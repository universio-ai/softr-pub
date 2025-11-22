<script>
// THIS MAKES THE AVATAR ICON BLACK
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
        headers: { "content-type": "application/json" },
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


    sessionStorage.setItem("universio:flags", JSON.stringify(window.__U.flags || {}));
    sessionStorage.setItem("universio:profile", JSON.stringify(window.__U.profile || {}));
    sessionStorage.setItem("universio:progress", JSON.stringify(window.__U.progress || []));
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
async function refreshCWT(emailOverride = "") {
 const EMAIL = (emailOverride || __currentEmail()).trim();
 if (!EMAIL) throw new Error("no email available for CWT refresh");
 const res = await fetch("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({ email: EMAIL })
 });
 if (!res.ok) throw new Error("bootstrap refresh failed");
 const out = await res.json();
 window.__U.cwt = out.data?.cwt;
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
    window.__U.cwt = null;
    window.__U.cwt_expires_at = 0;
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
(function () {
if (window.__umCtaScriptOnce) { return; }
window.__umCtaScriptOnce = true;

  const pathAfterOrigin = (location.pathname || '').replace(/^\/+/, '');
  const isCoursePage = /^C0/i.test(pathAfterOrigin);
  if (!isCoursePage) {
    return;
  }

  if (window.__umCourseGateInjected) return;
  window.__umCourseGateInjected = true;

  function up(x){ return (x||"").toString().trim().toUpperCase(); }

function getCourseId(){
  const pathCID = ((location.pathname.match(/C\d{3}/i)||[])[0] || '').toUpperCase();
  const m = document.querySelector('#um-course');
  const markerCID = ((m?.dataset?.course || m?.dataset?.graph) || '').toUpperCase();
  // Prefer URL; if marker disagrees, fix it.
  if (m && pathCID && markerCID !== pathCID) m.setAttribute('data-course', pathCID);
  return pathCID || markerCID || null;
}

const START_NODE = {
  C001:'ALP1', C002:'DF1',  C003:'HL1',  C004:'AP1',  C005:'EG1',
  C006:'ST1',  C007:'SQ1',  C008:'DV1',  C009:'GM1',  C010:'NC1',
  C011:'GC1',  C012:'RW1',  C013:'ESG1', C014:'FF1',  C015:'DT1'
};
const startUrlFor = cid => `/classroom?graph=${cid}${START_NODE[cid] ? `&node=${START_NODE[cid]}` : ''}`;
const normalizeUrl = u => {
  const x = new URL(u, location.origin);
  return x.pathname + x.search + x.hash;
};

let CTA_BTN = null;
let CTA_WRAPPER = null;
let CTAPlacementBound = false;
let CTADomObserver = null;
let CTA_MSG = null;

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
  const explicitHost = document.getElementById('um-course-cta-host');
  if (explicitHost instanceof HTMLElement) return explicitHost;

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
  return best;
}

function placeBtnWrapper() {
  const wrapper = CTA_WRAPPER;
  if (!wrapper) return;

  const target = findCourseContainer();
  const fallbackParent = document.querySelector('main') || document.body;

  if (!target || !target.parentNode) {
    if (wrapper.parentNode !== fallbackParent) {
      fallbackParent.appendChild(wrapper);
    }
    return;
  }

  const parent = target.parentNode;
  if (wrapper.previousElementSibling === target && wrapper.parentNode === parent) {
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

function injectBtn() {
  const btn = ensureBtn();
  const U = window.__U || {};
  const ent = U.entitlements;
  if (!ent) {
    setLoadingState(btn);
    return false;
  }

  const cid = getCourseId();
  if (!cid) {
    setLoadingState(btn);
    return false;
  }

  const hints = U.courseHints || {};
  const hint = hints[cid];

  const BASE_SAMPLER_ALLOWED = ['C001','C002','C003'];
  const rawTier = String(
    // Rely solely on entitlements for gating to avoid stale Softr billing data
    // accidentally upgrading/downgrading eligibility.
    ent.plan?.tier ||
    'sampler'
  ).trim().toLowerCase();
  const tier = ['basic','plus','pro'].includes(rawTier) ? rawTier : 'sampler';
  const samplerAllowedRaw = Array.isArray(ent.courses?.sampler_allowed)
    ? ent.courses.sampler_allowed
    : BASE_SAMPLER_ALLOWED;
  const samplerAllowedList = samplerAllowedRaw.length ? samplerAllowedRaw : BASE_SAMPLER_ALLOWED;
  const samplerAllowed = new Set(
    samplerAllowedList
      .map(up)
      .filter((id)=>BASE_SAMPLER_ALLOWED.includes(id))
  );
  const activeCourses = new Set(ent.courses?.active_courses || []);
  const isActive = activeCourses.has(cid);
  const activeSlots = Number(ent.courses?.active_slots || 0);
  const activeRemaining = Number(ent.courses?.active_slots_remaining ?? 0);
  const swapTarget = ent.courses?.will_swap_out || null;

  if (tier === 'sampler' && !samplerAllowed.has(cid)) {
    setBlockedState(
      btn,
      'Unavailable',
      null,
      'Sampler includes C001–C003 only. Upgrade to access full courses.'
    );
    placeBtnWrapper();
    return true;
  }

  if (tier !== 'sampler' && activeSlots > 0 && !isActive && activeRemaining <= 0) {
    const message = swapTarget
      ? `You’re at your course limit. Finish or swap out ${swapTarget} to start this course.`
      : 'You’re at your course limit. Finish one course to start another.';
    setBlockedState(btn, 'Course limit reached', () => (location.href = '/dashboard'), message);
    placeBtnWrapper();
    return true;
  }

  let resumeUrl;
  if (hint?.alreadyStarted) {
    resumeUrl = normalizeUrl(hint?.resumeUrl || startUrlFor(cid));
  } else {
    resumeUrl = normalizeUrl(startUrlFor(cid));
  }

  const already = !!hint?.alreadyStarted;
  const label = already ? 'Resume' : 'Start';

  setReadyState(btn, label, resumeUrl);
  placeBtnWrapper();
  console.debug('[UM] CTA injected', { cid, label, resumeUrl });
  return true;

}
function watchAndInject(){
  const observer=new MutationObserver(()=>injectBtn()&&observer.disconnect());
  observer.observe(document.body,{childList:true,subtree:true});
  injectBtn();
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
      <div style="font-size:24px;font-weight:700;margin-bottom:10px;">Module locked</div>
      <div style="font-size:16px;line-height:1.6;margin-bottom:18px;">${msg}</div>
      <a href="/pricing" class="sw-btn sw-btn--primary" style="padding:12px 18px;border-radius:24px;font-weight:600;">Upgrade</a>
      <a href="/" style="display:block;margin-top:12px;text-decoration:underline">Back to dashboard</a>
    </div>`;
    document.body.appendChild(p);
  }

  function gate(){
    const U = window.__U||{}; const ent = U.entitlements; if (!ent) return;
    const FALLBACK_SAMPLER_ALLOWED = ['C001','C002','C003'];
    const rawTier = String(
      // Only trust entitlements; ignore Softr billing fields that may be stale.
      ent.plan?.tier ||
      'sampler'
    ).trim().toLowerCase();
    const tier = ['basic','plus','pro'].includes(rawTier) ? rawTier : 'sampler';
    if (tier !== 'sampler') return;

    const cid = courseId(); if (!cid) return;
    const samplerAllowedRaw = Array.isArray(ent.courses?.sampler_allowed)
      ? ent.courses.sampler_allowed
      : FALLBACK_SAMPLER_ALLOWED;
    const samplerAllowedList = samplerAllowedRaw.length ? samplerAllowedRaw : FALLBACK_SAMPLER_ALLOWED;
    const allowed = new Set(
      samplerAllowedList
        .map(up)
        .filter((id)=>FALLBACK_SAMPLER_ALLOWED.includes(id))
    );
    if (!allowed.has(cid)) { lock(`Sampler includes C001–C003 only. <code>${cid}</code> is a full course.`); return; }

    const limit = +ent.courses?.sampler_module_limit || 3;
    const idx = nodeIndex(); if (idx == null) return;
    if (idx > limit) lock(`Your plan allows the first ${limit} modules. You’re on module ${idx}.`);
  }

  if (window.__U?.entitlements) gate(); else window.addEventListener('universio:bootstrapped', gate, { once:true });
})();
;
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
