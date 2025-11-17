<script>
(function () {
  const SOFTR_FN_BASE = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1";
  const FETCH_PROFILES_URL = `${SOFTR_FN_BASE}/fetch-profiles`;
  const STATUS_ID = "onboarding-lang-status";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function resolveEmail() {
    const ctx = window.logged_in_user || window.Softr?.context?.logged_in_user || {};
    const candidates = [ctx.softr_user_email, ctx.email, window.__uniUserId];
    for (const candidate of candidates) {
      const val = (candidate || "").toString().trim();
      if (val && val.includes("@")) return val.toLowerCase();
    }
    return "";
  }

  function buildOptions() {
    const api = window.universioI18n;
    if (api?.options && Array.isArray(api.options) && api.options.length) {
      return api.options.map((entry) => ({ value: entry.label, label: entry.label }));
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
  }

  async function persistLanguage(email, label) {
    if (!email || !label) return;
    const res = await fetch(FETCH_PROFILES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pref_lang: label })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error || res.statusText || "Language update failed";
      throw new Error(message);
    }
  }

  function setStatus(text, tone = "info") {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;
    el.textContent = text || "";
    el.dataset.state = tone;
  }

  ready(() => {
    const host = document.querySelector("#onboarding-language-host") || document.querySelector("#page-content") || document.body;
    if (!host) return;

    const card = document.createElement("div");
    card.id = "onboarding-language-card";
    card.style.margin = "16px auto";
    card.style.maxWidth = "520px";
    card.style.padding = "24px";
    card.style.borderRadius = "18px";
    card.style.border = "1px solid rgba(0,0,0,0.08)";
    card.style.background = "#fff";
    card.style.boxShadow = "0 16px 32px rgba(15,18,34,0.08)";

    const heading = document.createElement("h3");
    heading.textContent = "Choose your preferred language";
    heading.setAttribute("data-i18n", "onboarding.languagePrompt");
    heading.style.marginTop = "0";
    heading.style.marginBottom = "12px";
    heading.style.fontSize = "18px";
    heading.style.fontWeight = "700";
    card.appendChild(heading);

    const notice = document.createElement("p");
    notice.textContent = "The UI will switch after you complete onboarding.";
    notice.setAttribute("data-i18n", "onboarding.notice");
    notice.style.marginTop = "0";
    notice.style.marginBottom = "16px";
    notice.style.fontSize = "14px";
    notice.style.color = "#4d4d4d";
    card.appendChild(notice);

    const select = document.createElement("select");
    select.id = "onboarding-lang";
    select.style.width = "100%";
    select.style.padding = "12px";
    select.style.borderRadius = "10px";
    select.style.border = "1px solid #dadce0";
    select.style.fontSize = "15px";
    select.style.marginBottom = "12px";
    const options = buildOptions();
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    const initialLabel = window.__U?.langContext?.label || window.universioI18n?.getLanguage?.()?.label || "English";
    if (initialLabel) {
      const match = options.find((opt) => opt.label === initialLabel);
      if (match) select.value = match.value;
    }
    card.appendChild(select);

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.style.minHeight = "18px";
    status.style.fontSize = "13px";
    status.style.color = "#666";
    card.appendChild(status);

    const anchor = document.querySelector("#onboarding-language-host");
    if (anchor) {
      anchor.innerHTML = "";
      anchor.appendChild(card);
    } else {
      host.insertBefore(card, host.firstChild);
    }

    const email = resolveEmail();
    let pending = false;

    async function saveAndProceed() {
      if (pending) return true;
      const label = select.value || "English";
      if (!email) {
        console.warn("[onboarding] missing email; skipping language persistence");
        return true;
      }
      try {
        pending = true;
        setStatus("Saving…");
        await persistLanguage(email, label);
        try {
          await window.universioI18n?.setLanguage?.(label, { source: "profiles", surface: "onboarding", scrub: false });
        } catch (err) {
          console.warn("[onboarding] setLanguage failed", err);
        }
        setStatus("Saved", "success");
        return true;
      } catch (err) {
        console.error("[onboarding] language save failed", err);
        setStatus(String(err?.message || err), "error");
        alert("We couldn’t save your language preference. Please try again.");
        return false;
      } finally {
        pending = false;
        setTimeout(() => setStatus(""), 2500);
      }
    }

    const continueButtons = Array.from(document.querySelectorAll("button, a"))
      .filter((el) => /continue|next/i.test((el.textContent || "").trim()));

    continueButtons.forEach((btn) => {
      if (btn.dataset.langHook) return;
      btn.dataset.langHook = "1";
      btn.addEventListener("click", async (event) => {
        const ok = await saveAndProceed();
        if (!ok) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, { capture: true });
    });

    const form = card.closest("form");
    if (form) {
      form.addEventListener("submit", async (event) => {
        const ok = await saveAndProceed();
        if (!ok) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }
  });
})();
</script>
