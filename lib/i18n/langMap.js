const LANGUAGE_TABLE = [
  { label: "English", code: "en", rtl: false },
  { label: "Español", code: "es", rtl: false },
  { label: "Français", code: "fr", rtl: false },
  { label: "Português", code: "pt", rtl: false },
  { label: "Italiano", code: "it", rtl: false },
  { label: "Deutsch", code: "de", rtl: false },
  { label: "中文", code: "zh", rtl: false },
  { label: "العربية", code: "ar", rtl: true },
  { label: "हिन्दी", code: "hi", rtl: false },
  { label: "日本語", code: "ja", rtl: false },
  { label: "한국어", code: "ko", rtl: false },
];

const LABEL_TO_CODE = new Map();
const CODE_TO_ENTRY = new Map();

for (const entry of LANGUAGE_TABLE) {
  LABEL_TO_CODE.set(entry.label.toLowerCase(), entry);
  CODE_TO_ENTRY.set(entry.code, entry);
}

export const LANGUAGE_OPTIONS = LANGUAGE_TABLE.map((entry) => ({
  label: entry.label,
  code: entry.code,
  rtl: entry.rtl,
}));

export function getLanguageEntry(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (LABEL_TO_CODE.has(lower)) return LABEL_TO_CODE.get(lower);
  if (CODE_TO_ENTRY.has(lower)) return CODE_TO_ENTRY.get(lower);
  if (CODE_TO_ENTRY.has(trimmed)) return CODE_TO_ENTRY.get(trimmed);
  return null;
}

export function getDefaultLangContext() {
  return {
    label: "English",
    code: "en",
    rtl: false,
    source: "default",
  };
}

export function toLangContext(input, source = "default") {
  const entry = getLanguageEntry(typeof input === "object" ? input?.code || input?.label : input);
  if (!entry) {
    const fallback = getDefaultLangContext();
    return { ...fallback, source };
  }
  return {
    label: entry.label,
    code: entry.code,
    rtl: !!entry.rtl,
    source,
  };
}

export function normalizeLabel(label) {
  return String(label || "").trim();
}

export function normalizeCode(code) {
  return String(code || "").trim().toLowerCase();
}

export function isSupportedLabel(label) {
  return LABEL_TO_CODE.has(normalizeLabel(label).toLowerCase());
}

export function isSupportedCode(code) {
  return CODE_TO_ENTRY.has(normalizeCode(code));
}

export function getLabelFromCode(code) {
  const entry = CODE_TO_ENTRY.get(normalizeCode(code));
  return entry ? entry.label : null;
}

export function getCodeFromLabel(label) {
  const entry = LABEL_TO_CODE.get(normalizeLabel(label).toLowerCase());
  return entry ? entry.code : null;
}

export function listLanguageLabels() {
  return LANGUAGE_TABLE.map((entry) => entry.label);
}

export function createLangContext(input) {
  if (!input) return getDefaultLangContext();
  if (typeof input === "object" && input.label && input.code) {
    return {
      label: normalizeLabel(input.label) || getLabelFromCode(input.code) || "English",
      code: normalizeCode(input.code) || getCodeFromLabel(input.label) || "en",
      rtl: !!input.rtl || normalizeCode(input.code) === "ar",
      source: input.source || "default",
    };
  }
  return toLangContext(input, typeof input === "string" ? "default" : input?.source || "default");
}

export function serializeLangContext(ctx) {
  if (!ctx) return null;
  return {
    label: ctx.label,
    code: ctx.code,
    rtl: !!ctx.rtl,
    source: ctx.source || "default",
  };
}

export function resolveContextFromLabel(label, source = "default") {
  return toLangContext(getLanguageEntry(label)?.code || label, source);
}

export function resolveContextFromCode(code, source = "default") {
  return toLangContext(code, source);
}

export function contextEquals(a, b) {
  if (!a || !b) return false;
  return normalizeCode(a.code) === normalizeCode(b.code) && normalizeLabel(a.label) === normalizeLabel(b.label);
}

export function contextDiff(prev, next) {
  const previous = prev ? serializeLangContext(prev) : null;
  const current = next ? serializeLangContext(next) : null;
  return { previous, current };
}

export function isRTL(codeOrLabel) {
  const entry = getLanguageEntry(codeOrLabel);
  return !!entry?.rtl;
}

export function langOptionsForSelect() {
  return LANGUAGE_TABLE.map((entry) => ({
    value: entry.label,
    label: entry.label,
    code: entry.code,
    rtl: entry.rtl,
  }));
}

export function ensureLangContext(input, source = "default") {
  if (input && typeof input === "object" && input.label && input.code) {
    return {
      label: normalizeLabel(input.label) || getLabelFromCode(input.code) || "English",
      code: normalizeCode(input.code) || getCodeFromLabel(input.label) || "en",
      rtl: !!input.rtl || normalizeCode(input.code) === "ar",
      source: input.source || source,
    };
  }
  return toLangContext(input, source);
}

export function mergeLangContext(base, overrides) {
  const ctx = ensureLangContext(base);
  const over = overrides ? ensureLangContext({ ...ctx, ...overrides }) : ctx;
  return { ...ctx, ...serializeLangContext(over), source: over.source || ctx.source };
}

export default {
  LANGUAGE_OPTIONS,
  getLanguageEntry,
  getDefaultLangContext,
  toLangContext,
  createLangContext,
  serializeLangContext,
  resolveContextFromLabel,
  resolveContextFromCode,
  contextEquals,
  contextDiff,
  isRTL,
  langOptionsForSelect,
  ensureLangContext,
  mergeLangContext,
};
