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

export function embedModelComment(model) {
  try {
    const json = encodeJson(model, false);
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
