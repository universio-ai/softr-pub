<script type="module">
(() => {
  // ---------- Config ----------
  const BFF_BASE = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1";

  // Stripe Price IDs (test mode) — keys are canonical plan_code
  const PRICE_IDS = {
    basic: {
      monthly: "price_1SVdSY5vPVhLhThy5yn57rgu",
      annual:  "price_1SVdSY5vPVhLhThyMu6zWMlU"
    },
    plus: {
      monthly: "price_1SVdSg5vPVhLhThySJIXHwh4",
      annual:  "price_1SVdSg5vPVhLhThyyoClgbNk"
    },
    pro: {
      monthly: "price_1SVdSl5vPVhLhThyLcNvodZr",
      annual:  "price_1SVdSl5vPVhLhThyNCxcJGWF"
    }
  };

  // Default cycle shown on page
  let billingCycle = "annual";
  let initialized = false;

  // Keep track of buttons we've already wired
  const wiredButtons = new WeakSet();

  // ---------- Current plan ----------
  function getPlanState() {
    const u = window.logged_in_user || {};

    const plan_code = (
      u.plan_code ||
      u.billing_plan_code ||
      ""
    ).toString().toLowerCase();

    // Authoritative: plan_code present
    if (plan_code) {
      return {
        plan_code,
        pro_trial_end_at: u.pro_trial_end_at || null,
        pro_trial_used: !!u.pro_trial_used,
        pro_trial_locked_in: !!u.pro_trial_locked_in
      };
    }

    // Fallback to Stripe plan fields only if plan_code missing
    const planName   = (u.plan_name || u.billing_plan || "").toString();          // "Pro", "Plus", "Basic"
    const planType   = (u.billing_plan_type || "").toString();                    // "Monthly" | "Annual"
    const planStatus = (u.plan_status || u.billing_status || "").toString().toLowerCase();

    const isActive = planStatus === "active" || planStatus === "trialing";
    if (!planName || !isActive) {
      return {
        plan_code: "free",
        pro_trial_end_at: null,
        pro_trial_used: !!u.pro_trial_used,
        pro_trial_locked_in: !!u.pro_trial_locked_in
      };
    }

    const normalizedName = planName.trim().toLowerCase();
    const inferred =
      normalizedName.includes("pro")  ? "pro" :
      normalizedName.includes("plus") ? "plus" :
      normalizedName.includes("basic") || normalizedName.includes("upgrade") ? "basic" :
      "free";

    return {
      plan_code: inferred,
      pro_trial_end_at: null,
      pro_trial_used: !!u.pro_trial_used,
      pro_trial_locked_in: !!u.pro_trial_locked_in
    };
  }

  // ---------- Utils ----------
  function getIdentity() {
    const u = window.logged_in_user || {};
    return {
      email: (window.__uniUserId || u.softr_user_email || "").toLowerCase(),
      name: u.softr_user_full_name || "",
      session: u.session_token || "",
      softrUserId: u.id || u.user_id || ""
    };
  }

  // Normalize: uppercase, trim, collapse spaces, strip punctuation
  function normalizeLabel(text = "") {
    return text
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  // Map many possible button texts to canonical plan_code
  const PLAN_MAP = {
    "FREE": "free",
    "START FREE": "free",
    "BASIC": "basic",
    "GO BASIC": "basic",
    "PLUS": "plus",
    "GO PLUS": "plus",
    "PRO": "pro",
    "GO PRO": "pro",
    "START PRO TRIAL": "pro_trial"
  };

  function canonicalPlanCode(labelText) {
    const norm = normalizeLabel(labelText);
    return PLAN_MAP[norm] || norm.toLowerCase();
  }

  async function fetchWithRetry(fn, retries = 3, delay = 300) {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try { return await fn(); }
      catch (err) {
        lastErr = err;
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
      }
    }
    throw lastErr;
  }

  // ---------- Checkout ----------
  async function startCheckout({ plan_code, cycle }) {
    try {
      const id = getIdentity();
      if (!id.email) {
        window.location.href = "/sign-in?redirect=/plans";
        return;
      }

      const priceId = PRICE_IDS[plan_code]?.[cycle];
      if (!priceId) {
        console.error("[plans] Unknown plan/cycle:", plan_code, cycle);
        alert("Sorry, we couldn't determine the correct price. Please refresh and try again.");
        return;
      }

      // GA4 signal
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "begin_checkout",
        plan_code,
        billing_cycle: cycle,
        price_id: priceId,
        page_location: window.location.href,
        page_title: document.title || "Plans"
      });

      const headers = {
        "Content-Type": "application/json",
        "X-User-Email": id.email,
        "X-User-Name": id.name,
        "X-User-Id": id.softrUserId || "",
        "X-Client": "web",
        "X-Agent": "softr-web"
      };
      if (id.session) headers["X-Softr-Session"] = id.session;

      const body = JSON.stringify({
        price_id: priceId,
        success_url: window.location.origin + "/dashboard",
        cancel_url: window.location.origin + "/plans"
      });

      const res = await fetchWithRetry(() =>
        fetch(`${BFF_BASE}/create-checkout-session`, { method: "POST", headers, body })
      );

      const data = await res.json().catch(() => ({}));
      console.log("[plans] Checkout response:", data);

      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        console.error("[plans] Checkout error payload:", data);
        alert("We couldn't start checkout. Please try again in a moment.");
      }
    } catch (err) {
      console.error("[plans] Checkout error (caught):", err);
      alert("Temporary issue starting checkout. Please try again.");
    }
  }

  // ---------- Pro Trial ----------
  async function startProTrial() {
    try {
      const id = getIdentity();
      if (!id.email) {
        window.location.href = "/sign-in?redirect=/plans";
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        "X-User-Email": id.email,
        "X-User-Name": id.name,
        "X-User-Id": id.softrUserId || "",
        "X-Client": "web",
        "X-Agent": "softr-web"
      };
      if (id.session) headers["X-Softr-Session"] = id.session;

      const res = await fetchWithRetry(() =>
        fetch(`${BFF_BASE}/start-pro-trial`, { method: "POST", headers })
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Could not start Pro Trial.");
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error("[plans] Pro trial error (caught):", err);
      alert("Temporary issue starting Pro Trial. Please try again.");
    }
  }

  // ---------- Wiring ----------
  function wireBillingToggle() {
    const toggle =
      document.querySelector("[data-billing-toggle]") ||
      document.querySelector('[data-spr-block-parent-id="add5fede-4e03-481c-85d1-36a8922187c2"] .switch_1') ||
      document.querySelector('[role="switch"]') ||
      document.querySelector(".switch_1");

    if (!toggle) {
      console.warn("[plans] Billing toggle not found; defaulting to:", billingCycle);
      return;
    }

    toggle.addEventListener("click", () => {
      billingCycle = (billingCycle === "annual") ? "monthly" : "annual";
      console.log("🔄 Billing cycle switched →", billingCycle);

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "billing_cycle_toggled",
        billing_cycle: billingCycle,
        page_location: window.location.href,
        page_title: document.title || "Plans"
      });
    });
  }

  function stylePurple(btn) {
    btn.style.setProperty(
      "background",
      "linear-gradient(to right, #6A7CFF, #BA6CFF)",
      "important"
    );
    btn.style.setProperty("background-color", "transparent", "important");
    btn.style.setProperty("color", "white", "important");
  }

  function styleBlack(btn) {
    btn.style.setProperty("background-color", "black", "important");
    btn.style.setProperty("color", "white", "important");
  }

  function wirePlanButtons() {
    const planState = getPlanState();
    const plan_code = planState.plan_code || "free";

    const isLoggedIn = !!getIdentity().email;

    const onPro = plan_code === "pro";
    const onPlus = plan_code === "plus";
    const onBasic = plan_code === "basic";
    const onFree = plan_code === "free";
    const onProTrial = plan_code === "pro_trial";

    const buttons = document.querySelectorAll(".pricing-btn");
    if (!buttons.length) {
      console.warn("[plans] No pricing buttons found");
      return;
    }

    buttons.forEach((btn) => {
      // Persist original label
      if (!btn.dataset.planLabelOriginal) {
        const initial = btn.innerText || btn.textContent || "";
        btn.dataset.planLabelOriginal = normalizeLabel(initial);
      }

      const originalNorm = btn.dataset.planLabelOriginal;
      const canonical = canonicalPlanCode(originalNorm); // "basic" | "plus" | "pro" | "pro_trial" | "free"

      // Reset base state
      btn.disabled = false;
      btn.removeAttribute("aria-busy");

      btn.style.removeProperty("background");
      btn.style.removeProperty("background-image");
      btn.style.removeProperty("background-color");
      btn.style.removeProperty("color");

      const isPaidPlanButton = !!PRICE_IDS[canonical];

      // ---------- Non-logged in default ----------
      if (!isLoggedIn) {
        if (canonical === "free") {
          btn.textContent = "FREE";
          styleBlack(btn);
        } else if (canonical === "pro") {
          btn.textContent = "START PRO TRIAL";
          stylePurple(btn);
          // wire to pro_trial action via canonical logic below
        } else if (canonical === "plus") {
          btn.textContent = "GO PLUS";
          styleBlack(btn);
        } else if (canonical === "basic") {
          btn.textContent = "GO BASIC";
          styleBlack(btn);
        }
      }

      // ---------- Logged in ----------
      if (isLoggedIn) {
        // Free user who already used trial (and not paid): Free purple, Pro black upgrade
        if (onFree && planState.pro_trial_used) {
          if (canonical === "free") {
            btn.textContent = "CURRENT";
            stylePurple(btn);
            btn.disabled = true;
          } else if (canonical === "pro") {
            btn.textContent = "GO PRO";
            styleBlack(btn);
          } else if (canonical === "basic") {
            btn.textContent = "GO BASIC";
            styleBlack(btn);
          } else if (canonical === "plus") {
            btn.textContent = "GO PLUS";
            styleBlack(btn);
          }
        }

        // Pro Trial state
        if (onProTrial) {
          if (canonical === "pro") {
            // If you have a place for "LOCK IN PRO" you can set it here.
            // Using CURRENT to keep UI consistent.
            btn.textContent = "CURRENT";
            stylePurple(btn);
            btn.disabled = true;
          } else if (canonical === "basic") {
            btn.textContent = "GO BASIC";
            styleBlack(btn);
          } else if (canonical === "plus") {
            btn.textContent = "GO PLUS";
            styleBlack(btn);
          } else if (canonical === "free") {
            btn.textContent = "FREE";
            styleBlack(btn);
          }
        }

        // Paid plans
        if (onPro || onPlus || onBasic) {
          if (canonical === "free") {
            btn.textContent = "FREE";
            styleBlack(btn);
          }

          if ((onPro && canonical === "pro") ||
              (onPlus && canonical === "plus") ||
              (onBasic && canonical === "basic")) {
            btn.textContent = "CURRENT";
            stylePurple(btn);
            btn.disabled = true;
          }

          if (!onBasic && canonical === "basic") {
            btn.textContent = "GO BASIC";
            styleBlack(btn);
          }
          if (!onPlus && canonical === "plus") {
            btn.textContent = "GO PLUS";
            styleBlack(btn);
          }
          if (!onPro && canonical === "pro") {
            btn.textContent = "GO PRO";
            styleBlack(btn);
          }
        }

        // Pure free (no trial used)
        if (onFree && !planState.pro_trial_used) {
          if (canonical === "free") {
            btn.textContent = "CURRENT";
            stylePurple(btn);
            btn.disabled = true;
          } else if (canonical === "pro") {
            btn.textContent = "START PRO TRIAL";
            stylePurple(btn);
          } else if (canonical === "basic") {
            btn.textContent = "GO BASIC";
            styleBlack(btn);
          } else if (canonical === "plus") {
            btn.textContent = "GO PLUS";
            styleBlack(btn);
          }
        }
      }

      // ---------- Wiring ----------
      if (!wiredButtons.has(btn)) {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (btn.disabled) return;

          btn.disabled = true;
          btn.setAttribute("aria-busy", "true");
          try {
            if (canonical === "pro_trial") {
              await startProTrial();
              return;
            }

            if (canonical === "free") {
              // Free just routes user to app or sign-up
              if (!isLoggedIn) {
                window.location.href = "/sign-in?redirect=/dashboard";
              } else {
                window.location.href = "/dashboard";
              }
              return;
            }

            // Only paid plans call Stripe checkout
            if (PRICE_IDS[canonical]) {
              console.log("[plans] Plan selected:", canonical, billingCycle);
              await startCheckout({ plan_code: canonical, cycle: billingCycle });
            }
          } finally {
            btn.disabled = false;
            btn.removeAttribute("aria-busy");
          }
        }, true);

        wiredButtons.add(btn);
      }
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    wireBillingToggle();
    wirePlanButtons();
  }

  // Initial + late renders
  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("@softr/page-content-loaded", wirePlanButtons);
  window.addEventListener("universio:bootstrapped", wirePlanButtons);

  // Catch slow DOM paints
  setTimeout(wirePlanButtons, 1000);
})();
</script>
