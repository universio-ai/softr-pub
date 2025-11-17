(function() {
  const anchorId = "universio-summary";
  let anchor = document.getElementById(anchorId);
  if (!anchor) {
    anchor = document.createElement("div");
    anchor.id = anchorId;
    anchor.setAttribute("data-uni-root", "summary");
    const currentScript = document.currentScript;
    if (currentScript && currentScript.parentNode) {
      currentScript.parentNode.insertBefore(anchor, currentScript);
    } else {
      document.body.appendChild(anchor);
    }
  }

  const styleId = "uni-summary-style";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
  #uni-summary-root {
    --bg: #F8F8FF;
    --fg: #0F1222;
    --header-bg: rgba(248,248,248,0.13);
    --border: none;
    --card: rgba(255,255,255,0.65);

    color: var(--fg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: clamp(0px, 2vw, 20px) 16px 96px;
    box-sizing: border-box;
    width: 100%;
    gap: clamp(18px, 4vw, 28px);
  }

  #uni-summary-root *,
  #uni-summary-root *::before,
  #uni-summary-root *::after {
    box-sizing: inherit;
  }

  #uni-summary-root .uni-summary-card {
    width: min(100%, 800px);
    margin: 0 auto;
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  #uni-summary-root .uni-summary-body {
    padding: clamp(24px, 5vw, 36px) 0 clamp(32px, 6vw, 48px);
    display: flex;
    flex-direction: column;
    gap: clamp(18px, 4vw, 28px);
  }

  #uni-summary-root .uni-summary-download-wrap {
    width: min(100%, 800px);
    margin: clamp(12px, 4vw, 36px) auto 0;
    display: flex;
    justify-content: flex-end;
  }

  #uni-summary-root .uni-summary-download-btn {
    appearance: none;
    border: none;
    border-radius: 999px;
    background: #000;
    color: #fff;
    font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 12px 22px;
    cursor: pointer;
    box-shadow: 0 14px 28px rgba(91, 60, 255, 0.25);
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  #uni-summary-root .uni-summary-download-btn:hover:not([disabled]),
  #uni-summary-root .uni-summary-download-btn:focus-visible:not([disabled]) {
    transform: translateY(-1px);
    box-shadow: 0 20px 36px rgba(91, 60, 255, 0.3);
    outline: none;
  }

  #uni-summary-root .uni-summary-download-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 12px 24px rgba(91, 60, 255, 0.2);
  }

  #uni-summary-root #uni-summary-course-name {
    display: block;
    width: min(100%, 800px);
    margin: clamp(16px, 3.5vw, 36px) auto 0;
    font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif;
    font-size: clamp(1.2rem, 2vw, 1.3rem);
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    text-align: left;
    color: #0F1222;
    line-height: clamp(1.5rem, 2.6vw, 2rem);
  }

  #uni-summary-root .uni-summary-status {
    margin: 0;
    font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif;
    font-size: 0.96rem;
    line-height: 1.6;
    color: rgba(15, 18, 34, 0.68);
  }

  #uni-summary-root .uni-summary-status.error {
    color: #c24040;
  }

  #uni-summary-root .uni-loading-dots {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 1.2em;
  }

  #uni-summary-root .uni-loading-dots span {
    width: 6px;
    height: 6px;
    display: inline-block;
    border-radius: 999px;
    background: #B874FF !important;
    animation: uniSummaryDots 1s ease-in-out infinite;
  }

  #uni-summary-root .uni-loading-dots span:nth-child(2) {
    animation-delay: 0.15s;
  }

  #uni-summary-root .uni-loading-dots span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes uniSummaryDots {
    0%, 80%, 100% {
      opacity: 0.25;
    }
    40% {
      opacity: 1;
    }
  }

  #uni-summary-root .uni-summary-item {
    border: 1px solid #B874FF;
    border-radius: 18px;
    background: #fff !important;
    box-shadow: 0 14px 28px rgba(15, 18, 34, 0.12);
    padding: clamp(18px, 4vw, 28px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  #uni-summary-root .uni-summary-item-title {
    margin: 0;
    font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: normal;
    text-transform: none;
    color: #444;
  }

  #uni-summary-root .uni-summary-item-body {
    margin: 0;
    font-family: "Inter", "Plus Jakarta Sans", Arial, sans-serif;
    font-size: 0.98rem;
    line-height: 1.65;
    color: rgba(15, 18, 34, 0.8);
    white-space: normal;
    word-break: break-word;
    margin-left: clamp(8px, 3vw, 20px);
  }

  #uni-summary-root .uni-summary-item-body h1,
  #uni-summary-root .uni-summary-item-body h2,
  #uni-summary-root .uni-summary-item-body h3,
  #uni-summary-root .uni-summary-item-body h4,
  #uni-summary-root .uni-summary-item-body h5,
  #uni-summary-root .uni-summary-item-body h6 {
    font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif;
    color: rgba(15, 18, 34, 0.92);
    margin: 0 0 0.35em 0;
  }

  #uni-summary-root .uni-summary-item-body h1 { font-size: 1.35rem; }
  #uni-summary-root .uni-summary-item-body h2 { font-size: 1.22rem; }
  #uni-summary-root .uni-summary-item-body h3 { font-size: 1.08rem; }
  #uni-summary-root .uni-summary-item-body h4 { font-size: 1.05rem; }

  #uni-summary-root .uni-summary-item-body ul,
  #uni-summary-root .uni-summary-item-body ol {
    margin: 0 0 1em 1.15em;
    padding: 0;
  }

  #uni-summary-root .uni-summary-item-body li {
    margin-bottom: 0.5em;
  }

  #uni-summary-root .uni-summary-item-body p {
    margin: 0 0 1em 0;
  }

  #uni-summary-root .uni-summary-item-body p:last-child {
    margin-bottom: 0;
  }

  #uni-summary-root .uni-summary-item-body code {
    font-family: "Fira Code", "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
    font-size: 0.9em;
    background: rgba(15, 18, 34, 0.07);
    padding: 0.1em 0.35em;
    border-radius: 6px;
  }

  @media (max-width: 600px) {
    #uni-summary-root {
      padding: clamp(36px, 16vw, 80px) 12px 72px;
      gap: clamp(14px, 6vw, 24px);
    }

    #uni-summary-root .uni-summary-card {
      width: 100%;
    }
  }
`;
    document.head.appendChild(styleEl);
  }
})();

  (function () {
    const ROOT_ANCHOR_ID = "universio-summary";
    const GRADIENT_LIGHT =
      "radial-gradient(1200px 800px at 0% 0%, rgba(214,236,255,.95) 0%, rgba(214,236,255,0) 80%)," +
      "radial-gradient(1100px 720px at 100% 0%, rgba(236,209,255,.92) 0%, rgba(236,209,255,0) 120%)," +
      "linear-gradient(to bottom, rgba(248,248,255,0) 0%, rgba(248,248,255,0) 70%, rgba(235,236,240,1) 100%)";

    function ready(fn) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fn, { once: true });
      } else {
        fn();
      }
    }

    function getRGB(str) {
      return (str || "").replace(/\s+/g, "").toLowerCase();
    }

    function isGhostWhite(el) {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const bg = getRGB(cs.backgroundColor);
      return bg === "rgb(248,248,255)" || bg === "#f8f8ff";
    }

    function findShellEl(root) {
      if (!root) return null;
      const candidates = [
        root.closest('[data-element-type="custom_code"]'),
        root.closest(".softr-section"),
        root.closest("section"),
        root.parentElement,
      ].filter(Boolean);

      for (const el of candidates) {
        if (isGhostWhite(el)) return el;
      }

      let current = root.parentElement;
      let hops = 0;
      while (current && hops++ < 6) {
        if (isGhostWhite(current)) return current;
        current = current.parentElement;
      }

      return candidates[0] || root.parentElement || null;
    }

    function applyGradient() {
      const anchor = document.getElementById(ROOT_ANCHOR_ID);
      if (!anchor) return;
      const shell = findShellEl(anchor);
      if (!shell) return;

      shell.style.setProperty("background-color", "#F8F8FF", "important");
      shell.style.setProperty("background-image", GRADIENT_LIGHT, "important");
      shell.style.setProperty("background-repeat", "no-repeat", "important");
      shell.style.setProperty("background-size", "cover", "important");
      shell.style.setProperty("background-attachment", "scroll", "important");
      shell.style.setProperty("background-position", "center", "important");
      shell.style.setProperty("min-height", "100vh", "important");
      shell.style.setProperty("min-height", "100svh", "important");
      shell.style.setProperty("min-height", "100dvh", "important");
      shell.style.setProperty("box-sizing", "border-box", "important");
      shell.style.setProperty("overflow-x", "hidden", "important");
    }

    ready(applyGradient);
  })();
(function(){
  const host = document.getElementById("universio-summary");
  if (!host) return;

  const root = document.createElement("div");
  root.id = "uni-summary-root";
  root.setAttribute("role", "region");
  root.setAttribute("aria-live", "polite");
  root.innerHTML = `
    <div class="uni-summary-card">
      <div class="uni-summary-body" id="uni-summary-body">
        <p class="uni-summary-status"><span class="uni-loading-dots" aria-label="Loading module summaries"><span></span><span></span><span></span></span></p>
      </div>
    </div>
  `;

  host.appendChild(root);

  const pageLoadedPromise = new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }
    window.addEventListener(
      "load",
      () => {
        resolve();
      },
      { once: true }
    );
  });

  let modulesReadyResolve;
  const modulesReadyPromise = new Promise((resolve) => {
    modulesReadyResolve = resolve;
  });

  function markModulesReady() {
    if (typeof modulesReadyResolve === "function") {
      modulesReadyResolve();
      modulesReadyResolve = null;
    }
  }

  const DOWNLOAD_BUTTON_ID = "uni-summary-download-btn";
  const DOWNLOAD_BUTTON_CLASS = "uni-summary-download-btn";
  const DOWNLOAD_WRAP_CLASS = "uni-summary-download-wrap";
  const HTML2PDF_SRC = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";

  let pdfLibPromise = null;

  function loadPdfLibrary() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HTML2PDF_SRC;
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.onload = () => {
        if (window.html2pdf) {
          resolve(window.html2pdf);
        } else {
          pdfLibPromise = null;
          reject(new Error("PDF library failed to initialize"));
        }
      };
      script.onerror = () => {
        pdfLibPromise = null;
        script.remove();
        reject(new Error("Failed to load PDF library"));
      };
      document.head.appendChild(script);
    });
    return pdfLibPromise;
  }

  function sanitizeFileName(value) {
    const clean = String(value || "").trim().toLowerCase();
    const slug = clean.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
    return slug || "course-summary";
  }

  function waitForNextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  async function generateSummaryPdf() {
    await pageLoadedPromise;
    await modulesReadyPromise;
    await waitForNextFrame();

    const summaryRoot = document.getElementById("uni-summary-root");
    if (!summaryRoot) throw new Error("Missing summary root");

    if (document.fonts && typeof document.fonts.ready?.then === "function") {
      try {
        await document.fonts.ready;
      } catch (err) {
        console.warn("[UNI][summary] font load wait failed", err);
      }
    }

    if (typeof window.html2pdf !== "function") {
      throw new Error("PDF library unavailable");
    }

    const computed = getComputedStyle(summaryRoot);
    const textColor = computed?.color || "#0F1222";
    const courseName = (summaryRoot.querySelector("#uni-summary-course-name")?.textContent || "Course Summary").trim() || "Course Summary";
    const filename = `${sanitizeFileName(courseName)}-summary.pdf`;

    const margin = [24, 24, 24, 24];
    const normalizeMargin = (value) => {
      if (Array.isArray(value)) {
        if (value.length === 4) return value;
        if (value.length === 2) return [value[0], value[1], value[0], value[1]];
        if (value.length === 1) return [value[0], value[0], value[0], value[0]];
        return [0, 0, 0, 0];
      }
      const val = Number.isFinite(value) ? Number(value) : 0;
      return [val, val, val, val];
    };

    const resolvedMargin = normalizeMargin(margin);
    const horizontalMarginPt = resolvedMargin[1] + resolvedMargin[3];
    const LETTER_WIDTH_PT = 612; // jsPDF letter width in portrait
    const ptToPx = (pt) => (pt / 72) * 96;
    const availableWidthPx = Math.max(320, ptToPx(LETTER_WIDTH_PT - horizontalMarginPt));
    const safetyInsetPx = 24;

    const cardEl = summaryRoot.querySelector(".uni-summary-card");
    const cardRect = cardEl?.getBoundingClientRect();
    const summaryRect = summaryRoot.getBoundingClientRect();
    const summaryHeight = Math.max(
      summaryRoot.scrollHeight || 0,
      summaryRect?.height || 0,
      summaryRoot.offsetHeight || 0
    );
    const baseContentWidth = Math.max(
      360,
      Math.min(
        Math.max(cardRect?.width || 0, summaryRect?.width || 0, summaryRoot.scrollWidth || 0),
        860
      )
    );
    const targetWidthPx = Math.min(
      baseContentWidth,
      Math.max(320, availableWidthPx - safetyInsetPx)
    );
    const totalHeightPx = Math.max(1, Math.ceil(summaryHeight));
    const captureContainer = document.createElement("div");
    captureContainer.setAttribute("aria-hidden", "true");
    captureContainer.style.position = "fixed";
    captureContainer.style.top = "0";
    captureContainer.style.left = "0";
    captureContainer.style.right = "auto";
    captureContainer.style.bottom = "auto";
    captureContainer.style.width = `${targetWidthPx}px`;
    captureContainer.style.maxWidth = `${targetWidthPx}px`;
    captureContainer.style.minHeight = `${totalHeightPx}px`;
    captureContainer.style.display = "block";
    captureContainer.style.margin = "0";
    captureContainer.style.padding = "0";
    captureContainer.style.background = "#ffffff";
    captureContainer.style.pointerEvents = "none";
    captureContainer.style.opacity = "0";
    captureContainer.style.zIndex = "-2147483648";
    captureContainer.style.overflow = "visible";

    const captureRoot = summaryRoot.cloneNode(true);
    const downloadInClone = captureRoot.querySelector(`#${DOWNLOAD_BUTTON_ID}`);
    if (downloadInClone) {
      downloadInClone.remove();
    }

    captureRoot.style.background = "#ffffff";
    captureRoot.style.boxSizing = "border-box";
    captureRoot.style.margin = "0 auto";
    captureRoot.style.padding = "24px";
    captureRoot.style.width = `${targetWidthPx}px`;
    captureRoot.style.maxWidth = "550px"; // ← add this line
    captureRoot.style.minHeight = `${totalHeightPx}px`;
    captureRoot.style.height = "auto";
    captureRoot.style.color = textColor;


    captureContainer.appendChild(captureRoot);
    document.body.appendChild(captureContainer);

    await waitForNextFrame();

    const options = {
      margin,
      filename,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: {
        scale: Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2.5),
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: "pt", format: "letter", orientation: "portrait" }
    };

    const worker = window.html2pdf();
    worker.set(options);

    try {
      await worker.from(captureRoot).save();
    } finally {
      captureContainer.remove();
    }
  }

  function ensureDownloadButton() {
    let wrap = root.querySelector(`.${DOWNLOAD_WRAP_CLASS}`);
    let button = root.querySelector(`#${DOWNLOAD_BUTTON_ID}`);
    if (button) return button;

    wrap = document.createElement("div");
    wrap.className = DOWNLOAD_WRAP_CLASS;

    button = document.createElement("button");
    button.id = DOWNLOAD_BUTTON_ID;
    button.type = "button";
    button.className = DOWNLOAD_BUTTON_CLASS;
    button.textContent = "Download summary PDF";
    button.setAttribute("aria-label", "Download this course summary as a PDF");
    button.setAttribute("data-html2canvas-ignore", "true");
    button.dataset.pageReady = "pending";
    button.hidden = true;
    button.disabled = true;
    button.setAttribute("aria-hidden", "true");

    Promise.all([pageLoadedPromise, modulesReadyPromise]).then(() => {
      button.hidden = false;
      button.removeAttribute("aria-hidden");
      button.dataset.pageReady = "ready";
      if (button.dataset.loading !== "true") {
        button.disabled = false;
      }
    });

    button.addEventListener("click", async (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.dataset.pageReady !== "ready") return;
      if (target.dataset.loading === "true") return;

      const originalText = target.textContent;
      target.dataset.loading = "true";
      target.disabled = true;
      target.textContent = "Preparing PDF…";

      try {
        await pageLoadedPromise;
        await modulesReadyPromise;
        await loadPdfLibrary();
        await generateSummaryPdf();
      } catch (err) {
        console.error("[UNI][summary] pdf generation failed", err);
        window.alert("We couldn't create your PDF right now. Please try again in a moment.");
      } finally {
        target.disabled = false;
        target.dataset.loading = "false";
        if (typeof originalText === "string") {
          target.textContent = originalText;
        }
      }
    });

    wrap.appendChild(button);
    root.appendChild(wrap);
    return button;
  }

  ensureDownloadButton();

  const bodyEl = root.querySelector("#uni-summary-body");
  if (!bodyEl) return;

  let headingEl = root.querySelector("#uni-summary-course-name");
  if (!headingEl) {
    headingEl = document.createElement("h2");
    headingEl.id = "uni-summary-course-name";
    headingEl.className = "uni-summary-course-title";
    root.insertBefore(headingEl, root.firstChild);
  }

  function createLoadingDots(label = "Loading") {
    const wrap = document.createElement("span");
    wrap.className = "uni-loading-dots";
    if (label) wrap.setAttribute("aria-label", label);
    for (let i = 0; i < 3; i++) {
      wrap.appendChild(document.createElement("span"));
    }
    return wrap;
  }

  function renderLoadingPlaceholder() {
    bodyEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "uni-summary-status";
    p.appendChild(createLoadingDots("Loading module summaries"));
    bodyEl.appendChild(p);
  }

  function normalizeCourseId(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = text.match(/C\d{3}/i);
    return match ? match[0].toUpperCase() : text.toUpperCase();
  }

  function readLastContext() {
    try {
      const raw = localStorage.getItem("uni:lastContext");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {}
    return {};
  }

  const params = new URLSearchParams(window.location.search || "");
  const storedContext = readLastContext();
  const normalizedCourse = (() => {
    const candidates = [
      params.get("course"),
      params.get("graph"),
      params.get("graph_id"),
      host?.dataset?.course,
      host?.dataset?.graph,
      storedContext?.graphId,
      storedContext?.courseId,
      storedContext?.course_id,
      window.__U?.lastGraph
    ];

    for (const candidate of candidates) {
      const normalized = normalizeCourseId(candidate);
      if (normalized) return normalized;
    }

    return "";
  })();

  if (normalizedCourse) {
    window.__uniGraphId = normalizedCourse;
    host.dataset.course = normalizedCourse;
  }

  const fallbackName = normalizedCourse ? `Course ${normalizedCourse}` : "Course";
  const storedNames = readLastNames();
  const storedCourseName = String(storedNames?.courseName || "").trim();
  const initialCourseName = storedCourseName || fallbackName;
  window.__uniCourseName = initialCourseName;
  if (headingEl) {
    headingEl.textContent = "";
  }

  renderLoadingPlaceholder();

  const SUMMARY_ENDPOINT = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/pull-summary";
  const CREATE_SUMMARY_ENDPOINT = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/create-summary";
  const BOOTSTRAP_ENDPOINT = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap";
  const LAST_EMAIL_KEY = "uni:lastEmail";

  let summaryRefreshHandle = null;
  let summaryRefreshAttempts = 0;

  function readLastNames() {
    try {
      const raw = localStorage.getItem("uni:lastNames");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
    return {};
  }

  window.__U = window.__U || {};

  let pendingCwtPromise = null;

  function dispatchBootstrapped(detail) {
    if (!detail) return;
    if (window.__uniBootstrappedOnce) return;
    window.__uniBootstrappedOnce = true;
    try {
      window.dispatchEvent(new CustomEvent("universio:bootstrapped", { detail }));
    } catch (err) {
      console.warn("[UNI][summary] bootstrapped dispatch failed", err);
    }
  }

  function rememberUserEmail(email) {
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) return;
    try {
      sessionStorage.setItem(LAST_EMAIL_KEY, clean);
    } catch {}
    try {
      localStorage.setItem(LAST_EMAIL_KEY, clean);
    } catch {}
  }

  function readCachedEmail() {
    let cached = "";
    try {
      cached = sessionStorage.getItem(LAST_EMAIL_KEY) || "";
    } catch {}
    if (!cached) {
      try {
        cached = localStorage.getItem(LAST_EMAIL_KEY) || "";
      } catch {}
    }
    return cached;
  }

  function resolveUserEmail() {
    const softr =
      window.logged_in_user?.softr_user_email ||
      window.logged_in_user?.email ||
      window.logged_in_user?.user_email ||
      "";
    const bootstrapEmail =
      window.__U?.profile?.email ||
      window.__U?.profile?.softr_user_email ||
      window.__U?.profile?.user_email ||
      "";
    const cached = readCachedEmail();
    let resolved = softr || bootstrapEmail || cached || "";
    if (resolved) {
      rememberUserEmail(resolved);
      resolved = String(resolved).trim().toLowerCase();
    }
    return resolved;
  }

  async function waitForUserEmail(timeoutMs = 4000) {
    const deadline = Date.now() + timeoutMs;
    let email = resolveUserEmail();
    while (!email && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      email = resolveUserEmail();
    }
    return email;
  }

  function expiryToMs(value) {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }
    const str = typeof value === "string" ? value : String(value);
    const parsed = Date.parse(str);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function fetchCWT(force = false) {
    const exp = expiryToMs(window.__U?.cwt_expires_at || 0);
    if (!force && window.__U?.cwt && exp && exp - Date.now() > 60000) {
      return window.__U.cwt;
    }
    if (pendingCwtPromise) return pendingCwtPromise;

    pendingCwtPromise = (async () => {
      let email = resolveUserEmail();
      if (!email) {
        email = await waitForUserEmail(6000);
      }
      if (!email) throw new Error("Cannot fetch CWT — missing user email");
      rememberUserEmail(email);

      const res = await fetch(BOOTSTRAP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error(`CWT request failed ${res.status}`);

      const json = await res.json().catch(() => null);
      if (!json || json.ok === false) {
        throw new Error("CWT bootstrap rejected");
      }

      const payload = json?.data || {};
      const profile = json?.profile || payload?.profile || {};
      const cwt = json?.cwt || payload?.cwt || null;
      const expires = json?.cwt_expires_at || payload?.cwt_expires_at || null;

      window.__U = { ...(window.__U || {}), ...(payload || {}) };
      if (profile && Object.keys(profile).length > 0) {
        window.__U.profile = { ...(window.__U.profile || {}), ...profile };
      } else if (payload?.profile) {
        window.__U.profile = { ...(window.__U.profile || {}), ...payload.profile };
      }
      if (!window.__U.profile) window.__U.profile = {};
      if (email && !window.__U.profile.email) window.__U.profile.email = email;
      if (cwt) window.__U.cwt = cwt;
      if (expires) window.__U.cwt_expires_at = expires;
      if (json?.courseHints && !window.__U.courseHints) {
        window.__U.courseHints = json.courseHints;
      }

      if (!window.__U.cwt) {
        throw new Error("CWT bootstrap response missing token");
      }

      dispatchBootstrapped(window.__U);
      return window.__U.cwt;
    })();

    try {
      return await pendingCwtPromise;
    } finally {
      pendingCwtPromise = null;
    }
  }

  async function ensureFreshCWT() {
    const exp = expiryToMs(window.__U?.cwt_expires_at || 0);
    if (window.__U?.cwt && exp && exp - Date.now() > 120000) {
      return window.__U.cwt;
    }
    return fetchCWT();
  }

  function apiHeaders(includeJSON = true) {
    const headers = includeJSON ? { "Content-Type": "application/json" } : {};
    const cwt = window.__U?.cwt;
    if (cwt) headers["Authorization"] = `Bearer ${cwt}`;
    return headers;
  }

  async function apiFetch(url, init = {}) {
    await ensureFreshCWT();
    const baseHeaders = apiHeaders(false);
    const merged = { ...baseHeaders, ...(init.headers || {}) };
    let res = await fetch(url, { ...init, headers: merged });
    if (res.status === 401) {
      await fetchCWT(true);
      const retryHeaders = { ...apiHeaders(false), ...(init.headers || {}) };
      res = await fetch(url, { ...init, headers: retryHeaders });
    }
    return res;
  }

  function extractNodeRank(id) {
    const raw = String(id || "").toUpperCase();
    const isCapstone = /^CAP/.test(raw);
    const match = raw.match(/(\d+)/);
    const num = match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
    return { raw, isCapstone, num: Number.isFinite(num) ? num : Number.POSITIVE_INFINITY };
  }

  function compareSummaryRows(a, b) {
    const rankA = extractNodeRank(a?.node_id);
    const rankB = extractNodeRank(b?.node_id);
    if (rankA.isCapstone !== rankB.isCapstone) {
      return rankA.isCapstone ? 1 : -1;
    }
    if (rankA.num !== rankB.num) {
      return rankA.num - rankB.num;
    }
    return rankA.raw.localeCompare(rankB.raw);
  }

  function prettifySender(sender) {
    const text = String(sender || "").trim();
    if (!text) return "";
    const lower = text.toLowerCase();
    if (lower === "user") return "You";
    if (lower === "tutor") return "Tutor";
    if (lower === "uni") return "Uni";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function formatMessageEntry(entry) {
    if (!entry || typeof entry !== "object") return "";
    const sender = prettifySender(entry.sender);
    const text = String(entry.text ?? "").trim();
    if (sender && text) return `${sender}: ${text}`;
    return text || sender;
  }

  function formatMessages(value) {
    if (!value && value !== 0) return "";
    if (Array.isArray(value)) {
      return value
        .map((item) => formatMessageEntry(item))
        .filter(Boolean)
        .join("\n\n");
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return formatMessages(parsed);
      } catch {}
      return trimmed;
    }
    if (typeof value === "object") {
      if (Array.isArray(value?.messages)) return formatMessages(value.messages);
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value ?? "");
  }

  function hasStoredSummary(row) {
    if (!row || typeof row !== "object") return false;
    const summaryText = formatMessages(row.summary);
    if (!summaryText) return false;
    const source = typeof row.summary_source === "string" ? row.summary_source.toLowerCase() : "";
    if (source && source !== "summary") return false;
    return true;
  }

  function shouldGenerateSummary(row) {
    if (!row || typeof row !== "object") return false;
    if (hasStoredSummary(row)) return false;
    const transcript = typeof row.transcript === "string" ? row.transcript.trim() : "";
    if (transcript) return true;
    const messageText = formatMessages(row.messages);
    return Boolean(messageText);
  }

  function extractSummaryText(row) {
    if (!row || typeof row !== "object") return "";
    const summaryText = formatMessages(row.summary);
    if (!summaryText) return "";
    const source = typeof row.summary_source === "string" ? row.summary_source.toLowerCase() : "";
    if (source && source !== "summary") return "";
    return summaryText;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, (match, prefix, content) => {
        return `${prefix}<em>${content}</em>`;
      })
      .replace(/(^|\s)_(?!\s)([^_]+?)_(?!_)/g, (match, prefix, content) => {
        return `${prefix}<em>${content}</em>`;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function renderMarkdown(markdownText) {
    if (!markdownText) return "";
    const normalized = String(markdownText).replace(/\r\n/g, "\n");
    const lines = normalized.split(/\n/);
    const html = [];
    let inList = false;
    let listType = null;

    function closeList() {
      if (!inList) return;
      html.push(listType === "ol" ? "</ol>" : "</ul>");
      inList = false;
      listType = null;
    }

    lines.forEach((rawLine) => {
      const line = rawLine.replace(/\s+$/g, "");
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        html.push("");
        return;
      }

      const headingMatch = trimmed.match(/^#{1,6}\s*(\S.*)$/);
      if (headingMatch) {
        closeList();
        const level = Math.min(6, (trimmed.match(/^#{1,6}/)?.[0]?.length) || 1);
        const content = headingMatch[1] ?? "";
        html.push(`<h${level}>${formatInlineMarkdown(content)}</h${level}>`);
        return;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (orderedMatch) {
        const content = orderedMatch[1] ?? "";
        if (!inList || listType !== "ol") {
          closeList();
          html.push("<ol>");
          inList = true;
          listType = "ol";
        }
        html.push(`<li>${formatInlineMarkdown(content)}</li>`);
        return;
      }

      const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
      if (unorderedMatch) {
        const content = unorderedMatch[1] ?? "";
        if (!inList || listType !== "ul") {
          closeList();
          html.push("<ul>");
          inList = true;
          listType = "ul";
        }
        html.push(`<li>${formatInlineMarkdown(content)}</li>`);
        return;
      }

      closeList();
      html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
    });

    closeList();

    return html
      .filter((fragment) => fragment !== null && fragment !== undefined)
      .join("\n");
  }

  function summaryStartsWithHeading(summaryText) {
    if (!summaryText) return false;
    const lines = String(summaryText)
      .replace(/\r\n/g, "\n")
      .split(/\n/)
      .map((line) => line.trim());
    const firstContentLine = lines.find((line) => line.length > 0);
    if (!firstContentLine) return false;
    return /^#{1,6}(?:\s|$)/.test(firstContentLine);
  }

  function setStatus(message, kind = "info") {
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = `uni-summary-status${kind === "error" ? " error" : ""}`;
    if (message && typeof message === "object" && "nodeType" in message) {
      p.appendChild(message);
    } else {
      p.textContent = String(message ?? "");
    }
    bodyEl.appendChild(p);
  }

  function escapeRegExp(value) {
    return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function extractModuleTitle(row) {
    const fallbackTitle = String(row?.node_id || "Module").trim() || "Module";
    const directModuleName = String(row?.module_name || row?.module_title || row?.module || "").trim();
    if (directModuleName) return directModuleName;

    const nodeName = String(row?.node_name || "").trim();
    if (!nodeName) return fallbackTitle;

    const courseCandidates = [];
    const rowCourseName = String(row?.course_name || "").trim();
    if (rowCourseName) courseCandidates.push(rowCourseName);
    const storedCourseName = String(window.__uniCourseName || "").trim();
    if (storedCourseName) courseCandidates.push(storedCourseName);
    if (normalizedCourse) courseCandidates.push(normalizedCourse);

    const separators = "\\-\\u2013\\u2014:|/\\u203a>•~";

    for (const candidate of courseCandidates) {
      const trimmedCandidate = String(candidate || "").trim();
      if (!trimmedCandidate) continue;
      const pattern = new RegExp(`^${escapeRegExp(trimmedCandidate)}\\s*([${separators}]+\\s*)?`, "i");
      const reduced = nodeName.replace(pattern, "").trim();
      if (reduced) return reduced;
    }

    const parts = nodeName
      .split(/[\-\u2013\u2014:|/\u203a>•~]+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }

    return nodeName || fallbackTitle;
  }

  function renderModules(rows) {
    if (!bodyEl) return;
    const list = Array.isArray(rows) ? rows.slice() : [];
    window.__uniSummaryData = {
      courseId: normalizedCourse,
      fetchedAt: new Date().toISOString(),
      rows: list.slice()
    };

    if (list.length === 0) {
      setStatus("No completed modules to show yet. Your summaries will appear here once you finish modules.");
      return;
    }

    const sorted = list.sort(compareSummaryRows);

    bodyEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    sorted.forEach((row) => {
      const article = document.createElement("article");
      article.className = "uni-summary-item";
      if (row?.node_id) article.dataset.nodeId = row.node_id;
      if (row?.session_id) article.dataset.sessionId = row.session_id;

      const summaryText = extractSummaryText(row);
      const pendingGeneration = shouldGenerateSummary(row);
      const showTitle = !summaryStartsWithHeading(summaryText);

      if (showTitle) {
        const titleEl = document.createElement("h3");
        titleEl.className = "uni-summary-item-title";
        titleEl.textContent = extractModuleTitle(row);
        article.appendChild(titleEl);
      }

      const bodyPara = document.createElement("div");
      bodyPara.className = "uni-summary-item-body";
      if (summaryText) {
        const rendered = renderMarkdown(summaryText);
        if (rendered) {
          bodyPara.innerHTML = rendered;
        } else {
          bodyPara.textContent = summaryText;
        }
        if (row?.summary_source) {
          bodyPara.dataset.source = row.summary_source;
        } else {
          bodyPara.dataset.source = "summary";
        }
        bodyPara.dataset.summaryState = "ready";
      } else if (pendingGeneration) {
        bodyPara.dataset.summaryState = "pending";
        const statusWrap = document.createElement("p");
        statusWrap.className = "uni-summary-status";
        const dots = createLoadingDots("Generating summary");
        statusWrap.appendChild(dots);
        statusWrap.appendChild(document.createTextNode(" Generating summary…"));
        bodyPara.appendChild(statusWrap);
      } else {
        bodyPara.dataset.summaryState = "empty";
        bodyPara.textContent = "No summary captured yet.";
      }

      article.appendChild(bodyPara);
      frag.appendChild(article);
    });

    bodyEl.appendChild(frag);
    markModulesReady();
  }

  function cleanId(value) {
    return String(value || "").trim();
  }

  async function requestSummaryForRow(row) {
    if (!row || typeof row !== "object") return;
    const courseId = cleanId(row.course_id || normalizedCourse).toUpperCase();
    const nodeId = cleanId(row.node_id).toUpperCase();
    if (!courseId || !nodeId) return;

    let email = cleanId(row.email || resolveUserEmail()).toLowerCase();
    if (!email) {
      email = await waitForUserEmail(4000);
      email = cleanId(email).toLowerCase();
    }
    if (!email) return;
    rememberUserEmail(email);

    const sessionId = cleanId(row.session_id) || null;
    const courseName = cleanId(row.course_name || window.__uniCourseName || `Course ${courseId}`);
    const nodeName = cleanId(row.node_name || extractModuleTitle(row) || nodeId);

    const key = [email, courseId, nodeId, sessionId || ""].join("|").toLowerCase();
    window.__uniSummaryQueue = window.__uniSummaryQueue || Object.create(null);
    const queue = window.__uniSummaryQueue;
    const last = queue[key];
    if (last && Date.now() - last < 15000) {
      return;
    }
    queue[key] = Date.now();
    setTimeout(() => {
      if (window.__uniSummaryQueue) delete window.__uniSummaryQueue[key];
    }, 60000);

    const payload = {
      course_id: courseId,
      node_id: nodeId,
      session_id: sessionId,
      email,
      course_name: courseName,
      node_name: nodeName
    };

    try {
      const res = await apiFetch(CREATE_SUMMARY_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        console.warn("[UNI][summary] create-summary failed", { status: res.status, body: json, payload });
      } else {
        console.info("[UNI][summary] summary generation requested", {
          course_id: courseId,
          node_id: nodeId,
          session_id: sessionId
        });
      }
    } catch (err) {
      console.warn("[UNI][summary] create-summary error", err);
    }
  }

  async function triggerMissingSummaries(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return false;
    let hasMissing = false;
    const tasks = [];
    rows.forEach((row) => {
      if (!shouldGenerateSummary(row)) return;
      hasMissing = true;
      tasks.push(requestSummaryForRow(row));
    });
    if (!hasMissing) return false;
    if (tasks.length) {
      await Promise.allSettled(tasks);
    }
    return true;
  }

  function scheduleSummaryRefresh() {
    if (!normalizedCourse) return;
    if (summaryRefreshAttempts >= 5) return;
    if (summaryRefreshHandle) return;
    summaryRefreshHandle = setTimeout(() => {
      summaryRefreshHandle = null;
      summaryRefreshAttempts += 1;
      loadSummaries(normalizedCourse, true);
    }, 6000);
  }

  async function loadSummaries(courseId, isRetry = false) {
    if (!courseId) return;
    if (!isRetry) {
      summaryRefreshAttempts = 0;
    }
    if (summaryRefreshHandle) {
      clearTimeout(summaryRefreshHandle);
      summaryRefreshHandle = null;
    }

    const shouldShowSpinner = !isRetry && (!bodyEl || bodyEl.children.length === 0);
    if (shouldShowSpinner) {
      setStatus(createLoadingDots("Loading module summaries"));
    }
    try {
      const res = await apiFetch(`${SUMMARY_ENDPOINT}?course=${encodeURIComponent(courseId)}`, { method: "GET" });
      if (!res.ok) throw new Error(`pull-summary ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json?.data) ? json.data : [];
      renderModules(rows);
      triggerMissingSummaries(rows)
        .then((hasMissing) => {
          if (!hasMissing) {
            summaryRefreshAttempts = 0;
            return;
          }
          scheduleSummaryRefresh();
        })
        .catch((err) => {
          console.warn("[UNI][summary] trigger-missing failed", err);
        });
    } catch (err) {
      console.error("[UNI][summary] load", err);
      setStatus("We couldn’t load your completed modules right now. Please refresh or try again shortly.", "error");
    }
  }

  async function fetchCourseName(courseId) {
    const fallback = `Course ${courseId}`;
    const endpoint = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/ai-tutor-api/graph";
    try {
      const res = await apiFetch(`${endpoint}?courseId=${encodeURIComponent(courseId)}`, { method: "GET" });
      if (!res.ok) throw new Error(`graph fetch ${res.status}`);
      const data = await res.json();
      const name =
        data?.graph?.course?.title ||
        data?.graph?.title ||
        data?.graph?.name ||
        data?.title ||
        data?.name ||
        fallback;
      const clean = String(name || "").trim();
      return clean || fallback;
    } catch (err) {
      console.error("[UNI][summary][course-name]", err);
      return fallback;
    }
  }

  if (!normalizedCourse) {
    setStatus("Select a course to view your notes.");
    return;
  }

  loadSummaries(normalizedCourse);

  fetchCourseName(normalizedCourse)
    .then((name) => {
      window.__uniCourseName = name;
      if (headingEl) headingEl.textContent = name;
      try {
        localStorage.setItem(
          "uni:lastNames",
          JSON.stringify({ courseName: name, moduleName: "" })
        );
      } catch {}
    })
    .catch(() => {
      window.__uniCourseName = fallbackName;
      if (headingEl && !headingEl.textContent && fallbackName) {
        headingEl.textContent = fallbackName;
      }
    });
})();
