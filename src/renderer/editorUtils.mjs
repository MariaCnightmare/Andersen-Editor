export function isEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function normalizeUiScaleChoice(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "auto") return "auto";
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const allowed = new Set([0.8, 0.9, 1, 1.1, 1.2]);
  if (!allowed.has(n)) return null;
  return String(n);
}

export function isMermaidMetaLine(line) {
  const t = String(line || "").trim();
  if (!t) return false;
  if (t.startsWith("%%")) return true;
  return /^(classDef|class|style|linkStyle|click|link|accTitle|accDescr)\b/i.test(t);
}

export function computeAutoUiZoomFactor({ devicePixelRatio, displayScale }) {
  const dpr = Number(devicePixelRatio) || 1;
  const ds = Number(displayScale) || dpr || 1;
  const base = Math.max(dpr, ds, 1);
  const factor = 1 / base;
  return Math.max(0.9, Math.min(1, factor));
}

export function resolveUiZoomFactor(choice, { devicePixelRatio, displayScale } = {}) {
  const normalized = normalizeUiScaleChoice(choice) || "auto";
  if (normalized === "auto") {
    return computeAutoUiZoomFactor({ devicePixelRatio, displayScale });
  }
  return Number(normalized);
}

export function stripInternalBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (/^\s*%%AE:RAW_BEGIN/.test(line)) {
      skipping = true;
      continue;
    }
    if (/^\s*%%AE:RAW_END/.test(line)) {
      skipping = false;
      continue;
    }
    if (skipping) continue;
    if (/^\s*%%AE:MODEL/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

export function buildInternalBlocksText(rawBlocks) {
  if (!rawBlocks || !rawBlocks.length) return "";
  return rawBlocks
    .map((b) => `%%AE:RAW_BEGIN\n${b.lines.join("\n")}\n%%AE:RAW_END`)
    .join("\n");
}

export async function prepareContentForSave({ mode, textDirty, commit, buildContent }) {
  if (mode === "text" && textDirty) {
    const ok = await commit();
    if (!ok) return { ok: false };
  }
  return { ok: true, content: buildContent() };
}
