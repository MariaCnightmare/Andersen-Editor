/* api-shim.js - Web build fallback for Electron preload API
 *
 * renderer.js expects:
 *   - window.api.readAssetText(relPath) -> Promise<{ ok, content }>
 *   - window.api.readAssetJson(relPath) -> Promise<{ ok, content } | any>
 *
 * IMPORTANT:
 *   - Always resolve against site-root.
 *   - Use no-store to avoid stale cache in diagnostics/debug runs.
 */
(() => {
  if (window.api?.readAssetText && window.api?.readAssetJson) {
    console.info("[api-shim] skipped (window.api already available)");
    return;
  }

  const normalizeUrl = (relPath) => {
    const stripped = String(relPath || "")
      .trim()
      .replace(/^\.\//, "")
      .replace(/^\/+/, "");
    const base = location.protocol === "file:" ? location.href : location.origin + "/";
    return new URL(stripped, base);
  };

  const preview = (text) => String(text || "").slice(0, 120).replace(/\s+/g, " ");

  const fetchAsset = async (relPath) => {
    const url = normalizeUrl(relPath);
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      throw new Error(
        `Failed to read ${relPath}: HTTP ${res.status} ${res.statusText}; url=${res.url}; content-type=${contentType}`
      );
    }

    const startsAsHtml = /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text);
    if (/text\/html/i.test(contentType) || startsAsHtml) {
      throw new Error(
        `Failed to read ${relPath}: SPA fallback suspected (received HTML); url=${res.url}; status=${res.status}; content-type=${contentType}; head=${preview(
          text
        )}`
      );
    }

    return { text, url: res.url, status: res.status, contentType };
  };

  const readAssetText = async (relPath) => {
    const out = await fetchAsset(relPath);
    return {
      ok: true,
      content: out.text,
      meta: {
        url: out.url,
        status: out.status,
        contentType: out.contentType
      }
    };
  };

  const readAssetJson = async (relPath) => {
    const out = await fetchAsset(relPath);
    try {
      return {
        ok: true,
        content: JSON.parse(out.text),
        meta: {
          url: out.url,
          status: out.status,
          contentType: out.contentType
        }
      };
    } catch (e) {
      throw new Error(
        `Invalid JSON in ${relPath}; url=${out.url}; status=${out.status}; content-type=${out.contentType}; error=${
          e && e.message ? e.message : e
        }; head=${preview(out.text)}`
      );
    }
  };

  window.api = { readAssetText, readAssetJson };
  console.info("[api-shim] installed window.api.readAssetText/readAssetJson");
})();
