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

export function autoWrapLabel(input, maxChars = 18) {
  const width = Number.isFinite(maxChars) && maxChars > 4 ? Math.floor(maxChars) : 18;
  const src = String(input ?? "").replace(/\r?\n/g, " ").trim();
  if (!src) return "";

  const wrapPart = (part) => {
    const cleaned = String(part || "").trim();
    if (!cleaned) return "";
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (word.length <= width) {
        current = word;
        continue;
      }
      let rest = word;
      while (rest.length > width) {
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      current = rest;
    }
    if (current) lines.push(current);
    return lines.join("<br/>");
  };

  return src
    .split(/<br\s*\/?>/i)
    .map((part) => wrapPart(part))
    .filter(Boolean)
    .join("<br/>");
}

export function alignRects(rects, mode) {
  const list = Array.isArray(rects) ? rects : [];
  if (list.length < 2) return list.map((r) => ({ ...r }));
  const xs = list.map((r) => Number(r.x) || 0);
  const ys = list.map((r) => Number(r.y) || 0);
  const rights = list.map((r) => (Number(r.x) || 0) + (Number(r.w) || 0));
  const bottoms = list.map((r) => (Number(r.y) || 0) + (Number(r.h) || 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...rights);
  const minY = Math.min(...ys);
  const maxY = Math.max(...bottoms);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return list.map((r) => {
    const w = Number(r.w) || 0;
    const h = Number(r.h) || 0;
    let x = Number(r.x) || 0;
    let y = Number(r.y) || 0;
    if (mode === "left") x = minX;
    if (mode === "center") x = cx - w / 2;
    if (mode === "right") x = maxX - w;
    if (mode === "top") y = minY;
    if (mode === "middle") y = cy - h / 2;
    if (mode === "bottom") y = maxY - h;
    return { ...r, x, y };
  });
}

export function distributeRects(rects, axis = "x") {
  const list = Array.isArray(rects) ? rects : [];
  if (list.length < 3) return list.map((r) => ({ ...r }));
  const key = axis === "y" ? "y" : "x";
  const sizeKey = axis === "y" ? "h" : "w";
  const centers = (r) => (Number(r[key]) || 0) + (Number(r[sizeKey]) || 0) / 2;
  const sorted = list
    .map((r, i) => ({ i, r }))
    .sort((a, b) => centers(a.r) - centers(b.r));
  const first = centers(sorted[0].r);
  const last = centers(sorted[sorted.length - 1].r);
  const step = (last - first) / (sorted.length - 1);
  const out = list.map((r) => ({ ...r }));
  for (let idx = 1; idx < sorted.length - 1; idx += 1) {
    const { i, r } = sorted[idx];
    const targetCenter = first + step * idx;
    out[i][key] = targetCenter - (Number(r[sizeKey]) || 0) / 2;
  }
  return out;
}

export function pickUnlockedIds(nodes, ids) {
  const nodeMap = new Map((Array.isArray(nodes) ? nodes : []).map((n) => [n.id, n]));
  const out = new Set();
  for (const id of Array.isArray(ids) ? ids : Array.from(ids || [])) {
    const node = nodeMap.get(id);
    if (!node || node.locked) continue;
    out.add(id);
  }
  return out;
}
