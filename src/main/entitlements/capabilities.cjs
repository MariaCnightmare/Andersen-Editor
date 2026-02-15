const PRO_CAPABILITIES = ["export.pdf", "export.png.highres", "export.modelJson"];

function normalizeExportFormat(format) {
  const v = String(format || "").toLowerCase();
  if (v === "pdf") return "pdf";
  if (v === "modeljson" || v === "model_json" || v === "json") return "modelJson";
  if (v === "png") return "png";
  if (v === "svg") return "svg";
  return "mermaid";
}

function resolveExportCapability({ format, pngScale = 1 } = {}) {
  const f = normalizeExportFormat(format);
  if (f === "pdf") return "export.pdf";
  if (f === "modelJson") return "export.modelJson";
  if (f === "png" && Number(pngScale) > 1) return "export.png.highres";
  return null;
}

function buildCapabilityStatus(isPro) {
  const cap = {};
  PRO_CAPABILITIES.forEach((id) => {
    cap[id] = !!isPro;
  });
  return cap;
}

module.exports = {
  PRO_CAPABILITIES,
  normalizeExportFormat,
  resolveExportCapability,
  buildCapabilityStatus
};

