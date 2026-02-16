/**
 * codec utilities (browser/electron friendly)
 * - UTF-8 <-> bytes
 * - base64 encode/decode
 * - JSON helpers
 */

const hasBuffer = typeof Buffer !== "undefined";

export function utf8ToBytes(str) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  // Fallback (rare)
  const s = unescape(encodeURIComponent(str));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  // Fallback (rare)
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
}

export function toBase64(input) {
  // input: Uint8Array | string
  if (typeof input === "string") {
    if (hasBuffer) return Buffer.from(input, "utf8").toString("base64");
    return btoa(unescape(encodeURIComponent(input)));
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (hasBuffer) return Buffer.from(bytes).toString("base64");

  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function fromBase64(b64) {
  if (hasBuffer) return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeJson(obj, pretty = false) {
  return JSON.stringify(obj, null, pretty ? 2 : 0);
}

export function decodeJson(str) {
  return JSON.parse(str);
}

export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function pickDefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

function sanitizeModelForComment(model) {
  const src = model && typeof model === "object" ? model : {};
  return {
    version: Number.isFinite(src.version) ? Number(src.version) : 1,
    packId: String(src.packId || ""),
    themeId: String(src.themeId || ""),
    diagramType: String(src.diagramType || "flowchart"),
    direction: String(src.direction || "LR"),
    nodes: Array.isArray(src.nodes)
      ? src.nodes.map((n) =>
          pickDefined({
            id: String(n?.id || ""),
            label: String(n?.label || ""),
            role: String(n?.role || ""),
            boundaryId: n?.boundaryId || n?.groupId || null,
            shape: n?.shape ? String(n.shape) : undefined,
            className: n?.className ? String(n.className) : undefined,
            style: n?.style && typeof n.style === "object" ? { ...n.style } : undefined
          })
        )
      : [],
    edges: Array.isArray(src.edges)
      ? src.edges.map((e) =>
          pickDefined({
            id: String(e?.id || ""),
            from: String(e?.from || ""),
            to: String(e?.to || ""),
            kind: String(e?.kind || ""),
            label: e?.label ? String(e.label) : undefined,
            style: e?.style && typeof e.style === "object" ? { ...e.style } : undefined
          })
        )
      : [],
    boundaries: Array.isArray(src.boundaries)
      ? src.boundaries.map((b) =>
          pickDefined({
            id: String(b?.id || ""),
            label: String(b?.label || ""),
            role: String(b?.role || "")
          })
        )
      : [],
    rawBlocks: Array.isArray(src.rawBlocks)
      ? src.rawBlocks.map((r) => ({
          start: Number.isFinite(r?.start) ? Number(r.start) : null,
          end: Number.isFinite(r?.end) ? Number(r.end) : null,
          lines: Array.isArray(r?.lines) ? r.lines.map((line) => String(line ?? "")) : [],
          fromRaw: !!r?.fromRaw
        }))
      : []
  };
}

export function embedModelComment(model) {
  try {
    const compact = sanitizeModelForComment(model);
    const json = encodeJson(compact, false);
    const b64 = toBase64(utf8ToBytes(json));
    return `%%AE:MODEL ${b64}`;
  } catch {
    return "%%AE:MODEL";
  }
}

export function extractModelFromText(text) {
  const src = String(text ?? "");
  const lines = src.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(/^\s*%%AE:MODEL\s+(.+)\s*$/);
    if (!m) continue;
    const payload = String(m[1] || "").trim();
    if (!payload) return null;
    try {
      const decoded = bytesToUtf8(fromBase64(payload));
      const parsed = safeJsonParse(decoded, null);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
    const fallback = safeJsonParse(payload, null);
    if (fallback && typeof fallback === "object") return fallback;
    return null;
  }
  return null;
}

// ありがちな名前もまとめて生やしておく（renderer.js 側の呼び方に耐える）
export const codec = {
  utf8ToBytes,
  bytesToUtf8,
  toBase64,
  fromBase64,
  encodeJson,
  decodeJson,
  safeJsonParse,
  embedModelComment,
  extractModelFromText,
};

export default codec;
