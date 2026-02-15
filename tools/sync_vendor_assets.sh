#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="${ROOT_DIR}/src/renderer/public/vendor"

mkdir -p "${VENDOR_DIR}/codemirror" "${VENDOR_DIR}/mermaid"

# ---- CodeMirror (v5想定) ----
CM_JS="${ROOT_DIR}/node_modules/codemirror/lib/codemirror.js"
CM_CSS="${ROOT_DIR}/node_modules/codemirror/lib/codemirror.css"
CM_MD="${ROOT_DIR}/node_modules/codemirror/mode/markdown/markdown.js"
CM_THEME="${ROOT_DIR}/node_modules/codemirror/theme/material-darker.css"

[[ -f "${CM_JS}"  ]] || { echo "[ERROR] not found: ${CM_JS}"; exit 1; }
[[ -f "${CM_CSS}" ]] || { echo "[ERROR] not found: ${CM_CSS}"; exit 1; }
[[ -f "${CM_MD}"  ]] || { echo "[ERROR] not found: ${CM_MD}"; exit 1; }

cp -f "${CM_JS}"  "${VENDOR_DIR}/codemirror/codemirror.js"
cp -f "${CM_CSS}" "${VENDOR_DIR}/codemirror/codemirror.css"
cp -f "${CM_MD}"  "${VENDOR_DIR}/codemirror/markdown.js"

if [[ -f "${CM_THEME}" ]]; then
  cp -f "${CM_THEME}" "${VENDOR_DIR}/codemirror/material-darker.css"
else
  echo "[WARN] not found: ${CM_THEME} (skip theme)"
fi

# ---- Mermaid ----
MM_MIN1="${ROOT_DIR}/node_modules/mermaid/dist/mermaid.min.js"
MM_MIN2="${ROOT_DIR}/node_modules/mermaid/dist/mermaid.min.mjs"
MM_ESM="${ROOT_DIR}/node_modules/mermaid/dist/mermaid.esm.mjs"

if [[ -f "${MM_MIN1}" ]]; then
  cp -f "${MM_MIN1}" "${VENDOR_DIR}/mermaid/mermaid.min.js"
elif [[ -f "${MM_MIN2}" ]]; then
  cp -f "${MM_MIN2}" "${VENDOR_DIR}/mermaid/mermaid.min.mjs"
  cp -f "${MM_MIN2}" "${VENDOR_DIR}/mermaid/mermaid.min.js"
elif [[ -f "${MM_ESM}" ]]; then
  cp -f "${MM_ESM}" "${VENDOR_DIR}/mermaid/mermaid.min.js"
else
  echo "[ERROR] mermaid dist not found under node_modules/mermaid/dist/"
  exit 1
fi

date -u +"%Y-%m-%dT%H:%M:%SZ" > "${VENDOR_DIR}/_synced_at_utc.txt"
echo "[OK] synced vendor assets => ${VENDOR_DIR}"
