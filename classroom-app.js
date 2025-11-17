(function () {
  const CLASSROOM_WRAPPER_ID = "universio-classroom";
  const CLASSROOM_DATA_ID = "uni-data";
  const MARKED_CDN = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";

  function ensureWrapper() {
    return new Promise((resolve) => {
      const insert = () => {
        let wrapper = document.getElementById(CLASSROOM_WRAPPER_ID);
        if (!wrapper) {
          wrapper = document.createElement("div");
          wrapper.id = CLASSROOM_WRAPPER_ID;
          wrapper.setAttribute("data-uni-root", "classroom");
          const scriptHost =
            (typeof document !== "undefined" &&
              typeof document.currentScript !== "undefined" &&
              document.currentScript &&
              (document.currentScript.closest?.("[data-element-type=\"custom_code\"]") ||
                document.currentScript.closest?.("section") ||
                document.currentScript.parentElement)) ||
            null;
          let parent = scriptHost || document.body || document.documentElement;
          parent.appendChild(wrapper);
        }

        let dataSpan = document.getElementById(CLASSROOM_DATA_ID);
        if (!dataSpan) {
          dataSpan = document.createElement("span");
          dataSpan.id = CLASSROOM_DATA_ID;
          dataSpan.setAttribute("data-graph", "");
          dataSpan.setAttribute("data-node", "");
          dataSpan.style.display = "none";
          wrapper.appendChild(dataSpan);
        }
        resolve();
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", insert, { once: true });
      } else {
        insert();
      }
    });
  }

  function ensureStyleOverrides() {
    if (document.getElementById("um-input-row-only-card")) return;
    const style = document.createElement("style");
    style.id = "um-input-row-only-card";
    style.textContent = `
    .uni-root .uni-card {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
    }
    .uni-root .uni-card-header {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin-bottom: 8px !important;
    }
    .uni-root .uni-section {
        background: transparent !important;
        padding: 0 !important;
    }
    .uni-root .uni-messages {
        background: transparent !important;
        padding: 0 0 12px 0 !important;
        box-shadow: none !important;
    }
    .uni-root .uni-input-row {
        background: var(--card) !important;
        border: 2px solid var(--border) !important;
        box-shadow: var(--shadow) !important;
        border-radius: 24px !important;
        padding: 8px !important;
        margin-top: 12px !important;
        align-items: center !important;
    }
    .uni-root .uni-input-row .uni-input {
        height: 40px !important;
        background: #fff !important;
        border-radius: 12px !important;
    }
    .uni-root .uni-input-row .uni-send {
        box-shadow: none !important;
    }
    .uni-root .uni-input-row .mic-btn {
        border-color: rgba(0, 0, 0, 0.08) !important;
    }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function loadMarked() {
    if (window.marked) return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = MARKED_CDN;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      (document.head || document.documentElement).appendChild(script);
    });
  }

  const wrapperReady = ensureWrapper();
  ensureStyleOverrides();

  const init = () => {
    window.__UNI_DEBUG = false; // set true when debugging
    const debug = (...a) => {
        if (window.__UNI_DEBUG) console.log(...a);
    };

    const BOOTSTRAP_URL = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap";
    const ISSUE_CERT_URL = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/issue-certificate";
    const CREATE_SUMMARY_URL = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/create-summary";

    const LAST_EMAIL_KEY = "uni:lastEmail";

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

    function parseSoftrValue(value) {
        if (value == null) return "";
        if (Array.isArray(value)) {
            for (const entry of value) {
                const parsed = parseSoftrValue(entry);
                if (parsed) return parsed;
            }
            return "";
        }
        if (typeof value === "object") {
            const preferred = ["label", "value", "id", "name", "text"];
            for (const key of preferred) {
                if (value[key] != null) {
                    const parsed = parseSoftrValue(value[key]);
                    if (parsed) return parsed;
                }
            }
            return "";
        }
        const str = String(value || "").trim();
        if (!str) return "";
        const looksJson = (str.startsWith("{") && str.endsWith("}")) || (str.startsWith("[") && str.endsWith("]"));
        if (looksJson) {
            try {
                const parsed = JSON.parse(str);
                return parseSoftrValue(parsed);
            } catch {}
        }
        return str;
    }

    function extractCourseCode(value) {
        const text = parseSoftrValue(value);
        if (!text) return "";
        const match = text.match(/C\d{3}/i);
        return match ? match[0].toUpperCase() : "";
    }

    const NODE_CODE_PATTERN = /(CAP(?:_[A-Z0-9]+)?|[A-Z]{2,}\d{1,3})/i;

    function extractNodeCode(value) {
        const text = parseSoftrValue(value);
        if (!text) return "";
        const match = text.match(NODE_CODE_PATTERN);
        return match ? match[0].toUpperCase() : "";
    }

    const CAPSTONE_ID_PATTERN = /^CAP(?:_|$)/i;

    function toCourseKey(course) {
        return String(course || "").trim().toUpperCase();
    }

    function toShortCourse(course) {
        const m = toCourseKey(course).match(/^C\d{3}/);
        return m ? m[0] : "";
    }

    function deriveCourseCapstoneId(course) {
        const courseKey = toCourseKey(course);
        const short = toShortCourse(courseKey);
        if (!courseKey) return "CAP";
        if (courseKey && CAPSTONE_ID_PATTERN.test(courseKey) && courseKey !== "CAP") {
            return courseKey.toUpperCase();
        }
        if (short) return `CAP_${short}`;
        if (courseKey && !CAPSTONE_ID_PATTERN.test(courseKey)) {
            return `CAP_${courseKey}`;
        }
        return "CAP";
    }

    function canonicalizeCapstoneId(nodeId) {
        const id = String(nodeId || "").toUpperCase();
        if (!CAPSTONE_ID_PATTERN.test(id)) return id;
        return id.startsWith("CAP_") ? "CAP" : id;
    }

    function cacheCapstoneNode(course, nodeId) {
        const courseKey = toCourseKey(course);
        const nodeKey = String(nodeId || "").trim().toUpperCase();
        if (!courseKey || !nodeKey || !CAPSTONE_ID_PATTERN.test(nodeKey)) return;
        window.__capstoneNodes = window.__capstoneNodes || {};
        window.__capstoneNodes[courseKey] = nodeKey;
        const short = toShortCourse(courseKey);
        if (short) window.__capstoneNodes[short] = nodeKey;
    }

    function getCachedCapstoneNode(course) {
        const courseKey = toCourseKey(course);
        if (!courseKey) return null;
        const cache = window.__capstoneNodes || {};
        const short = toShortCourse(courseKey);
        return cache[courseKey] || (short ? cache[short] : null) || null;
    }

    function extractCapstoneFromUrl(urlLike) {
        try {
            const u = new URL(urlLike, location.origin);
            const node = String(u.searchParams.get("node") || "").toUpperCase();
            if (CAPSTONE_ID_PATTERN.test(node)) return node;
        } catch {}
        return null;
    }

    function resolveCapstoneNode(course, nodes = [], fallback = "CAP") {
        const list = Array.isArray(nodes) ? nodes : [];
        for (const n of list) {
            const id = n?.id != null ? String(n.id).toUpperCase() : "";
            if (CAPSTONE_ID_PATTERN.test(id) && id !== "CAP") {
                cacheCapstoneNode(course, id);
                return id;
            }
        }

        const cached = getCachedCapstoneNode(course);
        if (cached) return cached;

        const hints = window.__U?.courseHints || {};
        const courseKey = toCourseKey(course);
        const short = toShortCourse(courseKey);
        const entry = (short && (hints[short] || null)) || hints[courseKey] || null;
        if (entry) {
            const viaHint = extractCapstoneFromUrl(entry.nextEligibleUrl) || extractCapstoneFromUrl(entry.resumeUrl);
            if (viaHint) {
                cacheCapstoneNode(course, viaHint);
                return viaHint;
            }
        }

        const fallbackId = String(fallback || "").toUpperCase();
        if (CAPSTONE_ID_PATTERN.test(fallbackId) && fallbackId !== "CAP") {
            cacheCapstoneNode(course, fallbackId);
            return fallbackId;
        }

        const derived = deriveCourseCapstoneId(courseKey || fallbackId);
        if (derived) {
            cacheCapstoneNode(course, derived);
            return derived;
        }

        return "CAP";
    }


    // 🧩 Warm-up Softr user (ensures logged_in_user is ready before first CWT call)
    if (!window.logged_in_user && window.parent && window.parent.logged_in_user) {
        try {
            window.logged_in_user = window.parent.logged_in_user;
            console.info("[BOOT PATCH] Warmed Softr user from parent frame early");
        } catch (e) {
            console.warn("[BOOT PATCH] Could not warm Softr user early", e);
        }
    }



    // ---- SINGLETON GUARD ----
    if (window.__uniClassroomInit) {
        console.debug("[UNI] duplicate init prevented");
    } else {
        window.__uniClassroomInit = true;

        // ---- DOM READY HOOK ----
        if (document.readyState === "complete" || document.readyState === "interactive") {
            startUniversio();
        } else {
            document.addEventListener("DOMContentLoaded", startUniversio);
        }
    }

    // ---- MAIN FUNCTION ----
    async function startUniversio() {
        const dataEl = document.getElementById("uni-data");
        const rawGraphAttr = dataEl?.dataset?.graph || "";
        const rawNodeAttr = dataEl?.dataset?.node || "";
        const qs = new URLSearchParams(location.search);
        const bootstrapCtx = (() => {
            const boot = getBootstrap?.();
            return boot?.lastContext || boot?.last || null;
        })();
        const storedCtx = (() => {
            try {
                return JSON.parse(localStorage.getItem("uni:lastContext") || "{}");
            } catch {
                return null;
            }
        })();

        const courseCandidates = [
            rawGraphAttr,
            qs.get("graph"),
            qs.get("graph_id"),
            bootstrapCtx?.graphId,
            bootstrapCtx?.course_id,
            bootstrapCtx?.courseId,
            storedCtx?.graphId,
            storedCtx?.course_id,
        ];
        let graphId = "";
        for (const candidate of courseCandidates) {
            const code = extractCourseCode(candidate);
            if (code) {
                graphId = code;
                break;
            }
        }
        if (!graphId) {
            const fallbackCourse = courseCandidates
                .map((v) => parseSoftrValue(v))
                .find((val) => val && !val.includes("{{"));
            if (fallbackCourse) {
                const match = fallbackCourse.match(/C\d{3}/i);
                graphId = match ? match[0].toUpperCase() : fallbackCourse.toUpperCase();
            }
        }

        const nodeCandidates = [
            rawNodeAttr,
            qs.get("node"),
            qs.get("node_id"),
            bootstrapCtx?.nodeId,
            bootstrapCtx?.node_id,
            storedCtx?.nodeId,
            storedCtx?.node_id,
        ];
        let nodeId = "";
        for (const candidate of nodeCandidates) {
            const code = extractNodeCode(candidate);
            if (code) {
                nodeId = code;
                break;
            }
        }
        if (!nodeId) {
            const fallbackNode = nodeCandidates
                .map((v) => parseSoftrValue(v))
                .find((val) => val && !val.includes("{{"));
            if (fallbackNode) nodeId = fallbackNode.toUpperCase();
        }

        console.info("[UNI][context]", { graphId, nodeId, rawGraph: rawGraphAttr, rawNode: rawNodeAttr });

        // --- ensure universio:bootstrapped fires once after first user-bootstrap success ---
        const __uni_orig_fetch = window.fetch;
        let __uni_bootstrapFired = false;
        window.fetch = async (...a) => {
            const r = await __uni_orig_fetch(...a);
            const u = a[0];
            if (!__uni_bootstrapFired && typeof u === "string" && u.includes("/v1/user-bootstrap")) {
                try {
                    const j = await r.clone().json();
                    if (j?.ok && j?.data?.cwt) {
                        __uni_bootstrapFired = true; // 🛑 prevent repeats
                        window.__U = j.data;
                        rememberUserEmail(j?.data?.profile?.email || j?.profile?.email || j?.data?.profile?.softr_user_email);
                        window.dispatchEvent(new CustomEvent("universio:bootstrapped", { detail: j.data }));
                    }
                } catch {}
            }
            return r;
        };

        // --- CAPSTONE MODE DETECTION ---
        const isCapstone = /[?&]capstone\b/i.test(location.search) || location.pathname.includes("/capstone");
        const capstoneGraphHint = (() => {
            if (!isCapstone) return "";
            const qsGraph = new URLSearchParams(location.search).get("graph") || "";
            return extractCourseCode(qsGraph) || qsGraph.toUpperCase();
        })();
        if (isCapstone && !graphId && capstoneGraphHint) {
            graphId = capstoneGraphHint;
        }
        if (isCapstone && (!nodeId || nodeId === "CAP")) {
            nodeId = resolveCapstoneNode(
                graphId || capstoneGraphHint || storedCtx?.graphId || window.__U?.lastGraph || "",
                window.__lastGraphNodes,
                nodeId || "CAP"
            );
        }
        if (isCapstone) {
            console.info("[UNI][capstone-mode]", graphId || capstoneGraphHint || window.__U?.lastGraph || "");
        }

        const COMPLETE_KEY = () => `uni:completed:${window.__uniGraphId}:${window.__uniNodeId}`;

        // Persist once we have context
        if (graphId && nodeId) {
            try {
                localStorage.setItem("uni:lastContext", JSON.stringify({ graphId, nodeId }));
            } catch {}
        }

        // --- normalize graphId to short form (C001–C015) ---
        graphId = (graphId.match(/^C\d{3}/i) || [graphId])[0].toUpperCase();
        console.info("[UNI][graphId-normalized]", graphId);

        if (CAPSTONE_ID_PATTERN.test(nodeId) && graphId) {
            cacheCapstoneNode(graphId, nodeId);
        }

        window.__uniGraphId = graphId;
        window.__uniNodeId = nodeId;
        window.__uniCanonicalNodeId = canonicalizeCapstoneId(nodeId);

        // --- GRAPH CONTEXT GUARD ---
        // If the active graph differs from what was previously loaded, force-clear titles and cache.
        if (window.__U?.lastGraph && window.__U.lastGraph !== graphId) {
            console.warn("[UNI][context] Detected graph change:", window.__U.lastGraph, "→", graphId);
            // Clear cached names to prevent wrong titles
            try {
                localStorage.removeItem("uni:lastNames");
            } catch {}
            window.__uniCourseName = null;
            window.__uniModuleName = null;

            // Reset header elements if already rendered
            const h1 = document.querySelector('[id$="-planHeader"]');
            const h2 = document.querySelector('[id$="-subHeader"]');
            if (h1) h1.textContent = "";
            if (h2) h2.textContent = "";

            // Remove any cached bootstrap hint for the previous graph
            if (window.__U?.courseHints) {
                delete window.__U.courseHints[window.__U.lastGraph];
            }
        }

        // Always record the current graph as the last one opened
        window.__U = window.__U || {};
        window.__U.lastGraph = graphId;

        // -------- Helpers --------
        function injectStyles(cssText) {
            const s = document.createElement("style");
            s.textContent = cssText;
            document.head.appendChild(s);
        }
        function el(tag, attrs = {}, children = []) {
            const n = document.createElement(tag);
            Object.entries(attrs).forEach(([k, v]) => {
                if (k === "class") n.className = v;
                else if (k === "html") n.innerHTML = v;
                else n.setAttribute(k, v);
            });
            (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
            return n;
        }
        function htmlEscape(s) {
            return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        function renderInlineMD(s) {
            let out = htmlEscape(s);
            out = out.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
            out = out.replace(/(\*|_)([^*_]+?)\1/g, "<em>$2</em>");
            out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
            out = out.replace(/\n/g, "<br>");
            return out;
        }

        function renderMarkdown(text) {
            if (window.marked && typeof window.marked.parse === "function") {
                return window.marked.parse(text, { breaks: true, gfm: true });
            }
            if (typeof window.marked === "function") {
                return window.marked(text);
            }
            return renderInlineMD(text);
        }

        function sanitizeAssistantText(s) {
            let out = String(s || "");

            // Remove any fenced code blocks (we don't show code in tutor bubbles)
            out = out.replace(/```[\s\S]*?```/g, "");

            // --- 3) Drop a standalone Title-case heading on the very first line (e.g., "Sources of Bias")
            out = out.replace(/^\s*([A-Z][A-Za-z0-9,&’'`\- ]{2,60})\s*(?:\r?\n)+/, (m, title) => {
                return /[.?!:]/.test(title) ? m : "";
            });

            // --- 4) Remove any remaining bare "**" lines
            out = out.replace(/(^|\n)\s*\*\*\s*($|\n)/g, "$1");

            // --- 5a) Remove leading "TITLE:" prefix on first line
            out = out.replace(/^\s*TITLE\s*:\s*/i, "");

            // --- 5b) Remove orphan bold markers like "** " at line starts
            out = out.replace(/(^|\n)\s*\*\*\s+/g, "$1");

            // --- 5c) Remove leading progress counters like "1/5"
            out = out.replace(/(^|\n)\s*\d+\s*\/\s*\d+\s*/g, "$1");

            // --- 5d) Drop first line if it looks like a topic header (no sentence-ending punctuation)
            out = (function (x) {
                const arr = x.split(/\r?\n/);
                if (!arr.length) return x;
                const first = (arr[0] || "").trim();
                if (first && !/[.?!]\s*$/.test(first)) {
                    arr.shift();
                    return arr.join("\n").trim();
                }
                return x;
            })(out);

            // --- 5e) Ensure single blank line between paragraphs; collapse >2 to exactly 2
            out = out.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");

            // --- 5f) Enforce a paragraph line cap (<= 6–7 lines): insert a blank line after 6 lines
            out = out
                .split("\n\n")
                .map((block) => {
                    const bLines = block.split("\n");
                    if (bLines.length <= 7) return block;
                    const res = [];
                    for (let i = 0; i < bLines.length; i++) {
                        res.push(bLines[i]);
                        if ((i + 1) % 6 === 0 && i !== bLines.length - 1) res.push("");
                    }
                    return res.join("\n");
                })
                .join("\n\n");

            // --- 6) Collapse extra blank lines
            out = out.replace(/\n{3,}/g, "\n\n").trim();

            return out;
        }

        // Emphasize tutor questions in italics (wrap whole question lines ending in "?")
        function italicizeTutorQuestions(s) {
            return String(s).replace(/(^|\n)([^\n]*?\?)(?=(\s*($|\n)))/g, (m, lead, q) => {
                // Skip if already italicized or contains code/HTML italics
                if (/\*(?:[^*]+)\*/.test(q) || /_(?:[^_]+)_/.test(q) || /<em>/.test(q) || /`/.test(q)) {
                    return lead + q;
                }
                return lead + `*${q}*`;
            });
        }

        // Keep the first question line; drop all later question lines.

        // A "question line" = a line that ends with "?" (matches italicizeTutorQuestions rule).
        function enforceOneQuestion(s, suppressAll = false) {
            const lines = String(s || "").split(/\r?\n/);
            let kept = false;
            const out = [];

            for (const line of lines) {
                if (/\?\s*$/.test(line)) {
                    if (suppressAll) continue; // QC present → no visible question at all
                    if (kept) continue; // already kept the first question → drop this one
                    kept = true; // keep *only* the first question line
                }
                out.push(line);
            }
            return out.filter(Boolean).join("\n");
        }

        // Remove a dangling final artifact line (e.g., │, •, ·, —, *, `, quotes, or a lone I/l).
        function cleanupTrailingArtifacts(s) {
            const lines = String(s || "").split(/\r?\n/);
            if (!lines.length) return s;

            let last = (lines[lines.length - 1] || "").trim();

            // Remove stray artifacts like │, •, ·, —, *, `, quotes, non-breaking space, or lone letters
            const isGlyph = /^[|¦│▏•·●○▪▫◦─—–*`'"]$/.test(last);
            const isSingleLetter = /^[A-Za-z]$/.test(last);
            const isVeryShortWord = /^[A-Za-z]{1,2}$/.test(last);
            const isInvisible = /^[\u200b\u200c\u200d\u2060\s]*$/.test(last);

            if (last === "" || isGlyph || isSingleLetter || isVeryShortWord || isInvisible) {
                lines.pop();
            }

            // 🔍 Additionally, remove any trailing <p></p> or <br> artifacts from markdown rendering
            return lines
                .join("\n")
                .replace(/(<p>[\s\u200b]*<\/p>|<br>\s*)+$/gi, "")
                .trim();
        }

        function prepareAssistantText(source, { suppressQuestions = false } = {}) {
            let text = sanitizeAssistantText(source || "");
            text = enforceOneQuestion(text, suppressQuestions);
            text = italicizeTutorQuestions(text);
            text = cleanupTrailingArtifacts(text);
            return text;
        }

        function normalizeQuickCheckMeta(raw) {
            if (!raw) return [];
            if (Array.isArray(raw)) {
                return raw.filter((entry) => entry && typeof entry === "object");
            }
            if (typeof raw === "object") return [raw];
            return [];
        }

        function boolish(value) {
            if (typeof value === "boolean") return value;
            if (typeof value === "number") return value !== 0;
            if (typeof value === "string") return /^(true|1|yes|y)$/i.test(value.trim());
            return false;
        }

        function coerceQuickCheckString(value) {
            if (value == null) return "";
            if (typeof value === "string") return value.trim();
            if (typeof value === "number" || typeof value === "boolean") return String(value);
            if (Array.isArray(value)) {
                for (const entry of value) {
                    const str = coerceQuickCheckString(entry);
                    if (str) return str;
                }
                return "";
            }
            if (typeof value === "object") {
                const preferred = ["text", "prompt", "label", "value", "title", "question", "description", "body"];
                for (const key of preferred) {
                    if (key in value) {
                        const str = coerceQuickCheckString(value[key]);
                        if (str) return str;
                    }
                }
            }
            return "";
        }

        function interpretQuickCheck(raw) {
            const entries = normalizeQuickCheckMeta(raw);
            if (!entries.length) return null;
            const entry = entries[0] || {};
            const typeHints = [entry.type, entry.mode, entry.display, entry.ui, entry.kind, entry.variant, entry.intent]
                .map((v) => String(v || "").toLowerCase())
                .filter(Boolean);
            const suppress =
                boolish(entry.suppress) ||
                boolish(entry.hide) ||
                boolish(entry.disabled) ||
                boolish(entry.suppress_bubble) ||
                typeHints.some((hint) => ["suppress", "hidden", "hide", "omit", "none", "silent"].includes(hint));
            const hasCustomHint =
                boolish(entry.custom_ui) ||
                boolish(entry.card) ||
                !!entry.component ||
                !!entry.html ||
                Array.isArray(entry.options) ||
                Array.isArray(entry.choices) ||
                typeHints.some((hint) =>
                    ["custom", "interactive", "ui", "card", "widget", "multiple_choice", "multichoice", "poll", "quiz"].some(
                        (target) => hint.includes(target)
                    )
                );
            const action = suppress ? "suppress" : hasCustomHint ? "custom" : "plain";
            const promptText =
                coerceQuickCheckString(entry.prompt) ||
                coerceQuickCheckString(entry.question) ||
                coerceQuickCheckString(entry.text);
            const suppressQuestion =
                suppress ||
                boolish(entry.suppress_question) ||
                boolish(entry.hide_question) ||
                typeHints.some((hint) => ["ui_only", "custom", "interactive"].includes(hint));
            const id = coerceQuickCheckString(entry.id) || coerceQuickCheckString(entry.key) || "";
            return {
                action,
                entry,
                entries,
                id: id || null,
                text: promptText || "",
                suppressQuestion,
            };
        }

        function extractQuickCheckOption(option, idx = 0) {
            if (option == null) {
                return {
                    value: String(idx),
                    label: `Option ${idx + 1}`,
                    detail: "",
                };
            }
            if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
                const val = String(option);
                return {
                    value: val,
                    label: val,
                    detail: "",
                };
            }
            const value =
                coerceQuickCheckString(option.value) ||
                coerceQuickCheckString(option.id) ||
                coerceQuickCheckString(option.key) ||
                String(idx);
            const label =
                coerceQuickCheckString(option.label) ||
                coerceQuickCheckString(option.text) ||
                coerceQuickCheckString(option.title) ||
                value ||
                `Option ${idx + 1}`;
            const detail = coerceQuickCheckString(option.detail) || coerceQuickCheckString(option.description);
            return {
                value: value || String(idx),
                label: label || `Option ${idx + 1}`,
                detail: detail || "",
            };
        }

        // Promote paragraph breaks for tutor text: turn single \n before cue-lines into \n\n
        function ensureParagraphBreaks(s) {
            return (
                String(s)
                    // Cue phrases: "To achieve our objectives", "Let's dive", "Self-awareness", etc.
                    .replace(/\n(?=(To achieve our objectives|Let[’']s dive|Self[- ]awareness|Key Idea:|Application:|Now,|Next,|Consider:))/g, "\n\n")
                    // Generic: if a sentence ended, and the next line starts with a Capital word, also promote
                    .replace(/([.!?])\s*\n(?=[A-Z][a-zA-Z])/g, "$1\n\n")
                    // NEW: if the next line is *italic* or _italic_ (e.g., your final question), promote to a new paragraph
                    // Use a negative lookbehind so we don't add extra space when there's already a blank line.
                    .replace(/(?<!\n)\n(?=\s*(\*[^*\n]+\*|_[^_\n]+_))/gm, "\n\n")
            );
        }

        function endWithPrompt(t) {
            // No generic closer; contract requires one good question max (or zero if QC).
            return String(t || "").trim();
        }

        // Pull learner motivation for adaptive nudges
        function getBootstrapMotivation() {
            const u = getBootstrap();
            return (u?.profile?.motivation || "").toString().slice(0, 500);
        }

        // If names are not loaded yet, restore last known names (with Capstone override)
        if (!window.__uniCourseName || !window.__uniModuleName) {
            try {
                const ln = JSON.parse(localStorage.getItem("uni:lastNames") || "{}");
                if (!window.__uniCourseName && ln.courseName) window.__uniCourseName = ln.courseName;

                const isCapstoneNode = CAPSTONE_ID_PATTERN.test(String(window.__uniNodeId || ""));
                if (isCapstoneNode) {
                    window.__uniModuleName = "Capstone Completion";
                } else if (!window.__uniModuleName && ln.moduleName) {
                    window.__uniModuleName = ln.moduleName;
                }
            } catch {}
        }

        function makeLoader() {
            return el("div", { class: "uni-loader-orbit" }, [el("span"), el("span"), el("span")]);
        }

        function showTypingBubble() {
            if (!messagesEl) return null;
            let existing = document.querySelector(`#${ROOT_ID} .uni-bubble.tutor.typing`);
            if (existing) return existing;

            const elTyping = el("div", { class: "uni-bubble tutor typing" }, [el("div", { class: "uni-loader-orbit" }, [el("span"), el("span"), el("span")])]);
            messagesEl.appendChild(elTyping);
            requestAnimationFrame(scrollToBottom);
            return elTyping;
        }

        function hideTypingBubble(ref) {
            try {
                (ref || document.querySelector(`#${ROOT_ID} .uni-bubble.tutor.typing`))?.remove();
            } catch {}
        }

        let hasUserInput = false;
        let autoScrollEnabled = false; // harmless default; you already set it to true after history overflow

        // -------- Config --------
        // -- window.__uniUserId = userId; // optional: make it globally inspectable

        const convoBase = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/ai-tutor-api";
        
// === CWT Unified Manager ===
async function getCWT() {
  return window.__U?.cwt || null;
}

async function fetchCWT() {
  console.debug("Fetching getBootstrapToken");
  if (window.__U?.cwt && Date.parse(window.__U.cwt_expires_at || 0) > Date.now()) {
    return window.__U.cwt;
}
  let email = resolveUserEmail();
  if (!email) {
    email = await waitForUserEmail(6000);
  }
  if (!email) throw new Error("Cannot fetch CWT — missing user email");
  rememberUserEmail(email);

  const res = await fetch(
    "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );

  if (!res.ok) throw new Error("CWT request failed " + res.status);
  const { cwt, cwt_expires_at } = await res.json();
  if (!cwt) throw new Error("No token in response");

  window.__U = window.__U || {};
  window.__U.cwt = cwt;
  window.__U.cwt_expires_at = cwt_expires_at;
  if (!window.__U.profile) window.__U.profile = {};
  if (!window.__U.profile.email) window.__U.profile.email = email;
  return cwt;
}

    async function ensureFreshCWT() {
        const exp = Date.parse(window.__U?.cwt_expires_at || 0);
        const now = Date.now();
        if (window.__U?.cwt && exp && exp - now > 120000) {
            return window.__U.cwt;
        }
        return await fetchCWT();
    }

    function apiHeaders(includeJSON = true) {
        const headers = includeJSON ? { "Content-Type": "application/json" } : {};
        const cwt = window.__U?.cwt;
        if (cwt) headers["Authorization"] = `Bearer ${cwt}`;
        return headers;
    }

    async function issueCourseCertificate({ email, courseId, courseName, name, type = "mc_cert" } = {}) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedCourse = String(courseId || "").trim().toUpperCase();
        const normalizedName = normalizeFullName ? normalizeFullName(name) : String(name || "").trim();
        if (!normalizedEmail || !normalizedCourse) return null;

        window.__issuedCourseCerts = window.__issuedCourseCerts || {};
        const cacheKey = `${normalizedEmail}__${normalizedCourse}__${type}__${normalizedName || ""}`;
        if (window.__issuedCourseCerts[cacheKey]) {
            return window.__issuedCourseCerts[cacheKey];
        }

        try {
            await ensureFreshCWT();
        } catch (err) {
            console.warn("[cert status] token refresh before issuing failed", err);
        }

        const headers = apiHeaders(true);
        const payload = { type, course_id: normalizedCourse };
        if (courseName) payload.course_name = courseName;
        if (normalizedName) {
            payload.name = normalizedName;
        } else if (name) {
            payload.name = String(name);
        }

        let json = null;
        try {
            const res = await fetch(ISSUE_CERT_URL, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });
            json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                console.warn("[cert status] issue-certificate rejected", { status: res.status, body: json });
                return null;
            }
        } catch (err) {
            console.warn("[cert status] issue-certificate failed", err);
            return null;
        }

        window.__issuedCourseCerts[cacheKey] = json;
        return json;
    }

async function apiFetch(url, init = {}) {
  await ensureFreshCWT();
  const headers = { ...apiHeaders(false), ...(init.headers || {}) };
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    await fetchCWT();
    res = await fetch(url, { ...init, headers: apiHeaders(false) });
  }
  return res;
}

window.ensureFreshCWT = ensureFreshCWT;




// === [CWT Safety Pulse] — lightweight self-heal if token missing/stale ===
async function cwtSafetyPulse(attempt = 1) {
  try {
    const email = resolveUserEmail();
    const exp = Date.parse(window.__U?.cwt_expires_at || 0);
    const missing = !window.__U?.cwt;
    const stale = exp && exp < Date.now();

    if (email && (missing || stale)) {
      console.warn(`[CWT Pulse] token refresh (attempt ${attempt})`);
      await fetchCWT(); // quick reissue
    }
  } catch (err) {
    console.warn("[CWT Pulse] refresh attempt failed", err);
  }

  const nextInterval = attempt < 3 ? 15000 : 120000;
  setTimeout(() => cwtSafetyPulse(attempt + 1), nextInterval);
}

// ✅ start pulse after Softr user boots
window.addEventListener("universio:bootstrapped", () => {
  setTimeout(() => cwtSafetyPulse(), 3000);
});

        // --- Pull and Assign userID via Bootstrap
        function getUserId() {
            const u = getBootstrap();
            return u?.profile?.user_id || u?.profile?.id || null;
        }

        let userId = getUserId();

        // 🔧 Fix: fallback to bootstrap.profile.id if userId missing after initial load
        if (!userId && window.__U?.profile?.id) {
            userId = window.__U.profile.id;
            console.log("[UNI][fix] userId restored from bootstrap:", userId);
        }


        // 🔧 Extra guard: if still missing, wait briefly for bootstrap event
        if (!userId) {
            window.addEventListener("universio:bootstrapped", () => {
                const late = getUserId() || window.__U?.profile?.id || null;
                if (late) {
                    window.__uniUserId = late;
                    console.log("[UNI][fix] userId restored after bootstrapped:", late);
                }
            });
        }

        window.__uniUserId = userId;

        // --- Bootstrap helpers ---
        function getBootstrap() {
            return window.__U || null;
        }

        function getBootstrapPrefs() {
            const u = getBootstrap();
            const p = u?.profile || {};
            return {
                pref_tone: p.pref_tone || "Neutral",
                pref_pace: p.pref_pace || "Balanced",
            };
        }

        window.readPersistedProgress = readPersistedProgress;

        // 🧩 HARD DEFER patch — waits until parser finishes compiling functions
        setTimeout(async () => {
            debug("[BOOT FLAG #1] Before CWT check: entering ensureFreshCWT()");

            // 🧩 Wait a few ms for Softr globals to populate (fixes first-open hang)
            const deadline = Date.now() + 1200; // wait up to 1.2s
            let emailReady = resolveUserEmail();
            while ((!emailReady || !window.__U) && Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 100));
                emailReady = resolveUserEmail();
            }
            if (!emailReady) console.warn("[BOOT PATCH] Softr user still undefined after waitReady");

            // Wrap fetch with retry on 401
            
            
    
            
            
        }, 0);

        // Cache key for minutes-left
        const LEFT_KEY = `uni:minutesLeft:${graphId}`;

        // Track how many ms we've already billed for this node to avoid re-sending after reloads
        const BILLED_KEY = `uni:billed:${graphId}:${nodeId}:ms`;
        const PROG_KEY = `uni:progress:${graphId}:${nodeId}`;

        function coerceProgressFraction(value) {
            if (value == null) return 0;
            let num = typeof value === "string" ? parseFloat(value) : Number(value);
            if (!isFinite(num)) return 0;
            if (num <= 0) return 0;
            if (num <= 1) return Math.min(1, num);
            if (num >= 100) return 1;
            return Math.min(num / 100, 1);
        }

        function coerceProgressPercent(value) {
            return Math.round(coerceProgressFraction(value) * 100);
        }

        function readStoredProgressFraction() {
            try {
                const raw = localStorage.getItem(PROG_KEY);
                if (raw == null) return 0;
                return coerceProgressFraction(raw);
            } catch {
                return 0;
            }
        }

        function writeStoredProgressFraction(fraction) {
            const clean = Math.max(0, Math.min(1, Number(fraction) || 0));
            try {
                localStorage.setItem(PROG_KEY, String(clean));
            } catch {}
        }

        function updateProgressUI(pct) {
            const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));

            // Header pill in your chat card
            const headerPill = document.getElementById(ROOT_ID + "-progress");
            if (headerPill) {
                headerPill.textContent = n >= 100 ? "Completed" : `${n}%`;
                headerPill.setAttribute("aria-label", n >= 100 ? "Module completed" : `Module progress ${n} percent`);
            }

            // Nav overlay pill (left of time markers)
            const navPill = ensureNavProgressPill();
            if (navPill) {
                navPill.textContent = n >= 100 ? "Completed" : `${n}%`;
                navPill.setAttribute("aria-label", n >= 100 ? "Module completed" : `Module progress ${n} percent`);
                navPill.style.setProperty("--p", n + "%"); // ⬅️ NEW: drive the fill
                // ✅ Animate upward pulse for visible progress jumps
                navPill.setAttribute("data-anim", "up");
                setTimeout(() => navPill.removeAttribute("data-anim"), 300);
                navPill.style.color = n >= 50 ? "#fff" : "#000"; // ⬅️ NEW: keep text readable
                // width may have changed → reposition to keep the 8px hug
                positionNavPill();
            }
            writeStoredProgressFraction(n / 100);
        }

        // optional: for console testing
        window.updateProgressUI = updateProgressUI;

        // --- Nav overlay pill (left of the timer) ---
        function positionNavPill() {
            const pill = document.getElementById("uniNavProgressPill");
            const timer = document.getElementById("uniTimerFixed");
            if (!pill) return;

            // If we have the timer, hug its left edge; otherwise keep a sensible fallback
            if (timer) {
                const r = timer.getBoundingClientRect();
                // place pill centered vertically with the timer, and 8px to its left
                const margin = 4;
                // ensure layout pass so offsetWidth/Height are current
                const w = pill.offsetWidth || 60;
                const h = pill.offsetHeight || 33;

                let left = Math.round(r.left - w - margin);
                if (left < 8) left = 8; // keep on-screen

                pill.style.top = Math.round(r.top + (r.height - h) / 2) + "px";
                pill.style.left = left + "px";
                pill.style.right = "auto";
                // show pill only after #uniTimerLeft has text (prevents early layout nudge)
                const leftHasText = !!document.getElementById("uniTimerLeft")?.textContent?.trim();
                pill.style.visibility = leftHasText ? "visible" : "hidden";
            } else {
                // fallback (rare): top-right corner
                pill.style.top = "10px";
                pill.style.right = "10px";
                pill.style.left = "auto";
                pill.style.visibility = "visible";
            }
        }

        function ensureNavProgressPill() {
            let pill = document.getElementById("uniNavProgressPill");
            if (!pill) {
                pill = document.createElement("div");
                pill.id = "uniNavProgressPill";
                pill.setAttribute("role", "status");
                pill.setAttribute("aria-live", "polite");
                pill.textContent = "0%";
                document.body.appendChild(pill);

                // Reposition on resize/orientation
                window.addEventListener("resize", positionNavPill, { passive: true });
                window.addEventListener("orientationchange", positionNavPill);
            }

            // If/when the timer appears or resizes, keep pill aligned
            const attachObservers = () => {
                const t = document.getElementById("uniTimerFixed");
                if (!t) return false;
                try {
                    new ResizeObserver(positionNavPill).observe(t);
                } catch {}
                return true;
            };

            if (!attachObservers()) {
                // Watch for the timer to be added later
                const mo = new MutationObserver(() => {
                    if (attachObservers()) mo.disconnect();
                    positionNavPill();
                });
                mo.observe(document.body, { childList: true, subtree: true });
            }

            // Initial position attempt
            positionNavPill();
            return pill;
        }

        // If we have a cached remaining, show it immediately
        try {
            const cachedLeft = Number(localStorage.getItem(LEFT_KEY));
            if (!Number.isNaN(cachedLeft)) {
                window.dispatchEvent(new CustomEvent("uni:minutes-left", { detail: { remaining: cachedLeft } }));
            }
        } catch {}

        // Fetch fresh minutes-left without consuming time (dry-run)
        async function fetchMinutesLeftNow() {
            const r = await apiFetch("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/ai-tutor-api/time/remaining", {
              method: "POST",
              body: "{}",
            });
            if (!r.ok) {
                console.warn("[time-remaining] failed", r.status);
                return;
            }

            const j = await r.json();
            const remainingMs = Number(j?.remaining_ms ?? NaN);
            const remainingMin = Math.floor(remainingMs / 60000);

            if (Number.isFinite(remainingMin)) {
                try {
                    localStorage.setItem(LEFT_KEY, String(remainingMin));
                } catch {}
                window.dispatchEvent(new CustomEvent("uni:minutes-left", { detail: { remaining: remainingMin } }));
            }
        }

        window.fetchMinutesLeftNow = fetchMinutesLeftNow;

        // [CLASSROOM-ADD-1] Send active-time delta to user-bootstrap (uses CWT in apiHeaders)
        async function sendActiveDelta(deltaMs, final = false) {
            if (deltaMs <= 0) return;
            const graphId = window.__uniGraphId || document.getElementById("uni-data")?.dataset?.graph || "UNK_GRAPH";
            const nodeId = window.__uniNodeId || document.getElementById("uni-data")?.dataset?.node || "UNK_NODE";
            const userId = window.__uniUserId || getUserId();
            const email = resolveUserEmail();

            const payload = {
                delta_ms: deltaMs,
                graphId,
                nodeId,
                user_id: userId, // ✅ for backend correlation
                email, // ✅ optional fallback
                when: new Date().toISOString(),
                source: "web",
                device: navigator.userAgent,
            };
            let j = null; // ✅ define outside try so finally can see it
            try {
                const r = await apiFetch("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/ai-tutor-api/time/ingest", {
                  method: "POST",
                  body: JSON.stringify(payload),
                });

                j = await r.json().catch(() => ({}));
                console.log("[time-ingest]", j);

                // --- Emit remaining minutes for header + pills ---
                const remainingMin = j?.updated?.remaining_today_minutes ?? j?.updated?.remaining_minutes ?? (j?.updated?.remaining_ms ? Math.floor(j.updated.remaining_ms / 60000) : null);

                if (typeof remainingMin === "number") {
                    try {
                        localStorage.setItem(LEFT_KEY, String(remainingMin));
                    } catch {}
                    window.dispatchEvent(new CustomEvent("uni:minutes-left", { detail: { remaining: remainingMin } }));

                    // Auto-pause if out of time
                    if (remainingMin <= 0) {
                        window.uniTimer?.pause?.();
                    }
                }
            } catch (err) {
                console.warn("[time-ingest failed]", err);
            } finally {
                window.__UNI_DELTA_LOCK__ = false;
                // ✅ update last-ingest timestamp if successful
                if (j?.ok) window.__lastIngestAt = Date.now();
            }
        }

        // expose for console testing
        window.sendActiveDelta = sendActiveDelta;

        // Update the header timer's "minutes left" subline whenever time-ingest replies
        window.addEventListener("uni:minutes-left", (e) => {
            const remaining = e.detail?.remaining; // ✅ will now be minutes, integer

            const el = document.getElementById("uniTimerFixed");
            const leftEl = document.getElementById("uniTimerLeft");
            const timeEl = document.getElementById("uniTimerTime");
            if (!el || !leftEl || typeof remaining !== "number") return;

            // Write tooltip + visible subline
            el.title = `${remaining} min left`;
            leftEl.textContent = `${remaining} min left`;

            // Keep ARIA label in sync (a11y)
            el.setAttribute("aria-label", `${timeEl?.textContent || ""}${leftEl.textContent ? ", " + leftEl.textContent : ""}`);

            // Keep the overlay pill hugging the timer
            positionNavPill?.();

            // Optional: auto-pause at limit
            if (remaining <= 0) {
                window.uniTimer?.pause?.();
                // addMessage?.('tutor', '⏳ You’ve reached today’s study time for your plan.', false);
            }
        });


        // Run a callback once the CWT is present (event or short fallback) — idempotent
        function onBootstrappedOnce(fn) {
            let ran = false;
            const handler = () => {
                if (!ran && getCWT()) {
                    ran = true;
                    try {
                        fn();
                    } catch {}
                }
            };
            window.addEventListener("universio:bootstrapped", handler, { once: true });

            // 👇 one-time fallback in case the event never fires (e.g., bootstrap already happened)
            setTimeout(handler, 800);
        }

        let voice = { active: false, convo: null };
        // ---- Helper to start fresh and clear old voice rooms
        async function cleanupVoiceSession() {
            if (voice.convo) {
                try {
                    console.debug("[voice] cleaning up old session");
                    await voice.convo.endSession();
                } catch (e) {
                    console.warn("[voice] error ending old session", e);
                }
                voice.convo = null;
            }
            voice.active = false;
            __voiceConnecting = false;

            // clear flush timers
            clearTimeout(window.__userFlushT);
            clearTimeout(window.__tutorFlushT);
            clearTimeout(window.__voiceFlushT);

            __userBuffer = "";
            __tutorBuffer = "";
            __userLiveEl = null;
            __tutorLiveEl = null;
        }

        // --- Session handle (localStorage) ---
        let sessionId = null;
        function SESSION_KEY() {
            const uid = window.__uniUserId || "";
            return `classroom:${uid}:${graphId}:${nodeId}:sessionId`;
        }
        function setSession(id) {
            sessionId = id;
            try {
                localStorage.setItem(SESSION_KEY(), id);
            } catch {}
            window.__uniSessionId = id;
            uniResetCadence(id);
        }

        function extractVoiceText(msg) {
            if (!msg) return "";
            if (typeof msg === "string") return msg;
            if (typeof msg.output_text === "string") return msg.output_text;
            if (Array.isArray(msg.output_text)) return msg.output_text.join("");
            if (typeof msg.content === "string") return msg.content;
            if (Array.isArray(msg.content)) return msg.content.map((c) => (typeof c === "string" ? c : c?.text || c?.content || "")).join("");
            if (msg.agent_response?.content) {
                const c = msg.agent_response.content;
                return Array.isArray(c) ? c.map((s) => (typeof s === "string" ? s : s?.text || "")).join("") : typeof c === "string" ? c : "";
            }
            try {
                return JSON.stringify(msg);
            } catch {
                return String(msg);
            }
        }

        // Unwrap ElevenLabs voice payloads into { role: 'assistant'|'user', text: '...' }
        function unwrapVoiceMessage(msg) {
            let role = "assistant";
            let text = "";

            // If msg is a string that looks like JSON, try to parse
            if (typeof msg === "string") {
                const s = msg.trim();
                if (s.startsWith("{") || s.startsWith("[")) {
                    try {
                        const obj = JSON.parse(s);
                        return unwrapVoiceMessage(obj);
                    } catch {
                        return { role, text: s };
                    }
                }
                return { role, text: s };
            }

            // If it's an object:
            if (!msg) return { role, text };

            // common envelope {source, message}
            if (typeof msg.source === "string" && msg.message != null) {
                role = msg.source === "user" ? "user" : "assistant";
                text = typeof msg.message === "string" ? msg.message : Array.isArray(msg.message) ? msg.message.join("") : String(msg.message ?? "");
                return { role, text };
            }

            // SDK-shaped responses
            if (typeof msg.output_text === "string") return { role, text: msg.output_text };
            if (Array.isArray(msg.output_text)) return { role, text: msg.output_text.join("") };

            if (typeof msg.content === "string") return { role, text: msg.content };
            if (Array.isArray(msg.content)) return { role, text: msg.content.map((c) => (typeof c === "string" ? c : c?.text || c?.content || "")).join("") };

            if (msg.agent_response?.content) {
                const c = msg.agent_response.content;
                if (typeof c === "string") return { role, text: c };
                if (Array.isArray(c)) return { role, text: c.map((s) => (typeof s === "string" ? s : s?.text || "")).join("") };
            }

            // user transcript envelopes
            if (msg.user_transcript?.text) return { role: "user", text: msg.user_transcript.text };
            if (msg.user?.transcript) return { role: "user", text: msg.user.transcript };

            try {
                return { role, text: JSON.stringify(msg) };
            } catch {
                return { role, text: String(msg) };
            }
        }

        // --- GA helper: hash user email for privacy-safe identity ---
        async function sha256Hex(input) {
            const data = new TextEncoder().encode(input);
            const hash = await crypto.subtle.digest("SHA-256", data);
            return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
        }

        function toFirst(s) {
            const t = String(s || "").trim();
            if (!t) return "";
            return t
                .split(/\s+/)[0]
                .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’\-]/g, "")
                .replace(/^(.)(.*)$/, (m, a, b) => a.toUpperCase() + b);
        }
        function fromEmailPrefix(e) {
            const p = String(e || "")
                .split("@")[0]
                .replace(/[._-]+/g, " ")
                .trim();
            return toFirst(p);
        }
        function normalizeFullName(value) {
            const raw = String(value || "").replace(/[\s\u00A0]+/g, " ").trim();
            if (!raw) return "";
            return raw
                .split(" ")
                .map((part) => part.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’\-]/g, "").replace(/^(.)(.*)$/, (m, a, b) => a.toUpperCase() + b))
                .filter(Boolean)
                .join(" ");
        }
        function getFullName() {
            try {
                const candidates = [];
                if (window.__U?.profile) {
                    const prof = window.__U.profile;
                    candidates.push(prof.full_name, prof.name, prof.display_name, prof.first_name && prof.last_name ? `${prof.first_name} ${prof.last_name}` : "");
                }
                candidates.push(
                    window.LOGGED_IN_USER?.NAME,
                    window.logged_in_user?.softr_user_full_name,
                    window.logged_in_user?.full_name,
                    window.logged_in_user?.name,
                    window.logged_in_user?.display_name,
                    window.logged_in_user?.first_name && window.logged_in_user?.last_name
                        ? `${window.logged_in_user.first_name} ${window.logged_in_user.last_name}`
                        : ""
                );
                for (const candidate of candidates) {
                    const clean = normalizeFullName(candidate);
                    if (clean) return clean;
                }
            } catch {}
            return normalizeFullName(window.__uniUserName) || "";
        }
        function getFirstName() {
            try {
                if (window.LOGGED_IN_USER?.NAME) return toFirst(window.LOGGED_IN_USER.NAME);
                const u = window.logged_in_user || {};
                return toFirst(u.softr_user_full_name) || toFirst(u.full_name) || toFirst(u.name) || toFirst(u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : "") || fromEmailPrefix(u.softr_user_email) || "";
            } catch {
                return "";
            }
        }

        function setVoiceUI(mode) {
            // 'listening' | 'speaking' | null
            micBtn.classList.toggle("active", !!mode);
            micBtn.classList.toggle("speaking", mode === "speaking");
            micBtn.classList.toggle("listening", mode === "listening");
        }

        // Positive-text detector for Uni cheers (simple sentiment heuristic)
        function isPositiveText(txt) {
            const t = String(txt || "").toLowerCase();
            return /\b(thanks|thank you|got it|makes sense|perfect|awesome|great|nice|helpful|works now|i (understand|get it)|enjoy|enjoying|interesting|super interesting|appreciat(e|ion)|love it)\b/.test(t);
        }

        // --- Mastery logger (front-end console)
        function logMastery(evt, detail = {}) {
            try {
                console.info(`[UNI][mastery] ${evt}`, {
                    graphId: window.__uniGraphId,
                    nodeId: window.__uniNodeId,
                    ...detail,
                });
            } catch {}
        }

        // ---- GA emit helper ----
        function emitGA(event, params = {}) {
            try {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ event, ...params });
            } catch {}
        }

        // === Uni helpers ===
        const UNI_AVATAR_SRC = "https://assets.softr-files.com/applications/6200748e-9f61-4ecf-85e2-62d4993f521e/assets/3869c85d-250a-4c87-8e25-8ca98c84ae50.png";

        let __uniCheerTurns = 0; // counts user turns between cheers
        let __uniNextCheerAt = 3 + Math.floor(Math.random() * 4); // 3..6

        function uniResetCadence(seed) {
            // deterministically seed 3..6 from session id when available
            if (seed) {
                let h = 0;
                for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
                __uniNextCheerAt = 3 + (h % 4);
            }
            __uniCheerTurns = 0;
        }

        function renderUniBubble(text, save = true) {
            const b = el("div", { class: "uni-bubble tutor uni-uni" });
            const img = el("img", { class: "uni-uni-avatar", src: UNI_AVATAR_SRC, alt: "Uni" });
            const content = el("div", { html: renderInlineMD(text) });
            b.append(img, content);
            messagesEl.appendChild(b);
            requestAnimationFrame(scrollToBottom);

            // NEW: persist Uni messages (unless replaying history)
            if (save) {
                conversation.push({ sender: "uni", text });
                saveConversationState();
            }

            // GA
            try {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                    event: "uni_cheer_shown",
                    graph_id: window.__uniGraphId,
                    node_id: window.__uniNodeId,
                    session_id: window.__uniSessionId,
                    cadence: __uniNextCheerAt,
                });
            } catch {}
        }

        // === Refresh courseHints from user-bootstrap (uses Softr email) HELPER SECTION FOR TRANSITION TO NEXT NODE ===
        async function refreshCourseHints() {
            const email = resolveUserEmail();
            if (!email) {
                console.warn("[completion] no Softr email; cannot refresh hints");
                return window.__U?.courseHints || null;
            }
            const res = await apiFetch(
              "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/user-bootstrap",
              {
                method: "POST",
                body: JSON.stringify({ email, include_last_activity: true }),
              }
            );
            const j = await res.json().catch(() => ({}));
            const hints = j?.data?.courseHints || j?.courseHints || null;

            if (hints) {
                window.__U = window.__U || {};
                window.__U.courseHints = hints;
            }

            // --- normalize stale "nextEligibleUrl" that equals the current page ---
            try {
                const course = window.__uniGraphId || "";
                const curr = window.__uniNodeId || "";
                const short = (String(course).match(/^C\d{3}/) || [])[0] || course;
                const entry = window.__U?.courseHints?.[short] || window.__U?.courseHints?.[course] || null;

                const raw = entry?.nextEligibleUrl || entry?.resumeUrl || null;
                if (raw) {
                    const u = new URL(raw, location.origin);
                    const sameAsHere = u.pathname === location.pathname && u.search === location.search;
                    if (sameAsHere) {
                        // Compute next from the course graph (fallback) and rewrite hints in-memory

                        const baseFn = "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/ai-tutor-api";
                        const r = await apiFetch(`${baseFn}/graph?courseId=${encodeURIComponent(course)}`);
                        const j = await r.json();
                        const nodes = j?.graph?.graph?.nodes || []; // ✅ define nodes here
                        window.__lastGraphNodes = nodes;
                        const ids = nodes.map((n) => String(n.id)).filter(Boolean);
                        const num = (id) => {
                            const m = id.match(/\d+/g);
                            return m ? Number(m.join("")) : 0;
                        };
                        const order = ids.slice().sort((a, b) => num(a) - num(b) || a.localeCompare(b));
                        const i = order.indexOf(curr);
                        const nextId = i >= 0 && i < order.length - 1 ? order[i + 1] : null;

                        if (nextId && nodes.some((n) => String(n.id) === nextId)) {
                            // ✅ Found a real next node
                            target = `/classroom?graph=${window.__uniGraphId}&node=${nextId}`;
                        } else {
                            // 🚀 No valid next node → Capstone
                            usedGraph = true; // analytics branch
                            const capId = resolveCapstoneNode(window.__uniGraphId, nodes);
                            target = `/classroom?graph=${window.__uniGraphId}&node=${capId}`;
                        }
                    }
                }
            } catch {}

            return hints;
        }
        window.refreshCourseHints = refreshCourseHints;

        async function readPersistedProgress() {
            const { courseName, moduleName } = resolveCourseModuleNames();
            const res = await apiFetch(convoBase + "/lesson/progress", {
                method: "POST",
                body: JSON.stringify({
                    graphId: window.__uniGraphId,
                    nodeId: window.__uniNodeId,
                    mode: "read",
                    course_name: courseName,
                    node_name: moduleName,
                }),
            });
            if (!res.ok) return { score: null, status: null };
            return res.json();
        }

        // === Read nextEligibleUrl for current course (short code) ===
        function getNextEligibleUrlForCourseSafe() {
            const short = String(window.__uniGraphId || "").match(/^C\d{3}/)?.[0] || null;
            const hints = window.__U?.courseHints || {};
            return (short && (hints[short]?.nextEligibleUrl || hints[short]?.resumeUrl)) || hints[window.__uniGraphId]?.nextEligibleUrl || hints[window.__uniGraphId]?.resumeUrl || null;
        }

        // === Minimal completion banner ===
        (function installCompletionBannerStyles() {
            const css = `
    #uniCompleteBanner{
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: calc(env(safe-area-inset-bottom,0) + 16px);
      z-index: 99999;
      background: #111; color:#fff; border-radius: 999px;
      padding: 10px 12px; display:flex; gap: 10px; align-items:center;
      box-shadow: 0 8px 24px rgba(0,0,0,.25); font-size:.90rem;
    }
    #uniCompleteBanner .label{ margin-right:6px; }
    #uniCompleteBanner .btn{
      background:#fff; color:#000; border:0; border-radius:999px;
      padding:8px 12px; cursor:pointer; font-size:.9rem; line-height:1;
    }
    #uniCompleteBanner .btn.secondary{ background:transparent; color:#fff; outline:1px solid rgba(255,255,255,.35); }
    @media (max-width:480px){ #uniCompleteBanner{ width: calc(100vw - 24px); justify-content:space-between; } }
  `;
            try {
                const s = document.createElement("style");
                s.textContent = css;
                document.head.appendChild(s);
            } catch {}
        })();

        function showCompletionBanner(nextUrl) {
            try {
                document.getElementById("uniCompleteBanner")?.remove();
            } catch {}
            const bar = document.createElement("div");
            bar.id = "uniCompleteBanner";
            bar.setAttribute("role", "status");
            bar.setAttribute("aria-live", "polite");

            const label = document.createElement("span");
            label.className = "label";
            label.textContent = "Module Complete ✓";

            const btnGo = document.createElement("button");
            btnGo.className = "btn";
            btnGo.textContent = "Continue";

            const btnDash = document.createElement("button");
            btnDash.className = "btn secondary";
            btnDash.textContent = "Dashboard";

            // prevent implicit form submit
            btnGo.type = "button";
            btnDash.type = "button";

            // CLICK HANDLERS
            btnGo.onclick = async () => {
                btnGo.disabled = true;
                btnGo.setAttribute("aria-busy", "true");
                btnGo.textContent = "Continuing…";

                // --- CLEANUP: hide completion banner immediately ---
                try {
                    const banner = document.getElementById("uniCompleteBanner");
                    if (banner) {
                        banner.style.transition = "opacity 0.3s ease";
                        banner.style.opacity = "0";
                        setTimeout(() => banner.remove(), 300);
                    }
                    // Reset pill to prepare for new node
                    localStorage.removeItem(PROG_KEY);
                    updateProgressUI(0);
                } catch (e) {
                    console.warn("[UNI][Continue] cleanup failed", e);
                }

                // Always refresh hints; if still missing, recompute from graph
                try {
                    await refreshCourseHints();
                    const course = window.__uniGraphId;
                    const hintEntry = window.__U?.courseHints?.[course];
                    if (!hintEntry?.nextEligibleUrl) {
                        console.warn("[UNI][fix-hints]", "No nextEligibleUrl found, forcing graph recompute");
                        const res = await apiFetch(`${convoBase}/graph?courseId=${encodeURIComponent(course)}`);
                        const j = await res.json();
                        const nodes = j?.graph?.graph?.nodes || [];
                        window.__lastGraphNodes = nodes;
                        const ids = nodes.map((n) => String(n.id)).filter(Boolean);
                        const num = (id) => {
                            const m = id.match(/\d+/g);
                            return m ? Number(m.join("")) : 0;
                        };
                        const order = ids.slice().sort((a, b) => num(a) - num(b) || a.localeCompare(b));
                        const curr = window.__uniNodeId;
                        const i = order.indexOf(curr);
                        const nextId = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
                        const capId = resolveCapstoneNode(course, nodes);
                        window.__U.courseHints[course] = {
                            ...(hintEntry || {}),
                            nextEligibleUrl: nextId
                                ? `/classroom?graph=${course}&node=${nextId}`
                                : `/classroom?graph=${course}&node=${capId}`,
                        };
                    }
                } catch {}

                let target = __safeNextUrl();
                let usedGraph = false;

                // if hints are missing/stale or point to this page/dashboard → compute from graph
                const sameAsHere = (() => {
                    try {
                        const u = new URL(target, location.origin);
                        return u.pathname === location.pathname && u.search === location.search;
                    } catch {
                        return false;
                    }
                })();

                if (!target || sameAsHere || /\/dashboard$/.test(String(target))) {
                    try {
                        const res = await apiFetch(`${convoBase}/graph?courseId=${encodeURIComponent(window.__uniGraphId)}`);
                        const j = await res.json();
                        const nodes = j?.graph?.graph?.nodes || [];
                        window.__lastGraphNodes = nodes;
                        const ids = nodes.map((n) => String(n.id)).filter(Boolean);
                        const num = (id) => {
                            const m = id.match(/\d+/g);
                            return m ? Number(m.join("")) : 0;
                        };
                        const order = ids.slice().sort((a, b) => num(a) - num(b) || a.localeCompare(b));
                        const curr = window.__uniNodeId;
                        const i = order.indexOf(curr);
                        const nextId = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
                        if (nextId) {
                            target = `/classroom?graph=${window.__uniGraphId}&node=${nextId}`;
                        } else {
                            const capId = resolveCapstoneNode(window.__uniGraphId, nodes);
                            target = `/classroom?graph=${window.__uniGraphId}&node=${capId}`;
                            usedGraph = true;
                        }
                    } catch {}
                }

                try {
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({
                        event: "uni_cta_continue",
                        course: window.__uniGraphId,
                        node: window.__uniNodeId,
                        branch: usedGraph ? "graph_fallback" : "hints",
                        target: target || "/dashboard",
                    });
                    console.info("[CTA] continue", { branch: usedGraph ? "graph_fallback" : "hints", target });
                } catch {}

                // ✅ Persist new context before redirect (prevents reload loop)
                try {
                    const url = new URL(target, location.origin);
                    const graphId = url.searchParams.get("graph") || window.__uniGraphId;
                    const nodeId =
                        url.searchParams.get("node") || resolveCapstoneNode(graphId, window.__lastGraphNodes);
                    localStorage.setItem("uni:lastContext", JSON.stringify({ graphId, nodeId }));
                } catch (e) {
                    console.warn("[CAP redirect persist failed]", e);
                }

                window.location.replace(target || "/dashboard"); // forces a full reload so startUniversio() runs
            };

            btnDash.onclick = () => {
                location.href = "/dashboard";
            };

            // append (unchanged)
            bar.append(label, btnGo, btnDash);
            document.body.appendChild(bar);
        }

        // -------- Root + Theme bootstrap (scoped to this block) --------
        const ROOT_ID = "uni-root-" + Math.random().toString(36).slice(2, 8);
        const IDS = {
            toolbar: ROOT_ID + "-toolbar",
            toggle: ROOT_ID + "-toggle",
            messages: ROOT_ID + "-messages",
            input: ROOT_ID + "-input",
            send: ROOT_ID + "-send",
            planBody: ROOT_ID + "-plan-body",
            moduleDetail: ROOT_ID + "-module-detail",
        };

        const THEME_KEY = "uni-theme";
        let storedTheme = null;
        try {
            storedTheme = localStorage.getItem(THEME_KEY);
        } catch {}
        const initialTheme = storedTheme || "light";

        // --- CLEANUP: remove stale completion banner & reset pill if coming from a completed node ---
        try {
            const oldBanner = document.getElementById("uniCompleteBanner");
            if (oldBanner) {
                console.info("[UNI] Removing stale completion banner on new module load");
                oldBanner.remove();
            }
            // Reset pill text back to 0% and clear stored progress
            localStorage.removeItem(PROG_KEY);
            updateProgressUI(0);
        } catch (e) {
            console.warn("[UNI] Cleanup failed", e);
        }

        // Create root right after the Softr span (keeps scope contained)
        const wrapper = document.getElementById("universio-classroom");
        const rootEl = el("div", { id: ROOT_ID, class: "uni-root", "data-theme": initialTheme });
        rootEl.style.colorScheme = initialTheme;
        wrapper.insertBefore(rootEl, dataEl?.nextSibling || null);

        // -------- Find and control the Softr wrapper background --------
        function getRGB(str) {
            return (str || "").replace(/\s+/g, "").toLowerCase();
        }
        function isGhostWhite(el) {
            const cs = getComputedStyle(el);
            const bg = getRGB(cs.backgroundColor);
            return bg === "rgb(248,248,255)" || bg === "#f8f8ff";
        }
        function findShellEl() {
            const candidates = [rootEl.closest('[data-element-type="custom_code"]'), rootEl.closest(".softr-section"), rootEl.closest("section"), rootEl.parentElement].filter(Boolean);
            for (const el of candidates) if (isGhostWhite(el)) return el;
            let cur = rootEl.parentElement,
                hops = 0;
            while (cur && hops++ < 6) {
                if (isGhostWhite(cur)) return cur;
                cur = cur.parentElement;
            }
            return candidates[0] || rootEl.parentElement || null;
        }
        const shellEl = findShellEl();

        const GRADIENT_LIGHT =
            "radial-gradient(1200px 800px at 0% 0%, rgba(214,236,255,.95) 0%, rgba(214,236,255,0) 80%)," +
            "radial-gradient(1100px 720px at 100% 0%, rgba(236,209,255,.92) 0%, rgba(236,209,255,0) 120%)," +
            "linear-gradient(to bottom, rgba(248,248,255,0) 0%, rgba(248,248,255,0) 70%, rgba(235,236,240,1) 100%)";
        const GRADIENT_DARK = "linear-gradient(#0F1222, #0F1222)";

        rootEl.style.setProperty("--uni-shell-gradient-light", GRADIENT_LIGHT);
        rootEl.style.setProperty("--uni-shell-gradient-dark", GRADIENT_DARK);

        function applyShellBg(theme) {
            const gradient = theme === "dark" ? GRADIENT_DARK : GRADIENT_LIGHT;
            rootEl.style.setProperty("--uni-shell-gradient", gradient);
            if (!shellEl) return;
            if (theme === "dark") {
                shellEl.style.setProperty("background-color", "#0F1222", "important");
            } else {
                shellEl.style.setProperty("background-color", "#F8F8FF", "important");
            }
            shellEl.style.setProperty("background-image", gradient, "important");
            shellEl.style.setProperty("background-repeat", "no-repeat", "important");
            shellEl.style.setProperty("background-size", "cover", "important");
            shellEl.style.setProperty("background-attachment", "scroll", "important");
            shellEl.style.setProperty("min-height", "100vh", "important");
            shellEl.style.setProperty("min-height", "100svh", "important");
            shellEl.style.setProperty("min-height", "100dvh", "important");
            shellEl.style.setProperty("box-sizing", "border-box", "important");
            shellEl.style.setProperty("overflow-x", "hidden", "important");
            shellEl.style.setProperty("width", "100%", "important");
            shellEl.style.setProperty("max-width", "100vw", "important");
            shellEl.style.setProperty("position", "relative", "important");
            shellEl.style.setProperty("padding-bottom", "calc(env(safe-area-inset-bottom, 0px) + 24px)", "important");
        }
        applyShellBg(initialTheme);

        // -------- Styles (tokens + components, all scoped to this block) --------
        injectStyles(`
    /* ===== Tokens (light) ===== */
    #${ROOT_ID} {
      --bg: #F8F8FF;
      --fg: #0F1222;
      --muted: #6b7280;


      --header-bg: rgba(248,248,248,0.13);

      --border: #E6E8F2;

      --accent: #8A3DFF;
      --accent-2: #B874FF;

      --bubble-user-border: #B874FF;
      --bubble-tutor-border: #0F1222;

      --input-bg: #ffffff;

      --link: #0F1222;
      --link-hover: #B874FF;

      --error-bg: #ffebee;
      --error-border: #ffcdd2;
      --error-fg: #c62828;

      color: var(--fg);
      background: var(--bg);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
      width: 100%;
      max-width: 100%;
      position: relative;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    #${ROOT_ID} *,
    #${ROOT_ID} *::before,
    #${ROOT_ID} *::after {
      box-sizing: inherit;
    }

    #${ROOT_ID} img,
    #${ROOT_ID} video,
    #${ROOT_ID} svg {
      max-width: 100%;
    }

    /* ===== Tokens (dark) ===== */
    #${ROOT_ID}[data-theme="dark"] {
      --bg: #0F1222;
      --fg: #E9EAF4;
      --muted: #A0A6B4;

      --card: #171A2A;
      --elev: #171A2A;
      --header-bg: #171A2A;

      --border: #23263A;
      --shadow: 0 10px 30px rgba(0,0,0,.4);

      --accent: #B874FF;
      --accent-2: #8A3DFF;

      --bubble-user-border: #B874FF;
      --bubble-tutor-border: #E6E8F2;

      --input-bg: #0F1222;

      --link: #E9EAF4;
      --link-hover: #B874FF;

      --error-bg: #2b0f14;
      --error-border: #6b1d23;
      --error-fg: #f7a0a0;
    }

    /* A little breathing room around the block */
    #${ROOT_ID} { padding: 8px 0; }

    /* ===== Toolbar ===== */
    #${ROOT_ID} .uni-toolbar {
      display:flex; align-items:center; justify-content:flex-end;
      margin: 0 auto 8px auto;
      max-width: 800px;
      padding: 0 4px;
    }

    /* Send button */
    #${ROOT_ID} .uni-send {
      width: 40px !important;
      height: 40px !important;
      min-width: 40px !important;   /* ✅ prevents shrinking in flex */
      min-height: 40px !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--fg);
      color: var(--bg);
      border: none;
      cursor: pointer;
      font-size: 16px;
      flex-shrink: 0 !important;    /* ✅ don’t compress in tight rows */
      aspect-ratio: 1 / 1;          /* ✅ modern browsers keep it square */
    }

    /* ===== Cards ===== */
    #${ROOT_ID} .uni-card {
      width: min(100%, 800px);
      max-width: 100%;
      min-width: min(300px, 100%);
      margin:16px auto;
      border:1px solid var(--border);
      border-radius:0px;
      overflow:hidden;
      box-shadow: var(--shadow);
      background: var(--card);
      box-sizing: border-box;
    }
    #${ROOT_ID} .uni-card-header {
      background: var(--header-bg);
      text-align: left;
      font-family: "Plus Jakarta Sans", Inter, Arial, sans-serif;
      font-size: 1.1rem;
      font-weight: 500;
      letter-spacing: .5px;
      color: var(--fg);
      padding: 14px;
      text-transform: uppercase;
    }
    #${ROOT_ID} .uni-card-header span {
      background:linear-gradient(90deg,var(--accent),var(--accent-2));
      -webkit-background-clip:text; background-clip:text; color:transparent;
    }

    #${ROOT_ID} .uni-section,
    #${ROOT_ID} .uni-messages {
      background: var(--elev);
      padding:16px;
      color: var(--fg);
      margin-top: 4px;
      box-sizing: border-box;
    }

    /* ===== Chat ===== */
#${ROOT_ID} .uni-messages {
  flex: 1 1 auto;
  min-height: 0;           /* let it shrink inside flex */
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  scroll-behavior: smooth;

  /* breathing room so last bubble clears the composer */
  padding-bottom: 80px;
  scroll-padding-bottom: 80px;
}

    #${ROOT_ID} .uni-bubble {
      display:inline-block; max-width:66%; line-height:1.4; word-break:break-word; overflow-wrap:anywhere;
      animation:glowIn .45s ease-out;
    }
#${ROOT_ID} .uni-bubble.user {
  background: #000; color: #fff;
  border: none;
  border-radius: 24px;
  padding: 12px 14px;
  align-self: flex-end;
  margin-left: auto;
  box-shadow: none;
    color: #fff !important;
  background-clip: initial !important;
  -webkit-background-clip: initial !important;
}

#${ROOT_ID} .uni-bubble.user * {
  color: #fff !important;
  background-clip: initial !important;
  -webkit-background-clip: initial !important;
}


#${ROOT_ID} .uni-bubble.tutor {
  background: #fff; color: #000;
  border: none;
  border-radius: 24px;
  padding: 12px 14px;
  align-self: flex-start;
  box-shadow: none;
}

    #${ROOT_ID} .uni-input-row {
      display:flex; align-items:center; gap:8px; margin-top:12px;
    }
    #${ROOT_ID} .uni-input {
      flex:1; border:1px solid var(--border); border-radius:12px;
      padding:12px 14px; font-size:14px;
      background: var(--input-bg); color: var(--fg);
      box-shadow:0 1px 2px rgba(0,0,0,.04);
    }
    #${ROOT_ID} .uni-input:focus {
      outline:none; border-color: var(--accent);
      box-shadow:0 0 0 4px rgba(138,61,255,.25);
    }

    #${ROOT_ID} .uni-send:hover { background: var(--accent-2); color: var(--bg); }

    /* ===== States ===== */
    #${ROOT_ID} .uni-error {
      color: var(--error-fg);
      padding:8px 10px; background: var(--error-bg);
      border:1px solid var(--error-border); border-radius:8px; margin:8px 0;
    }
    #${ROOT_ID} .uni-muted { opacity:.75; }

    /* ===== A11y helper ===== */
    #${ROOT_ID} .sr-only {
      position: absolute; width:1px; height:1px; padding:0; margin:-1px;
      overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
    }

    /* ===== Animations ===== */
    @keyframes glowIn {
      0% { opacity:0; transform:scale(.92); filter:blur(1px); }
      70% { opacity:.9; transform:scale(.98); filter:blur(0); }
      100% { opacity:1; transform:scale(1); }
    }
    #${ROOT_ID} .uni-bubble em { font-style: italic; }
    #${ROOT_ID} .uni-bubble code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: rgba(0,0,0,.06);
      padding: 0 3px;
      border-radius: 4px;
    }
  `);

        injectStyles(`
  /* Paragraph rhythm inside chat bubbles */
  #${ROOT_ID} .uni-bubble p{
    margin: 0 0 14px 0;         /* bottom space between paragraphs */
  }
  #${ROOT_ID} .uni-bubble p + p{
    margin-top: 14px;           /* top space for subsequent paragraphs */
  }
  /* Lists get breathing room too */
  #${ROOT_ID} .uni-bubble ul,
  #${ROOT_ID} .uni-bubble ol{
    margin: 8px 0 14px 1.25rem;
    padding-left: 1.25rem;
  }
  #${ROOT_ID} .uni-bubble li{ margin: 0 0 6px 0; }
  #${ROOT_ID} .uni-bubble li:last-child{ margin-bottom: 0; }
`);

        injectStyles(`
  /* Keep single-line bubbles compact */
  #${ROOT_ID} .uni-bubble p:last-child { margin-bottom: 0; }
  #${ROOT_ID} .uni-bubble p:only-child { margin: 0; }

  /* Lists: also remove trailing space if they end the bubble */
  #${ROOT_ID} .uni-bubble ul:last-child,
  #${ROOT_ID} .uni-bubble ol:last-child { margin-bottom: 0; }
`);

        /* Mic button look */
        injectStyles(`
    #${ROOT_ID} .mic-btn {
      background: #fff !important;
      color: #000 !important;
      border: 1px solid var(--border);
      width:40px !important; height:40px !important; border-radius:50% !important;
      display:flex !important; align-items:center !important; justify-content:center !important; padding:0 !important;
    }
    #${ROOT_ID} .mic-btn:hover { background: #f0f0f0 !important; }
    #${ROOT_ID} .mic-btn svg { display:block; margin:auto; width:18px; height:18px; }
  `);

        /* OUTER wrapper transparent; cards stay flat */
        injectStyles(`#${ROOT_ID}{ background: transparent !important; min-height: 100vh; }`);
        injectStyles(`#${ROOT_ID}[data-theme="dark"]{ background: transparent !important; }`);
        injectStyles(`#${ROOT_ID} .uni-section, #${ROOT_ID} .uni-card-header { backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }`);

        injectStyles(`
  #${ROOT_ID} .reset-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  #${ROOT_ID} .uni-reset-hint {
    font-size: 0.70rem;
    color: var(--muted);
    text-align: center;
    line-height: 1.4;
    margin-top: 6px;
    user-select: none;
  }
`);

        /* Force simple, rounded bubbles regardless of theme */
        injectStyles(`
  #${ROOT_ID} .uni-bubble.tutor { 
    background:#fff !important; color:#000 !important;
    border:none !important; box-shadow:none !important; border-radius:24px !important;
  }
  #${ROOT_ID} .uni-bubble.user  { 
    background:#000 !important; color:#fff !important;
    border:none !important; box-shadow:none !important; border-radius:24px !important;
  }
`);

        /* Solid black header text */
        injectStyles(`
    #${ROOT_ID} .uni-card-header span {
      background: none !important;
      -webkit-background-clip: initial !important;
      background-clip: initial !important;
      color: #000 !important;
    }
  `);

        injectStyles(`
  #${ROOT_ID} .uni-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between; /* title left, reset right */
  }
`);



injectStyles(`
@media (max-width: 768px) {
  /* Prevent horizontal scrolling */
  html, body {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100% !important;
    position: relative;
  }

  #${ROOT_ID} { 
    min-height: 100svh !important; 
    min-height: 100dvh !important; 
    overflow-x: hidden !important;
  }

  #${ROOT_ID} .uni-card { 
    display:flex; 
    flex-direction:column; 
    min-height:100%; 
  }

  #${ROOT_ID} .uni-section { 
    display:flex; 
    flex-direction:column; 
    flex:1 1 auto; 
    min-height:0; 
  }

  #${ROOT_ID} .uni-messages {
    flex: 1 1 auto;
    min-height: 0 !important;
    max-height: none !important;
    overflow-y: auto;
    padding-bottom: calc(env(safe-area-inset-bottom) + 13px) !important;
    scroll-padding-bottom: calc(var(--bar-h, 96px) + env(safe-area-inset-bottom) + 16px) !important;
  }

  #${ROOT_ID} .uni-messages::after {
    content: "";
    display: block;
    height: calc(var(--bar-h, 96px) + env(safe-area-inset-bottom));
    margin-top: 8px;
    pointer-events: none;
  }

/* === Outer composer edge === */
#${ROOT_ID} .uni-input-row {
  position: fixed !important;
  bottom: calc(var(--kb, 0px) + env(safe-area-inset-bottom)) !important;
  left: 0 !important;
  right: 0 !important;
  transform: none !important;
  width: 100vw !important;
  max-width: none !important;
  margin: 0 !important;
  z-index: 9999;
  padding: 12px calc(14px + env(safe-area-inset-right)) 12px calc(14px + env(safe-area-inset-left)) !important;
  box-sizing: border-box;

  /* Outer edge stays solid white */
  background: rgba(255,255,255,0.1) !important;
  border: 0.7px solid #000000 !important; /* Mobile Composer Borders */
  box-shadow: 0 12px 32px rgba(15, 18, 34, 0.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 10px !important;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* === Input section edge === */
#${ROOT_ID} .uni-input-row .uni-input {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 18px !important;
  border: 0.7px solid #000000 !important; /* exact same border look */

  /* Fully transparent input area */
  background: rgba(255,255,255,0.65) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;

  box-shadow: none !important;
  color: #0F1222 !important;
  padding: 12px 16px !important;
  transition: border-color 0.2s ease, background 0.2s ease;
}

  /* === Microphone button edge === */
  #${ROOT_ID} .uni-input-row .mic-btn {
    border: 0.7px solid #000000 !important; /* Mobile Composer Borders */
    border-radius: 50%;
    background: rgba(255,255,255,0.65) !important;
  }

  #${ROOT_ID}:not([data-ready="1"]) .uni-input-row { 
    visibility: hidden !important; 
  }
}
`);





        // -------- Build UI (inside this block only) --------
        const chatCard = el("div", { class: "uni-card" });

        const shellLoader = el(
            "div",
            {
                id: ROOT_ID + "-shell-loader",
                class: "uni-shell-loader",
                role: "status",
                "aria-live": "polite",
                "aria-hidden": "true",
                "aria-label": "Loading AI tutor",
                hidden: true,
            },
            [makeLoader()]
        );

        function showShellLoader() {
            shellLoader.hidden = false;
            shellLoader.setAttribute("aria-hidden", "false");
            rootEl?.setAttribute("data-loading", "1");
        }

        function hideShellLoader() {
            shellLoader.hidden = true;
            shellLoader.setAttribute("aria-hidden", "true");
            rootEl?.removeAttribute("data-loading");
        }

        // define reset button separately so we can reference it later
        const resetBtn = el(
            "button",
            {
                id: "classroom-reset-btn",
                class: "uni-send",
                type: "button",
                title: "Reset session (start fresh)",
            },
            [
                el("span", {
                    html: `
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
       viewBox="0 0 24 24" fill="none" stroke="#ffffff"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       style="display:block;shape-rendering:geometricPrecision">
    <polyline points="1 4 1 10 7 10"></polyline>
    <path d="M3.51 15a9 9 0 1 0 .49-5H1"></path>
  </svg>
`,
                }),
            ]
        );

        const resetHint = el("div", {
            class: "uni-reset-hint",
            html: "Restart<br>Module at 0%",
        });

        const progressPill = el(
            "div",
            {
                id: ROOT_ID + "-progress",
                class: "uni-progress",
                role: "status",
                "aria-live": "polite",
                title: "Module progress",
            },
            ""
        );

        const headerRight = el("div", { class: "uni-header-right" }, [progressPill, el("div", { class: "reset-wrapper" }, [resetBtn, resetHint])]);

        const chatHeader = el("div", { class: "uni-card-header" }, [
            el("div", {}, [
                el("span", { id: ROOT_ID + "-planHeader" }, window.__uniCourseName || ""),
                el("div", { id: ROOT_ID + "-subHeader", class: "uni-sub-header" }, window.__uniModuleName || ""),
            ]),
            headerRight,
        ]);

        function paintHeader(courseName, moduleName) {
            const planEl = document.getElementById(ROOT_ID + "-planHeader");
            if (planEl && courseName != null) planEl.textContent = String(courseName);

            const subEl = document.getElementById(ROOT_ID + "-subHeader");
            if (subEl && moduleName != null) subEl.textContent = String(moduleName);

            hideShellLoader();
        }

        if (!window.__uniCourseName || !window.__uniModuleName) {
            showShellLoader();
        }

        try {
            const cachedRaw = localStorage.getItem(PROG_KEY);
            if (cachedRaw != null) {
                updateProgressUI(coerceProgressPercent(cachedRaw));
            }
        } catch {}

        async function loadHeaderInfo(force = false) {
            // 1) keep cache guard you already use
            const lastNames = JSON.parse(localStorage.getItem("uni:lastNames") || "{}");
            if (lastNames.courseName && window.__uniGraphId && lastNames.courseName !== window.__uniGraphId) {
                console.info("[UNI] Clearing stale header cache for", lastNames.courseName, "→", window.__uniGraphId);
                localStorage.removeItem("uni:lastNames");
            }
            if (!force && window.__U?.lastGraph && window.__U.lastGraph !== window.__uniGraphId) {
                console.info("[UNI] Graph changed, reloading header info");
                localStorage.removeItem("uni:lastNames");
                window.__U.lastGraph = window.__uniGraphId;
                return await loadHeaderInfo(true);
            }
            window.__U = window.__U || {};
            window.__U.lastGraph = window.__uniGraphId;

            try {
                // 🔐 ensure CWT is loaded before calling secure endpoint
                if (typeof ensureFreshCWT === "function") {
                    await ensureFreshCWT();
                }

                // 2) get the course graph (bypasses Softr entirely)
                const gRes = await apiFetch(
                  "https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/ai-tutor-api/graph?courseId=" +
                  encodeURIComponent(window.__uniGraphId)
                );


                if (!gRes.ok) throw new Error("graph fetch " + gRes.status);
                const g = await gRes.json();

                // 3) find node by id
                const nodes = g?.graph?.graph?.nodes || [];
                const nodeIdUp = (window.__uniNodeId || "").toUpperCase();
                const searchIds = (() => {
                    const ids = [nodeIdUp];
                    if (CAPSTONE_ID_PATTERN.test(nodeIdUp)) {
                        const canonical = canonicalizeCapstoneId(nodeIdUp);
                        if (canonical && !ids.includes(canonical)) ids.push(canonical);
                    }
                    return ids;
                })();

                const node = nodes.find((n) => {
                    const id = String(n.id || "").toUpperCase();
                    return searchIds.includes(id);
                });

                // 4) derive names
                const nodeName = node?.name || (CAPSTONE_ID_PATTERN.test(nodeIdUp) ? "Capstone Completion" : window.__uniNodeId || "Module");
                // try plausible places for course title; fall back to graphId
                const courseName =
                    g?.graph?.course?.title || // ✅ Correct path for "Data Fluency for Decision-Making"
                    g?.graph?.title ||
                    g?.graph?.name ||
                    g?.title ||
                    window.__uniCourseName ||
                    `Course ${window.__uniGraphId}`;

                // 5) paint header
                paintHeader(courseName, nodeName);

                // 6) cache
                window.__uniCourseName = String(courseName);
                window.__uniModuleName = String(nodeName);
                localStorage.setItem("uni:lastNames", JSON.stringify({ courseName, moduleName: nodeName }));

                console.log("[UNI][loadHeaderInfo] graph-derived", { courseName, nodeName, nodeId: window.__uniNodeId });
            } catch (e) {
                console.error("[header loadHeaderInfo]", e);
                // graceful fallback to visible IDs
                paintHeader(`Course ${window.__uniGraphId}`, window.__uniNodeId || "Module");
            }
        }

        const chatBody = el("div", { class: "uni-section" });

        // Messages list
        const messagesEl = el("div", { class: "uni-messages", id: "classroom-messages" });
        messagesEl.setAttribute("role", "log");
        messagesEl.setAttribute("aria-live", "polite");
        messagesEl.setAttribute("aria-relevant", "additions");

        // Composer with mic + input + send
        const inputEl = el("input", { class: "uni-input", type: "text", id: "classroom-input", placeholder: "" });
        const micBtn = el(
            "button",
            {
                class: "uni-send mic-btn",
                type: "button",
                "aria-label": "Voice input",
            },
            [
                el("span", {
                    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"
         style="display:block;shape-rendering:geometricPrecision">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <path d="M12 19v3"></path>
      <path d="M8 22h8"></path>
    </svg>`,
                }),
            ]
        );
        const sendBtn = el("button", { class: "uni-send", id: "classroom-send-btn" }, "➤");

        // Define Voice session

        let Conversation; // will be loaded on demand
        let __voiceBuffer = ""; // collects streamed agent text
        let __voiceStartedAt = 0; // for duration metric in GA
        let __voiceConnecting = false; // prevent overlapping session starts
        let __voiceOutEl = null;
        let __voiceAudioCtx = null;
        let __userBuffer = "";
        let __userLiveEl = null;
        let __tutorBuffer = "";
        let __tutorLiveEl = null;
        window.__tutorFlushT = null;
        window.__userFlushT = null; // keep on window like __voiceFlushT
        window.__lastUserSaved = ""; // simple de-dupe guard

        // --- Finalize helpers: race-proof user/tutor turns ---
        let __userFinalizedAt = 0;
        let __tutorFinalizedAt = 0;

        function finalizeUserTurn(finalText) {
            const s = (finalText || __userBuffer || "").trim();
            __userBuffer = "";
            if (!s) return;

            // prevent double-finalize within 1s
            const now = Date.now();
            if (now - __userFinalizedAt < 1000) return;
            __userFinalizedAt = now;

            if (__userLiveEl) {
                __userLiveEl.setAttribute("data-final", "1");
                conversation.push({ sender: "user", text: s });
                saveConversationState();
                __userLiveEl = null;
            } else {
                addMessage("user", s, true);
            }
            window.__lastUserSaved = s;
            logMastery("user_answer_submitted", { source: "voice", length: s.length });
        }

        function finalizeTutorTurn(finalText) {
            const s = (finalText || __tutorBuffer || "").trim();
            __tutorBuffer = "";
            if (!s) return;

            const now = Date.now();
            if (now - __tutorFinalizedAt < 1000) return;
            __tutorFinalizedAt = now;

            if (__tutorLiveEl) {
                __tutorLiveEl.setAttribute("data-final", "1");
                conversation.push({ sender: "tutor", text: s });
                saveConversationState();
                __tutorLiveEl = null;
            } else {
                handleAgentMessage(s, true);
            }
            setVoiceUI?.("listening");
        }

        function ensureOutputAudio() {
            if (!__voiceOutEl) {
                __voiceOutEl = document.getElementById("uni-voice-audio");
                if (!__voiceOutEl) {
                    __voiceOutEl = el("audio", {
                        id: "uni-voice-audio",
                        // IMPORTANT for iOS Safari:
                        // playsinline + autoplay = allowed with user gesture (your mic click)
                        // do NOT set muted here (we want to hear it)
                        autoplay: "",
                        playsinline: "",
                        style: "display:none",
                    });
                    document.body.appendChild(__voiceOutEl);
                }
            }
            // Web Audio on iOS can be suspended; resume on gesture/connect
            try {
                if (!__voiceAudioCtx) {
                    const ACtx = window.AudioContext || window.webkitAudioContext;
                    if (ACtx) __voiceAudioCtx = new ACtx();
                }
                if (__voiceAudioCtx?.state === "suspended") {
                    __voiceAudioCtx.resume().catch(() => {});
                }
            } catch {}
            return __voiceOutEl;
        }

        const ELEVENLABS_JSDELIVR_BASE = "https://cdn.jsdelivr.net/npm/@elevenlabs/client";
        const ELEVENLABS_JSDELIVR_META_BASE = "https://data.jsdelivr.com/v1/packages/npm/@elevenlabs/client/resolved?specifier=latest";
        const ELEVENLABS_JSDELIVR_PATHS = [
            "dist/index.mjs",
            "dist/index.js",
            "dist/browser/index.mjs",
            "dist/browser/index.js",
            "dist/browser.mjs",
            "dist/browser.js",
        ];
        const ELEVENLABS_UNPKG_FALLBACKS = [
            "https://unpkg.com/@elevenlabs/client@latest/dist/index.mjs?module",
            "https://unpkg.com/@elevenlabs/client@latest/dist/browser/index.mjs?module",
        ];

        const __elevenManifestCache = new Map();
        let __elevenCandidatePromise = null;

        function walkJsDelivrFiles(files = [], prefix = "", out = new Set()) {
            for (const entry of files) {
                if (!entry || !entry.name) continue;
                const path = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (entry.type === "file") {
                    out.add(path);
                } else if (entry.files) {
                    walkJsDelivrFiles(entry.files, path, out);
                }
            }
            return out;
        }

        async function fetchElevenLabsManifest(tag = "latest") {
            const key = String(tag || "latest");
            if (__elevenManifestCache.has(key)) {
                return __elevenManifestCache.get(key);
            }

            const url = `${ELEVENLABS_JSDELIVR_META_BASE}@${encodeURIComponent(key)}`;
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const files = walkJsDelivrFiles(json?.files || []);
                const manifest = { tag: key, files };
                __elevenManifestCache.set(key, manifest);
                return manifest;
            } catch (err) {
                console.warn("[voice] jsDelivr manifest lookup failed", { tag: key, url, err });
                __elevenManifestCache.set(key, null);
                return null;
            }
        }

        async function getElevenLabsModuleCandidates() {
            if (__elevenCandidatePromise) return __elevenCandidatePromise;

            __elevenCandidatePromise = (async () => {
                const urls = [];
                const seen = new Set();
                const add = (url) => {
                    if (!url || seen.has(url)) return;
                    urls.push(url);
                    seen.add(url);
                };

                add(`${ELEVENLABS_JSDELIVR_BASE}@latest/+esm`);

                const latestManifest = await fetchElevenLabsManifest("latest");
                if (latestManifest?.files?.size) {
                    for (const rel of ELEVENLABS_JSDELIVR_PATHS) {
                        if (latestManifest.files.has(rel)) {
                            add(`${ELEVENLABS_JSDELIVR_BASE}@latest/${rel}`);
                        }
                    }
                }

                const pinnedManifest = await fetchElevenLabsManifest("0.8.1");
                if (pinnedManifest?.files?.has("dist/browser/index.min.js")) {
                    add(`${ELEVENLABS_JSDELIVR_BASE}@0.8.1/dist/browser/index.min.js`);
                }

                for (const url of ELEVENLABS_UNPKG_FALLBACKS) add(url);

                add("https://esm.sh/@elevenlabs/client@latest?bundle");

                if (!urls.length) {
                    // Absolute last resort: reuse the historical list so we do not regress loading.
                    for (const rel of ELEVENLABS_JSDELIVR_PATHS) {
                        add(`${ELEVENLABS_JSDELIVR_BASE}@latest/${rel}`);
                    }
                    add(`${ELEVENLABS_JSDELIVR_BASE}@0.8.1/dist/browser/index.min.js`);
                    for (const url of ELEVENLABS_UNPKG_FALLBACKS) add(url);
                    add("https://esm.sh/@elevenlabs/client@latest?bundle");
                }

                console.debug("[voice] ElevenLabs module candidates", urls);
                return urls;
            })();

            return __elevenCandidatePromise;
        }

        function resolveConversationExport(mod) {
            const seen = new Set();
            const queue = [];

            function enqueue(candidate) {
                if (!candidate) return;
                const type = typeof candidate;
                if (type !== "object" && type !== "function") return;
                if (seen.has(candidate)) return;
                seen.add(candidate);
                queue.push(candidate);
            }

            function hasStartSession(candidate) {
                return !!candidate && typeof candidate.startSession === "function";
            }

            enqueue(mod);
            enqueue(mod?.default);

            const MAX_WALKS = 25;
            while (queue.length && seen.size <= MAX_WALKS) {
                const current = queue.shift();
                if (hasStartSession(current)) return current;

                try {
                    const keys = Object.getOwnPropertyNames(current || {});
                    for (const key of keys) {
                        if (key === "prototype") {
                            enqueue(current[key]);
                            continue;
                        }
                        enqueue(current[key]);
                    }
                } catch {}
            }

            if (window.ElevenLabs?.Conversation?.startSession) return window.ElevenLabs.Conversation;
            if (window.ElevenLabs?.startSession) return window.ElevenLabs;

            return null;
        }

        async function ensureConversationLib() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log("[voice] got mic stream", stream.getTracks());
            } catch (e) {
                console.error("[voice] mic permission denied", e);
            }
            if (Conversation) return;

            const moduleCandidates = await getElevenLabsModuleCandidates();

            let lastError = null;
            for (const url of moduleCandidates) {
                try {
                    const mod = await import(url);
                    const resolved = resolveConversationExport(mod);
                    if (resolved) {
                        Conversation = resolved;
                        console.debug("[voice] loaded ElevenLabs Conversation SDK", { url });
                        return;
                    }
                    console.warn(
                        "[voice] ElevenLabs module missing Conversation export",
                        { url, keys: Object.keys(mod || {}) }
                    );
                } catch (err) {
                    lastError = err;
                    console.warn("[voice] failed to import ElevenLabs Conversation SDK", { url, err });
                }
            }

            console.error("[voice] unable to load ElevenLabs Conversation SDK", lastError);
            throw lastError || new Error("ElevenLabs Conversation SDK unavailable");
        }

        async function startVoiceTutor() {
            if (voice.convo) {
                try {
                    await voice.convo.endSession();
                } catch {}
                voice.convo = null;
                voice.active = false;
            }

            // prevent overlapping connects
            if (voice.active || __voiceConnecting) return;
            __voiceConnecting = true;

            try {
                console.debug("[voice] startVoiceTutor()", { graphId, nodeId, userId });
                if (!graphId || !nodeId) {
                    addMessage("tutor", "Voice needs course context. Open from a module page or add ?graph=…&node=…", false);
                    __voiceConnecting = false;
                    return;
                }

                // load SDK + prime mic (user gesture already happened on mic click)
                await ensureConversationLib();

                // create audio sink BEFORE connect
                const outEl = ensureOutputAudio();

                // get ElevenLabs conversation token from your edge
                const tokenRes = await apiFetch(convoBase + "/voice/token", {
                    method: "GET",
                    cache: "no-store",
                });
                if (!tokenRes.ok) {
                    const txt = await tokenRes.text().catch(() => "");
                    console.error("[voice] token fetch failed", tokenRes.status, txt);
                    addMessage("tutor", "Voice setup error (token). Please try again.", false);
                    __voiceConnecting = false;
                    return;
                }

                let conversationToken = "";
                try {
                    const j = await tokenRes.json();
                    conversationToken = j?.token || "";
                    console.debug("[voice] token payload", j);

                    // --- NEW: decode expiry if it's a JWT ---
                    if (conversationToken.includes(".")) {
                        try {
                            const [, payload] = conversationToken.split(".");
                            const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
                            if (decoded?.exp) {
                                console.debug("[voice] token exp", decoded.exp, "→", new Date(decoded.exp * 1000).toISOString());
                            }
                        } catch (err) {
                            console.warn("[voice] could not decode token exp", err);
                        }
                    }
                } catch (err) {
                    const txt = await tokenRes.text().catch(() => "");
                    console.error("[voice] token parse failed", err, txt);
                }

                if (!conversationToken) {
                    console.error("[voice] empty token payload");
                    addMessage("tutor", "Voice setup error (empty token).", false);
                    __voiceConnecting = false;
                    return;
                }

                // create audio sink BEFORE connect (put this a few lines before startSession)
                const sink = ensureOutputAudio();

                // connect
                voice.convo = await Conversation.startSession({
                    conversationToken,
                    connectionType: "webrtc",
                    outputAudioElement: sink,

                    onConnect: async () => {
                        __voiceConnecting = false;

                        // nudge audio only via the local sink
                        sink.muted = false;
                        sink.play?.().catch(() => {});
                        if (__voiceAudioCtx?.state === "suspended") {
                            __voiceAudioCtx.resume().catch(() => {});
                        }
                        try {
                            sink.setSinkId?.("default");
                        } catch {}

                        updateMicUI(true);
                        voice.active = true;
                        __voiceStartedAt = Date.now();
                        setVoiceUI?.("listening");

                        // Hard guardrails for the voice agent (VOICE MODE)
                        const policyText =
                            "VOICE RULES: Never speak bare labels or meta like 'Explain', 'Next steps', 'Quick check', or anything about a session meter. " +
                            "Use conversational transitions instead: Explain -> 'Here’s the idea in plain terms...', Next steps -> 'Next, we’ll...', Quick check -> 'Your turn: try this one question.' " +
                            "Ask exactly one question per reply (no stacks). If a check is due, speak it naturally." +
                            "Do not output JSON or code blocks in your spoken message. " +
                            "Never say 'Quick check'. One question max.";

                        try {
                            voice.convo?.sendContextualUpdate?.(
                                JSON.stringify({
                                    fromVoice: true,
                                    policy_text: policyText,
                                    one_question: true,
                                    ban_phrases: ["Explain", "Next steps", "Quick check", "Session meter", "session meter", "Explain:", "Next steps:", "Quick check:"],
                                    rewrite_map: {
                                        Explain: "Here is the idea in plain terms...",
                                        "Next steps": "Next, we will...",
                                        "Quick check": "Your turn: try this one question.",
                                    },
                                    no_json_in_speech: true,
                                })
                            );
                        } catch {}

                        emitGA("voice_session_started", {
                            agent: "Universio Tutor",
                            graph_id: graphId,
                            node_id: nodeId,
                            user_hash: window.__uniUserHash,
                            session_id: window.__uniSessionId,
                        });
                    },

                    onDisconnect: (reason) => {
                        __voiceConnecting = false;
                        updateMicUI(false);
                        voice.active = false;
                        setVoiceUI?.(null);
                        try {
                            if (__voiceOutEl) {
                                __voiceOutEl.srcObject = null;
                                __voiceOutEl.pause?.();
                            }
                        } catch {}
                        emitGA("voice_session_ended", {
                            agent: "Universio Tutor",
                            graph_id: graphId,
                            node_id: nodeId,
                            user_hash: window.__uniUserHash,
                            session_id: window.__uniSessionId,
                            duration: Math.round((Date.now() - (__voiceStartedAt || Date.now())) / 1000),
                            reason: String(reason || ""),
                        });
                    },

                    onError: (e) => {
                        __voiceConnecting = false;
                        console.error("Voice error", e);
                        setVoiceUI?.(null);
                    },

                    // SDK sometimes sends final text here
                    onMessage: (msg) => {
                        const { role, text } = unwrapVoiceMessage(msg);
                        console.log("[voice:onMessage]", { role, len: (text || "").length, preview: (text || "").slice(0, 120) });
                        if (!text) return;

                        // ----- USER (speech) -----
                        if (role === "user") {
                            __userBuffer = (__userBuffer ? __userBuffer + " " : "") + text;

                            const htmlOut = window.marked && typeof window.marked.parse === "function" ? window.marked.parse(__userBuffer, { breaks: true, gfm: true }) : renderInlineMD(__userBuffer);

                            if (!__userLiveEl) {
                                __userLiveEl = el("div", { class: "uni-bubble user", html: htmlOut });
                                messagesEl.appendChild(__userLiveEl);
                                requestAnimationFrame(scrollToBottom);
                            } else {
                                __userLiveEl.innerHTML = htmlOut;
                            }

                            clearTimeout(window.__userFlushT);
                            window.__userFlushT = setTimeout(() => finalizeUserTurn(), 900);
                            return; // user path handled
                        }

                        // ----- ASSISTANT (tts) -----
                        __tutorBuffer = (__tutorBuffer ? __tutorBuffer + " " : "") + text;

                        const interim = sanitizeAssistantText(__tutorBuffer);
                        const interimOne = enforceOneQuestion(interim, false);
                        const htmlOutTutor = window.marked && typeof window.marked.parse === "function" ? window.marked.parse(interimOne, { breaks: true, gfm: true }) : renderInlineMD(interimOne);

                        if (!__tutorLiveEl) {
                            __tutorLiveEl = el("div", { class: "uni-bubble tutor", html: htmlOutTutor });
                            messagesEl.appendChild(__tutorLiveEl);
                            requestAnimationFrame(scrollToBottom);
                        } else {
                            __tutorLiveEl.innerHTML = htmlOutTutor;
                        }

                        clearTimeout(window.__tutorFlushT);
                        window.__tutorFlushT = setTimeout(() => finalizeTutorTurn(), 900);
                    }, // 👈 CLOSE onMessage properly before onEvent

                    onEvent: (event) => handleAgentEvent(event),
                }); // <-- properly closes startSession

                try {
                    voice.convo?.setOutputAudioElement?.(sink) || voice.convo?.setAudioElement?.(sink) || voice.convo?.attachAudioElement?.(sink);
                } catch (e) {
                    console.warn("[voice] post-connect attach failed", e);
                }

                try {
                    const room = voice.convo?.room || voice.convo?.engine?.room;
                    room?.on?.("trackSubscribed", (track, pub, participant) => {
                        console.debug("[livekit] trackSubscribed", { kind: track?.kind, participant: participant?.identity });
                        try {
                            track?.attach?.(sink);
                            sink.play?.().catch(() => {});
                        } catch {}
                    });
                    room?.on?.("connectionStateChanged", (state) => {
                        console.debug("[livekit] connectionState", state);
                    });
                } catch {}

                // final nudge
                outEl.volume = 1.0;
                outEl.muted = false;
                outEl.play?.().catch(() => {});

                // push personalization to the agent
                const prefs = getBootstrapPrefs();
                const courseNameVar = window.__uniCourseName || document.getElementById(ROOT_ID + "-planHeader")?.textContent || `Course ${graphId}`;
                const moduleNameVar = window.__uniModuleName || document.getElementById(ROOT_ID + "-subHeader")?.textContent || `Module ${nodeId}`;
                const vars = {
                    userName: window.__uniUserName || "",
                    pref_tone: prefs.pref_tone,
                    pref_pace: prefs.pref_pace,
                    courseName: courseNameVar,
                    moduleName: moduleNameVar,
                    graphId,
                    nodeId,
                    motivation: getBootstrapMotivation() || "",
                    fromVoice: true, // ← NEW: hints agent to avoid labels/QC UI
                };
                voice.convo.sendContextualUpdate(JSON.stringify({ variables: vars }));

                console.debug("[voice vars sent]", vars);

                // optional plan vars
                try {
                    const r = await apiFetch(`${convoBase}/lesson/module?nodeId=${encodeURIComponent(window.__uniNodeId)}`);
                    if (r.ok) {
                        const cw = await r.json();
                        if (cw?.learningObjectives || cw?.recommendedActivity) {
                            voice.convo.sendContextualUpdate(
                                JSON.stringify({
                                    variables: {
                                        learningObjectives: cw.learningObjectives || "",
                                        recommendedActivity: cw.recommendedActivity || "",
                                    },
                                })
                            );
                        }
                    }
                } catch {}
            } catch (e) {
                console.error("[voice start] fatal", e);
            } finally {
                if (!voice.active) __voiceConnecting = false;
            }
        }

        async function stopVoiceTutor() {
            if (!voice.active) return;
            await voice.convo.endSession();
            voice.active = false;
        }

        function updateMicUI(isOn) {
            micBtn.classList.toggle("active", isOn);
            micBtn.setAttribute("aria-label", isOn ? "Stop voice tutor" : "Start voice tutor");
            micBtn.title = isOn ? "Stop Voice" : "Start Voice";
        }

        function handleAgentMessage(text, save = false) {
            if (!text) return;
            let cleaned = sanitizeAssistantText(text);
            cleaned = enforceOneQuestion(cleaned);
            cleaned = italicizeTutorQuestions(cleaned);
            cleaned = cleanupTrailingArtifacts(cleaned);

            // Split final question into its own bubble (unchanged UX)
            const parts = cleaned.split(/\n(?=\*[^*\n]+\*\s*$)/);
            if (parts.length > 1) {
                addMessage("tutor", parts[0].trim(), save);
                addMessage("tutor", parts[1].trim(), save);
            } else {
                addMessage("tutor", cleaned, save);
            }
        }

        function handleAgentEvent(event) {
            if (!event) return;

            // --- DEBUG: log every voice event type once per second ---
            try {
                window.__voiceSeen = window.__voiceSeen || new Set();
                const t = String(event.type || "(no type)");
                if (!window.__voiceSeen.has(t)) {
                    window.__voiceSeen.add(t);
                    console.log("[voice:event] first seen →", t, event);
                    // quick way to reprint the set anytime:
                    window.__printVoiceEvents = () => console.log("[voice:event types]", [...window.__voiceSeen]);
                }
            } catch {}
            if (!event) return;
            // console.debug('[voice:event]', event.type, event);

            // 1) Speaking state → HUD
            if (event.type === "agent_response_started") {
                setVoiceUI?.("speaking");
                const outEl = ensureOutputAudio();
                outEl.muted = false;
                outEl.play?.().catch(() => {});
            }

            // NEW (pulse mic)
            if (event.type === "vad_score") {
                const score = Math.max(0, Math.min(1, Number(event.score ?? 0)));
                micBtn.style.transform = `scale(${1 + score * 0.1})`;
                clearTimeout(micBtn.__vadResetT);
                micBtn.__vadResetT = setTimeout(() => {
                    micBtn.style.transform = "";
                }, 120);
            }

            // 3) Collect streamed agent text → flush at end
            if (event.type === "agent_response" && (event.response?.output_text || event.agent_response?.content)) {
                const raw = event.response?.output_text ?? event.agent_response?.content;
                const chunk = Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? x : x?.text || x?.content || "")).join("") : typeof raw === "string" ? raw : String(raw ?? "");
                __voiceBuffer += chunk;
            }

            // ✅ Finalize voice turn: set UI to listening, persist final message
            if (event.type === "agent_response_ended") {
                setVoiceUI?.("listening");

                const s = (__voiceBuffer || "").trim();
                __voiceBuffer = "";
                if (!s) return;

                try {
                    const maybeObj = s.startsWith("{") || s.startsWith("[") ? JSON.parse(s) : s;
                    const { role, text } = unwrapVoiceMessage(maybeObj);
                    if (!text) return;

                    if (role === "user") {
                        finalizeUserTurn(text);
                    } else {
                        // Clean + enforce one-question rule (no QC parsing)
                        let cleaned = sanitizeAssistantText(text)
                            .split("\n")
                            .join("\n")
                            .replace(/\n{3,}/g, "\n\n");

                        cleaned = enforceOneQuestion(cleaned);
                        cleaned = italicizeTutorQuestions(cleaned);
                        finalizeTutorTurn(cleaned);
                    }
                } catch {
                    finalizeTutorTurn(s); // ✅ fallback to tutor helper
                }
            }

            if (event.type === "client_tool_call") {
                const { tool_name, tool_call_id, parameters } = event.client_tool_call || {};
                let result = "ok";
                try {
                    if (tool_name === "uni_cheer") {
                        renderUniBubble(parameters?.text || "Great job!");
                    } else if (tool_name === "update_session_meter") {
                        // no-op on web; time UI handled elsewhere
                        result = "ignored:update_session_meter";
                    } else {
                        result = `ignored:${tool_name || "unknown"}`;
                    }
                } catch (e) {
                    result = String(e?.message || e);
                }
                try {
                    voice.convo?.sendClientToolResult?.({
                        tool_call_id,
                        result,
                        is_error: !/^ok$|^ignored:/.test(result),
                    });
                } catch {}
            }

            // 5) Show user's voice transcript when finalized
            if (event.type === "user_transcript" || event.type === "user_speech_transcribed" || event.user_transcript || event.user?.transcript) {
                const isFinal = !!(event.is_final ?? event.final ?? true);
                const t = event.transcript || event.user_transcript?.text || event.user?.transcript || event.text || "";

                if (t && voice.active) {
                    if (isFinal) {
                        // ✅ Final transcript: persist and show once
                        console.log("[voice:user-final]", t);
                        addMessage("user", t, true);
                    } else {
                        // 🔎 Interim transcript: show ephemeral, no persist
                        console.log("[voice:user-interim]", t);
                        addMessage("user", t, false);
                    }
                }
            }
        }

        micBtn.addEventListener("click", () => {
            const turningOn = !voice.active;

            emitGA("voice_mode_toggled", {
                on: turningOn,
                graph_id: graphId,
                node_id: nodeId,
                session_id: window.__uniSessionId,
            });

            if (turningOn) {
                // 🔎 quick context sanity
                let lastCtx = {};
                try {
                    lastCtx = JSON.parse(localStorage.getItem("uni:lastContext") || "{}");
                } catch {}
                console.debug("[voice ctx]", {
                    graphId,
                    nodeId,
                    userId,
                    sessionId: window.__uniSessionId,
                    lastContext: lastCtx,
                });

                startVoiceTutor();
            } else {
                stopVoiceTutor();
            }
        });

        const inputRow = el("div", { class: "uni-input-row" }, [micBtn, inputEl, sendBtn]);
        chatBody.append(messagesEl, inputRow);
        chatCard.append(shellLoader, chatHeader, chatBody);

        // Plan card
        const planCard = el("div", { class: "uni-card" });
        const planHeader = el("div", { class: "uni-card-header" }, el("span", {}, "LEARNING PATH"));
        const planBody = el("div", { class: "uni-section uni-plan-body", id: IDS.planBody }, "Loading your plan…");
        const planDetail = el("div", { id: IDS.moduleDetail, class: "uni-section" });
        planCard.append(planHeader, planBody, planDetail);
        planCard.style.display = "none";

        // ✅ only append chatCard and planCard (remove toolbar entirely)
        rootEl.append(chatCard, planCard);

        const mobileComposerQuery =
            typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 768px)") : null;
        const placeComposer = () => {
            if (!mobileComposerQuery) return;
            if (mobileComposerQuery.matches) {
                if (inputRow.parentElement !== rootEl) {
                    rootEl.appendChild(inputRow);
                }
            } else if (inputRow.parentElement !== chatBody) {
                chatBody.appendChild(inputRow);
            }
        };
        if (mobileComposerQuery) {
            placeComposer();
            if (typeof mobileComposerQuery.addEventListener === "function") {
                mobileComposerQuery.addEventListener("change", placeComposer);
            } else if (typeof mobileComposerQuery.addListener === "function") {
                mobileComposerQuery.addListener(placeComposer);
            }
        }

        // hook up reset button now that it exists
        resetBtn.addEventListener("click", resetSession);

        /* === A: Desktop chat layout + auto-scroll (drop-in) === */
        injectStyles(`
  /* Desktop layout: messages fill, input stays in flow (no fixed/sticky) */
  @media (min-width: 769px){
    #${ROOT_ID} .uni-card {
      display: flex;
      flex-direction: column;
    }
    #${ROOT_ID} .uni-section {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;               /* critical for flex scrolling */
    }
    #${ROOT_ID} .uni-messages {
      flex: 1 1 auto;
      min-height: 0;               /* allow child to shrink for overflow */
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      scroll-behavior: smooth;

      /* cushion so last bubble never hides behind composer */
      padding-bottom: 80px;
      scroll-padding-bottom: 80px;
    }
    #${ROOT_ID} .uni-input-row {
      position: static !important; /* ensure no fixed/sticky sneaks back */
      margin-top: 12px;
    }
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-section { overflow: hidden !important; }
  #${ROOT_ID} .uni-messages { overflow-y: auto !important; }
`);

        injectStyles(`
  #${ROOT_ID} .uni-sub-header {
    font-size: 0.9rem;
    font-weight: 400;
    color: #444;   /* darker gray */
    margin-top: 4px;
    text-transform: none; /* keep it in Title Case, not all caps */
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-shell-loader {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin: 8px 16px 0;
    align-self: flex-start;
    width: fit-content;
    max-width: calc(100% - 32px);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 10px 28px rgba(16, 24, 40, 0.12);
  }
  #${ROOT_ID}[data-theme="dark"] .uni-shell-loader {
    background: rgba(15, 18, 34, 0.9);
    box-shadow: 0 10px 28px rgba(8, 12, 24, 0.45);
  }
  #${ROOT_ID} .uni-shell-loader[aria-hidden="true"] {
    display: none;
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-bubble.user  { 
    background:#000 !important; color:#fff !important;
    border:none !important; box-shadow:none !important; border-radius:24px !important;
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-bubble.user * {
    color: #fff !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-bubble.tutor.quick-check {
    border: 2px solid rgba(79, 70, 229, 0.35);
    box-shadow: 0 12px 30px rgba(79, 70, 229, 0.15);
    padding: 18px 18px 20px;
    border-radius: 20px;
    background: linear-gradient(145deg, rgba(248, 248, 255, 0.95), rgba(237, 233, 254, 0.9));
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-prompt {
    font-weight: 600;
    font-size: 1.05rem;
    margin-bottom: 12px;
    color: #312e81;
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-subtitle {
    font-size: 0.95rem;
    color: rgba(49, 46, 129, 0.82);
    margin-bottom: 14px;
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-option {
    border: 1px solid rgba(79, 70, 229, 0.2);
    background: #ffffff;
    border-radius: 16px;
    padding: 12px 14px;
    text-align: left;
    font-size: 0.98rem;
    font-weight: 600;
    color: #1f2937;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
    cursor: pointer;
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-option:hover {
    border-color: rgba(79, 70, 229, 0.6);
    box-shadow: 0 10px 26px rgba(79, 70, 229, 0.18);
    transform: translateY(-1px);
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-option.selected {
    background: rgba(79, 70, 229, 0.92);
    color: #ffffff;
    border-color: rgba(79, 70, 229, 0.92);
    box-shadow: 0 12px 30px rgba(79, 70, 229, 0.25);
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-option .detail {
    display: block;
    margin-top: 6px;
    font-size: 0.85rem;
    font-weight: 400;
    color: rgba(17, 24, 39, 0.75);
  }
  #${ROOT_ID} .uni-bubble.tutor.quick-check .quick-check-hint {
    margin-top: 16px;
    font-size: 0.85rem;
    color: rgba(55, 65, 81, 0.85);
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-loader-orbit {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
  }
  #${ROOT_ID} .uni-loader-orbit span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #a855f7;
    animation: orbit 1.2s infinite ease-in-out;
  }
  #${ROOT_ID} .uni-loader-orbit span:nth-child(2) { animation-delay: 0.2s; }
  #${ROOT_ID} .uni-loader-orbit span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes orbit {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
    40%           { transform: scale(1.2); opacity: 1; }
  }
`);

        // iOS Safari mobile override — add this AFTER your other injectStyles
        injectStyles(`
  /* iOS/Safari mobile: allow true fixed composer */
  @supports (-webkit-touch-callout: none) {
    @media (max-width: 768px) {
      /* stop clipping the fixed composer */
      #${ROOT_ID} .uni-card,
      #${ROOT_ID} .uni-section {
        overflow: visible !important;
      }
      /* remove blur that creates a fixed containing block */
      #${ROOT_ID} .uni-section,
      #${ROOT_ID} .uni-card-header {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
    }
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-bubble.uni-uni {
    border: 2px solid #B874FF !important;
    position: relative;
    padding: 12px 14px 12px 52px; /* room for avatar */
  }
  #${ROOT_ID} .uni-bubble.uni-uni .uni-uni-avatar {
    position: absolute; left: 12px; top: 9px;
    width: 28px; height: 28px; border-radius: 50%;
    border: 0px solid #B874FF; background: #fff; object-fit: cover;
  }
`);

        injectStyles(`
  #${ROOT_ID} .uni-header-right { display:flex; align-items:center; gap:8px; }
  #${ROOT_ID} .uni-progress{
    font-size:.9rem; line-height:1;
    padding:8px 8px; border:1px solid var(--border);
    border-radius:999px; background:var(--input-bg); color:var(--fg);
    min-width:53px; min-height:33px; text-align:center;
    display: none !important;
  }
`);

        injectStyles(`
  /* Purple pulse for mic button */
  #${ROOT_ID} .mic-btn { position: relative; transition: transform .12s ease; }
  #${ROOT_ID} .mic-btn.active { border-color: #B874FF !important; }
  #${ROOT_ID} .mic-btn.active svg { stroke: #B874FF !important; }

  /* Outer glow ring pulsing */
  #${ROOT_ID} .mic-btn.active::after {
    content: '';
    position: absolute;
    inset: -4px;               /* ring outside the button */
    border-radius: 999px;
    box-shadow: 0 0 0 0 rgba(184,116,255,.55);
    animation: micPulse 1.8s ease-in-out infinite;
    pointer-events: none;
  }

  /* Faster pulse + tiny scale while speaking */
  #${ROOT_ID} .mic-btn.speaking::after { animation-duration: 1.05s; }
  #${ROOT_ID} .mic-btn.speaking { transform: scale(1.04); }

  @keyframes micPulse {
    0%   { box-shadow: 0 0 0 0    rgba(184,116,255,.55); }
    70%  { box-shadow: 0 0 0 12px rgba(184,116,255,0); }
    100% { box-shadow: 0 0 0 0    rgba(184,116,255,0); }
  }

  /* Hide the old orb HUD if you want it gone */
  #${ROOT_ID} .voice-hud { display: none !important; }
`);

        // Make the in-header pill black/white as requested
        injectStyles(`
  #${ROOT_ID} .uni-progress{
    background:#000 !important;
    color:#fff !important;
    border:1px solid rgba(255,255,255,.18) !important;
  }
`);

        injectStyles(`
  #uniNavProgressPill {
    position: fixed;
    z-index: 2147483647;
    --p: 0%;
    border: 1px solid #000;
    background: linear-gradient(
      to right,
      #000 0%,
      #000 var(--p),
      transparent var(--p),
      transparent 100%
    );
    color: #000;
    border-radius: 999px;
    padding: 6px 8px;
    font-size: .75rem;
    line-height: 1;
    min-width: 40px;
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(0,0,0,.15);
    -webkit-font-smoothing: antialiased;
    visibility: hidden;
  }
`);

        injectStyles(`
  /* ✅ Smooth fill animation for the progress pill */
  #uniNavProgressPill {
    transition: background-size 0.6s ease, color 0.3s ease, transform 0.2s ease;
  }

  /* Optional: small pulse bump when increasing */
  #uniNavProgressPill[data-anim="up"] {
    transform: scale(1.08);
  }
`);

        injectStyles(`
  #uniCompleteBanner.capstone-finish {
    position: fixed;
    left: 50%; transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom,0) + 16px);
    background: linear-gradient(90deg,#6D28D9,#9333EA);
    color: #fff;
    padding: 12px 20px;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
    z-index: 99999;
    display:flex; gap:10px; align-items:center;
    font-size: .9rem;
  }
  #uniCompleteBanner.capstone-finish .btn {
    background:#fff; color:#000; border:none;
    border-radius:999px; padding:8px 14px; cursor:pointer;
  }
  #uniCompleteBanner.capstone-finish .btn.secondary {
    background:transparent; color:#fff;
    outline:1px solid rgba(255,255,255,.5);
  }
`);

        // --- Auto-scroll: always pin to bottom when new messages appear ---
        function scrollToBottom() {
            // If the chat container itself scrolls, move that
            if (messagesEl && messagesEl.scrollHeight > messagesEl.clientHeight) {
                messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
            }
            // only scroll the page after a user message exists
            if (hasUserInput) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }
        }

        // Keep pinned whenever a child is added
        new MutationObserver(() => {
            requestAnimationFrame(scrollToBottom);
        }).observe(messagesEl, { childList: true });

        // If images load later, scroll again
        messagesEl.addEventListener(
            "load",
            (e) => {
                if (e.target.tagName === "IMG") scrollToBottom();
            },
            true
        );

        // -------- Chat logic --------
        let conversation = [];
        function addMessage(sender, text, save = true) {
            // Normalize sender
            const role = sender === "user" || sender === "tutor" || sender === "system" || sender === "uni" ? sender : "tutor"; // default fallback

            // Promote paragraph spacing for tutor-only text
            if (role === "tutor") {
                text = ensureParagraphBreaks(text);
            }

            // Parse markdown safely (supports window.marked or fallback)
            const htmlOut = renderMarkdown(text);

            // Create message bubble
            const bubble = el("div", {
                class: "uni-bubble " + role,
                html: htmlOut,
            });

            messagesEl.appendChild(bubble);

            if (role === "user") hasUserInput = true;

            requestAnimationFrame(scrollToBottom);

            if (save) {
                conversation.push({ sender: role, text });

                // 🧩 Prevent early double-saves during initial greeting/reset bursts
                const tooSoon = document.readyState !== "complete" || !window.__uniSessionId;
                if (tooSoon) {
                    console.debug("[addMessage] skipped auto-save (too soon)");
                    return;
                }

                // ✅ Normal path: save only once session is live
                saveConversationState();
            }

            return bubble;
        }

        function renderQuickCheckCustom(decision, displayText, recordText) {
            if (!decision || !decision.entry) return false;
            const entry = decision.entry;
            const promptSource = decision.text || recordText || displayText || "";
            const promptPrepared = promptSource ? prepareAssistantText(promptSource, { suppressQuestions: false }) : "";
            const recordPayload = recordText || promptPrepared || "";
            const bubble = addMessage("tutor", recordPayload, true);
            if (!bubble) return false;

            bubble.classList.add("quick-check");
            bubble.dataset.quickCheck = "1";
            if (decision.id) bubble.dataset.quickCheckId = decision.id;
            if (entry.type) bubble.dataset.quickCheckType = String(entry.type);
            bubble.__quickCheckMeta = entry;

            if (entry.html) {
                bubble.innerHTML = entry.html;
                requestAnimationFrame(scrollToBottom);
                return true;
            }

            const promptHtml = promptPrepared ? renderMarkdown(promptPrepared) : "";
            bubble.innerHTML = promptHtml ? `<div class="quick-check-prompt">${promptHtml}</div>` : "";

            const subtitle = coerceQuickCheckString(entry.subtitle) || coerceQuickCheckString(entry.description);
            if (subtitle) {
                bubble.appendChild(el("div", { class: "quick-check-subtitle", html: renderMarkdown(subtitle) }));
            }

            const options = Array.isArray(entry.options)
                ? entry.options.slice()
                : Array.isArray(entry.choices)
                ? entry.choices.slice()
                : [];

            if (options.length) {
                const wrap = el("div", { class: "quick-check-options" });
                options.forEach((opt, idx) => {
                    const info = extractQuickCheckOption(opt, idx);
                    const btn = el("button", {
                        type: "button",
                        class: "quick-check-option",
                        "data-value": info.value,
                    });
                    btn.appendChild(el("span", { class: "label" }, info.label || `Option ${idx + 1}`));
                    if (info.detail) {
                        btn.appendChild(el("span", { class: "detail" }, info.detail));
                    }
                    btn.addEventListener("click", () => {
                        wrap.querySelectorAll(".quick-check-option").forEach((b) => b.classList.remove("selected"));
                        btn.classList.add("selected");
                        bubble.dataset.selection = info.value;
                        window.dispatchEvent(
                            new CustomEvent("uni:quick-check-select", {
                                detail: {
                                    entry,
                                    option: info,
                                    decision,
                                },
                            })
                        );
                    });
                    wrap.appendChild(btn);
                });
                bubble.appendChild(wrap);
            }

            const hint =
                coerceQuickCheckString(entry.hint) ||
                coerceQuickCheckString(entry.helper) ||
                coerceQuickCheckString(entry.footer);
            if (hint) {
                bubble.appendChild(el("div", { class: "quick-check-hint", html: renderMarkdown(hint) }));
            }

            requestAnimationFrame(scrollToBottom);
            return true;
        }

        function suppressTutorBubble(recordText) {
            if (!recordText) return;
            const bubble = addMessage("tutor", recordText, true);
            bubble?.remove();
        }

        // --- Safe save for early (pre-CWT) tutor bubbles ---
        async function safeSaveConversationState(mode = "update") {
            // wait until we have a valid token (CWT)
            if (!getCWT()) {
                console.debug("[safeSaveConversationState] waiting for CWT…");
                await new Promise((resolve) => onBootstrappedOnce(resolve));
            }
            return saveConversationState(mode);
        }

        // --- Resolve course + module names for Softr writes ---
        function resolveCourseModuleNames() {
            const courseName = window.__uniCourseName || document.getElementById(ROOT_ID + "-planHeader")?.textContent || "Course";
            const moduleName = window.__uniModuleName || document.getElementById(ROOT_ID + "-subHeader")?.textContent || window.__uniNodeId || "Module";
            return { courseName, moduleName };
        }

        // --- Write conversation to Softr (delete+insert or append) ---
        function saveConversationState(mode = "update") {
            const email = resolveUserEmail();
            const { courseName, moduleName } = resolveCourseModuleNames();

            const payload = {
                mode, // "update" | "fresh"
                email,
                graphId,
                nodeId,
                course_name: courseName,
                node_name: moduleName,
                session_id: window.__uniSessionId || null,
                messages: conversation,
            };

            return apiFetch("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/softr-conversation", { method: "POST", body: JSON.stringify(payload) });
        }

        // --- NEW: delete Softr conversation record for this node ---
        async function deleteConversationRecord() {
            try {
                const email = resolveUserEmail();
                if (!email || !window.__uniNodeId) return false;

                const r = await apiFetch("https://oomcxsfikujptkfsqgzi.supabase.co/functions/v1/softr-conversation", {
                    method: "POST",
                    body: JSON.stringify({
                        mode: "delete",
                        email,
                        nodeId: window.__uniNodeId,
                        graphId: window.__uniGraphId,
                    }),
                });
                const j = await r.json().catch(() => ({}));
                console.log("[resetConversation] Softr delete →", r.status, j);
                return r.ok;
            } catch (e) {
                console.error("[resetConversation] delete failed", e);
                return false;
            }
        }

        async function triggerModuleSummary() {
            if (!graphId || !nodeId) return;
            const email = resolveUserEmail();
            if (!email) return;
            const { courseName, moduleName } = resolveCourseModuleNames();
            const sessionId = window.__uniSessionId || null;
            const key = [email, graphId, nodeId, sessionId || ""].join("|").toLowerCase();
            window.__uniSummaryQueue = window.__uniSummaryQueue || Object.create(null);
            const cache = window.__uniSummaryQueue;
            const last = cache[key];
            if (last && Date.now() - last < 15000) {
                return;
            }
            cache[key] = Date.now();
            setTimeout(() => {
                if (window.__uniSummaryQueue) delete window.__uniSummaryQueue[key];
            }, 60000);

            const payload = {
                course_id: graphId,
                node_id: nodeId,
                session_id: sessionId,
                email,
                course_name: courseName,
                node_name: moduleName,
            };

            try {
                const res = await apiFetch(CREATE_SUMMARY_URL, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || json?.ok === false) {
                    console.warn("[UNI][summary] create-summary failed", { status: res.status, body: json });
                } else {
                    console.info("[UNI][summary] summary generated", json);
                }
            } catch (err) {
                console.warn("[UNI][summary] create-summary error", err);
            }
        }

        function loadConversationState() {
            return apiFetch(convoBase + "/conversation-state/load", {
                method: "POST",
                body: JSON.stringify({ graphId, nodeId }),
            })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    if (data && Array.isArray(data.messages)) {
                        // 👉 Ensure UNI cheers replay with the purple-outlined bubble + avatar
                        data.messages.forEach((m) => {
                            if (m.sender === "uni") {
                                renderUniBubble(m.text, false); // don’t re-save history on paint
                            } else {
                                addMessage(m.sender, m.text, false);
                            }
                        });
                        conversation = data.messages.slice(0);
                        // ✅ Only scroll if chat actually overflows
                        setTimeout(() => {
                            if (messagesEl.scrollHeight > messagesEl.clientHeight) {
                                autoScrollEnabled = true;
                                messagesEl.scrollTop = messagesEl.scrollHeight;
                            }
                        }, 100);
                    }
                })
                .catch((e) => console.error("[load]", e));
        }

        // Use the loaded course + module names to make prompts dynamic
        const courseName = document.getElementById(ROOT_ID + "-planHeader")?.textContent || "this course";
        const moduleName = document.getElementById(ROOT_ID + "-subHeader")?.textContent || "this module";

        // ---- Randomized prompt sets ----

        // Diagnostic: prior knowledge, expectations, motivation
        const diagnosticPrompts = [
            `What prior experience do you have with '${courseName}'? Give 1 example.`,
            `Identify one challenge you expect in '${courseName}' and one strength you bring.`,
            `How familiar are you with the main ideas behind '${courseName}'? Share a quick example or story.`,
            `Describe one concept in '${courseName}' you’re most curious or uncertain about.`,
            `Before starting '${courseName}', what do you already know that might help you succeed?`,
            `What skills or knowledge from past learning do you think will transfer well into '${courseName}'?`,
            `In your own words, what do you think '${courseName}' will focus on, and why might it matter?`,
            `What’s one goal you have for yourself as you begin '${courseName}'?`,
        ];

        // Explanation: summarization and knowledge transfer
        const explanationPrompts = [
            `Teach a peer the most important ideas from today's '${courseName}' lesson.`,
            `Create a 5-step checklist to apply a key technique from '${courseName}' tomorrow.`,
            `Write a short summary of '${courseName}' in your own words, as if explaining to a friend.`,
            `List three main insights from '${courseName}' and one question you still have.`,
            `Draft a mini-tutorial that could help someone new understand '${courseName}'.`,
        ];

        // Exercise: applied practice
        const exercisePrompts = [
            `Complete a hands-on task related to '${courseName}': {task}. Paste your artifact.`,
            `Peer-review: Use rubric {rubric} to critique a peer's artifact for '${courseName}'.`,
            `Try recreating a key process from '${courseName}' using your own example or dataset.`,
            `Design a quick demo or prototype showing how a concept from '${courseName}' works.`,
            `Reflect on your process as you attempt a practical activity from '${courseName}'.`,
        ];

        // Assessment: formal check of learning
        const assessmentPrompts = [
            `5 MCQs on '${courseName}' (1 correct, 3 plausible distractors) with answer key.`,
            `Short answer: Solve {problem} related to '${courseName}'; show your steps and final answer.`,
            `Performance task: Deliverable + rubric with levels (Exceeds/Meet/Developing).`,
            `Mini project: Apply a concept from '${courseName}' to a real-world case and summarize results.`,
            `Create a short quiz (3–5 items) to test understanding of '${courseName}'.`,
        ];

        // ---- Random selection ----
        const promptData = {
            diagnostic: diagnosticPrompts[Math.floor(Math.random() * diagnosticPrompts.length)],
            explanation: explanationPrompts[Math.floor(Math.random() * explanationPrompts.length)],
            exercise: exercisePrompts[Math.floor(Math.random() * exercisePrompts.length)],
            assessment: assessmentPrompts[Math.floor(Math.random() * assessmentPrompts.length)],
        };

        let currentCategory = "diagnostic";
        let promptIndex = 0;
        async function nextPrompt() {
            // Capstone guard — bail out for CAP / CAP_*
            if (/^CAP(?:_|$)/i.test(String(window.__uniNodeId || ""))) return;

            const prompts = promptData[currentCategory] || [];

            // 👉 Special case: if this is the *first* diagnostic prompt, make it module-aware
            if (currentCategory === "diagnostic" && promptIndex === 0) {
                const moduleName = document.getElementById(ROOT_ID + "-subHeader")?.textContent || "this module";
                addMessage("tutor", `Before we dive in, what prior experience do you have with '${moduleName}'?`, true);
                setTimeout(() => safeSaveConversationState("update"), 0);

                promptIndex++; // advance so next call moves on
                return;
            }

            // 🧩 Persist initial tutor bubbles once session_id exists
            setTimeout(async () => {
                let tries = 0;
                while (!window.__uniSessionId && tries++ < 10) await new Promise((r) => setTimeout(r, 300));
                console.debug("[init-save] new record with greeting bubbles");
                try {
                    await safeSaveConversationState("fresh");
                } catch (e) {
                    // 👈 delete-then-insert
                    console.warn("[init-save failed]", e);
                }
            }, 1500);

            if (promptIndex < prompts.length) {
                addMessage("tutor", prompts[promptIndex++], true); // ✅ now saved
                return;
            }

            if (currentCategory === "diagnostic") {
                currentCategory = "explanation";
                promptIndex = 0;
                addMessage("tutor", "Thanks! Let's proceed to explanation questions.", true);
                setTimeout(nextPrompt, 600);
            } else if (currentCategory === "explanation") {
                currentCategory = "exercise";
                promptIndex = 0;
                addMessage("tutor", "Great job! Now let's do an exercise.", true);
                setTimeout(nextPrompt, 600);
            } else if (currentCategory === "exercise") {
                currentCategory = "assessment";
                promptIndex = 0;
                addMessage("tutor", "Almost done! Finally, let's assess your understanding.", true);
                setTimeout(nextPrompt, 600);
            } else if (currentCategory === "assessment") {
                // 🎯 module fully completed
                addMessage("tutor", "Congratulations! You've completed the session.", true);
                markComplete(100).catch((e) => console.error("[complete]", e));
            }
        }

        // Expose for quick testing in the console:
        window.uniProgress = markProgress;
        window.uniComplete = markComplete;

        async function sendAiReply(userText) {
            const msg = (userText || "").trim();
            if (!msg) return;

            if (!window.__uniUserId) {
                console.warn("[UNI][tutor] user identity not ready, waiting 400ms");
                await new Promise((r) => setTimeout(r, 400));
                userId = getUserId(); // rehydrate after delay
                window.__uniUserId = userId;
            }

            if (!userId || !graphId || !nodeId) {
                console.error("[tutor/message] missing params", { userId, graphId, nodeId });
                addMessage("tutor", "This page is missing graph/node. Add ?graph=C001&node=N001 to the URL or open from a record page.", false);
                return;
            }

            const typingEl = showTypingBubble();

            // TEMPORARILY COMMENTING OUT THE FOLLOWING
            // messagesEl.appendChild(typingEl);
            // requestAnimationFrame(scrollToBottom);

            // 1) Fetch clever-worker module data
            let cleverWorker = {};
            try {
                await ensureFreshCWT();  // 👈 ensure token ready before fetch
                const cwRes = await apiFetch(`${convoBase}/lesson/module?nodeId=${encodeURIComponent(nodeId)}`);
                if (cwRes.ok) {
                    cleverWorker = await cwRes.json();
                }
            } catch (e) {
                console.warn("[clever-worker]", e);
            }

            // 2) Pull onboarding prefs and build payload (include first name)
            const { pref_tone, pref_pace } = getBootstrapPrefs();
            const motivation = getBootstrapMotivation();
            const payload = { graphId, nodeId, message: msg, cleverWorker, pref_tone, pref_pace, userName: window.__uniUserName || "", motivation };

            return apiFetch(convoBase + "/tutor/message", {
                method: "POST",
                body: JSON.stringify(payload),
            })
                .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
                .then(async (data) => {
                    hideTypingBubble(typingEl);

                    // store session if new
                    if (data?.session_id) setSession(data.session_id);

                    // ✅ always reflect the stored truth
                    let persisted = null;
                    if (data?.meta?.progress?.updated) {
                        persisted = await readPersistedProgress();
                        const pctNow = coerceProgressPercent(persisted?.score ?? 0);
                        logMastery("progress_updated_by_server", { persisted_pct: pctNow });
                        updateProgressUI(pctNow);
                    }

                    // ✅ completion check using persisted score (no redeclare)
                    if (!persisted) persisted = await readPersistedProgress();
                    const pct = coerceProgressPercent(persisted?.score ?? 0);

                    if (pct >= 100 && !window.__completionShown && !sessionStorage.getItem(COMPLETE_KEY())) {
                        window.__completionShown = true;
                        sessionStorage.setItem(COMPLETE_KEY(), "1");

                        const isCapstoneNode = CAPSTONE_ID_PATTERN.test(String(window.__uniNodeId || ""));

                        // 1️⃣ Stamp completion silently on server
                        await markComplete(100, { silent: true });

                        // 2️⃣ Refresh hints so next module is ready
                        await refreshCourseHints();

                        if (isCapstoneNode) {
                            // Capstone finale already handles banners/messages
                            return;
                        }

                        // 3️⃣ Tutor gives its single final message + banner
                        addMessage(
                            "tutor",
                            "🎉 Congratulations — **module complete!** You’ve reached the finish line for this lesson.",
                            true
                        );
                        showCompletionBanner(__safeNextUrl());

                        // ✅ Stop here — prevents any further tutor output
                        return;
                    }


                    // ✅ optional evaluator feedback for debugging/telemetry
                    if (data?.meta?.evaluation) {
                        console.log("[evaluation]", data.meta.evaluation);
                        // Optional visible feedback to learner:
                        // const e = data.meta.evaluation;
                        // const avg = ((e.correctness + e.completeness + e.relevance) / 3 * 100).toFixed(0);
                        // addMessage('tutor', `✅ Your last reply scored about ${avg}% accuracy & completeness.`, false);
                    }

                    // ✅ render tutor reply
                    if (data?.assistant_text) {
                        const quickCheck = interpretQuickCheck(data?.meta?.quick_check);
                        if (quickCheck) window.__lastQuickCheck = quickCheck;

                        const plainOverride = quickCheck?.action === "plain" && quickCheck.text ? quickCheck.text : null;
                        const displaySource = plainOverride || data.assistant_text;
                        const recordSource = plainOverride || data.assistant_text;

                        const displayText = prepareAssistantText(displaySource, {
                            suppressQuestions: quickCheck?.suppressQuestion ?? false,
                        });
                        const recordText = prepareAssistantText(recordSource, { suppressQuestions: false });

                        let handled = false;
                        if (quickCheck?.action === "custom") {
                            handled = renderQuickCheckCustom(quickCheck, displayText, recordText);
                        } else if (quickCheck?.action === "suppress") {
                            suppressTutorBubble(recordText);
                            handled = true;
                        }

                        if (!handled) {
                            const fallback = displayText || recordText;
                            if (fallback) {
                                addMessage("tutor", fallback, true);
                            } else {
                                addMessage("tutor", "Hmm, I didn’t get a reply. Try again?", false);
                            }
                        }
                    } else {
                        addMessage("tutor", "Hmm, I didn’t get a reply. Try again?", false);
                    }

                    // --- ✅ Live progress pill update (from node_percent) ---
                    if (data?.node_percent != null) {
                        const pct = coerceProgressPercent(data.node_percent);
                        updateProgressUI(pct);
                        console.log("[UNI][pill] updated from node_percent:", pct + "%");
                    }

                    // ✅ analytics (keep one)
                    if (!data?.analytics) {
                        try {
                            window.dataLayer = window.dataLayer || [];
                            window.dataLayer.push({
                                event: "ai_reply_generated",
                                graph_id: graphId,
                                node_id: nodeId,
                                session_id: sessionId,
                                user_hash: window.__uniUserHash,
                                message_length: msg.length,
                                model: data?.model || "default",
                            });
                        } catch {}
                    }
                })

                .catch((err) => {
                    console.error("[tutor/message]", err);
                    typingEl.remove?.();
                    addMessage("tutor", "Error contacting AI tutor.", false);
                });
        }

        async function resetSession() {
            try {
                // 1️⃣ Reset the tutor session server-side (creates new session_id)
                const res = await apiFetch(convoBase + "/tutor/reset", {
                    method: "POST",
                    body: JSON.stringify({ graphId, nodeId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || res.status);
                if (data?.session_id) setSession(data.session_id);

                // 2️⃣ Delete the Softr conversation record so a new one starts clean
                await deleteConversationRecord();

                // 3️⃣ Clear local chat UI and memory
                conversation = [];
                messagesEl.innerHTML = "";

                // Persisted reset (mastery): set this node’s progress to 0% and sync UI
                await markProgress(0, /*silent*/ false);
                // Force UI to 0 after server write to defeat any stale readback bounce
                updateProgressUI(0);

                // If on CAP / CAP_* → show deterministic Capstone welcome and skip random greetings
                const currentNodeId = String(nodeId || window.__uniNodeId || "").toUpperCase();
                const isCapstoneNode = CAPSTONE_ID_PATTERN.test(currentNodeId);

                if (isCapstoneNode) {
                    const courseNameVar = window.__uniCourseName || document.getElementById(ROOT_ID + "-planHeader")?.textContent || "this course";

                    addMessage(
                        "tutor",
                        `Welcome to your *Capstone Completion* for **${courseNameVar}**.<br><br>We'll explore one key integrative question per module—a reflection on how you'd apply its ideas using AI.<br><br>Ready to begin?`,
                        true
                    );
                    return; // prevent preloaded greetings/readiness prompts
                }

                // Rotate greeting (with optional first name)
                const name = getFirstName();
                const n = name && name.toLowerCase() !== "there" ? name : null;

                const greetings = [
                    n ? `Hello, ${n}. 👋` : "Hello, there. 👋",
                    n ? `Hi, ${n}—welcome back! 🌟` : "Hi, welcome back! 🌟",
                    n ? `Hey ${n}, glad you’re here. 🚀` : "Hey, glad you’re here. 🚀",
                    "Welcome back! Let’s dive in. 🌱",
                    n ? `Hello again, ${n}! 👋` : "Hello again! 👋",
                    n ? `Hi ${n}, let’s begin. 📝` : "Hi there, let’s begin. 📝",
                    "Welcome back! 📚",
                    n ? `Good to see you again, ${n}—let’s get started. ⚡` : "Good to see you again, let’s get started. ⚡",
                    n ? `Hi ${n}, ready to kick things off? 🚀` : "Hi, ready to kick things off? 🚀",
                    n ? `Hello, ${n}. A clean start. 🌅` : "Hello, a clean start. 🌅",
                    n ? `Glad you’re here, ${n}. 🎯` : "Glad you’re here. 🎯",
                    n ? `Welcome, ${n}. ✨` : "Welcome. ✨",
                ];

                // usage
                const greeting = greetings[Math.floor(Math.random() * greetings.length)];
                addMessage("tutor", greeting, true);

                // Reset let's start fresh line.
                addMessage("tutor", "Starting this module again fresh.", true);

                // Reset-specific follow-up (rotating readiness prompt)
                const readinessPrompts = [
                    "Are you all set?",
                    "Ready to continue?",
                    "Shall we pick up where we left off?",
                    "Ready to dive back in?",
                    "Good to go?",
                    "Shall we jump back in?",
                    "Ready to resume?",
                    "Shall we get rolling?",
                    "Up for the next step?",
                    "Ready when you are.",
                ];
                addMessage("tutor", readinessPrompts[Math.floor(Math.random() * readinessPrompts.length)], true);

                // 🧩 Persist initial tutor bubbles once session_id exists
                setTimeout(async () => {
                    let tries = 0;
                    while (!window.__uniSessionId && tries++ < 10) await new Promise((r) => setTimeout(r, 300));
                    console.debug("[init-save] new record with greeting bubbles");
                    try {
                        await safeSaveConversationState("fresh");
                    } catch (e) {
                        // 👈 delete-then-insert
                        console.warn("[init-save failed]", e);
                    }
                }, 1500);
            } catch (e) {
                console.error("[tutor/reset]", e);
                addMessage("tutor", "Could not reset the session.", true);
            }
        }

        // === RESTORE PROGRESS ON PAGE LOAD ===
        async function restoreProgress() {
            if (window.__restoreInFlight) {
                debug("[BOOT FLAG #4] restoreProgress() invoked — beginning state load");
                console.debug("[restoreProgress] skipped duplicate call");
                return;
            }
            window.__restoreInFlight = true;
            try {
                const res = await apiFetch(convoBase + "/lesson/progress", {
                    method: "POST",
                    body: JSON.stringify({
                        graphId: window.__uniGraphId,
                        nodeId: window.__uniNodeId,
                        mode: "read", // ✅ this must be 'mode: read'
                    }),
                });

                if (!res.ok) throw new Error(res.status);
                const data = await res.json();

                if (data?.course_id || data?.node_id) {
                    const newGraph = data?.course_id ? String(data.course_id).toUpperCase() : "";
                    const newNode = data?.node_id ? String(data.node_id).toUpperCase() : "";
                    if (newGraph && newGraph !== window.__uniGraphId) {
                        window.__uniGraphId = newGraph;
                        graphId = newGraph;
                    }
                    if (newNode && newNode !== window.__uniNodeId) {
                        window.__uniNodeId = newNode;
                        nodeId = newNode;
                    }
                    if (data?.course_name) window.__uniCourseName = data.course_name;
                    if (data?.node_name) window.__uniModuleName = data.node_name;
                    try {
                        localStorage.setItem("uni:lastContext", JSON.stringify({ graphId: window.__uniGraphId, nodeId: window.__uniNodeId }));
                    } catch {}
                }

                if (data?.score != null) {
                    const pct = coerceProgressPercent(data.score);
                    console.log("[restoreProgress] loaded", pct + "%");
                    updateProgressUI(pct);

                    // 🔁 ensure server-side truth syncs full completion
                    if (pct >= 100) {
                        logMastery("node_completed_on_restore", { percent: pct });

                        // stamp completed silently
                        await markComplete(100, { silent: true });

                        // refresh hints so nextEligibleUrl resolves past the current node
                        await new Promise((r) => setTimeout(r, 250));
                        await refreshCourseHints();

                        // remember we showed completion to avoid loops
                        sessionStorage.setItem(COMPLETE_KEY(), "1");

                        // single, unified banner
                        showCompletionBanner(__safeNextUrl());
                    }
                }
            } catch (err) {
                console.warn("[restoreProgress]", err);
                // emulate finally safely
                window.__restoreInFlight = false;
                return; // prevent fall-through
            }

            // ✅ always clear the flag when the try succeeds
            window.__restoreInFlight = false;

            window.restoreProgress = restoreProgress; // optional: for console testing
        }

        function __safeNextUrl() {
            try {
                const hints = window.__U?.courseHints || {};
                const course = window.__uniGraphId;
                const entry = hints[course];
                let next = entry?.nextEligibleUrl || entry?.resumeUrl || "/dashboard";

                // 🔁 Force recompute if hints are missing or point to dashboard
                if (!next || /\/dashboard$/.test(next)) {
                    const nodes = window.__lastGraphNodes || []; // fallback cache from last fetch
                    const ids = nodes.map((n) => String(n.id)).filter(Boolean);
                    const num = (id) => {
                        const m = id.match(/\d+/g);
                        return m ? Number(m.join("")) : 0;
                    };
                    const order = ids.slice().sort((a, b) => num(a) - num(b) || a.localeCompare(b));
                    const curr = window.__uniNodeId;
                    const i = order.indexOf(curr);
                    const nextId = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
                    const capId = resolveCapstoneNode(course, nodes);
                    next = nextId ? `/classroom?graph=${course}&node=${nextId}` : `/classroom?graph=${course}&node=${capId}`;
                }

                const u = new URL(next, location.origin);
                if (u.pathname === location.pathname && u.search === location.search)
                    return `/classroom?graph=${window.__uniGraphId}&node=${resolveCapstoneNode(window.__uniGraphId, window.__lastGraphNodes)}`;
                return u.toString();
            } catch (e) {
                console.warn("[UNI][safeNextUrl fallback]", e);
                return `/classroom?graph=${window.__uniGraphId}&node=${resolveCapstoneNode(window.__uniGraphId, window.__lastGraphNodes)}`;
            }
        }

        window.__safeNextUrl = __safeNextUrl;
        window.refreshCourseHints = refreshCourseHints;

        function getCertificateDisplayName() {
            const candidates = [
                normalizeFullName(window.__uniUserFullName),
                getFullName(),
                normalizeFullName(window.__U?.profile?.preferred_name),
                normalizeFullName(window.__uniUserName),
                normalizeFullName(getFirstName()),
            ];
            for (const name of candidates) {
                if (name) return name;
            }
            return "";
        }

        async function onCourseCompleted({ email, courseCode }) {
            if (!email) return;
            const normalizedCourse = (courseCode || "").toString().toUpperCase();
            const finishBtn = document.getElementById("capFinishBtn");
            const setFinish = (label, handler) => {
                if (!finishBtn) return;
                finishBtn.disabled = false;
                finishBtn.textContent = label;
                finishBtn.onclick = (evt) => {
                    try {
                        if (typeof handler === "function") handler(evt);
                    } catch (err) {
                        console.warn("[cert status] finish handler failed", err);
                    }
                };
            };

            if (finishBtn) {
                finishBtn.disabled = true;
                finishBtn.textContent = "Generating your certificate…";
            }

            const courseName = window.__uniCourseName || document.getElementById(ROOT_ID + "-planHeader")?.textContent || normalizedCourse;
            let issued = null;
            try {
                const nameForCert = getCertificateDisplayName();
                const payload = { email, courseId: normalizedCourse, courseName };
                if (nameForCert) payload.name = nameForCert;
                issued = await issueCourseCertificate(payload);
            } catch (err) {
                console.warn("[cert status] microcertificate attempt failed", err);
            }
            if (issued?.ok) {
                const targetUrl = typeof issued.url === "string" && issued.url ? issued.url : "/certificate";
                setFinish("Download Certificate", (evt) => {
                    evt?.preventDefault();
                    const win = window.open(targetUrl, "_blank", "noopener,noreferrer");
                    if (!win) {
                        console.warn("[cert status] popup blocked for certificate download", targetUrl);
                    }
                });
                addMessage("system", "🎓 Your certificate is ready!<br><br><br><br>", false);
                return;
            }

            if (finishBtn) {
                finishBtn.textContent = "Checking your certificate status…";
            }

            try {
                await ensureFreshCWT();
            } catch (err) {
                console.warn("[cert status] token refresh failed", err);
            }
            const headers = apiHeaders(true);
            let bootstrapData = null;
            try {
                const res = await fetch(BOOTSTRAP_URL, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ email, include_progress: true })
                });
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    console.warn("[cert status] bootstrap refresh failed", res.status, json?.error || json?.detail || json);
                }
                bootstrapData = json?.data || null;
                if (json?.data) {
                    window.__U = { ...(window.__U || {}), ...json.data };
                }
            } catch (err) {
                console.warn("[cert status] bootstrap refresh failed", err);
            }
            const metaById = new Map();
            let candidateIds = [];
            try {
                const res = await fetch(BOOTSTRAP_URL, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ email, mode: "cert-map", course_id: normalizedCourse })
                });
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    console.warn("[cert status] cert-map failed", res.status, json?.error || json?.detail || json);
                } else {
                    const certs = Array.isArray(json?.data?.certificates) ? json.data.certificates : json?.certificates || [];
                    for (const cert of certs) {
                        const bid = (cert?.business_id || cert?.cert_id || "").toString().toUpperCase();
                        if (bid) metaById.set(bid, cert);
                    }
                    candidateIds = Array.from(metaById.keys());
                }
            } catch (err) {
                console.warn("[cert status] cert-map failed", err);
            }
            if (!candidateIds.length && Array.isArray(bootstrapData?.entitlements?.certificate_enrollments)) {
                for (const enr of bootstrapData.entitlements.certificate_enrollments) {
                    const bid = (enr?.cert_id || enr?.certId || "").toString().toUpperCase();
                    if (!bid) continue;
                    if (!metaById.has(bid)) {
                        metaById.set(bid, {
                            business_id: bid,
                            name: enr?.cert_name || null,
                            level: enr?.level || null
                        });
                    }
                }
                candidateIds = Array.from(metaById.keys());
            }
            const eligibility = [];
            for (const certId of candidateIds) {
                try {
                    const res = await fetch(BOOTSTRAP_URL, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ email, mode: "cert-eligibility", cert_id: certId })
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok) {
                        console.warn("[cert status] eligibility failed", certId, res.status, json?.error || json?.detail || json);
                        continue;
                    }
                    if (json?.data?.cert) {
                        const meta = metaById.get(certId) || {};
                        eligibility.push({ cert_id: certId, ...meta, ...json.data.cert });
                    }
                } catch (err) {
                    console.warn("[cert status] eligibility failed", certId, err);
                }
            }
            if (!eligibility.length) {
                setFinish("Return to Dashboard", () => (location.href = "/dashboard"));
                return;
            }
            const completed = eligibility.find((c) => {
                const cta = (c.primary_cta || "").toLowerCase();
                return c.enrollment_status === "completed" || cta.includes("view certificate");
            });
            if (completed) {
                setFinish("View Certificate", () => (location.href = "/certificate"));
                addMessage("system", `🎓 ${completed.cert_name || completed.cert_id || "Certificate"} is ready to view.`, false);
                return;
            }
            const planBlocked = eligibility.find((c) => c.progress?.ready && !c.can_enroll);
            if (planBlocked) {
                const level = (planBlocked.level || planBlocked.cert?.level || "").toString().toUpperCase();
                const targetPlan = level === "CR2" ? "Pro" : "Plus";
                setFinish("Upgrade to Redeem", () => (location.href = targetPlan === "Pro" ? "/pricing?plan=pro" : "/pricing?plan=plus"));
                addMessage("system", `Upgrade to ${targetPlan} to redeem ${planBlocked.cert_name || planBlocked.cert_id || "this certificate"}.`, false);
                if (planBlocked.progress?.reqTotal) {
                    addMessage("system", `Progress: ${planBlocked.progress.reqDone} of ${planBlocked.progress.reqTotal} required courses complete.`, false);
                }
                return;
            }
            const redeemable = eligibility.find((c) => c.progress?.ready && c.can_enroll);
            if (redeemable && finishBtn) {
                finishBtn.disabled = false;
                const rawLabel = (redeemable.primary_cta || "").trim();
                const label = rawLabel && !/unenroll/i.test(rawLabel) ? rawLabel : "Redeem Certificate";
                finishBtn.textContent = label;
                finishBtn.onclick = async () => {
                    finishBtn.disabled = true;
                    finishBtn.textContent = "Finishing…";
                    try {
                        await fetch(BOOTSTRAP_URL, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({ email, mode: "cert-redeem", cert_id: redeemable.cert_id })
                        });
                    } catch (err) {
                        console.warn("[cert status] redeem failed", err);
                    }
                    location.href = "/certificate";
                };
                return;
            }
            const pending = eligibility.find((c) => c.progress && c.progress.reqTotal > 0);
            if (pending) {
                setFinish("Return to Dashboard", () => (location.href = "/dashboard"));
                addMessage("system", `Certificate progress: ${pending.progress.reqDone} of ${pending.progress.reqTotal} required courses complete.`, false);
                return;
            }
            if (finishBtn) {
                setFinish("View Certificate", () => (location.href = "/certificate"));
            }
        }

        async function markProgress(percent, silent = false) {
    // --- Normalize caller input to a 0..1 fraction (server expects fraction) ---
    // Accept both 0..100 (percent) and 0..1 (fraction).
    // Special case: raw === 1 is treated as *1%* (boot path calls markProgress(1, true)).
    let raw = Number(percent);
    if (!isFinite(raw)) raw = 0;

    let fraction;
    if (raw > 1) {
        fraction = raw / 100;        // 64 -> 0.64, 100 -> 1
    } else if (raw === 1) {
        fraction = 0.01;             // 1 -> 1% (avoid stamping 100%)
    } else {
        fraction = raw;              // 0..1 -> already a fraction
    }
    if (fraction < 0) fraction = 0;
    if (fraction > 1) fraction = 1;

    // --- skip redundant silent start when we already have higher progress ---
    // Compare like-with-like (we store a fraction in PROG_KEY)
    const existing = readStoredProgressFraction();
    if (silent && fraction <= existing) {
        console.log("[markProgress] skipped redundant silent update");
        return { ok: true, skipped: true };
    }

    try {
        const res = await apiFetch(convoBase + "/lesson/progress", {
            method: "POST",
            body: JSON.stringify({ graphId, nodeId, percent: fraction }),
        });
        const data = await res.json();

        if (data?.course_id || data?.node_id) {
            const newGraph = data?.course_id ? String(data.course_id).toUpperCase() : "";
            const newNode = data?.node_id ? String(data.node_id).toUpperCase() : "";
            if (newGraph && newGraph !== window.__uniGraphId) {
                window.__uniGraphId = newGraph;
                graphId = newGraph;
            }
            if (newNode && newNode !== window.__uniNodeId) {
                window.__uniNodeId = newNode;
                nodeId = newNode;
            }
            if (data?.course_name) window.__uniCourseName = data.course_name;
            if (data?.node_name) window.__uniModuleName = data.node_name;
            try {
                localStorage.setItem("uni:lastContext", JSON.stringify({ graphId: window.__uniGraphId, nodeId: window.__uniNodeId }));
            } catch {}
        }

        // ✅ Always update directly from server's score if available
        let pctNowPercent = null;
        if (data?.score != null) {
            pctNowPercent = coerceProgressPercent(data.score);
            console.log("[markProgress] server score", pctNowPercent);
            updateProgressUI(pctNowPercent);
        }

        // If server also returns node_percent (0..100), prefer it when score missing
        if (data?.node_percent != null) {
            const nodePct = coerceProgressPercent(data.node_percent);
            updateProgressUI(nodePct);
            if (pctNowPercent == null) pctNowPercent = nodePct;
        }

        // ✅ confirm with a read-back to sync UI with server truth
        try {
            const persisted = await readPersistedProgress();
            const confirmedPct = coerceProgressPercent(
                persisted?.score ?? (pctNowPercent != null ? pctNowPercent / 100 : 0)
            );
            updateProgressUI(confirmedPct);
            pctNowPercent = confirmedPct;
        } catch (e) {
            console.warn("[markProgress] read-back failed", e);
        }

        // ✅ fallback to persisted read if needed
        if (pctNowPercent == null || isNaN(pctNowPercent)) {
            const persisted = await readPersistedProgress();
            pctNowPercent = coerceProgressPercent(persisted?.score ?? 0);
            console.log("[markProgress] fallback persisted", pctNowPercent);
            updateProgressUI(pctNowPercent);
        }

        // ✅ Only auto-complete on non-silent calls
        if (!silent && pctNowPercent >= 100) {
            logMastery("node_completed_auto", { percent: pctNowPercent });
            await markComplete(100, { silent: true });
            await refreshCourseHints();
            if (!/^CAP(?:_|$)/i.test(String(window.__uniNodeId || ""))) {
                showCompletionBanner(__safeNextUrl());
            }
        }

        if (!res.ok) throw new Error(data?.error || res.status);

        if (silent) {
            console.log(`[progress] Saved silently at ${Math.round(fraction * 100)}% for ${graphId}/${nodeId}`);
        }

        // GA4 event (renamed to avoid auto-redirects)
        try {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: "uni_lesson_progress",
                graph_id: graphId,
                node_id: nodeId,
                session_id: sessionId,
                user_hash: window.__uniUserHash,
                score: pctNowPercent ?? Math.round(fraction * 100),
                redirect: false,
            });
        } catch {}

        // Persist the fraction so future comparisons use the same unit
        writeStoredProgressFraction(fraction);

        logMastery("progress_saved_client", { percent: pctNowPercent ?? Math.round(fraction * 100) });
        return data;
    } catch (e) {
        console.error("[lesson/progress]", e);
        if (String(e).includes("unmet prerequisites")) {
            addMessage("tutor", "🔒 This module is locked until you finish the previous one.", false);
        } else if (!silent) {
            addMessage("tutor", "Could not save progress.", false);
        }
    }
}


        async function markComplete(percent = 100, opts = {}) {
            try {
                const res = await apiFetch(convoBase + "/lesson/complete", {
                    method: "POST",
                    body: JSON.stringify({ graphId, nodeId, percent }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || res.status);

                triggerModuleSummary().catch((err) => console.warn("[UNI][summary] trigger failed", err));

                const currentNodeId = String(nodeId || window.__uniNodeId || "").toUpperCase();
                const isCapstoneNode = CAPSTONE_ID_PATTERN.test(currentNodeId);

                // --- Distinguish between regular and Capstone completion ---
                if (isCapstoneNode) {
                    // 🎓 CAPSTONE finale
                    addMessage(
                        "tutor",
                        `🎓 Congratulations — you’ve completed your *Capstone for ${window.__uniCourseName || "this course"}*!
        You’ve reflected on each module and explored how AI can enhance your work.
        Take a moment to celebrate your achievement!`,
                        true
                    );

                    // 🎉 Confetti celebration
                    const script = document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
                    script.onload = () => {
                        const end = Date.now() + 4000;
                        (function frame() {
                            window.confetti({
                                particleCount: 6,
                                spread: 70,
                                origin: { x: Math.random(), y: Math.random() - 0.2 },
                            });
                            if (Date.now() < end) requestAnimationFrame(frame);
                        })();
                    };
                    document.head.appendChild(script);

                    // 🏁 Custom Capstone banner
                    const bar = document.createElement("div");
                    bar.id = "uniCompleteBanner";
                    bar.className = "capstone-finish";
                    bar.innerHTML = `
            <span class="label">🎓 Course Complete — Well done!</span>
            <button class="btn" id="capFinishBtn">View Certificate</button>
            <button class="btn secondary" id="capDashBtn">Dashboard</button>
          `;
                    document.body.appendChild(bar);
                    document.getElementById("capFinishBtn").onclick = () => (location.href = "/certificate");
                    document.getElementById("capDashBtn").onclick = () => (location.href = "/dashboard");

                    try {
                        const emailResolved = await waitForUserEmail();
                        if (emailResolved && !window.__capstoneCertProbe) {
                            window.__capstoneCertProbe = true;
                            onCourseCompleted({ email: emailResolved, courseCode: window.__uniGraphId });
                        }
                    } catch (err) {
                        console.warn("[cert status] completion probe failed", err);
                    }

                    // Disable further input after Capstone finale
                    const inputRow = document.querySelector(".uni-input-row");
                    if (inputRow) {
                        inputRow.style.display = "none";
                        addMessage("system", "🎉 Course complete! <br><br><br><br><br>", false);
                    }

                    updateProgressUI(100);
                }

                // Analytics + logs + UI (rename event to avoid GTM redirect)
                try {
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({
                        event: "uni_lesson_complete", // ← renamed
                        graph_id: graphId,
                        node_id: nodeId,
                        session_id: sessionId,
                        user_hash: window.__uniUserHash,
                        score: percent,
                        redirect: false, // ← explicit signal
                    });
                } catch {}

                logMastery("node_completed", { percent: Math.round(percent) });

                if (!isCapstoneNode) {
                    // Update the UI immediately for normal modules
                    updateProgressUI(100);
                    showCompletionBanner(__safeNextUrl());

                    // Refresh hints in the background but await before exiting
                    const hintsPromise = refreshCourseHints();

                    if (!opts.silent) {
                        await new Promise((r) => setTimeout(r, 200));
                        addMessage(
                            "tutor",
                            "🎉 Congratulations — you've completed this module! Take a moment to reflect before continuing.",
                            true
                        );
                    }

                    await hintsPromise;
                } else {
                    updateProgressUI(100);
                }


                return data;
            } catch (e) {
                console.error("[lesson/complete]", e);
                if (String(e).includes("unmet prerequisites")) {
                    addMessage("tutor", "🔒 This module is locked until you finish the previous one.", false);
                    try {
                        window.dataLayer = window.dataLayer || [];
                        window.dataLayer.push({
                            event: "module_locked",
                            graph_id: graphId,
                            node_id: nodeId,
                            session_id: sessionId,
                            user_hash: window.__uniUserHash,
                        });
                    } catch {}
                } else {
                    addMessage("tutor", "Could not mark complete.", false);
                }
            }
        }

        // Expose for quick testing in the console:
        window.uniProgress = markProgress;
        window.uniComplete = markComplete;

        function handleSend() {
            const text = (inputEl.value || "").trim();
            if (!text) return;

            // GA4: client submit event
            try {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                    event: "tutor_submit",
                    graph_id: graphId,
                    node_id: nodeId,
                    session_id: sessionId,
                    message_length: text.length,
                    user_hash: window.__uniUserHash, // <-- add this line
                });
            } catch {}

            addMessage("user", text, true);
            logMastery("user_answer_submitted", { source: "chat", length: text.length });

            // Uni cheer on positive user text (cadence-gated)
            if (isPositiveText(text)) {
                __uniCheerTurns++; // count this positive turn
                const name = (window.__uniUserName || "").trim();
                const last = messagesEl.lastElementChild;
                const alreadyUni = last?.classList?.contains("uni-uni");
                if (!alreadyUni && __uniCheerTurns >= __uniNextCheerAt) {
                    renderUniBubble(`Great job${name ? `, ${name}` : ""}!`);
                    __uniCheerTurns = 0;
                    __uniNextCheerAt = 3 + Math.floor(Math.random() * 4); // reset to 3..6
                }
            }

            inputEl.value = "";
            sendAiReply(text);
        }

        // Wire
        sendBtn.addEventListener("click", handleSend);
        let __lastTouchSend = 0;
        sendBtn.addEventListener(
            "touchend",
            (e) => {
                // iOS will first blur the input (closing the keyboard) and cancel the click.
                // Trigger send manually so the first tap submits the message.
                e.preventDefault();
                const now = Date.now();
                if (now - __lastTouchSend < 250) return;
                __lastTouchSend = now;
                handleSend();
            },
            { passive: false }
        );
        inputEl.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
            }
        });

        const MOBILE_CONFIRM_UI_GAP = 1; // height of the Safari confirmation/address UI
        const isMobileViewport = () => window.matchMedia("(max-width: 768px)").matches;
        const computeKeyboardOffset = (vv) => {
            if (!vv) return 0;

            if (isMobileViewport()) {
                return 0;
            }

            const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
            let offset = layoutHeight - (vv.height + vv.offsetTop);
            if (offset <= 0) return 0;

            return offset;
        };

        // ===== Keyboard-aware offsets (mobile) =====
        (function setupMobileAnchoring() {
            function setBarH() {
                rootEl.style.setProperty("--bar-h", inputRow.offsetHeight + "px");
            }
            setBarH();
            try {
                new ResizeObserver(setBarH).observe(inputRow);
            } catch {}

            if (window.visualViewport) {
                const recompute = () => {
                    const kb = computeKeyboardOffset(window.visualViewport);
                    rootEl.style.setProperty("--kb", kb + "px");
                };
                window.visualViewport.addEventListener("resize", recompute);
                window.visualViewport.addEventListener("scroll", recompute);
                window.addEventListener("orientationchange", recompute);
                recompute();
            }
        })();

        // -------- Plan loader (full) --------
        async function loadPlan() {
            const planWrap = planBody;
            const detailEl = planDetail;
            if (!planWrap || !detailEl) return;

            try {
                // 👇 use the same apiFetch so it carries the CWT Authorization header
                const res = await apiFetch(`${convoBase}/graph?courseId=${encodeURIComponent(window.__uniGraphId)}`);
                if (!res.ok) throw new Error(`graph ${res.status}`);
                const { graph } = await res.json();

                const nodes = (graph?.graph?.nodes || []).slice();

                // Simple topo-ish order: prereq-first (fallback to input order)
                const byId = new Map(nodes.map((n) => [String(n.id).toUpperCase(), n]));
                const visited = new Set(),
                    order = [];
                function visit(id) {
                    const key = String(id || "").toUpperCase();
                    if (!key || visited.has(key)) return;
                    visited.add(key);
                    const n = byId.get(key);
                    if (!n) return;
                    for (const p of n.prerequisites || []) visit(p);
                    if (!order.includes(n)) order.push(n);
                }
                // seed
                for (const n of nodes) visit(n.id);

                const items = order
                    .map((n) => {
                        const locked = (n.prerequisites || []).length > 0; // client-side hint only
                        const title = `${n.name || n.id}${n.difficulty ? ` · D${n.difficulty}` : ""}`;
                        return `<li>
        <a href="?graph=${encodeURIComponent(window.__uniGraphId)}&node=${encodeURIComponent(n.id)}"
           class="uni-module-link" data-id="${htmlEscape(n.id)}">
          ${htmlEscape(title)}
        </a>
        ${locked ? `<span class="uni-muted" style="margin-left:6px">(${n.prerequisites.join(" → ")})</span>` : ""}
      </li>`;
                    })
                    .join("");

                planWrap.classList.remove("uni-muted");
                planWrap.innerHTML = `<ul>${items}</ul>`;
            } catch (err) {
                console.error("[plan]", err);
                planWrap.innerHTML = `<p class="uni-error">Could not load your curriculum graph.</p>`;
            }
        }

        function canStartNode(nodeId, graph) {
            const nodes = graph?.graph?.nodes || [];
            const n = nodes.find((x) => String(x.id).toUpperCase() === String(nodeId).toUpperCase());
            if (!n) return true;
            const prereqs = n.prerequisites || [];
            // TODO: wire to real mastery lookups if available
            // For now, let server be the source of truth and just warn.
            return prereqs.length === 0;
        }

        let lastActiveAt = Date.now();

        // update whenever user does something meaningful
        function markActive() {
            lastActiveAt = Date.now();
        }

        ["click", "keypress", "pointerdown", "touchstart", "submit"].forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

        // chat send / mic toggle handlers already trigger click/submit
        // so they’ll be covered automatically

        // === Daily Learning Time Gate ===
        async function reserveLearningMinutes(minutes = 5) {
            try {
                const res = await apiFetch(convoBase + "/time/reserve", {
                    method: "POST",
                    body: JSON.stringify({ minutes }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || res.status);

                if (!data?.allowed) {
                    if (data.reason === "limit") {
                        addMessage("tutor", "⏳ You’ve reached your daily study time. Upgrade to keep learning.", true);
                        throw new Error("Daily limit reached");
                    }
                } else {
                    console.log(`[time-limit] Reserved ${minutes}min, remaining=${data.remaining}`);
                }
                return data;
            } catch (err) {
                console.error("[time-limit]", err);
                return null;
            }
        }

        // Kick off timer after user is confirmed
        async function startLearningTimer() {
            // immediate small reserve on first real activity
            markActive();

            async function tryReserve() {
                const now = Date.now();
                const isVisible = document.visibilityState === "visible" && document.hasFocus();
                const isActive = now - lastActiveAt <= 90_000; // active within last 90s

                if (isVisible && isActive) {
                    await reserveLearningMinutes(5);
                } else {
                    console.debug("[time-limit] skipped (idle/hidden)");
                }
            }

            // Reserve once right away (if active)
            await tryReserve();

            if (window.__uniTimeSync) clearInterval(window.__uniTimeSync);

            // Wait for header timer to restore totalMs so tot >= __lastSentMs
            async function waitForTimerReady(maxMs = 2000) {
                const deadline = Date.now() + maxMs;
                while (Date.now() < deadline) {
                    const tot = getActiveTotalMs();
                    if (tot >= __lastSentMs) return;
                    await new Promise((r) => setTimeout(r, 50));
                }
            }
            // IMPORTANT: wait once before starting sync interval
            await waitForTimerReady();

            // every 5 minutes, only if active
            setInterval(tryReserve, 5 * 60 * 1000);
        }

        // === GA4: identity stamp + tutor_open (fire once) ===
        let __tutorOpenFired = false;
        async function fireTutorOpen() {
            if (__tutorOpenFired) return;
            __tutorOpenFired = true;

            const userHash = await sha256Hex(userId.toLowerCase());
            window.__uniUserHash = userHash; // used by GA hook enrichment

            if (typeof window.gtag === "function") {
                window.gtag("set", "user_properties", { user_hash: userHash });
            }
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: "tutor_open",
                graph_id: graphId,
                node_id: nodeId,
                session_id: sessionId, // may be null on first paint
                user_hash: userHash,
            });
        }

        // Back-compat shim: we don't actually AUTH on email anymore.
        // This just prevents crashes where old code still calls it.
        async function ensureUserEmail() {
            const qs = new URLSearchParams(location.search).get("email") || "";
            const softr = (resolveUserEmail() || "").toLowerCase();
            // Best effort: return *something* stringy so GA hashing doesn't blow up
            return qs || softr || getUserId() || "";
        }

        const runAfterDomReady = async () => {
            if (window.__uniDomReadyRan) return;
            window.__uniDomReadyRan = true;
            rootEl.setAttribute("data-ready", "1");

            // Resolve identity (UI/GA only; server identity now comes from CWT)
            if (!userId) userId = await ensureUserEmail();
            const userName = getFirstName();
            window.__uniUserName = userName;
            const fullName = getFullName();
            if (fullName) window.__uniUserFullName = fullName;

            if (!userId) {
                addMessage("tutor", "Please sign in or provide ?email= in the URL to begin.", false);
                return;
            }

            if (getCWT()) {
                await loadHeaderInfo();
            }

            // --- CLEANUP ON LOAD: remove any lingering completion UI from previous module ---
            try {
                // Remove the completion banner if it exists
                const oldBanner = document.getElementById("uniCompleteBanner");
                if (oldBanner) {
                    console.info("[UNI] Removing leftover completion banner");
                    oldBanner.remove();
                }

                // Reset nav progress pill to 0%
                const navPill = document.getElementById("uniNavProgressPill");
                if (navPill) {
                    navPill.textContent = "0%";
                    navPill.style.setProperty("--p", "0%");
                    navPill.setAttribute("aria-label", "Module progress 0 percent");
                }

                // Reset header pill if present
                const headerPill = document.querySelector('[id$="-progress"]');
                if (headerPill) {
                    headerPill.textContent = "0%";
                    headerPill.setAttribute("aria-label", "Module progress 0 percent");
                }

                // Clear any stale completion flags stored in session or local storage
                for (const key of Object.keys(localStorage)) {
                    if (key.startsWith("uni:progress:")) localStorage.removeItem(key);
                }
                for (const key of Object.keys(sessionStorage)) {
                    if (key.startsWith("uni:completed:")) sessionStorage.removeItem(key);
                }

                console.info("[UNI] Completion UI cleared on load");
            } catch (e) {
                console.warn("[UNI] Cleanup on load failed", e);
            }

            // Everything below requires a valid CWT → run ONLY after bootstrap
            onBootstrappedOnce(async () => {
                const bootTyping = showTypingBubble();

                try {
                    // 🌟 ensure we have a valid token
                    await ensureFreshCWT();

                    // 🔧 A. Debounce to stop double runs from Softr re-injection
                    if (window.__bootInFlight) {
                        console.debug("[UNI] skipped duplicate boot chain");
                        return;
                    }
                    window.__bootInFlight = true;

                    // 🌟 RESTORE once CWT is valid (now authenticated)
                    await restoreProgress();

                    // 🔧 B. Skip redundant “mark start” if already >1%
                    try {
                        const persisted = await readPersistedProgress();
                        const pct = coerceProgressPercent(persisted?.score || 0);
                        if (pct < 1) {
                          updateProgressUI(1);                       // ✅ no server write; shows 1% locally
                        } else {
                          console.debug("[UNI] skip UI nudge — already", pct + "%");
                        }

                    } catch (e) {
                        console.warn("[UNI] readPersistedProgress during boot failed", e);
                    }

                    try {
                        await fetchMinutesLeftNow();
                    } catch {}

                    // Returns the local, on-screen active milliseconds from the header timer
                    const getActiveTotalMs = () => {
                        try {
                            return window.uniTimer?.value()?.totalMs ?? 0;
                        } catch {
                            return 0;
                        }
                    };

                    // Seed last-sent strictly from billed baseline to avoid re-billing on reload
                    let __lastSentMs = 0;
                    try {
                        const billed = Number(localStorage.getItem(BILLED_KEY)) || 0;
                        __lastSentMs = billed;
                    } catch {}

                    // [CLASSROOM-ADD-2] === Active-time sync loop (10s) ===

                    // --- Fallback: periodic time-ingest heartbeat (guarantees updates) ---
                    if (!window.__uniHeartbeat) {
                        window.__uniHeartbeat = setInterval(async () => {
                            try {
                                // Send a small delta (1 minute) if nothing has posted in >70s
                                const since = Date.now() - (window.__lastIngestAt || 0);
                                if (since > 70_000) {
                                    console.debug("[time-ingest][fallback] posting 60 s delta");
                                    await sendActiveDelta(60_000);
                                    window.__lastIngestAt = Date.now();
                                }
                            } catch (err) {
                                console.warn("[time-ingest heartbeat failed]", err);
                            }
                        }, 60_000);
                    }

                    const SEND_THRESHOLD_MS = 60000;
                    if (window.__uniTimeSync) clearInterval(window.__uniTimeSync); // prevent duplicates
                    window.__uniTimeSync = setInterval(async () => {
                        const tot = getActiveTotalMs();
                        if (tot <= __lastSentMs) return;

                        const delta = tot - __lastSentMs;
                        if (delta >= SEND_THRESHOLD_MS) {
                            const whole = delta - (delta % SEND_THRESHOLD_MS);
                            await sendActiveDelta(whole);
                            __lastSentMs += whole;
                            try {
                                localStorage.setItem(BILLED_KEY, String(__lastSentMs));
                            } catch {}
                        }
                    }, 10000);

                    const __flush = () => {
                        const tot = getActiveTotalMs();
                        if (tot <= __lastSentMs) return;

                        const delta = tot - __lastSentMs;
                        const whole = delta - (delta % SEND_THRESHOLD_MS);
                        if (whole > 0) {
                            sendActiveDelta(whole, true);
                            __lastSentMs += whole;
                            try {
                                localStorage.setItem(BILLED_KEY, String(__lastSentMs));
                            } catch {}
                        }
                    };
                    window.addEventListener("pagehide", __flush);
                    document.addEventListener("visibilitychange", () => {
                        if (document.visibilityState === "hidden") __flush();
                    });

                    document.addEventListener("visibilitychange", () => {
                        if (document.visibilityState === "hidden") {
                            window.uniTimer?.pause?.();
                        } else {
                            window.uniTimer?.resume?.();
                        }
                    });

                    // 3) Restore conversation (server now requires CWT)
                    try {
                        await loadConversationState();
                        hideTypingBubble(bootTyping);
                    } catch (e) {
                        console.error("[loadConversationState]", e);
                    }
                    hideTypingBubble(bootTyping);

                    // 4) First-greet + prompt if no history
                    if (!Array.isArray(conversation) || conversation.length === 0) {
                        const isCapstoneNode = /^CAP(?:_|$)/i.test(String(window.__uniNodeId || ""));
                        const courseNameVar = window.__uniCourseName || "this course";
                        if (isCapstoneNode) {
                            addMessage(
                                "tutor",
                                `Welcome to your *Capstone Completion* for **${courseNameVar}**.

We'll revisit two key ideas from each module you've completed.

Ready to begin?`,
                                true
                            );
                        } else {
                            const greetings = ["Hello, there. 👋", "Hi, welcome back! 🌟", "Hey, glad you’re here. 🚀", "Welcome! Let’s dive in. 🌱"];
                            addMessage("tutor", greetings[Math.floor(Math.random() * greetings.length)], true);
                            setTimeout(nextPrompt, 400);
                        }
                    }

                    // 🧩 Persist initial tutor bubbles once session_id exists
                    setTimeout(async () => {
                        let tries = 0;
                        while (!window.__uniSessionId && tries++ < 10) await new Promise((r) => setTimeout(r, 300));
                        console.debug("[init-save] new record with greeting bubbles");
                        try {
                            await safeSaveConversationState("fresh");
                        } catch (e) {
                            console.warn("[init-save failed]", e);
                        }
                    }, 1500);

                    // 🧩 Second flush to capture all new bubbles once session_id confirmed
                    setTimeout(async () => {
                        let tries = 0;
                        while (!window.__uniSessionId && tries++ < 10) await new Promise((r) => setTimeout(r, 300));
                        console.debug("[reset-save] flushing reset greeting to Softr…", { session: window.__uniSessionId });
                        try {
                            await saveConversationState();
                        } catch (e) {
                            console.warn("[reset-save failed]", e);
                        }
                    }, 1500);

                    // 5) Load plan (clever-worker requires CWT)
                    loadPlan();
                } catch (err) {
                    console.warn("[boot after CWT] some steps failed", err);
                } finally {
                    // 🔧 C. Reset guard so next navigation can re-init
                    window.__bootInFlight = false;
                }
            });

            // GA: tutor_open stamp (does not require CWT)
            await fireTutorOpen();
            window.addEventListener("load", fireTutorOpen);

            ensureNavProgressPill();
            setTimeout(positionNavPill, 0);
            window.addEventListener("load", positionNavPill);

            // 🚀 defer the heavy async section to run after the stack unwinds
            queueMicrotask(async () => {
                try {
                    await ensureFreshCWT();
                    await loadHeaderInfo();
                    await restoreProgress();
                    debug("[BOOT FLAG #5] All boot steps finished — UI ready");
                    console.log("[UNI] deferred boot resumed successfully");
                } catch (e) {
                    console.error("[UNI] deferred boot error", e);
                }
            });

            // --- [Fail-safe Boot Nudge] ---
            // If the classroom hasn’t finished initializing within 1.5s,
            // force a gentle restoreProgress() call to avoid “stuck” boots.
            setTimeout(() => {
                if (!window.__restoreInFlight && !window.__bootInFlight) {
                    console.warn("[UNI] soft nudge: forcing restoreProgress()");
                    try {
                        restoreProgress().catch(() => {});
                    } catch {}
                }
            }, 1500);
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", runAfterDomReady, { once: true });
        } else {
            runAfterDomReady();
        }
    } // closes startUniversio()
    /* GA hook (unchanged) */
    (function () {
        if (window.__aiGaHookInstalled) return;
        window.__aiGaHookInstalled = true;

        var MATCH_PATH = /(ai-tutor-api|ai-reply|conversation-state)/i;

        function trackGA(analytics) {
            if (!analytics) return;

            // Enrich with user_hash set during boot
            const props = { ...(analytics.props || {}) };
            const userHash = window.__uniUserHash;
            if (userHash) {
                props.user_hash = userHash;
                if (typeof window.gtag === "function") {
                    // set user property in GA4
                    window.gtag("set", "user_properties", { user_hash: userHash });
                }
            }

            // Send event to GA4 if gtag is loaded
            if (typeof window.gtag === "function") {
                window.gtag("event", analytics.event, props);
            }

            // Always push to dataLayer for local debugging
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: analytics.event, ...props });
        }

        var originalFetch = window.fetch;
        window.fetch = function () {
            const args = Array.prototype.slice.call(arguments);
            const req = args[0];
            const url = req && req.url ? req.url : req;

            return originalFetch.apply(this, args).then((res) => {
                try {
                    if (url && MATCH_PATH.test(url)) {
                        const ct = (res.headers.get("content-type") || "").toLowerCase();
                        if (res.status !== 204 && ct.includes("application/json")) {
                            res.clone()
                                .json()
                                .then((data) => {
                                    console.debug("[GA hook]", url, data);

                                    if (data && data.analytics) {
                                        // Normal path: server provided analytics
                                        trackGA(data.analytics);
                                    } else if (/tutor\/message/i.test(String(url))) {
                                        // Fallback: synthesize ai_reply_generated
                                        const props = {
                                            graph_id: window.__uniGraphId,
                                            node_id: window.__uniNodeId,
                                            session_id: window.__uniSessionId,
                                            user_hash: window.__uniUserHash,
                                        };
                                        if (data && (data.assistant_text || data.session_id)) {
                                            console.debug("[GA synth ai_reply_generated]", props);
                                            trackGA({ event: "ai_reply_generated", props });
                                        } else {
                                            console.debug("[GA tutor/message no usable data]", data);
                                        }
                                    }
                                })
                                .catch((err) => {
                                    console.debug("[GA hook parse error]", url, err);
                                });
                        }
                    }
                } catch (err) {
                    console.debug("[GA hook outer error]", err);
                }
                return res;
            });
        };
    })();
  };

  Promise.all([loadMarked(), wrapperReady]).then(init);
})();
