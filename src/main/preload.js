const { contextBridge, ipcRenderer } = require("electron");

function onMenuAction(callback) {
  if (typeof callback !== "function") return;
  ipcRenderer.on("ae:menuAction", (_evt, action) => {
    try {
      callback(action);
    } catch (err) {
      console.error("[preload] onMenuAction callback failed:", err?.message || err);
    }
  });
}

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
  chooseExportPath: (args) => ipcRenderer.invoke("dialog:chooseExportPath", args),
  exportWriteFile: (args) => ipcRenderer.invoke("export:writeFile", args),
  showItemInFolder: (args) => ipcRenderer.invoke("shell:showItemInFolder", args),

  getDiagnostics: () => ipcRenderer.invoke("diag:getInfo"),
  getGpuStatus: () => ipcRenderer.invoke("diag:getGpuStatus"),
  copyDiagnostics: () => ipcRenderer.invoke("diag:copyToClipboard"),
  onMenuAction,
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
