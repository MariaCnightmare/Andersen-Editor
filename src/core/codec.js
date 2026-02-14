export function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const str = decodeURIComponent(escape(atob(b64)));
  return str;
}

export function embedModelComment(model) {
  const json = JSON.stringify(model);
  const b64u = toBase64Url(json);
  return `%%AE:MODEL ${b64u}`;
}

export function extractModelFromText(text) {
  const lines = (text || "").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*%%AE:MODEL\s+([A-Za-z0-9\-_]+)\s*$/);
    if (!m) continue;
    try {
      const json = fromBase64Url(m[1]);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
}
