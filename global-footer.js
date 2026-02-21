<script>
// THIS MAKES THE PROFILE AVATAR ICON BLACK
// Plans page CTA logic is handled in softr/plans-page.js to avoid duplicate wiring.
(function () {
  const BRAND_BLACK = "#000000";

  function initials() {
    const n =
      (window.logged_in_user?.softr_user_full_name ||
        window.logged_in_user?.softr_user_email ||
        "U").trim();
    if (!n) return "U";
    const parts = n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const a = (parts[0] || "")[0] || "";
    const b = (parts[parts.length - 1] || "")[0] || "";
    return (a + (b || parts[0]?.[1] || "")).toUpperCase();
  }

  function makeAvatar(bg = BRAND_BLACK, text = initials()) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="16" fill="${bg}"/>
        <text x="50%" y="50%" text-anchor="middle" alignment-baseline="central"
          font-family="system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif"
          font-weight="600" font-size="14" fill="#fff">
          ${text}
        </text>
      </svg>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }

  const BLACK_AVATAR = makeAvatar();

  // Override default Softr avatar
  try {
    window.logged_in_user.softr_user_default_avatar = BLACK_AVATAR;
  } catch {}

  // Swap in header after load
  function patchHeaderAvatar() {
    const header = document.querySelector("header");
    if (!header) return;
    header.querySelectorAll("img").forEach((img) => {
      const src = String(img.getAttribute("src") || "");
      if (src.startsWith("data:image/svg+xml")) {
        img.setAttribute("src", BLACK_AVATAR);
      }
    });
  }

  window.addEventListener("@softr/page-content-loaded", patchHeaderAvatar);
  new MutationObserver(patchHeaderAvatar).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
</script>

<script>
// --- global helper (used by Auth Wrapper and CWT pulse) ---
function __toEpochSeconds(v) {
  if (!v) return 0;
  return (typeof v === "string")
    ? Math.floor(Date.parse(v) / 1000)
    : Math.floor(Number(v));
}

function __decodeJWTPayload(token = "") {
  try {
    const [, payload] = String(token).split(".");
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (e) {
    console.warn("[auth] failed to decode JWT payload", e);
    return null;
  }
}
</script>

<script>
(function () {
  if (window.__U?.bootstrapped) return;
  window.__U = window.__U || {};
  window.__U.bootstrapped = true;

  const EMAIL = (window.logged_in_user?.softr_user_email || "").toLowerCase();
  const SOFTRID = ""; // leave blank or remove if you don't need it

  async function go() {
    const res = await fetch(
      "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap",
      {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
        body: JSON.stringify({
          email: EMAIL,
          include_progress: true,
          include_last_activity: true,
          probe_plan: false,
        }),
      }
    );

    const out = await res.json();
    if (!out?.ok) {
      console.error("[bootstrap]", out?.error);
      return;
    }

    const data = out.data;
window.__U.cwt = out.data?.cwt || out.cwt;
window.__U.cwt_email = EMAIL;
window.__U.cwt_expires_at = __toEpochSeconds(out.data?.cwt_expires_at || out.cwt_expires_at);
// no direct call here; the Auth Wrapper will schedule (and also auto-runs if CWT already set)


    window.__U.flags = data.flags;
    window.__U.profile = data.profile;
    window.__U.progress = data.dashboardProgress || [];
    window.__U.last = data.lastContext || null;
    window.__U.courseHints = data.courseHints || {};
    window.__U.entitlements = data.entitlements || out.entitlements || null;

    // Keep Softr's user object in sync with the authoritative profile
    // so inline checks like `logged_in_user.billing_plan_type` reflect
    // the latest plan values coming from Supabase/Profiles.
    try {
      const profile = data.profile || {};
      const u = window.logged_in_user || {};
      const planCode = profile.plan_code || u.plan_code || null;
      const planName = profile.plan_name || u.plan_name || null;
      if (planCode && !u.plan_code) u.plan_code = planCode;
      if (planName && !u.plan_name) u.plan_name = planName;
      if (!u.billing_plan_type) {
        u.billing_plan_type = profile.billing_plan_type || planCode || planName || null;
      }
      window.logged_in_user = u;
    } catch (e) {
      console.warn("[bootstrap] unable to sync Softr user plan fields", e);
    }


    sessionStorage.setItem("universio:flags", JSON.stringify(window.__U.flags || {}));
    sessionStorage.setItem("universio:profile", JSON.stringify(window.__U.profile || {}));
    sessionStorage.setItem("universio:progress", JSON.stringify(window.__U.progress || []));
    sessionStorage.setItem(
      "universio:entitlements",
      JSON.stringify(window.__U.entitlements || {})
    );
    if (window.__U.last)
      sessionStorage.setItem("universio:last", JSON.stringify(window.__U.last));

    window.dispatchEvent(
      new CustomEvent("universio:bootstrapped", { detail: window.__U })
    );
  }

  if ((window.logged_in_user?.softr_user_email || "").trim()) {
  go().catch((e) => console.error("[bootstrap] failed", e));
  }
})();
</script>

<script>
/** --- Global Universio Auth Wrapper --- **/
window.__U = window.__U || {};
let __refreshing = null;

function clearSessionCaches(reason = "") {
  try {
    const msg = reason ? `[auth] clearing session caches (${reason})` : "[auth] clearing session caches";
    console.debug(msg);
  } catch {}
  const KEYS = [
    "universio:flags",
    "universio:profile",
    "universio:progress",
    "universio:entitlements",
    "universio:last",
  ];
  KEYS.forEach((k) => {
    try { sessionStorage.removeItem(k); } catch {}
  });
}

// If Softr reports a different user than the cached token/profile, purge all caches up front
(() => {
  const softrEmail = (window.logged_in_user?.softr_user_email || window.logged_in_user?.email || "").toLowerCase();
  const cachedEmail = (window.__U?.cwt_email || "").toLowerCase();
  if (softrEmail && cachedEmail && softrEmail !== cachedEmail) {
    clearCachedCWT("softr user changed");
    clearSessionCaches("softr user changed");
  }
})();

function clearCachedCWT(reason = "") {
  const msg = reason ? `[auth] clearing cached CWT (${reason})` : "[auth] clearing cached CWT";
  try { console.debug(msg); } catch {}
  clearTimeout(window.__U._refreshTimer);
  window.__U.cwt = null;
  window.__U.cwt_email = "";
  window.__U.cwt_expires_at = 0;
  __refreshing = null;
}
window.clearCachedCWT = clearCachedCWT;
window.__U.clearCWT = clearCachedCWT;

function __currentEmail() {
  return (
    window.__U?.current_email ||
    window.logged_in_user?.softr_user_email ||
    window.logged_in_user?.email ||
    window.__U?.profile?.email ||
    ""
  ).toLowerCase();
}

/** Build auth headers for any edge call */
function authHeaders(init = {}) {
  const h = new Headers(init.headers || {});
  if (window.__U.cwt) {
    h.set("Authorization", `Bearer ${window.__U.cwt}`);
  }
  // optional: add reqId for log correlation
  h.set("X-Req-Id", crypto.randomUUID());
  return { ...init, headers: h, credentials: "omit" };
}

/** Call bootstrap edge to mint/refresh CWT */
async function refreshCWT(emailOverride = "", opts = {}) {
  const attempt = opts._attempt || 1;
  const EMAIL = (emailOverride || __currentEmail()).trim();
  if (!EMAIL) throw new Error("no email available for CWT refresh");
  console.debug("[auth] refreshing CWT for", EMAIL);
  const forceReset = !!(opts.forceReset || opts.retryOnMismatch || emailOverride);
  const body = { email: EMAIL };
  if (forceReset) body.force_reset = true;
  const res = await fetch("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap", {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    clearCachedCWT("bootstrap refresh failed");
    clearSessionCaches("bootstrap refresh failed");
    throw new Error("bootstrap refresh failed");
  }
  const out = await res.json();
  if (!out?.ok) {
    clearCachedCWT("bootstrap refresh error");
    clearSessionCaches("bootstrap refresh error");
    throw new Error(out?.error || "bootstrap refresh error");
  }
  const issued = out.data?.cwt;
  if (!issued) {
    clearCachedCWT("missing cwt from bootstrap");
    clearSessionCaches("missing cwt from bootstrap");
    throw new Error("missing cwt from bootstrap");
  }
  const payload = __decodeJWTPayload(issued);
  if (payload?.email && payload.email.toLowerCase() !== EMAIL.toLowerCase()) {
    clearCachedCWT("refreshCWT email mismatch");
    clearSessionCaches("refreshCWT email mismatch");
    if (opts.retryOnMismatch && attempt < 2) {
      return refreshCWT(EMAIL, { ...opts, _attempt: attempt + 1, forceReset: true });
    }
    throw new Error(`CWT email mismatch (wanted ${EMAIL}, got ${payload.email})`);
  }
  window.__U.cwt = issued;
  window.__U.cwt_email = EMAIL;
  window.__U.cwt_expires_at = __toEpochSeconds(out.data?.cwt_expires_at);
  scheduleProactiveRefresh();
}

/** Schedule proactive refresh ~150s before expiry */
function scheduleProactiveRefresh() {
  clearTimeout(window.__U._refreshTimer);
  if (!window.__U.cwt_expires_at) return;
  const ms = Math.max(
    0,
    window.__U.cwt_expires_at * 1000 - Date.now() - 150_000
  );
  window.__U._refreshTimer = setTimeout(() => {
    __refreshing = refreshCWT().finally(() => {
      __refreshing = null;
    });
  }, ms);
}

/** Ensure token exists and is not too close to expiry */
async function ensureFreshToken(emailOverride = "") {
  const EMAIL = (emailOverride || __currentEmail() || "").toLowerCase();
  const cachedEmail = (window.__U?.cwt_email || "").toLowerCase();
  if (EMAIL && cachedEmail && EMAIL !== cachedEmail) {
    clearCachedCWT("email mismatch");
    clearSessionCaches("email mismatch");
  }
  const now = Math.floor(Date.now() / 1000);
  if (!window.__U?.cwt || window.__U.cwt_expires_at - now <= 150) {
    __refreshing ??= refreshCWT(EMAIL).finally(() => {
      __refreshing = null;
    });
    await __refreshing;
  }
}

/** Main fetch wrapper: ensures valid CWT, retries once on 401 */
async function apiFetch(input, init = {}) {
  await ensureFreshToken();
  let res = await fetch(input, authHeaders(init));
  if (res.status === 401) {
    try {
      __refreshing ??= refreshCWT().finally(() => {
        __refreshing = null;
      });
      await __refreshing;
      res = await fetch(input, authHeaders(init));
    } catch (e) {
      alert("Session expired. Please reload the page.");
      throw e;
    }
  }
  return res;
}

/** Wire up initial bootstrap event */
window.addEventListener("universio:bootstrapped", () => {
  if (window.__U?.cwt) scheduleProactiveRefresh();
});
window.addEventListener("universio:logout", () => clearCachedCWT("universio:logout event"));
window.addEventListener("softr:logout", () => clearCachedCWT("softr:logout event"));
// In case bootstrap ran before this file loaded:
if (window.__U?.cwt && window.__U?.cwt_expires_at) scheduleProactiveRefresh();

</script>

<style id="um-footer-text-normalizer">
/* --- Universio.ai global footer normalization --- */

/* Run only when footer is rendered */
footer, [data-block-id*="home-footer"] {
  font-weight: 400 !important;
}

/* Explicitly target those 3 link labels (case-insensitive match) */
footer a,
[data-block-id*="home-footer"] a {
  font-weight: 400 !important;
}

/* Optionally: fine-grain control for specific labels */
footer a:where(:is([href*="mission-vision"], [href*="adaptive-personalized"], [href*="multilingual-accessible"])) {
  font-weight: 400 !important;
}
</style>

<script>
// Hide the Softr PWA download widget on every page except the homepage
(function () {
  if (window.location?.pathname === "/" || window.location?.pathname === "") {
    return;
  }

  function hideWidget(root = document) {
    root
      .querySelectorAll(
        ".progressier-widget-logo, .progressier-widget-icon"
      )
      .forEach((node) => {
        const target =
          node.closest(
            ".progressier-widget-icon, .progressier-widget-launcher, .progressier-widget-bubble, a, button"
          ) || node;

        target.style.setProperty("display", "none", "important");
        target.style.setProperty("visibility", "hidden", "important");
      });
  }

  hideWidget(document);

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          hideWidget(node);
        }
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>

<script>
/* Safety pass: re-apply footer normalization after Softr page load */
window.addEventListener("@softr/page-content-loaded", () => {
  document
    .querySelectorAll('footer a[href*="mission-vision"], footer a[href*="adaptive-personalized"], footer a[href*="multilingual-accessible"]')
    .forEach(el => el.style.fontWeight = "400");
});
</script>
<!-- Universio Global Start/Resume Button Injection -->
<script>
function normalizeTier(value){
  const s = (value || '').toString().trim().toLowerCase();
  if (s.includes('trial')) return 'pro';
  if (s.includes('free')) return 'free';
  if (s.includes('pro')) return 'pro';
  if (s.includes('plus')) return 'plus';
  if (s.includes('basic')) return 'basic';
  if (['basic','plus','pro','free'].includes(s)) return s;
  return 'free';
}

function resolveTierSignals() {
  const U = window.__U || {};
  const u = window.logged_in_user || {};
  const signals = {
    softr_plan_code: u.plan_code,
    softr_plan_name: u.plan_name,
    profile_plan_code: U.profile?.plan_code,
    profile_plan_name: U.profile?.plan_name,
  };

  const tierSource = signals.softr_plan_code || signals.softr_plan_name || '';
  const tier = normalizeTier(tierSource);

  return { tier, signals: { ...signals, tier_source: tierSource || 'free (default)' } };
}

(function () {
if (window.__umCtaScriptOnce) { return; }
window.__umCtaScriptOnce = true;

  // Enable verbose CTA tracing by default for this run; set window.__UM_DEBUG_CTA = false
  // before this script executes to silence.
  if (typeof window.__UM_DEBUG_CTA === 'undefined') {
    window.__UM_DEBUG_CTA = true;
  }

  // Softr course pages don't always have a URL that starts with the course code
  // (e.g., some use `/courses/C004/...`). Treat the presence of the UM marker
  // or any detectable course code in the URL as a signal to run the CTA logic.
  const hasMarker = !!document.getElementById('um-course');
  const pathHasCid = /C\d{3}/i.test((location.pathname || '').replace(/^\/+/, ''));
  if (!hasMarker && !pathHasCid) return;

  if (window.__umCourseGateInjected) return;
  window.__umCourseGateInjected = true;

  function readSessionJSON(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn(`[UM] failed to parse session cache for ${key}`, e);
      return null;
    }
  }

  // Hydrate cached bootstrap payload (progress/last/entitlements) for pages
  // that load before the edge call completes. This also helps when Softr
  // navigations reuse the same tab but skip the bootstrap call entirely.
  function hydrateCachedSession() {
    window.__U = window.__U || {};
    if (!window.__U.flags) window.__U.flags = readSessionJSON("universio:flags") || {};
    if (!window.__U.profile) window.__U.profile = readSessionJSON("universio:profile") || null;
    if (!Array.isArray(window.__U.progress)) {
      window.__U.progress = readSessionJSON("universio:progress") || [];
    }
    if (!window.__U.entitlements) {
      window.__U.entitlements = readSessionJSON("universio:entitlements") || null;
    }
    if (!window.__U.last) window.__U.last = readSessionJSON("universio:last") || null;
  }

  hydrateCachedSession();

  function up(x){ return (x||"").toString().trim().toUpperCase(); }

function getCourseId(){
  const pathCID = ((location.pathname.match(/C\d{3}/i)||[])[0] || '').toUpperCase();
  const m = document.querySelector('#um-course');
  const markerCID = ((m?.dataset?.course || m?.dataset?.graph) || '').toUpperCase();
  // Prefer URL; if marker disagrees, fix it.
  if (m && pathCID && markerCID !== pathCID) m.setAttribute('data-course', pathCID);
  return pathCID || markerCID || null;
}

function normalizeTier(value){
  const s = (value || '').toString().trim().toLowerCase();
  if (s.includes('trial')) return 'pro';
  if (s.includes('pro')) return 'pro';
  if (s.includes('plus')) return 'plus';
  if (s.includes('basic')) return 'basic';
  if (s.includes('free')) return 'free';
  if (['basic','plus','pro','free'].includes(s)) return s;
  return 'free';
}

const START_NODE = {
  C001:'ALP1', C002:'DF1',  C003:'HL1',  C004:'AP1',  C005:'EG1',
  C006:'ST1',  C007:'SQ1',  C008:'DV1',  C009:'GM1',  C010:'NC1',
  C011:'GC1',  C012:'RW1',  C013:'ESG1', C014:'FF1',  C015:'DT1'
};
const startUrlFor = cid => `/classroom?graph=${cid}${START_NODE[cid] ? `&node=${START_NODE[cid]}` : ''}`;
const normalizeUrl = u => {
  if (!u) return null;
  const raw = String(u).trim();
  if (!raw || raw === "null" || raw === "undefined") return null;
  try {
    const x = new URL(raw, location.origin);
    if (x.origin !== location.origin) return x.href;
    return x.pathname + x.search + x.hash;
  } catch {
    return null;
  }
};

function normalizeCourseId(id = "") {
  const trimmed = String(id || "").trim();
  const m = trimmed.match(/^C\d{3}/i);
  return m ? m[0].toUpperCase() : trimmed.toUpperCase();
}

function certEnrollmentForCourse(cid) {
  const normCid = normalizeCourseId(cid);
  if (!normCid) return null;
  const enrollments = Array.isArray(window.__U?.entitlements?.certificate_enrollments)
    ? window.__U.entitlements.certificate_enrollments
    : [];
  return enrollments.find((enr) => normalizeCourseId(enr?.cert_id || enr?.certId || enr?.course_id) === normCid) || null;
}

const CERT_URL_FIELD_ID = "SCmZJ";

function readEnrollmentCertUrl(enrollment) {
  if (!enrollment) return null;
  return enrollment?.cert_url || enrollment?.certUrl || enrollment?.[CERT_URL_FIELD_ID] || null;
}

function entCourseStats(ent = {}) {
  const stats = [];
  const courses = ent.courses || {};
  if (Array.isArray(courses.stats)) stats.push(...courses.stats);
  if (Array.isArray(courses.course_stats)) stats.push(...courses.course_stats);
  if (Array.isArray(ent.course_stats)) stats.push(...ent.course_stats);
  if (courses.stats_map && typeof courses.stats_map === "object") {
    stats.push(...Object.values(courses.stats_map));
  }
  if (courses.statsById && typeof courses.statsById === "object") {
    stats.push(...Object.values(courses.statsById));
  }
  if (courses.progress && Array.isArray(courses.progress)) stats.push(...courses.progress);
  if (courses.progress_map && typeof courses.progress_map === "object") {
    stats.push(...Object.values(courses.progress_map));
  }
  return stats;
}

function entCompletedCourses(ent = {}) {
  const courses = ent.courses || {};
  const lists = [
    courses.completed_courses,
    courses.completed,
    courses.finished_courses,
    ent.completed_courses,
  ];
  const out = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    list.map(normalizeCourseId).forEach((cid) => cid && out.add(cid));
  }
  return out;
}

function entResumeNode(ent = {}, cid) {
  const normCid = normalizeCourseId(cid);
  const courses = ent.courses || {};
  const node =
    courses.active_course_nodes?.[normCid] ||
    courses.resume_nodes?.[normCid] ||
    courses.active_nodes?.[normCid] ||
    courses.course_nodes?.[normCid] ||
    courses.last_nodes?.[normCid] ||
    null;
  return node ? String(node).toUpperCase() : null;
}

function domShowsCompletion() {
  const txt = (document.body?.innerText || "").toLowerCase();
  if (!txt) return false;
  return (
    txt.includes("course has been completed") ||
    txt.includes("this course has been completed") ||
    txt.includes("completed! view certificate")
  );
}

function pickNumeric(obj, keys, fallback = 0) {
  if (!obj) return fallback;
  for (const k of keys) {
    const raw = obj[k];
    if (typeof raw === "string") {
      const m = raw.match(/-?\d+(?:\.\d+)?/);
      if (m) {
        const n = Number(m[0]);
        if (!Number.isNaN(n)) return n;
      }
    }

    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function isTruthy(obj, keys) {
  if (!obj) return false;
  return keys.some((k) => !!obj[k]);
}

function isCourseCompleted(cid) {
  if (!cid) return false;
  const normCid = normalizeCourseId(cid);

  const certEvidence = analyzeCertEnrollments(normCid, getCachedCourseCertIds(normCid));
  if (certEvidence.completed) return true;

  const certEnrollment = certEnrollmentForCourse(normCid);
  if (certEnrollment) {
    const status = String(certEnrollment.status || certEnrollment.state || "").toLowerCase();
    const certUrl = readEnrollmentCertUrl(certEnrollment);
    const hasCertUrl = typeof certUrl === "string" && certUrl.trim();
    if (status === "completed" || status === "complete" || hasCertUrl) {
      return true;
    }
  }

  const progress = Array.isArray(window.__U?.progress) ? window.__U.progress : [];
  const progHit = progress.find((p) => normalizeCourseId(p.course_id) === normCid);
  if (progHit) {
    const percent = pickNumeric(progHit, ["percent_complete", "percentComplete", "completion_percent", "progress_percent", "progressPercent"]);
    if (
      isTruthy(progHit, ["completed", "completed_at", "completedAt", "completion_date", "completionDate", "is_complete", "isComplete"]) ||
      percent >= 100 ||
      String(progHit?.status || progHit?.state || "").toLowerCase() === "completed"
    ) {
      return true;
    }
  }

  const stats = Array.isArray(window.__U?.entitlements?.courses?.stats)
    ? window.__U.entitlements.courses.stats
    : [];
  const extraStats = entCourseStats(window.__U?.entitlements || {});
  const allStats = stats.concat(extraStats);
  const statHit = allStats.find((s) => normalizeCourseId(s.course_id) === normCid);
  if (statHit) {
    const percent = pickNumeric(statHit, ["percent_complete", "percentComplete", "completion_percent", "progress_percent", "progressPercent"]);
    if (
      percent >= 100 ||
      isTruthy(statHit, ["completed", "completed_at", "completedAt", "is_complete", "isComplete"]) ||
      String(statHit?.status || statHit?.state || "").toLowerCase() === "completed"
    ) {
      return true;
    }
  }

  const completedList = entCompletedCourses(window.__U?.entitlements || {});
  if (completedList.has(normCid)) return true;

  if (domShowsCompletion()) return true;

  return false;
}

function getCourseStartHint(cid) {
  const normCid = normalizeCourseId(cid);
  const hints = window.__U?.courseHints || {};
  const progress = Array.isArray(window.__U?.progress) ? window.__U.progress : [];
  const stats = Array.isArray(window.__U?.entitlements?.courses?.stats)
    ? window.__U.entitlements.courses.stats
    : [];
  const entStats = entCourseStats(window.__U?.entitlements || {});
  const last = window.__U?.last || null;
  const ent = window.__U?.entitlements || {};
  const activeCourses = new Set((ent.courses?.active_courses || []).map(normalizeCourseId));
  const entNode = entResumeNode(ent, normCid);
  const certEnrollment = certEnrollmentForCourse(normCid);
  const cachedCertIds = getCachedCourseCertIds(normCid);
  const certEvidence = analyzeCertEnrollments(normCid, cachedCertIds);

  const resumeFromEntNode = entNode
    ? `/classroom?graph=${normCid}&node=${entNode}`
    : null;

  const hint = hints[normCid] || null;
  const progHit = progress.find((p) => normalizeCourseId(p.course_id) === normCid);
  const progPercent = pickNumeric(progHit, ["percent_complete", "percentComplete", "completion_percent", "progress_percent", "progressPercent"]);
  const startedFromProgress = !!progHit && (
    progHit.started ||
    progPercent > 0 ||
    isTruthy(progHit, ["started_at", "startedAt", "last_viewed_at", "lastViewedAt", "last_activity_at", "lastActivityAt"]) ||
    String(progHit?.status || progHit?.state || "").toLowerCase() === "in_progress"
  );

  const statHit = stats.concat(entStats).find((s) => normalizeCourseId(s.course_id) === normCid);
  const statPercent = pickNumeric(statHit, ["percent_complete", "percentComplete", "completion_percent", "progress_percent", "progressPercent"]);
  const startedFromStats = !!statHit && (
    statPercent > 0 ||
    isTruthy(statHit, ["started", "started_at", "startedAt"]) ||
    String(statHit?.status || statHit?.state || "").toLowerCase() === "in_progress"
  );

  const lastMatch = last && normalizeCourseId(last.course_id || last.graphId) === normCid;
  const resumeFromLast = lastMatch
    ? `/classroom?graph=${normCid}&node=${(last.node_id || last.nodeId || "").toString().toUpperCase()}`
    : null;

  const enrollmentStatus = String(certEnrollment?.status || certEnrollment?.state || "").toLowerCase();
  const enrollmentShowsProgress = enrollmentStatus === 'in progress' || enrollmentStatus === 'started';

  const alreadyStarted = !!(
    hint?.alreadyStarted ||
    startedFromProgress ||
    startedFromStats ||
    lastMatch ||
    activeCourses.has(normCid) ||
    enrollmentShowsProgress ||
    certEvidence.started ||
    certEvidence.completed
  );
  const resumeUrl = normalizeUrl(
    hint?.resumeUrl ||
      resumeFromEntNode ||
      resumeFromLast ||
      startUrlFor(normCid)
  );

  const evidence = {
    hint: !!hint,
    progHit: !!progHit,
    statHit: !!statHit,
    lastMatch: !!lastMatch,
    entNode: !!entNode,
    activeCourse: activeCourses.has(normCid),
    certEnrollment: !!certEnrollment,
    certEvidence,
  };

  if (window.__UM_DEBUG_CTA) {
    const snapshot = JSON.stringify({ cid: normCid, evidence, alreadyStarted, resumeUrl });
    if (snapshot !== LAST_START_LOG) {
      LAST_START_LOG = snapshot;
      console.debug("[UM] start hint signals", {
        cid: normCid,
        hint,
        progHit,
        progPercent,
        statHit,
        statPercent,
        last,
        entNode,
        evidence,
        alreadyStarted,
        resumeUrl,
      });
    }
  }

  return { alreadyStarted, resumeUrl, evidence };
}

const CERT_LINK_CACHE = new Map();
const COURSE_CERT_IDS = new Map();
const BOOTSTRAP_URL = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap";

function normalizeCertId(id = "") {
  return String(id || "").trim().toUpperCase();
}

function pickEnrollmentCertUrl(certIds = []) {
  const enrollments = Array.isArray(window.__U?.entitlements?.certificate_enrollments)
    ? window.__U.entitlements.certificate_enrollments
    : [];
  const targets = new Set(certIds.map((id) => normalizeCourseId(id)));

  for (const enr of enrollments) {
    const cid = normalizeCourseId(enr?.cert_id || enr?.certId || "");
    if (!cid || !targets.has(cid)) continue;
    const url = readEnrollmentCertUrl(enr);
    if (typeof url === "string" && url.trim()) return url;
  }

  return null;
}

function analyzeCertEnrollments(cid, certIds = []) {
  const enrollments = Array.isArray(window.__U?.entitlements?.certificate_enrollments)
    ? window.__U.entitlements.certificate_enrollments
    : [];
  const targets = new Set([normalizeCourseId(cid), ...certIds.map(normalizeCertId)]);

  let bestUrl = null;
  let started = false;
  let completed = false;

  for (const enr of enrollments) {
    const eid = normalizeCertId(enr?.cert_id || enr?.certId || enr?.course_id || "");
    if (!eid || (!targets.has(eid) && !targets.has(normalizeCourseId(eid)))) continue;

    const status = String(enr?.status || enr?.state || "").toLowerCase();
    const certUrl = readEnrollmentCertUrl(enr);
    const hasUrl = typeof certUrl === "string" && certUrl.trim();
    const completedFlag =
      status.includes("redeemed") ||
      status.includes("issued") ||
      status.includes("earned") ||
      Number(enr?.completed) === 1 ||
      !!hasUrl;
    const startedFlag =
      completedFlag ||
      status.includes("progress") ||
      status.includes("in progress") ||
      status.includes("started") ||
      status.includes("active") ||
      Number(enr?.in_progress) === 1;

    started = started || startedFlag;
    completed = completed || completedFlag;
    bestUrl = hasUrl || bestUrl;
  }

  return { started, completed, certUrl: bestUrl };
}

function hydrateCachedCourseCertIds() {
  try {
    const raw = sessionStorage.getItem('universio:courseCertIds');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    Object.entries(parsed).forEach(([k, v]) => {
      const cid = normalizeCourseId(k);
      if (cid && Array.isArray(v)) {
        COURSE_CERT_IDS.set(cid, v.map(normalizeCertId));
      }
    });
  } catch {}
}
hydrateCachedCourseCertIds();

function persistCourseCertIds() {
  const obj = {};
  COURSE_CERT_IDS.forEach((val, key) => {
    const arr = Array.isArray(val) ? val : val && val.then ? null : [];
    if (arr && arr.length) obj[key] = arr;
  });
  try {
    sessionStorage.setItem('universio:courseCertIds', JSON.stringify(obj));
  } catch {}
}

function getCachedCourseCertIds(cid) {
  const normCid = normalizeCourseId(cid);
  const val = COURSE_CERT_IDS.get(normCid);
  if (Array.isArray(val)) return val;
  return [];
}

function fetchCourseCertIds(cid) {
  const normCid = normalizeCourseId(cid);
  if (!normCid) return Promise.resolve([]);

  const cached = COURSE_CERT_IDS.get(normCid);
  if (cached) {
    return cached.then ? cached : Promise.resolve(cached);
  }

  const promise = (async () => {
    let certIds = [];
    try {
      await ensureFreshToken();
      const res = await apiFetch(BOOTSTRAP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: __currentEmail(),
          mode: "cert-map",
          course_id: normCid,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        const certs = Array.isArray(json?.data?.certificates)
          ? json.data.certificates
          : json?.certificates || [];
        certIds = certs
          .map((c) => c?.business_id || c?.cert_id || c?.certId || c?.id || null)
          .filter(Boolean)
          .map(normalizeCertId);
      }
    } catch (err) {
      console.warn("[UM] cert map fetch failed", err);
    }

    COURSE_CERT_IDS.set(normCid, certIds);
    persistCourseCertIds();
    return certIds;
  })();

  COURSE_CERT_IDS.set(normCid, promise);
  return promise;
}

async function resolveCourseCertificateUrl(cid) {
  const normCid = normalizeCourseId(cid);
  if (!normCid) return null;
  if (CERT_LINK_CACHE.has(normCid)) return CERT_LINK_CACHE.get(normCid);

  const promise = (async () => {
    const certIds = await fetchCourseCertIds(normCid).catch(() => []);
    const normalizedIds = Array.isArray(certIds) ? certIds.map(normalizeCertId) : [];

    const enrolledUrl = pickEnrollmentCertUrl(normalizedIds.length ? normalizedIds : [normCid]);
    if (enrolledUrl) return enrolledUrl;

    return null;
  })();

  CERT_LINK_CACHE.set(normCid, promise);
  return promise;
}

let CTA_BTN = null;
let CTA_WRAPPER = null;
let CTAPlacementBound = false;
let CTADomObserver = null;
let CTA_MSG = null;
let CTACompletionObserver = null;
let CTACompletionFired = false;
let LAST_START_LOG = '';
let LAST_DECISION_LOG = '';
let LAST_AWAIT_LOG = -1;
let CTA_BOOTSTRAP_PROMISE = null;

function logDecision(payload) {
  if (!window.__UM_DEBUG_CTA) return;
  const snapshot = JSON.stringify(payload);
  if (snapshot === LAST_DECISION_LOG) return;
  LAST_DECISION_LOG = snapshot;
  console.debug('[UM] CTA decision', payload);
}

function ensureBtn() {
  if (CTA_BTN) return CTA_BTN;

  const wrapper = document.createElement('div');
  wrapper.id = 'um-start-btn-wrapper';
  Object.assign(wrapper.style, {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '24px 16px 0',
  });

  const btn = document.createElement('button');
  btn.id = 'um-start-btn';
  btn.type = 'button';
  btn.dataset.state = 'loading';
  btn.setAttribute('aria-live', 'polite');
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = 'Loading…';
  btn.disabled = true;

  btn.style.setProperty('display', 'inline-flex', 'important');
  Object.assign(btn.style, {
    background: '#000',
    color: '#fff',
    fontFamily: 'system-ui, Inter, sans-serif',
    fontWeight: '600',
    fontSize: '14px',
    padding: '10px 34px',
    borderRadius: '24px',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
    border: 'none',
    gap: '8px',
    opacity: '0.7',
  });

  btn.onmouseover = () => {
    if (btn.dataset.state === 'ready') {
      btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.18)';
    }
  };
  btn.onmouseout = () => {
    btn.style.boxShadow = '0 3px 8px rgba(0,0,0,0.15)';
  };

  const msg = document.createElement('div');
  msg.id = 'um-start-msg';
  Object.assign(msg.style, {
    fontFamily: 'system-ui, Inter, sans-serif',
    fontSize: '13px',
    color: '#333',
    textAlign: 'center',
    marginTop: '10px',
    maxWidth: '520px',
    lineHeight: '1.5',
    display: 'none',
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(msg);
  CTA_WRAPPER = wrapper;
  CTA_BTN = btn;
  CTA_MSG = msg;

  const main = document.querySelector('main');
  (main || document.body).appendChild(wrapper);
  window.__umCTAInjected = true;
  bindPlacementListeners();
  requestAnimationFrame(placeBtnWrapper);
  return btn;
}

function bindPlacementListeners() {
  if (CTAPlacementBound) return;
  CTAPlacementBound = true;
  if ('MutationObserver' in window && !CTADomObserver) {
    CTADomObserver = new MutationObserver(() => placeBtnWrapper());
    CTADomObserver.observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('resize', placeBtnWrapper, { passive: true });
}

function findCourseContainer() {
  const cid = getCourseId();

  const host = document.getElementById('um-course-cta-host');
  if (host) return { el: host, mode: 'host' };

  // Prefer Softr's own CTA placeholder so we stay anchored where the
  // platform would normally render the button (typically near the bottom
  // of the course card/section).
  const ctaLinks = Array.from(
    document.querySelectorAll('a[href*="/classroom?graph="]')
  ).filter((a) => a instanceof HTMLElement);

  let placeholder = null;
  if (ctaLinks.length) {
    // Pick the last matching link for the current course id if present;
    // otherwise fall back to the last CTA link on the page.
    const courseMatches = cid
      ? ctaLinks.filter((a) =>
          normalizeCourseId((a.getAttribute('href') || '').split('graph=')[1]) === cid
        )
      : [];
    placeholder = (courseMatches[courseMatches.length - 1] || ctaLinks[ctaLinks.length - 1]) || null;
  }

  if (placeholder) return { el: placeholder, mode: 'after-link' };

  const selectors = [
    '.softr-grid-container',
    '[data-block-id*="course"] div[role="list"]',
    '[data-block-id*="course"]',
    'main [role="list"]',
  ];

  const candidates = selectors
    .flatMap((sel) => Array.from(document.querySelectorAll(sel)))
    .filter((el) => el instanceof HTMLElement && el.offsetParent !== null);

  if (!candidates.length) return null;

  let best = candidates[0];
  let bestBottom = best.getBoundingClientRect().bottom;
  for (let i = 1; i < candidates.length; i++) {
    const rect = candidates[i].getBoundingClientRect();
    if (rect.bottom > bestBottom) {
      best = candidates[i];
      bestBottom = rect.bottom;
    }
  }
  return { el: best, mode: 'after' };
}

function placeBtnWrapper() {
  const wrapper = CTA_WRAPPER;
  if (!wrapper) return;

  const targetInfo = findCourseContainer();
  const target = targetInfo?.el || null;
  const fallbackParent = document.querySelector('main') || document.body;

  if (!target || !target.parentNode) {
    if (wrapper.parentNode !== fallbackParent) {
      fallbackParent.appendChild(wrapper);
    }
    return;
  }

  if (targetInfo?.mode === 'host') {
    if (wrapper.parentNode !== target) {
      target.innerHTML = '';
      target.appendChild(wrapper);
    }
    return;
  }

  const parent = target.parentNode;
  if (wrapper.previousElementSibling === target && wrapper.parentNode === parent) {
    return;
  }

  const mode = targetInfo?.mode || 'after';
  if (mode === 'after-link') {
    // Keep the existing container contents intact and simply inject after the
    // hidden Softr CTA anchor so layout stays where the platform placed it.
    target.insertAdjacentElement('afterend', wrapper);
    return;
  }

  target.insertAdjacentElement('afterend', wrapper);
}

function setLoadingState(btn, label = 'Loading…') {
  btn.dataset.state = 'loading';
  btn.textContent = label;
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  btn.style.cursor = 'default';
  btn.style.opacity = '0.7';
  btn.onclick = null;
  setMessage('');
}

function setReadyState(btn, label, resumeUrl) {
  btn.dataset.state = 'ready';
  btn.textContent = label;
  btn.setAttribute('aria-busy', 'false');
  btn.disabled = false;
  btn.style.cursor = 'pointer';
  btn.style.opacity = '1';
  btn.onclick = () => (location.href = resumeUrl);
  setMessage('');
}

function setBlockedState(btn, label, onClick, message = '') {
  btn.dataset.state = 'blocked';
  btn.textContent = label;
  btn.setAttribute('aria-busy', 'false');
  btn.disabled = !onClick;
  btn.style.cursor = onClick ? 'pointer' : 'not-allowed';
  btn.style.opacity = '1';
  btn.onclick = onClick || null;
  setMessage(message);
}

function setMessage(text = '') {
  const msg = CTA_MSG || CTA_WRAPPER?.querySelector?.('#um-start-msg');
  if (!msg) return;
  const clean = (text || '').trim();
  msg.textContent = clean;
  msg.style.display = clean ? 'block' : 'none';
}

setLoadingState(ensureBtn());

function handleCompletion(cid, resolvedUrl = null) {
  const btn = ensureBtn();
  setBlockedState(btn, "Completed", null);
  placeBtnWrapper();
}

function ensureCompletionWatcher(cid) {
  if (CTACompletionObserver || CTACompletionFired) return;
  CTACompletionObserver = new MutationObserver(() => {
    if (CTACompletionFired) return;
    if (!domShowsCompletion()) return;
    CTACompletionFired = true;
    CTACompletionObserver.disconnect();
    CTACompletionObserver = null;
    handleCompletion(cid);
  });
  CTACompletionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function injectBtn(attempt = 0, maxAttempts = 1) {
  const btn = ensureBtn();
  const cid = getCourseId();
  if (!cid) {
    setLoadingState(btn);
    return false;
  }

  ensureCompletionWatcher(cid);

  const U = window.__U || {};
  const ent = U.entitlements;
  if (!ent) {
    if (domShowsCompletion()) {
      CTACompletionFired = true;
      handleCompletion(cid);
      return true;
    }
    setLoadingState(btn);
    return false;
  }

  const startHint = getCourseStartHint(cid);
  const completionDetected = isCourseCompleted(cid);
  const certEvidence = analyzeCertEnrollments(cid, getCachedCourseCertIds(cid));

  if (completionDetected || certEvidence.completed) {
    CTACompletionFired = true;
    handleCompletion(cid, certEvidence.certUrl || null);
    return true;
  }

  const BASE_FREE_ALLOWED = ['C001','C002','C003'];
  const { tier, signals } = resolveTierSignals();
  const freeAllowedRaw = Array.isArray(ent.courses?.free_allowed)
    ? ent.courses.free_allowed
    : BASE_FREE_ALLOWED;
  const freeAllowedList = freeAllowedRaw.length ? freeAllowedRaw : BASE_FREE_ALLOWED;
  const freeAllowed = new Set(
    freeAllowedList
      .map(up)
      .filter((id)=>BASE_FREE_ALLOWED.includes(id))
  );
  const activeCourses = new Set(ent.courses?.active_courses || []);
  const isActive = activeCourses.has(cid);
  const activeSlots = Number(ent.courses?.active_slots || 0);
  const activeRemaining = Number(ent.courses?.active_slots_remaining ?? 0);
  const swapTarget = ent.courses?.will_swap_out || null;

  if (tier === 'free' && !freeAllowed.has(cid)) {
    setBlockedState(
      btn,
      'Unavailable',
      null,
      'Free includes C001–C003 only. Upgrade to access full courses.'
    );
    placeBtnWrapper();
    logDecision({ cid, tier, reason: 'free-blocked', signals, freeAllowed: [...freeAllowed] });
    return true;
  }

  if (tier !== 'free' && activeSlots > 0 && !isActive && activeRemaining <= 0) {
    const message = swapTarget
      ? `You’re at your course limit. Finish or swap out ${swapTarget} to start this course.`
      : 'You’re at your course limit. Finish one course to start another.';
    setBlockedState(btn, 'Course limit reached', () => (location.href = '/dashboard'), message);
    placeBtnWrapper();
    return true;
  }

  const already = !!(startHint.alreadyStarted || certEvidence.started);
  const label = already ? 'Resume' : 'Start';
  const hasEvidence =
    Object.values(startHint.evidence || {}).some(Boolean) ||
    certEvidence.started ||
    certEvidence.completed;

  setReadyState(btn, label, startHint.resumeUrl);
  placeBtnWrapper();
  logDecision({
    cid,
    tier,
    label,
    resumeUrl: startHint.resumeUrl,
    signals,
    freeAllowed: [...freeAllowed],
    already,
    certEvidence,
  });

  const settled =
    completionDetected ||
    already ||
    hasEvidence ||
    tier === 'free' ||
    attempt >= maxAttempts;

  if (!settled && window.__UM_DEBUG_CTA && LAST_AWAIT_LOG < 0) {
    LAST_AWAIT_LOG = attempt;
    console.debug('[UM] CTA awaiting signals', { cid, attempt, maxAttempts });
  }

  if (!settled) {
    fetchCourseCertIds(cid)
      .then((ids) => analyzeCertEnrollments(cid, Array.isArray(ids) ? ids : []))
      .then((extra) => {
        if (!extra) return;
        if (extra.completed && !CTACompletionFired) {
          CTACompletionFired = true;
          handleCompletion(cid, extra.certUrl || null);
          return;
        }
        if (!already && (extra.started || extra.completed)) {
          setReadyState(btn, 'Resume', startHint.resumeUrl);
          placeBtnWrapper();
          logDecision({
            cid,
            tier,
            label: 'Resume',
            resumeUrl: startHint.resumeUrl,
            signals,
            freeAllowed: [...freeAllowed],
            already: true,
            certEvidence: extra,
          });
        }
      })
      .catch(() => {});
  }

  return settled;

}
function ensureFreshBootstrap() {
  if (CTA_BOOTSTRAP_PROMISE) return CTA_BOOTSTRAP_PROMISE;

  const email = (window.logged_in_user?.softr_user_email || '').toLowerCase();
  if (!email) return null;

  CTA_BOOTSTRAP_PROMISE = fetch(BOOTSTRAP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      include_progress: true,
      include_last_activity: true,
      probe_plan: false,
    }),
  })
    .then((r) => r.json())
    .then((out) => {
      if (!out?.ok) return null;
      const data = out.data || {};
      window.__U = window.__U || {};
      window.__U.flags = data.flags || window.__U.flags || {};
      window.__U.profile = data.profile || window.__U.profile || null;
      window.__U.progress = data.dashboardProgress || window.__U.progress || [];
      window.__U.last = data.lastContext || window.__U.last || null;
      window.__U.courseHints = data.courseHints || window.__U.courseHints || {};
      window.__U.entitlements = data.entitlements || out.entitlements || window.__U.entitlements || null;
      sessionStorage.setItem('universio:progress', JSON.stringify(window.__U.progress || []));
      sessionStorage.setItem('universio:entitlements', JSON.stringify(window.__U.entitlements || {}));
      if (window.__UM_DEBUG_CTA) console.debug('[UM] CTA bootstrap refresh', { email });
      return window.__U;
    })
    .catch(() => null);

  return CTA_BOOTSTRAP_PROMISE;
}
function watchAndInject(){
  let attempts = 0;
  const MAX_ATTEMPTS = 15;
  const observer=new MutationObserver(()=>injectBtn(++attempts, MAX_ATTEMPTS)&&observer.disconnect());
  observer.observe(document.body,{childList:true,subtree:true});

  const interval = setInterval(() => {
    if (injectBtn(++attempts, MAX_ATTEMPTS)) {
      observer.disconnect();
      clearInterval(interval);
    }
    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(interval);
    }
  }, 600);

  const settled = injectBtn(attempts, MAX_ATTEMPTS);
  if (!settled) {
    const needsBootstrap = !window.__U?.entitlements;
    const needsEvidence = !needsBootstrap && !isCourseCompleted(getCourseId()) && !getCourseStartHint(getCourseId()).alreadyStarted;
    if (needsBootstrap || needsEvidence) {
      ensureFreshBootstrap()?.then(() => injectBtn(++attempts, MAX_ATTEMPTS));
    }
  }
  settled && observer.disconnect();
}

  if(window.__U?.entitlements) watchAndInject();
  else window.addEventListener("universio:bootstrapped", watchAndInject, { once: true });
})();
</script>



<script>
(function(){
  if (window.__umModuleGateInjected) return; window.__umModuleGateInjected = true;

  function up(x){ return (x||"").toString().trim().toUpperCase(); }
  function mark(){ return document.querySelector('#um-node'); }

  function courseId(){
    const mk = mark(); const d=mk?.dataset||{};
    const cid = d.course || d.graph; if (cid) return up(cid);
    const m = location.pathname.match(/C\d{3}/i); return m? up(m[0]) : null;
  }

  function nodeIndex(){
    const mk = mark(); const raw = (mk?.dataset?.node)||'';
    const fromAttr = (raw.match(/(\d{1,2})/)||[])[1];
    if (fromAttr) return +fromAttr;
    const m1 = location.pathname.match(/module[-_/]?(\d{1,2})/i);
    if (m1) return +m1[1];
    const m2 = location.pathname.match(/[A-Z]{1,3}(\d{1,2})$/i);
    if (m2) return +m2[1];
    return null;
  }

  function lock(msg){
    if (document.getElementById('um-lock')) return;
    const p = document.createElement('div'); p.id='um-lock';
    Object.assign(p.style,{position:'fixed',inset:'0',background:'rgba(255,255,255,0.96)',zIndex:'9999',display:'grid',placeItems:'center',padding:'24px'});
    p.innerHTML = `<div style="max-width:720px;text-align:center">
      <div style="font-size:24px;font-weight:700;margin-bottom:10px;">Course Locked</div>
      <div style="font-size:16px;line-height:1.6;margin-bottom:18px;">${msg}</div>
      <a href="/plans" class="sw-btn sw-btn--primary" style="padding:12px 18px;border-radius:24px;font-weight:600;">Upgrade</a>
      <a href="/dashboard" style="display:block;margin-top:12px;text-decoration:underline">Back to dashboard</a>
    </div>`;
    document.body.appendChild(p);
  }

  function gate(){
    const U = window.__U||{}; const ent = U.entitlements; if (!ent) return;
    const FALLBACK_FREE_ALLOWED = ['C001','C002','C003'];
    const { tier, signals } = resolveTierSignals();
    if (tier !== 'free') return;

    const cid = courseId(); if (!cid) return;
    const freeAllowedRaw = Array.isArray(ent.courses?.free_allowed)
      ? ent.courses.free_allowed
      : FALLBACK_FREE_ALLOWED;
    const freeAllowedList = freeAllowedRaw.length ? freeAllowedRaw : FALLBACK_FREE_ALLOWED;
    const allowed = new Set(
      freeAllowedList
        .map(up)
        .filter((id)=>FALLBACK_FREE_ALLOWED.includes(id))
    );
    if (!allowed.has(cid)) {
      console.debug('[UM] Module gate decision', { cid, tier, reason: 'free-blocked', signals, allowed: [...allowed] });
      lock(`Free includes C001–C003 only. <code>${cid}</code> is a non-free course.`); return; }

    const limit = +ent.courses?.free_module_limit || 3;
    const idx = nodeIndex(); if (idx == null) return;
    if (idx > limit) {
      console.debug('[UM] Module gate decision', { cid, tier, reason: 'module-limit', limit, idx, signals });
      lock(`Your plan allows the first ${limit} modules. You’re on module ${idx}.`);
    } else {
      console.debug('[UM] Module gate decision', { cid, tier, reason: 'allowed', limit, idx, signals, allowed: [...allowed] });
    }
  }

  if (window.__U?.entitlements) gate(); else window.addEventListener('universio:bootstrapped', gate, { once:true });
})();
;
</script>

<script>
(function () {
  if (window.__umEnrollPopupInjected) return;
  window.__umEnrollPopupInjected = true;

  const CERT_HINT = "Certificate";
  const PENDING_KEY = "universio:enrollPopupPendingCert";
  const CERT_NAME_MAP = {
    "ai for k-12 educators": "CR3-001",
  };
  const MODAL_ID = "um-enroll-modal";
  const BACKDROP_ID = "um-enroll-backdrop";
  let lastFocused = null;
  let lastAnchor = null;
  let lastCertKey = null;
  let isModalOpen = false;

  function normalize(text) {
    return (text || "").toLowerCase();
  }

  function elementMatchesCertificate(el) {
    if (!el) return false;
    const text = normalize(el.innerText || el.textContent || "");
    return text.includes(normalize(CERT_HINT));
  }

  function findCertificateCardFromAnchor(anchorEl) {
    let node = anchorEl;
    while (node && node !== document.body) {
      if (elementMatchesCertificate(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function findCertificateCardAnywhere() {
    const nodes = Array.from(document.querySelectorAll("section, article, div"));
    return nodes.find(elementMatchesCertificate) || null;
  }

  function slugify(text) {
    return normalize(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  function resolveCertKeyFromCard(card) {
    if (!card) return "CERT:UNKNOWN";
    const text = normalize(card.innerText || card.textContent || "");
    const idMatch = text.match(/cr\d-\d{3}/i);
    if (idMatch) return idMatch[0].toUpperCase();
    for (const [needle, certId] of Object.entries(CERT_NAME_MAP)) {
      if (text.includes(needle)) return certId;
    }
    const heading =
      card.querySelector("h1, h2, h3, h4, h5, [data-title], [data-name]")?.innerText ||
      "";
    const fallback = heading || text.slice(0, 80);
    return fallback ? `CERT:${slugify(fallback)}` : "CERT:UNKNOWN";
  }

  function scrollAndHighlightCertificateCard() {
    const directCard = lastAnchor ? findCertificateCardFromAnchor(lastAnchor) : null;
    const target = directCard || findCertificateCardAnywhere();
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("um-cert-highlight");
    window.setTimeout(() => {
      target.classList.remove("um-cert-highlight");
    }, 1500);
  }

  function injectModalOnce() {
    if (document.getElementById(MODAL_ID)) return;

    const style = document.createElement("style");
    style.id = "um-enroll-modal-styles";
    style.textContent = `
      body.um-modal-open { overflow: hidden; }
      .um-enroll-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        z-index: 99999;
        transition: opacity 160ms ease;
      }
      .um-enroll-backdrop.is-visible {
        opacity: 1;
        pointer-events: auto;
      }
      .um-enroll-modal {
        background: #ffffff;
        color: #111111;
        width: min(420px, 92vw);
        border-radius: 18px;
        padding: 18px 20px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
        font-family: system-ui, -apple-system, Segoe UI, Inter, Roboto, Arial, sans-serif;
      }
      .um-enroll-modal__title {
        font-size: 16px;
        font-weight: 700;
        margin: 0 0 8px;
      }
      .um-enroll-modal__body {
        font-size: 13.5px;
        line-height: 1.45;
        margin: 0 0 16px;
      }
      .um-enroll-modal__actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .um-enroll-btn {
        border: 1px solid #111111;
        border-radius: 999px;
        padding: 9px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        background: #ffffff;
        color: #111111;
        text-decoration: none;
      }
      .um-enroll-btn--primary {
        background: #111111;
        color: #ffffff;
      }
      .um-enroll-btn--link {
        border: none;
        padding: 0;
        background: transparent;
        text-decoration: underline;
        font-weight: 500;
      }
      .um-enroll-modal__close {
        position: absolute;
        top: 10px;
        right: 12px;
        border: none;
        background: transparent;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }
      .um-enroll-modal__container {
        position: relative;
      }
      .um-cert-highlight {
        box-shadow: 0 0 0 3px #000000, 0 0 18px rgba(0, 0, 0, 0.35);
        transition: box-shadow 200ms ease;
      }
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.className = "um-enroll-backdrop";
    backdrop.innerHTML = `
      <div class="um-enroll-modal um-enroll-modal__container" id="${MODAL_ID}" role="dialog" aria-modal="true" aria-labelledby="um-enroll-title" tabindex="-1">
        <button class="um-enroll-modal__close" aria-label="Close" data-um-close>×</button>
        <h2 class="um-enroll-modal__title" id="um-enroll-title">You’re enrolled!</h2>
        <p class="um-enroll-modal__body">
          You’re all set. To get started, select any microcourse included in this certificate.
          You can also return to your Dashboard at any time to continue from the certificate card.
          Explore each microcourse to see details before starting.
        </p>
        <div class="um-enroll-modal__actions">
          <button class="um-enroll-btn um-enroll-btn--primary" data-um-start>Start a microcourse</button>
          <button class="um-enroll-btn" data-um-dashboard>Go to Dashboard</button>
          <button class="um-enroll-btn um-enroll-btn--link" data-um-explore>Explore microcourses</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeEnrollModal();
      }
    });

    const closeButton = backdrop.querySelector("[data-um-close]");
    const startButton = backdrop.querySelector("[data-um-start]");
    const dashboardButton = backdrop.querySelector("[data-um-dashboard]");
    const exploreButton = backdrop.querySelector("[data-um-explore]");

    closeButton?.addEventListener("click", closeEnrollModal);
    startButton?.addEventListener("click", () => {
      closeEnrollModal();
      scrollAndHighlightCertificateCard();
    });
    dashboardButton?.addEventListener("click", () => {
      window.location.href = "/dashboard";
    });
    exploreButton?.addEventListener("click", () => {
      window.location.href = "https://www.universio.ai/microcourses";
    });
  }

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const focusable = getFocusableElements(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEnrollModal();
      return;
    }
    trapFocus(event);
  }

  function openEnrollModal({ anchorEl, certKey } = {}) {
    if (isModalOpen) return;
    injectModalOnce();
    const backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) return;
    lastAnchor = anchorEl || lastAnchor;
    lastCertKey = certKey || lastCertKey;
    lastFocused = document.activeElement;
    backdrop.classList.add("is-visible");
    document.body.classList.add("um-modal-open");
    isModalOpen = true;
    const modal = document.getElementById(MODAL_ID);
    const focusTarget = modal?.querySelector("[data-um-close]") || modal;
    window.setTimeout(() => {
      focusTarget?.focus();
    }, 0);
    document.addEventListener("keydown", handleKeydown);
    window.gtag?.("event", "cert_enroll_popup_shown", {
      cert_id: lastCertKey || "unknown",
    });
  }

  function closeEnrollModal() {
    const backdrop = document.getElementById(BACKDROP_ID);
    if (!backdrop) return;
    backdrop.classList.remove("is-visible");
    document.body.classList.remove("um-modal-open");
    isModalOpen = false;
    document.removeEventListener("keydown", handleKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function matchesEnrollText(el) {
    const text = normalize(el?.innerText || el?.textContent || "");
    return text === "enroll";
  }

  function isTargetEnrollClick(target) {
    const button = target?.closest?.("a, button");
    if (!button || !matchesEnrollText(button)) return null;
    if (button.dataset.umEnrollBound !== "1") {
      button.dataset.umEnrollBound = "1";
    }
    const card = findCertificateCardFromAnchor(button);
    if (!card) return null;
    if (!elementMatchesCertificate(card)) return null;
    const certKey = resolveCertKeyFromCard(card);
    return { button, card, certKey };
  }

  function handleEnrollClick(event) {
    const match = isTargetEnrollClick(event.target);
    if (!match) return;
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ certKey: match.certKey, ts: Date.now() })
    );
    openEnrollModal({ anchorEl: match.button, certKey: match.certKey });
    sessionStorage.removeItem(PENDING_KEY);
  }

  function checkPendingPopup() {
    const rawPending = sessionStorage.getItem(PENDING_KEY);
    if (!rawPending) return;
    let pending = null;
    try {
      pending = JSON.parse(rawPending);
    } catch (e) {
      pending = null;
    }
    const certKey = pending?.certKey;
    if (!certKey) {
      sessionStorage.removeItem(PENDING_KEY);
      return;
    }
    openEnrollModal({ certKey });
    sessionStorage.removeItem(PENDING_KEY);
  }

  function wireEnrollButtons() {
    const candidates = Array.from(document.querySelectorAll("a, button"));
    candidates.forEach((el) => {
      if (!matchesEnrollText(el)) return;
      if (!el.dataset.umEnrollBound) {
        el.dataset.umEnrollBound = "1";
      }
    });
    checkPendingPopup();
  }

  document.addEventListener("click", handleEnrollClick, true);
  window.addEventListener("@softr/page-content-loaded", wireEnrollButtons, { passive: true });
  wireEnrollButtons();
})();
</script>

<style>
/* remove the red Softr placeholder background */
#um-course-cta-host:empty,
#um-course-cta-host {
  background: transparent !important;
}
section[id*="custom-code"],
section[id*="course"] {
  background: transparent !important;
}
</style>
