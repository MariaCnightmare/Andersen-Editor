const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  readAssetText: (relPath) => ipcRenderer.invoke("asset:readText", relPath),

  openMmd: () => ipcRenderer.invoke("dialog:openMmd"),
  saveMmdAs: (args) => ipcRenderer.invoke("dialog:saveMmdAs", args),
  saveMmd: (args) => ipcRenderer.invoke("fs:saveMmd", args),

  exportSvg: (args) => ipcRenderer.invoke("export:svg", args),
  exportPng: (args) => ipcRenderer.invoke("export:png", args),
  exportPdf: (args) => ipcRenderer.invoke("export:pdf", args),
  exportMermaid: (args) => ipcRenderer.invoke("export:mermaid", args),
  exportModelJson: (args) => ipcRenderer.invoke("export:modelJson", args),

  getDiagnostics: () => ipcRenderer.invoke("diag:getInfo"),
  setUiScalePref: (value) => ipcRenderer.invoke("config:setUiScale", value),
  setOzonePref: (value) => ipcRenderer.invoke("config:setOzone", value),
  setUiZoomFactor: (value) => ipcRenderer.invoke("ui:setZoomFactor", value),
  getUiZoomFactor: () => ipcRenderer.invoke("ui:getZoomFactor")
});

try {
  require("../preload/menuBridge.js");
} catch (err) {
  // Keep core preload API available even if menu bridge fails to initialize.
  console.error("[preload] menuBridge init failed:", err?.message || err);
}
