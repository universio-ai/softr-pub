import { getDefaultLangContext, getLanguageEntry, getLabelFromCode } from "./langMap.js";

const LOCALES_VERSION = "2024-07-10";
const STORAGE_PREFIX = "universio:locale:";
const CONTEXT_STORAGE_KEY = "universio:lang-context";
const SUPABASE_PROJECT_REF = "oomcxsfikujptkfsqgzi";
const SUPABASE_PUBLIC_STORAGE_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public`;
const SUPABASE_LOCALE_BUCKET = "CurriculumServer";
// Locale JSON files are stored in Supabase Storage at
// {bucket}/{SUPABASE_LOCALE_PREFIX}/{lang}.json. Ask infra to provision the
// folder if it does not yet exist and upload the contents of public/locales.
const SUPABASE_LOCALE_PREFIX = "i18n/locales";

function resolveSupabaseLocaleBase() {
  const override =
    typeof window !== "undefined" &&
    window.universioI18n &&
    typeof window.universioI18n.localeBaseUrl === "string"
      ? window.universioI18n.localeBaseUrl.trim()
      : "";
  const sanitized = override.replace(/\/$/, "");
  if (sanitized) return sanitized;
  return `${SUPABASE_PUBLIC_STORAGE_BASE}/${SUPABASE_LOCALE_BUCKET}/${SUPABASE_LOCALE_PREFIX}`;
}
const memoryCache = new Map();
let pendingFetches = new Map();

function storageAvailable() {
  try {
    if (typeof localStorage === "undefined") return false;
    const key = "__i18n_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch  {
    return false;
  }
}

const hasStorage = storageAvailable();

function storageKey(code) {
  return `${STORAGE_PREFIX}${code}`;
}

function parseJSON(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch  {
    return fallback;
  }
}

function readFromStorage(code) {
  if (!hasStorage) return null;
  const raw = localStorage.getItem(storageKey(code));
  if (!raw) return null;
  const parsed = parseJSON(raw);
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.version !== LOCALES_VERSION) return null;
  if (!parsed.data || typeof parsed.data !== "object") return null;
  return parsed.data;
}

function writeToStorage(code, data) {
  if (!hasStorage) return;
  try {
    localStorage.setItem(
      storageKey(code),
      JSON.stringify({ version: LOCALES_VERSION, data })
    );
  } catch  {}
}

function getLocaleCandidateUrls(code) {
  const normalized = String(code || "en").trim().toLowerCase();
  const supabaseUrl = new URL(`${resolveSupabaseLocaleBase()}/${normalized}.json`);
  supabaseUrl.searchParams.set("v", LOCALES_VERSION);

  const fallbackUrl = new URL(`/locales/${normalized}.json`, location.origin);
  fallbackUrl.searchParams.set("v", LOCALES_VERSION);

  return [supabaseUrl, fallbackUrl];
}

async function requestLocaleWithFallback(urls, normalized) {
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url.toString(), {
        credentials: "omit",
        cache: "no-cache",
      });
      if (!res.ok) {
        throw new Error(`locale_fetch_failed:${normalized}:${res.status}`);
      }
      return res.json();
    } catch (error) {
      lastError = error;
      console.warn(`[i18n] Failed to fetch locale ${normalized} from ${url}`, error);
    }
  }
  if (lastError) throw lastError;
  throw new Error(`locale_fetch_failed:${normalized}:unknown`);
}

async function fetchLocale(code) {
  const normalized = String(code || "en").trim().toLowerCase();
  if (memoryCache.has(normalized)) {
    return memoryCache.get(normalized);
  }
  if (pendingFetches.has(normalized)) {
    return pendingFetches.get(normalized);
  }
  const urls = getLocaleCandidateUrls(normalized);

  const fetchPromise = requestLocaleWithFallback(urls, normalized)
    .then((json) => {
      memoryCache.set(normalized, json);
      writeToStorage(normalized, json);
      return json;
    })
    .catch((err) => {
      const cached = readFromStorage(normalized);
      if (cached) {
        memoryCache.set(normalized, cached);
        return cached;
      }
      if (normalized !== "en") {
        const fallback = readFromStorage("en") || memoryCache.get("en");
        if (fallback) return fallback;
      }
      throw err;
    })
    .finally(() => {
      pendingFetches.delete(normalized);
    });

  pendingFetches.set(normalized, fetchPromise);
  return fetchPromise;
}

export async function loadLocale(code) {
  const normalized = String(code || "en").trim().toLowerCase();
  let primary = memoryCache.get(normalized) || readFromStorage(normalized);
  if (!primary) {
    try {
      primary = await fetchLocale(normalized);
    } catch  {
      primary = null;
    }
  }
  let fallback = memoryCache.get("en") || readFromStorage("en");
  if (!fallback) {
    try {
      fallback = await fetchLocale("en");
    } catch  {
      fallback = {};
    }
  }
  if (!primary && fallback && normalized !== "en") {
    primary = fallback;
  }
  return {
    code: normalized,
    primary: primary || {},
    fallback: fallback || {},
  };
}

export function rememberLangContext(ctx) {
  if (!hasStorage || !ctx) return;
  try {
    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
  } catch  {}
}

export function restoreLangContext() {
  if (!hasStorage) return null;
  const raw = localStorage.getItem(CONTEXT_STORAGE_KEY);
  if (!raw) return null;
  const parsed = parseJSON(raw, null);
  if (!parsed) return null;
  const entry = getLanguageEntry(parsed.code || parsed.label);
  if (!entry) return getDefaultLangContext();
  return {
    label: entry.label,
    code: entry.code,
    rtl: !!entry.rtl,
    source: parsed.source || "localStorage",
  };
}

export function clearLocaleCache() {
  pendingFetches.clear();
  memoryCache.clear();
}

export function getLocalesVersion() {
  return LOCALES_VERSION;
}

export function getCachedLocale(code) {
  const normalized = String(code || "en").trim().toLowerCase();
  return memoryCache.get(normalized) || readFromStorage(normalized) || null;
}

export function getLocaleAssetBase() {
  return resolveSupabaseLocaleBase();
}

export function withLocaleFallback(primary, fallback) {
  return function translate(key, params) {
    if (!key) return "";
    const raw = (primary && primary[key]) ?? (fallback && fallback[key]) ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, token) =>
      Object.prototype.hasOwnProperty.call(params, token) ? params[token] : `{${token}}`
    );
  };
}

export function mergeDictionaries(primary, fallback) {
  return { ...(fallback || {}), ...(primary || {}) };
}

export function getLocaleLabel(code) {
  return getLabelFromCode(code) || getDefaultLangContext().label;
}

export { hasStorage as localeStorageAvailable, CONTEXT_STORAGE_KEY };
