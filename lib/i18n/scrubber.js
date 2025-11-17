import {
  LANGUAGE_OPTIONS,
  getDefaultLangContext,
  ensureLangContext,
  mergeLangContext,
  contextEquals,
  getLanguageEntry,
} from "./langMap.js";
import {
  createStore,
  createDerivedStore,
} from "./store.js";
import {
  loadLocale,
  rememberLangContext,
  restoreLangContext,
  withLocaleFallback,
  localeStorageAvailable,
  CONTEXT_STORAGE_KEY,
} from "./loader.js";

const DEFAULT_SURFACE = "unknown";
const observerConfig = { childList: true, subtree: true };
const SCRUB_EVENT = "universio:language-changed";

function parseParams(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") return json;
  } catch  {}
  const params = {};
  text.split(/[;,]/).forEach((pair) => {
    const [key, value] = pair.split("=");
    if (!key) return;
    params[key.trim()] = (value || "").trim();
  });
  return Object.keys(params).length ? params : null;
}

function toCamel(attr) {
  return attr
    .split(/[-:]/)
    .filter(Boolean)
    .map((part, idx) => (idx === 0 ? part.toLowerCase() : part[0].toUpperCase() + part.slice(1).toLowerCase()))
    .join("");
}

function datasetKeyForAttr(attr) {
  const camel = toCamel(attr);
  if (!camel) return null;
  return `i18n${camel[0].toUpperCase()}${camel.slice(1)}`;
}

function applyAttributes(el, translate) {
  const attrListRaw = el.getAttribute("data-i18n-attr");
  if (!attrListRaw) return;
  const list = attrListRaw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (!list.length) return;
  for (const attr of list) {
    const datasetKey = datasetKeyForAttr(attr);
    const key = datasetKey && el.dataset ? el.dataset[datasetKey] : null;
    const fallbackKey = el.getAttribute("data-i18n-attr-key") || el.getAttribute("data-i18n");
    const params = parseParams(el.getAttribute(`data-i18n-${attr}-params`)) || parseParams(el.getAttribute("data-i18n-params"));
    const translated = translate(key || fallbackKey, params);
    if (translated != null) {
      el.setAttribute(attr, translated);
      if (attr === "value" && "value" in el) {
        try {
          el.value = translated;
        } catch  {}
      }
    }
  }
}

function applyElement(el, translate) {
  if (!el || el.hasAttribute("data-i18n-skip")) return;
  const key = el.getAttribute("data-i18n");
  if (key) {
    const params = parseParams(el.getAttribute("data-i18n-params"));
    const htmlKey = el.getAttribute("data-i18n-html");
    const targetKey = htmlKey || key;
    const translated = translate(targetKey, params);
    if (translated != null) {
      if (htmlKey) {
        el.innerHTML = translated;
      } else if ("textContent" in el) {
        el.textContent = translated;
      }
    }
  }
  applyAttributes(el, translate);
}

function collectTargets(root) {
  const nodes = new Set();
  if (!root) return nodes;
  if (root.nodeType === Node.ELEMENT_NODE) {
    const element = root;
    if (element.hasAttribute("data-i18n") || element.hasAttribute("data-i18n-attr")) {
      nodes.add(element);
    }
  }
  const all = root.querySelectorAll?.("[data-i18n], [data-i18n-attr]");
  if (all) {
    all.forEach((el) => nodes.add(el));
  }
  return nodes;
}

function pushTelemetry(prev, next, surface = DEFAULT_SURFACE) {
  try {
    if (!prev || !next || prev.code === next.code) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "language_change",
      from: prev.code,
      to: next.code,
      from_label: prev.label,
      to_label: next.label,
      surface,
    });
  } catch  {
    // ignore telemetry failures
  }
}

function dispatchLanguageEvent(prev, next, surface, source) {
  try {
    window.dispatchEvent(
      new CustomEvent(SCRUB_EVENT, {
        detail: {
          previous: prev,
          current: next,
          surface,
          source,
        },
      })
    );
  } catch  {}
}

function applyDocumentDirection(ctx) {
  try {
    const doc = document.documentElement;
    if (!doc) return;
    doc.setAttribute("lang", ctx.code || "en");
    doc.setAttribute("dir", ctx.rtl ? "rtl" : "ltr");
    if (ctx.rtl) {
      doc.classList.add("is-rtl");
    } else {
      doc.classList.remove("is-rtl");
    }
  } catch  {}
}

const langStore = createStore(restoreLangContext() || getDefaultLangContext());
const translatorStore = createStore({ translate: (key) => key, code: "en", ready: false });
const derivedCodeStore = createDerivedStore(langStore, (ctx) => ctx.code);
let autoScrub = false;
let observer = null;
let scheduled = false;
let currentLocalePromise = null;

function scheduleScrub() {
  if (!autoScrub) return;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scrubDocument();
  });
}

function ensureObserver(root = document.documentElement) {
  if (observer || !root) return;
  observer = new MutationObserver(scheduleScrub);
  observer.observe(root, observerConfig);
}

async function hydrateLocale(code) {
  const normalized = String(code || "en").trim().toLowerCase();
  if (currentLocalePromise && currentLocalePromise.code === normalized) {
    return currentLocalePromise.promise;
  }
  const promise = loadLocale(normalized)
    .then((payload) => {
      const translate = withLocaleFallback(payload.primary, payload.fallback);
      translatorStore.set({ translate, code: normalized, ready: true, payload });
      return payload;
    })
    .finally(() => {
      if (currentLocalePromise && currentLocalePromise.code === normalized) {
        currentLocalePromise = null;
      }
    });
  currentLocalePromise = { code: normalized, promise };
  return promise;
}

function scrubNodes(nodes) {
  const state = translatorStore.get();
  const translate = state.translate;
  nodes.forEach((el) => {
    try {
      applyElement(el, translate);
    } catch (err) {
      console.warn("[i18n] scrub failed", err);
    }
  });
}

export function scrubDocument(root = document) {
  const nodes = collectTargets(root === document ? document.body || document : root);
  if (!nodes.size) return;
  const state = translatorStore.get();
  if (!state.ready) return;
  scrubNodes(nodes);
}

export async function setLanguage(input, options = {}) {
  const prev = langStore.get();
  const source = options.source || prev.source || "localStorage";
  const ctx = mergeLangContext(prev, ensureLangContext(input, source));
  if (contextEquals(prev, ctx) && prev.rtl === ctx.rtl) {
    langStore.set({ ...ctx, source });
    return ctx;
  }
  langStore.set({ ...ctx, source });
  rememberLangContext({ ...ctx, source });
  applyDocumentDirection(ctx);
  const payload = await hydrateLocale(ctx.code).catch(() => null);
  const shouldScrub = options.scrub !== false;
  if (payload && shouldScrub) {
    scrubDocument();
  }
  const surface = options.surface || DEFAULT_SURFACE;
  if (options.telemetry !== false) {
    pushTelemetry(prev, ctx, surface);
  }
  dispatchLanguageEvent(prev, ctx, surface, source);
  return ctx;
}

export function getCurrentLanguage() {
  return langStore.get();
}

export function getTranslator() {
  const state = translatorStore.get();
  return state.translate;
}

export function subscribeLanguage(listener) {
  return langStore.subscribe(listener);
}

export function subscribeCode(listener) {
  return derivedCodeStore.subscribe(listener);
}

export async function bootstrapI18n(options = {}) {
  const initial = options.initialContext
    ? ensureLangContext(options.initialContext, options.initialContext.source || "default")
    : langStore.get();
  langStore.set(initial);
  rememberLangContext(initial);
  applyDocumentDirection(initial);
  await hydrateLocale(initial.code).catch(() => null);
  if (options.scrub !== false) {
    scrubDocument();
  }
  if (options.observe !== false) {
    autoScrub = true;
    ensureObserver(options.observeRoot || document.documentElement);
  }
  return {
    getCurrentLanguage,
    setLanguage,
    scrubDocument,
    subscribe: subscribeLanguage,
  };
}

export function syncProfileLanguage(labelOrCode) {
  if (!labelOrCode) return;
  const entry = getLanguageEntry(labelOrCode);
  if (!entry) return;
  const current = langStore.get();
  if (current.code === entry.code && current.label === entry.label && current.source === "profiles") return;
  setLanguage(entry, { source: "profiles", telemetry: false });
}

export function exposeOnWindow(target = window) {
  if (!target) return;
  const api = {
    get options() {
      return LANGUAGE_OPTIONS.slice();
    },
    getLanguage: getCurrentLanguage,
    setLanguage: (labelOrCode, opts = {}) => setLanguage(labelOrCode, opts),
    subscribe: subscribeLanguage,
    scrub: scrubDocument,
    t: (key, params) => translatorStore.get().translate(key, params),
    storageKey: CONTEXT_STORAGE_KEY,
    storageAvailable: localeStorageAvailable,
  };
  target.universioI18n = target.universioI18n || api;
  Object.assign(target.universioI18n, api);
  return target.universioI18n;
}

export function enableAutoScrub() {
  autoScrub = true;
  ensureObserver(document.documentElement);
}

export function disableAutoScrub() {
  autoScrub = false;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export function isAutoScrubEnabled() {
  return autoScrub;
}

langStore.subscribe((ctx) => {
  rememberLangContext(ctx);
  applyDocumentDirection(ctx);
  try {
    if (typeof window !== "undefined") {
      window.__U = window.__U || {};
      window.__U.langContext = ctx;
    }
  } catch  {}
});
