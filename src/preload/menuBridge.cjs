// src/preload/menuBridge.js
const { ipcRenderer } = require("electron");

// メニューの actionId → renderer DOM要素ID への対応表
const ACTION_TO_DOM_ID = {
  // File
  "file:new": "btnNew",
  "file:open": "btnOpen",
  "file:save": "btnSave",
  "file:saveAs": "btnSaveAs",
  "file:restoreSnapshot": "btnRestoreSnapshot",
  "file:exportSvg": "btnExportSvg",
  "file:exportMermaid": "btnExportMermaid",
  "file:exportPng": "btnExportPng",
  "file:exportPdf": "btnExportPdf",
  "file:exportModelJson": "btnExportModelJson",

  // Edit / Diagram
  "edit:undo": "btnUndo",
  "edit:redo": "btnRedo",
  "edit:format": "btnFormat",
  "diagram:relayout": "btnRelayout",

  // View (zoom/pan)
  "view:zoomIn": "btnZoomIn",
  "view:zoomOut": "btnZoomOut",
  "view:zoomReset": "btnZoomReset",
  "view:zoomFit": "btnZoomFit",
  "view:panReset": "btnPanReset",

  // Toggles
  "view:toggleConnect": "btnConnect",
  "view:toggleDevMode": "toggleDevMode",
  "view:toggleInternal": "toggleInternalBlocks",
  "view:toggleProblems": "btnToggleProblems",

  // Panes
  "pane:collapseLeft": "btnCollapseLeft",
  "pane:collapseRight": "btnCollapseRight",
  "pane:expandLeft": "btnExpandLeft",
  "pane:expandRight": "btnExpandRight",

  // Help
  "help:copyDiagnostics": "btnCopyDiagnostics"
};

function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function getEl(id) {
  return document.getElementById(id);
}

function triggerById(id) {
  const el = getEl(id);
  if (!el) return false;

  // チェックボックスの場合：checked 反転 → change 発火
  if (el.tagName === "INPUT" && el.type === "checkbox") {
    el.checked = !el.checked;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ボタン等は click() を優先（renderer側ハンドラとの互換性を維持）
  try {
    if (typeof el.click === "function") {
      el.click();
      return true;
    }
  } catch {
    // fallback below
  }
  el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
  return true;
}

function applyAction(action) {
  const id = ACTION_TO_DOM_ID[action];
  if (!id) return false;
  return triggerById(id);
}

function collectState() {
  const dev = getEl("toggleDevMode");
  const internal = getEl("toggleInternalBlocks");
  const body = document.body;

  return {
    devMode: !!dev?.checked,
    internalBlocks: !!internal?.checked,
    connectMode: !!body?.classList?.contains("connect-mode"),
    problemsVisible: !body?.classList?.contains("problems-collapsed"),
    leftCollapsed: !!body?.classList?.contains("left-collapsed"),
    rightCollapsed: !!body?.classList?.contains("right-collapsed")
  };
}

function sendState() {
  try {
    ipcRenderer.send("ae:menuState", collectState());
  } catch {
    // ignore
  }
}

function wireStateObservers() {
  const dev = getEl("toggleDevMode");
  if (dev) dev.addEventListener("change", sendState);

  const internal = getEl("toggleInternalBlocks");
  if (internal) internal.addEventListener("change", sendState);

  const body = document.body;
  if (body) {
    const mo = new MutationObserver(() => sendState());
    mo.observe(body, { attributes: true, attributeFilter: ["class"] });
  }

  // 初回同期
  sendState();
}

// 起動時：状態監視を有効化
onReady(() => {
  wireStateObservers();
});
