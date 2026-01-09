<style>
  /* Action row inside the Current Plan card */
  #billing-card-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  @media (max-width: 768px) {
    #billing-card-actions { flex-direction: column; align-items: stretch; }
  }
  
  /* Match all primary action buttons */
#billing-card-actions button,
#save-prefs-btn {
  width: 100%;
  max-width: 100%;
  border-radius: 9999px; /* keep pill look */
  font-weight: 600;
  padding: 12px 0;
}

  /* Button width on mobile */
@media (min-width: 769px) {
  #billing-card-actions button,
  #save-prefs-btn {
    width: auto; /* keep natural size on desktop if desired */
  }
}

/* Base: desktop (auto width) */
#billing-card-actions button,
#save-prefs-btn {
  width: auto;
  border-radius: 9999px; /* keep pill look */
  font-weight: 600;
  padding: 12px 24px; /* add side padding for better shape */
}

/* Mobile only: full width */
@media (max-width: 768px) {
  #billing-card-actions button,
  #save-prefs-btn {
    width: 100%;
    max-width: 100%;
  }

  #billing-card-actions {
    flex-direction: column;
    align-items: stretch;
  }
}


</style>



<script type="module">
  const SOFTR_FN_BASE = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1";
  const LOGIN_URL = "/sign-in";
  const PORTAL_FN = `${SOFTR_FN_BASE}/create-portal-session`; // NEW

  // ---------- BFF helpers ----------
  function buildAuthedInit(init = {}) {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Authorization") && window.__U?.cwt) {
      headers.set("Authorization", `Bearer ${window.__U.cwt}`);
    }
    return { ...init, headers };
  }

  async function secureFetch(input, init = {}) {
    const fetcher = (typeof apiFetch === "function") ? apiFetch : fetch;
    const email = resolveEmail();

    if (typeof ensureFreshToken === "function") {
      try { await ensureFreshToken(email); } catch (err) { console.warn("[account] token refresh skipped", err); }
    }

    const nextInit = buildAuthedInit(init);
    return (fetcher === apiFetch ? fetch : fetcher)(input, nextInit);
  }

  function fetchWithRetry(fn, retries = 3, delay = 300) {
    let lastErr;
    return (async () => {
      for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (err) {
          lastErr = err;
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
      }
      throw lastErr;
    })();
  }




// --- user context helpers (single source of truth) ---
function resolveEmail() {
  const u = window.logged_in_user || (window.Softr?.context?.logged_in_user) || {};
  // Only treat strings with "@" as email; __uniUserId comes last and only counts if it's an email
  const candidates = [u.softr_user_email, u.email, window.__uniUserId];
  for (const c of candidates) {
    const s = (c || "").toString().trim();
    if (s && s.includes("@")) return s.toLowerCase();
  }
  return "";
}

function getUserCtx() {
  const u = window.logged_in_user || (window.Softr?.context?.logged_in_user) || {};
  const email = resolveEmail();
  const name  = u.softr_user_full_name || u.full_name || u.name || "";

  // Prefer explicit fields; DO NOT seed from u.billing_plan (it may contain old "(Type)" formatting)
  const planName = u.plan_name || u.plan || "";
  const planType = u.billing_plan_type || u.plan_type || "";

  // Flip to "Name • Type" (e.g., "Basic • Annual")
  const plan_display = (planName && planType)
    ? `${planName} • ${planType}`
    : (planName || "Free");

  const status = u.billing_status || "—";

  const normalize = (v) => {
    if (v == null) return "";
    if (Array.isArray(v)) return String(v[0] || "").trim().toLowerCase();
    if (typeof v === "object") return String(v.value || v.label || "").trim().toLowerCase();
    return String(v).trim().toLowerCase();
  };
  const tone = normalize(u.pref_tone);
  const pace = normalize(u.pref_pace);

  const plan_status = u.plan_status || "";

  return { email, name, plan_display, status, tone, pace, plan_status };
}




  // --- helpers for UI text updates and date formatting ---
  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatTrialEndDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }


  // NEW: Softr record id helper for X-User-Id header
  function getSoftrId() {
    const u = window.logged_in_user || (window.Softr?.context?.logged_in_user) || {};
    return u.id || u.user_id || "";
  }

  // ---------- Button label rewriting (preserve Softr structure) ----------
  function setButtonLabelDeep(btn, label) {
    try {
      btn.setAttribute("aria-label", label);
      btn.title = label;

      // Prefer obvious label elements first
      const candidates = btn.querySelectorAll(
        '[data-element="button-text"], .button-text, .btn__text, .btn-text, span, div, strong, em'
      );

      let done = false;
      for (const el of candidates) {
        const t = (el.innerText || el.textContent || "").trim();
        if (t && !el.closest("svg")) {
          el.innerText = label; // keep nested structure/styles
          done = true;
          break;
        }
      }

      // Fallback: replace the first non-empty TEXT node that is not inside an SVG
      if (!done) {
        const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const pe = n.parentElement || (n.parentNode && n.parentNode.nodeType === 1 ? n.parentNode : null);
          if (n.nodeValue.trim() && (!pe || !pe.closest("svg"))) {
            n.nodeValue = label;
            done = true;
            break;
          }
        }
      }

      // Last resort: append a visible span
      if (!done) {
        const span = document.createElement("span");
        span.textContent = label;
        span.style.display = "inline-block";
        btn.appendChild(span);
      }
    } catch {}
  }

  function cloneStyled(templateBtn, id, label, onClick) {
    // Deep clone to keep Softr’s internal label spans/icons
    const btn = templateBtn.cloneNode(true);
    btn.id = id;
    btn.type = "button";
    btn.removeAttribute("disabled");
    btn.classList.remove("disabled");
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";
    setButtonLabelDeep(btn, label);
    if (onClick) {
      // Clear previous listeners by replacing with cloned node again (ensures clean wiring)
      const clean = btn.cloneNode(true);
      setButtonLabelDeep(clean, label);
      clean.addEventListener("click", onClick);
      return clean;
    }
    return btn;
  }

  // ---------- Cards ----------
function injectBillingInfo() {
  try {
    if (document.getElementById("billing-info-card")) return;

    const updateBtn = [...document.querySelectorAll("button")]
      .find(b => (b.innerText || "").trim() === "Update");
    if (!updateBtn) return;

const { plan_display, status } = getUserCtx();

    const card = document.createElement("div");
    card.id = "billing-info-card";
    Object.assign(card.style, {
      marginTop: "1px", padding: "24px", border: "1px solid #e5e5e5", borderRadius: "16px",
      background: "#fff", boxShadow: "0px 1px 2px rgba(0,0,0,0.04)", fontSize: "14px",
      color: "#444", width: "100%", boxSizing: "border-box"
    });

    const line = (label, value) => {
      const row = document.createElement("div");
      row.style.marginBottom = "12px";
      row.innerHTML = `
        <div style="margin-bottom:6px;"><span style="font-weight:600; font-size:14px;">${label}</span></div>
        <div style="padding:12px; border:1px solid #e5e5e5; border-radius:8px; background:#f9f9f9;">${value}</div>`;
      return row;
    };

    // Only two lines now
card.appendChild(line("Current Plan", `<span id="billing-current-plan">${plan_display || "—"}</span>`));

    card.appendChild(line("Billing Status", `<span id="billing-status-value">${status || "—"}</span>`));

    const actions = document.createElement("div");
    actions.id = "billing-card-actions";
    card.appendChild(actions);

    // Insert just before the original row containing the Update button
    const btnRow = updateBtn.parentNode;
    if (btnRow?.parentNode) btnRow.parentNode.insertBefore(card, btnRow);

    // Fast seed from Softr context if present
    const ctx = getUserCtx();
    if (ctx.plan_status) {
      const el = document.getElementById("billing-status-value");
      if (el) el.textContent = String(ctx.plan_status);
    }





// Authoritative values from Profiles (status + plan)
(async () => {
  try {
    if (!ctx.email) { // ← quick guard
      console.warn("[account] missing email; skipping profiles fetch");
      return;
    }

    const res = await secureFetch(`${SOFTR_FN_BASE}/fetch-profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Email": ctx.email,
        "X-Client": "web",
        "X-Agent": "softr-web",
      },
      body: JSON.stringify({ email: ctx.email })
    });
    const data = await res.json().catch(() => ({}));

    // STATUS
    const planStatus = data?.plan_status || data?.planStatus || data?.status || "";
    const rawTrialEnd = data?.pro_trial_end_at || u?.pro_trial_end_at || "";
    const normalizedStatus = String(planStatus || "").trim().toLowerCase();
    const trialEndDate = formatTrialEndDate(rawTrialEnd);
    if (normalizedStatus === "trial" && trialEndDate) {
      setTextById("billing-status-value", `Trial Expires ${trialEndDate}`);
    } else if (planStatus) {
      setTextById("billing-status-value", String(planStatus));
    }

    // PLAN (force dot style, Name • Type)
    const fetchedName = (data?.plan_name || data?.planName || data?.plan || "").toString().trim();
    const fetchedType = (data?.billing_plan_type || data?.planType || "").toString().trim();
    const planLabel = (fetchedName && fetchedType)
      ? `${fetchedName} • ${fetchedType}`
      : fetchedName;

    if (planLabel) setTextById("billing-current-plan", planLabel);

    // keep Softr runtime context in sync (prevents future re-seeds from old formats)
    if (window.Softr?.context?.logged_in_user) {
      const u = window.Softr.context.logged_in_user;
      if (planStatus) u.plan_status = planStatus;
      if (fetchedName) u.plan_name = fetchedName;
      if (fetchedType) u.billing_plan_type = fetchedType;
      if (planLabel) u.billing_plan = planLabel; // store the dot style ("Name • Type")
    }
  } catch (e) {
    console.warn("[account] profiles preload failed", e);
  }
})();




  } catch (e) { console.error("[account] injectBillingInfo error", e); }
}

  
  function injectTutorPrefsCard() {
  try {
    if (document.getElementById("tutor-prefs-card")) return;

    const card = document.createElement("div");
    card.id = "tutor-prefs-card";
    Object.assign(card.style, {
      marginTop: "16px", marginBottom: "16px",
      padding: "24px", border: "1px solid #e5e5e5", borderRadius: "16px",
      background: "#fff", boxShadow: "0px 1px 2px rgba(0,0,0,0.04)", fontSize: "14px",
      color: "#444", width: "100%", boxSizing: "border-box"
    });

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.fontSize = "16px";
    title.style.marginBottom = "12px";
    title.innerText = "Tutor Preferences";
    card.appendChild(title);

    const TONES = [
      { value: "Encouraging", label: "Encouraging" },
      { value: "Neutral",     label: "Neutral" },
      { value: "Formal",      label: "Formal" }
    ];
    const PACES = [
      { value: "Step-by-step", label: "Step-by-step" },
      { value: "Balanced",     label: "Balanced" },
      { value: "Fast-track",   label: "Fast-track" }
    ];
    const LANGUAGES = (() => {
      const api = window.universioI18n;
      if (api?.options && Array.isArray(api.options) && api.options.length) {
        return api.options.map((entry) => ({
          value: entry.label,
          label: entry.label
        }));
      }
      return [
        "English",
        "Español",
        "Français",
        "Português",
        "Italiano",
        "Deutsch",
        "中文",
        "العربية",
        "हिन्दी",
        "日本語",
        "한국어",
      ].map((label) => ({ value: label, label }));
    })();

    const makeSelect = (id, label, options) => {
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "12px";
      wrap.innerHTML = `
        <div style="margin-bottom:6px;">
          <label for="${id}" style="font-weight:600; font-size:14px;">${label}</label>
        </div>
        <select id="${id}" name="${id}"
          style="width:100%; padding:12px; border:1px solid #e5e5e5; border-radius:8px; background:#fff; font-size:14px;">
          ${options.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}
        </select>`;
      return wrap;
    };

  card.appendChild(makeSelect("pref-tone", "AI Tone", TONES));
  card.appendChild(makeSelect("pref-pace", "Tutor Pace", PACES));
  card.appendChild(makeSelect("pref-lang", "Preferred Language", LANGUAGES));
    // Capture references immediately after insertion (survive re-render races)
    const toneEl = card.querySelector('#pref-tone');
    const paceEl = card.querySelector('#pref-pace');
    const langEl = card.querySelector('#pref-lang');

    const status = document.createElement("div");
    status.id = "prefs-status";
    status.setAttribute("role", "status");
    status.style.minHeight = "20px";
    status.style.marginTop = "6px";
    status.style.fontSize = "13px";
    card.appendChild(status);

    const btn = document.createElement("button");
    btn.id = "save-prefs-btn";
    btn.type = "button";
    btn.textContent = "Save Preferences";
    card.appendChild(btn);

    const billingCard = document.getElementById("billing-info-card");
    const host = billingCard?.parentNode || document.body;
    if (billingCard) host.insertBefore(card, billingCard.nextSibling);
    else host.appendChild(card);

    // 🔑 Now preload after the selects exist
    (async () => {
      const { email } = getUserCtx();
      if (!email) return;

      try {
        const res = await secureFetch(`${SOFTR_FN_BASE}/fetch-profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": email,
            "X-Client": "web",
            "X-Agent": "softr-web"
          },
          body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (data?.pref_tone) document.getElementById("pref-tone").value = data.pref_tone;
        if (data?.pref_pace) document.getElementById("pref-pace").value = data.pref_pace;
        if (data?.pref_lang) document.getElementById("pref-lang").value = data.pref_lang;
        else if (langEl && window.__U?.langContext?.label) {
          const fallback = LANGUAGES.find((o) => o.label === window.__U.langContext.label);
          if (fallback) langEl.value = fallback.value;
        }
      } catch (e) {
        console.warn("[prefs preload] failed", e);
      }
    })();
  } catch (e) { console.error("[account] injectTutorPrefsCard error", e); }
}
  // ---------- Actions ----------
  function wireChangePlan(btn) {
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = "https://www.universio.ai/plans";
    });
  }

  function wireManageBilling(btn) {
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const { email, name } = getUserCtx();
      if (!email) { location.href = LOGIN_URL; return; }

      btn.disabled = true; btn.style.opacity = "0.6"; btn.style.cursor = "wait";
      try {
        const res = await fetchWithRetry(() => fetch(PORTAL_FN, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Email": email,
            "X-User-Name": name,
            "X-User-Id": getSoftrId(),  // NEW
            "X-Client": "web",
            "X-Agent": "softr-web"
          },
          body: JSON.stringify({ return_url: location.origin + "/account" })
        }), 2, 300);

        if (res.status === 401) { location.href = LOGIN_URL; return; }
        if (res.status === 404) { location.href = "/plans"; return; }

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.url) throw new Error(json?.error || "Portal open failed");
        window.open(json.url, "_blank");
      } catch (err) {
        console.error("[billing] portal session failed", err);
        alert("Unable to open billing portal. Please try again.");
      } finally {
        btn.disabled = false; btn.style.opacity = "1"; btn.style.cursor = "pointer";
      }
    });
  }

  async function handleSavePrefsClick() {
  const { email, name } = getUserCtx();
  if (!email) { alert("Could not resolve your email. Please re-login and try again."); return; }

  const status = document.getElementById("prefs-status");
  const btn = document.getElementById("save-prefs-btn");
  // 🔑 keep the raw values from the selects (Title-case)
  const tone = document.getElementById("pref-tone")?.value || "Neutral";
  const pace = document.getElementById("pref-pace")?.value || "Balanced";
  const lang = document.getElementById("pref-lang")?.value || "English";

  btn.disabled = true; btn.style.opacity = "0.6"; status.textContent = "Saving…";
  try {
    const res = await fetchWithRetry(() => secureFetch(`${SOFTR_FN_BASE}/fetch-profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Email": email,
        "X-User-Name": name,
        "X-Client": "web",
        "X-Agent": "softr-web"
      },
      body: JSON.stringify({ email, pref_tone: tone, pref_pace: pace, pref_lang: lang })
    }), 2, 300);

    status.textContent = "Saved.";
    if (window.Softr?.context?.logged_in_user) {
      window.Softr.context.logged_in_user.pref_tone = tone;
      window.Softr.context.logged_in_user.pref_pace = pace;
      window.Softr.context.logged_in_user.pref_lang = lang;
    }
    try {
      await window.universioI18n?.setLanguage?.(lang, { source: "profiles", surface: "account-settings", scrub: false });
    } catch (err) {
      console.warn("[prefs] setLanguage failed", err);
    }
  } catch (e) {
    console.error("[prefs] save failed", e);
    status.textContent = "Save failed. Please try again.";
    alert(String(e?.message || e));
  } finally {
    btn.disabled = false; btn.style.opacity = "1";
    setTimeout(() => { status.textContent = ""; }, 2500);
  }
}



  // ---------- Layout + styling ----------
  function rearrangeAndStyleButtons() {
    try {
      const updateBtn = [...document.querySelectorAll("button")]
        .find(b => (b.innerText || "").trim() === "Update");
      if (!updateBtn) return;

      updateBtn.id = "update-btn";
      const btnRow = updateBtn.parentNode;
      btnRow && (btnRow.id = "account-buttons-row");

      const billingCard = document.getElementById("billing-info-card");
      if (billingCard?.parentNode && btnRow) {
        // Move Update row ABOVE the billing card (under the Email card)
        billingCard.parentNode.insertBefore(btnRow, billingCard);
      }

      // Ensure action row inside billing card
      let actions = document.getElementById("billing-card-actions");
      if (!actions && billingCard) {
        actions = document.createElement("div");
        actions.id = "billing-card-actions";
        billingCard.appendChild(actions);
      }

      // Create buttons INSIDE billing card (deep clone preserves label structure)
      let changeBtn = document.getElementById("change-plan");
      if (!changeBtn) {
        changeBtn = cloneStyled(updateBtn, "change-plan", "Change Plan", (e) => {
          e.preventDefault(); location.href = "https://www.universio.ai/plans";
        });
      } else { setButtonLabelDeep(changeBtn, "Change Plan"); }

      let manageBtn = document.getElementById("manage-billing");
      if (!manageBtn) {
        manageBtn = cloneStyled(updateBtn, "manage-billing", "Manage Billing", null);
      } else { setButtonLabelDeep(manageBtn, "Manage Billing"); }

      if (actions) {
        if (changeBtn.parentNode !== actions) actions.appendChild(changeBtn);
        if (manageBtn.parentNode !== actions) actions.appendChild(manageBtn);
      }

      wireChangePlan(changeBtn);
      wireManageBilling(manageBtn);

      // Upgrade Save Preferences to match (clone from Change Plan so style + structure match)
      const oldSave  = document.getElementById("save-prefs-btn");
      const template = document.getElementById("change-plan") || manageBtn || updateBtn;
      if (oldSave && template) {
        const saveStyled = cloneStyled(template, "save-prefs-btn", "Save Preferences", handleSavePrefsClick);
        oldSave.replaceWith(saveStyled);
      } else if (oldSave) {
        oldSave.addEventListener("click", handleSavePrefsClick);
      }
    } catch (e) { console.error("[account] rearrangeAndStyleButtons error", e); }
  }

  // ---------- Boot ----------
  function init() {
    try {
      const { email } = getUserCtx();
      if (!email) { console.warn("[account] No user email found"); return; }
      injectBillingInfo();
      injectTutorPrefsCard();
      rearrangeAndStyleButtons();
    } catch (e) { console.error("[account] init error", e); }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(init, 300));
  window.addEventListener("@softr/page-content-loaded", () => setTimeout(init, 300));

</script>
