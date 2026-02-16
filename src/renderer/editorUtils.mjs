const RAW_BEGIN = "%%AE:RAW_BEGIN";
const RAW_END = "%%AE:RAW_END";

export function buildInternalBlocksText(rawBlocks) {
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) return "";
  const chunks = [];
  for (const block of rawBlocks) {
    const lines = Array.isArray(block?.lines) ? block.lines : [];
    chunks.push(RAW_BEGIN, ...lines.map((line) => String(line ?? "")), RAW_END);
  }
  return chunks.join("\n");
}

export function stripInternalBlocks(text) {
  const src = String(text ?? "");
  const lines = src.split(/\r?\n/);
  const out = [];
  let inRawBlock = false;
  for (const line of lines) {
    if (/^\s*%%AE:RAW_BEGIN/.test(line)) {
      inRawBlock = true;
      continue;
    }
    if (/^\s*%%AE:RAW_END/.test(line)) {
      inRawBlock = false;
      continue;
    }
    if (!inRawBlock) out.push(line);
  }
  const joined = out.join("\n");
  return /\r?\n$/.test(src) ? `${joined}\n` : joined;
}

export function isMermaidMetaLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return false;
  return (
    /^%%\{.*\}%%$/.test(trimmed) ||
    /^%%AE:/.test(trimmed) ||
    /^classDef\b/i.test(trimmed) ||
    /^class\b/i.test(trimmed) ||
    /^style\b/i.test(trimmed) ||
    /^linkStyle\b/i.test(trimmed)
  );
}

const UI_SCALE_CHOICES = new Set(["auto", "0.8", "0.9", "1", "1.1", "1.2"]);

export function normalizeUiScaleChoice(choice) {
  const value = String(choice ?? "").trim().toLowerCase();
  return UI_SCALE_CHOICES.has(value) ? value : null;
}

export function computeAutoUiZoomFactor({ devicePixelRatio = 1, displayScale = 1 } = {}) {
  const dpr = Number(devicePixelRatio) || 1;
  const scale = Number(displayScale) || 1;
  return dpr >= 1.25 && scale >= 1.25 ? 0.9 : 1;
}

export function resolveUiZoomFactor(choice, ctx = {}) {
  const normalized = normalizeUiScaleChoice(choice) || "auto";
  if (normalized === "auto") {
    return computeAutoUiZoomFactor(ctx);
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function isEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tagName = String(target.tagName || "").toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export async function prepareContentForSave({ mode, textDirty, commit, buildContent } = {}) {
  if (mode === "text" && textDirty) {
    const ok = typeof commit === "function" ? await commit() : false;
    if (!ok) return { ok: false };
  }
  const content = typeof buildContent === "function" ? await buildContent() : "";
  return { ok: true, content: String(content ?? "") };
}
