import { createInitialModel, normalizeModel, clone } from "../core/model.js";
import { createBlankModel } from "../core/presets.js";
import { normalizeNodeClassName, slugifyClassName } from "../core/className.mjs";
import { generateMermaid } from "../core/generateMermaid.js";
import { extractModelFromText, embedModelComment } from "../core/codec.js";
import {
  buildInternalBlocksText,
  isMermaidMetaLine,
  normalizeUiScaleChoice,
  resolveUiZoomFactor,
  isEditableTarget,
  prepareContentForSave,
  stripInternalBlocks,
  autoWrapLabel,
  alignRects,
  distributeRects,
  pickUnlockedIds
} from "./editorUtils.mjs";
import { t, setLanguage, applyLanguage } from "./i18n.js";

console.log("[boot] renderer.js loaded", document.readyState);
try {
  console.log("[boot] sheets", document.styleSheets ? document.styleSheets.length : 0);
} catch (e) {
  console.log("[boot] sheets error", e?.message || e);
}

const $ = (id) => document.getElementById(id);
const PRO_CAP_EXPORT_PDF = "export.pdf";
const PRO_CAP_EXPORT_PNG_HIGHRES = "export.png.highres";
const PRO_CAP_EXPORT_MODEL_JSON = "export.modelJson";
const ONBOARDING_SEEN_KEY = "ae:onboardingSeen";
const SUPPORT_URL = "https://github.com/MariaCnightmare/Andersen-Editor/issues";

const state = {
  pack: null,
  themes: [],
  theme: null,
  model: null,
  filePath: null,
  editor: null,
  lastSvgText: "",
  renderSeq: 0,
  syncingEditor: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  panSpeed: 2,
  selectedNodeId: null,
  selectedNodeIds: new Set(),
  selectedEdgeId: null,
  hoverNodeId: null,
  hoverEdgeId: null,
  textDirty: false,
  parseWarnings: [],
  problems: [],
  problemsUserCollapsed: null,
  edgeAmbiguous: null,
  history: [],
  historyIndex: -1,
  showInternalBlocks: false,
  devMode: false,
  connectMode: false,
  connectFromNodeId: null,
  inspectorVisible: false,
  prevRawBlocks: null,
  mermaid: null,
  syncRev: 0,
  outOfSync: false,
  docHistory: [],
  docHistoryMax: 30,
  lastProgrammaticEditorText: null,
  exportDialogCtx: null,
  exportDialogWired: false,
  taskDepth: 0,
  nativeMenuWired: false,
  menuHandlers: {},
  exportRecentPaths: [],
  statusDetailsOpen: false,
  lastAutoScaleKey: "",
  appliedThemeVarKeys: [],
  entitlements: null,
  pendingAutoFit: false
};

const els = {
  preview: $("preview"),
  statusWrap: $("statusWrap"),
  statusText: $("statusText"),
  proPlanText: $("proPlanText"),
  btnStatusDetails: $("btnStatusDetails"),
  statusMetaWrap: $("statusMetaWrap"),
  statusDpr: $("statusDpr"),
  statusZoom: $("statusZoom"),
  statusBackend: $("statusBackend"),
  statusSession: $("statusSession"),
  statusDisplays: $("statusDisplays"),
  statusScale: $("statusScale"),
  statusUiScale: $("statusUiScale"),
  statusOzone: $("statusOzone"),
  statusGpu: $("statusGpu"),
  statusSizes: $("statusSizes"),
  statusWarn: $("statusWarn"),
  taskProgress: $("taskProgress"),
  taskProgressBar: $("taskProgressBar"),
  taskProgressLabel: $("taskProgressLabel"),
  fileInfo: $("fileInfo"),
  appVersion: $("appVersion"),
  btnReportBug: $("btnReportBug"),
  zoomText: $("zoomText"),
  srcEditor: $("srcEditor"),
  srcTextarea: $("src"),
  inspector: $("inspector"),
  inspectorHead: document.querySelector("#inspector .inspectorHead"),
  inspectorTitle: $("inspectorTitle"),
  inspectorBadge: $("inspectorBadge"),
  inspectorBody: $("inspectorBody"),
  problemsList: $("problemsList"),
  btnToggleProblems: $("btnToggleProblems"),
  toggleInternalBlocks: $("toggleInternalBlocks"),
  toggleDevMode: $("toggleDevMode"),
  internalToggleWrap: $("internalToggleWrap"),
  editorToolbar: document.querySelector(".editorToolbar"),
  internalPanel: $("internalPanel"),
  toast: $("toast"),
  layout: $("layout"),
  selTheme: $("selTheme"),
  selLanguage: $("selLanguage"),
  selDir: $("selDir"),
  selMode: $("selMode"),
  selUiScale: $("selUiScale"),
  selOzone: $("selOzone"),
  selRole: $("selRole"),
  selBoundaryRole: $("selBoundaryRole"),
  selEdgeFrom: $("selEdgeFrom"),
  selEdgeTo: $("selEdgeTo"),
  selEdgeKind: $("selEdgeKind"),
  txtEdgeLabel: $("txtEdgeLabel"),
  nodeList: $("nodeList"),
  edgeList: $("edgeList"),
  boundaryList: $("boundaryList"),
  btnNew: $("btnNew"),
  btnClearAll: $("btnClearAll"),
  btnClearAllTop: $("btnClearAllTop"),
  btnOpen: $("btnOpen"),
  btnSave: $("btnSave"),
  btnSaveAs: $("btnSaveAs"),
  btnExportMermaid: $("btnExportMermaid"),
  btnExportSvg: $("btnExportSvg"),
  btnExportPng: $("btnExportPng"),
  btnExportPdf: $("btnExportPdf"),
  btnExportModelJson: $("btnExportModelJson"),
  btnZoomOut: $("btnZoomOut"),
  btnZoomIn: $("btnZoomIn"),
  btnZoomReset: $("btnZoomReset"),
  btnZoomFit: $("btnZoomFit"),
  btnPanUp: $("btnPanUp"),
  btnPanDown: $("btnPanDown"),
  btnPanLeft: $("btnPanLeft"),
  btnPanRight: $("btnPanRight"),
  btnPanReset: $("btnPanReset"),
  btnPanSpeed: $("btnPanSpeed"),
  btnApplyText: $("btnApplyText"),
  btnCopyMermaid: $("btnCopyMermaid"),
  btnPasteMermaid: $("btnPasteMermaid"),
  btnCopySvg: $("btnCopySvg"),
  btnCopyPng: $("btnCopyPng"),
  btnUndo: $("btnUndo"),
  btnRedo: $("btnRedo"),
  btnFormat: $("btnFormat"),
  btnRelayout: $("btnRelayout"),
  btnGroup: $("btnGroup"),
  btnEqualize: $("btnEqualize"),
  btnConnect: $("btnConnect"),
  btnToggleInspector: $("btnToggleInspector"),
  btnCollapseLeft: $("btnCollapseLeft"),
  btnCollapseRight: $("btnCollapseRight"),
  btnExpandLeft: $("btnExpandLeft"),
  btnExpandRight: $("btnExpandRight"),
  btnCopyDiagnostics: $("btnCopyDiagnostics"),
  btnRestoreSnapshot: $("btnRestoreSnapshot"),
  selectionActions: $("selectionActions"),
  selectionCount: $("selectionCount"),
  btnSelectionGroup: $("btnSelectionGroup"),
  btnSelectionEqualize: $("btnSelectionEqualize"),
  btnSelectionUngroup: $("btnSelectionUngroup"),
  btnSelectionAlignL: $("btnSelectionAlignL"),
  btnSelectionAlignC: $("btnSelectionAlignC"),
  btnSelectionAlignR: $("btnSelectionAlignR"),
  btnSelectionAlignT: $("btnSelectionAlignT"),
  btnSelectionAlignM: $("btnSelectionAlignM"),
  btnSelectionAlignB: $("btnSelectionAlignB"),
  btnSelectionDistH: $("btnSelectionDistH"),
  btnSelectionDistV: $("btnSelectionDistV"),
  btnSelectionDelete: $("btnSelectionDelete"),
  ctxMenu: $("ctxMenu"),
  textPromptDialog: $("textPromptDialog"),
  textPromptTitle: $("textPromptTitle"),
  textPromptInput: $("textPromptInput"),
  btnTextPromptCancel: $("btnTextPromptCancel"),
  btnTextPromptOk: $("btnTextPromptOk"),
  exportDialog: $("exportDialog"),
  exportFormat: $("exportFormat"),
  exportPngQualityRow: $("exportPngQualityRow"),
  exportPngQuality: $("exportPngQuality"),
  exportPngQualityHint: $("exportPngQualityHint"),
  exportPathInput: $("exportPathInput"),
  exportRecentList: $("exportRecentList"),
  btnExportBrowse: $("btnExportBrowse"),
  exportOpenFolder: $("exportOpenFolder"),
  exportError: $("exportError"),
  btnExportCancel: $("btnExportCancel"),
  btnExportRun: $("btnExportRun"),
  btnProUnlock: $("btnProUnlock"),
  proDialog: $("proDialog"),
  proStatusText: $("proStatusText"),
  proStatusError: $("proStatusError"),
  btnProPurchase: $("btnProPurchase"),
  btnProRestore: $("btnProRestore"),
  btnProClose: $("btnProClose"),
  newDialog: $("newDialog"),
  btnNewCancel: $("btnNewCancel"),
  tipsDialog: $("tipsDialog"),
  btnTipsGotIt: $("btnTipsGotIt"),
  btnShowTips: $("btnShowTips"),
  btnAddNode: $("btnAddNode"),
  btnAddBoundary: $("btnAddBoundary"),
  btnAddEdge: $("btnAddEdge")
};

function applyLanguageUi(force = false) {
  return applyLanguage({
    els,
    getSelectionCount: () => state.selectedNodeIds.size,
    setFileInfo,
    updateProUi,
    force
  });
}

function setStatus(level, msg) {
  const statusMap = {
    ready: "statusReady",
    dirty: "statusDirty",
    "out-of-sync": "statusOutOfSync",
    error: "statusError"
  };
  const key = statusMap[String(msg || "")];
  els.statusText.textContent = key ? t(key) : msg;
  els.statusWrap.classList.toggle("error", level === "error");
  els.statusWrap.classList.toggle("ok", level === "ok");
  els.statusWrap.classList.toggle("dirty", level === "dirty");
  els.statusWrap.classList.toggle("warn", level === "warn");
  if (level === "ok") setStatusReason("");
}

function updateStatusDetailsVisibility() {
  const canShow = !!state.devMode;
  if (els.btnStatusDetails) {
    els.btnStatusDetails.classList.toggle("hidden", !canShow);
    els.btnStatusDetails.textContent = canShow && state.statusDetailsOpen ? t("detailsHide") : t("details");
  }
  if (els.statusMetaWrap) {
    const open = canShow && !!state.statusDetailsOpen;
    els.statusMetaWrap.classList.toggle("hidden", !open);
  }
}

function updateDprStatus() {
  if (!els.statusDpr) return;
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  els.statusDpr.textContent = `dpr:${dpr}`;
  if (els.statusSizes) {
    const sw = window.screen?.width || 0;
    const sh = window.screen?.height || 0;
    const ww = window.innerWidth || 0;
    const wh = window.innerHeight || 0;
    els.statusSizes.textContent = `screen:${sw}x${sh} win:${ww}x${wh}`;
  }
}

async function updateDiagnostics() {
  if (!window.api?.getDiagnostics) return;
  try {
    const diag = await window.api.getDiagnostics();
    if (els.statusSession) {
      els.statusSession.textContent = `session:${diag.sessionType || "unknown"}`;
    }
    if (els.statusDisplays) {
      const way = diag.envWaylandDisplay ? `WAYLAND=${diag.envWaylandDisplay}` : "WAYLAND=-";
      const disp = diag.envDisplay ? `DISPLAY=${diag.envDisplay}` : "DISPLAY=-";
      els.statusDisplays.textContent = `${way} ${disp}`;
    }
    if (els.statusScale) {
      const scale = diag.displayScale ? Math.round(diag.displayScale * 100) / 100 : "unknown";
      els.statusScale.textContent = `displayScale:${scale}`;
    }
    if (els.statusZoom) {
      const z = diag.zoomFactor ? Math.round(diag.zoomFactor * 100) / 100 : 1;
      els.statusZoom.textContent = `zoom:${z}`;
    }
    if (els.statusBackend) {
      els.statusBackend.textContent = `backend:${diag.backend || "unknown"}`;
    }
    if (els.statusUiScale) {
      const src = diag.forcedScaleSource ? `(${diag.forcedScaleSource})` : "";
      els.statusUiScale.textContent = `uiScale:${diag.forcedScale || "auto"}${src}`;
    }
    if (els.statusOzone) {
      els.statusOzone.textContent = `ozone:${diag.ozoneHint || (diag.ozoneEnabled ? "auto" : "off")}`;
    }
    if (els.statusGpu) {
      const gpu = diag?.gpu?.summary;
      if (!state.devMode || !gpu) {
        els.statusGpu.textContent = "";
      } else if (gpu.enabled) {
        els.statusGpu.textContent = "GPU: enabled";
      } else {
        els.statusGpu.textContent = `GPU: disabled (${gpu.reason || "unknown"})`;
      }
    }
    if (els.statusWarn) {
      if (!state.devMode) {
        els.statusWarn.textContent = "";
      } else if (diag.warning) {
        els.statusWarn.textContent = `info:${diag.warning}`;
      } else if (diag?.ozoneDecision?.reason) {
        const reason = String(diag.ozoneDecision.reason || "unknown");
        const from = diag?.ozoneDecision?.envHint ? "env" : reason === "wsl_decorations_default" ? "auto" : reason;
        els.statusWarn.textContent = `ozone:${from}->${diag.ozoneDecision.resolved} (${reason})`;
      } else {
        els.statusWarn.textContent = "";
      }
    }
    updateStatusDetailsVisibility();
    return diag;
  } catch (err) {
    if (els.statusWarn) els.statusWarn.textContent = state.devMode ? "warn:diag unavailable" : "";
    updateStatusDetailsVisibility();
  }
  return null;
}

async function applyUiZoom(choice, diag = null) {
  const normalized = normalizeUiScaleChoice(choice) || "auto";
  const zoomFactor = resolveUiZoomFactor(normalized, {
    devicePixelRatio: window.devicePixelRatio || 1,
    displayScale: diag?.displayScale || 1
  });
  if (window.api?.setUiZoomFactor) {
    const res = await window.api.setUiZoomFactor(zoomFactor);
    if (!res?.ok) throw new Error(res?.error || "zoom apply failed");
  } else {
    document.documentElement.style.fontSize = `${Math.round(zoomFactor * 100)}%`;
  }
  return { normalized, zoomFactor };
}

async function syncAutoUiScaleIfNeeded({ force = false } = {}) {
  if (!els.selUiScale) return;
  const pref = normalizeUiScaleChoice(els.selUiScale.value) || "auto";
  if (pref !== "auto") {
    state.lastAutoScaleKey = "";
    return;
  }
  const diag = await updateDiagnostics();
  if (!diag) return;
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  const scale = Math.round((Number(diag.displayScale) || 1) * 100) / 100;
  const nextKey = `${dpr}|${scale}`;
  if (!force && state.lastAutoScaleKey === nextKey) return;
  state.lastAutoScaleKey = nextKey;
  try {
    await applyUiZoom("auto", diag);
  } catch (err) {
    if (state.devMode && els.statusWarn) {
      els.statusWarn.textContent = `warn:${err?.message || "ui scale auto apply failed"}`;
    }
  }
}

function clearError({ preserveStatus = false } = {}) {
  state.problems = [];
  renderProblems();
  if (!preserveStatus) setStatus("ok", "ready");
}

function setStatusReason(text) {
  if (els.statusWrap) els.statusWrap.title = text || "";
}

function bumpSyncRev() {
  state.syncRev += 1;
  return state.syncRev;
}

function isLatestRev(rev) {
  return rev === state.syncRev;
}

function setOutOfSync(flag, reason = "") {
  state.outOfSync = !!flag;
  if (state.outOfSync) {
    setStatus("warn", "out-of-sync");
    setStatusReason(reason || "Text has syntax errors. Fix and Apply.");
  } else if (!state.problems.length) {
    setStatus("ok", "ready");
    setStatusReason("");
  }
}

function devLog(...args) {
  if (!state.devMode) return;
  console.log("[dev]", ...args);
}

function closeContextMenu() {
  if (!els.ctxMenu) return;
  els.ctxMenu.classList.add("hidden");
  els.ctxMenu.setAttribute("aria-hidden", "true");
  els.ctxMenu.innerHTML = "";
}

function showContextMenu(clientX, clientY, buildItems) {
  if (!els.ctxMenu) return;
  els.ctxMenu.innerHTML = "";
  buildItems(els.ctxMenu);
  if (!els.ctxMenu.children.length) return;
  els.ctxMenu.classList.remove("hidden");
  els.ctxMenu.setAttribute("aria-hidden", "false");
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  const rect = els.ctxMenu.getBoundingClientRect();
  const x = Math.max(8, Math.min(clientX, Math.max(8, vw - rect.width - 8)));
  const y = Math.max(8, Math.min(clientY, Math.max(8, vh - rect.height - 8)));
  els.ctxMenu.style.left = `${x}px`;
  els.ctxMenu.style.top = `${y}px`;
}

function addCtxTitle(container, text) {
  const div = document.createElement("div");
  div.className = "ctxTitle";
  div.textContent = text;
  container.appendChild(div);
}

function addCtxItem(container, label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ctxItem";
  btn.textContent = label;
  btn.addEventListener("click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    closeContextMenu();
    onClick();
  });
  container.appendChild(btn);
}

function addCtxGroup(container, label, items) {
  const details = document.createElement("details");
  details.className = "ctxGroup";
  const summary = document.createElement("summary");
  summary.textContent = label;
  const body = document.createElement("div");
  body.className = "ctxGroupBody";
  for (const it of items) {
    addCtxItem(body, it.label, it.onClick);
  }
  details.appendChild(summary);
  details.appendChild(body);
  summary.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    container.querySelectorAll(".ctxGroup[open]").forEach((el) => {
      if (el !== details) el.open = false;
    });
    details.open = !details.open;
  });
  details.addEventListener("pointerenter", () => {
    container.querySelectorAll(".ctxGroup[open]").forEach((el) => {
      if (el !== details) el.open = false;
    });
    details.open = true;
  });
  container.appendChild(details);
}

function requestTextInput(title, defaultValue = "") {
  if (!els.textPromptDialog || !els.textPromptInput || !els.textPromptTitle) {
    const picked = window.prompt(title || t("textPromptInput"), defaultValue || "");
    return Promise.resolve(picked == null ? null : String(picked).trim());
  }
  return new Promise((resolve) => {
    const close = (value) => {
      els.textPromptDialog.classList.add("hidden");
      els.textPromptInput.removeEventListener("keydown", onKeyDown);
      els.btnTextPromptOk?.removeEventListener("click", onOk);
      els.btnTextPromptCancel?.removeEventListener("click", onCancel);
      els.textPromptDialog.removeEventListener("click", onBackdrop);
      resolve(value);
    };
    const onOk = () => close(String(els.textPromptInput.value || "").trim());
    const onCancel = () => close(null);
    const onBackdrop = (evt) => {
      if (evt.target === els.textPromptDialog) onCancel();
    };
    const onKeyDown = (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        onOk();
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        onCancel();
      }
    };

    els.textPromptTitle.textContent = title || t("textPromptInput");
    els.textPromptInput.value = defaultValue || "";
    els.textPromptDialog.classList.remove("hidden");
    setTimeout(() => {
      els.textPromptInput.focus();
      els.textPromptInput.select();
    }, 0);
    els.textPromptInput.addEventListener("keydown", onKeyDown);
    els.btnTextPromptOk?.addEventListener("click", onOk);
    els.btnTextPromptCancel?.addEventListener("click", onCancel);
    els.textPromptDialog.addEventListener("click", onBackdrop);
  });
}

function normalizeHexColor(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^#[0-9a-f]{3}$/i.test(v) || /^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  return null;
}

function normalizeEdgeWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(0.5, Math.min(12, Math.round(n * 10) / 10));
}

function showError(err) {
  const msg = err?.message ? String(err.message) : String(err || "Unknown error");
  setProblems([{ type: "error", message: msg }], { status: "error", open: true });
  console.error(err);
}

function showWarning(msg) {
  if (!msg) return;
  setProblems([{ type: "warn", message: msg }], { status: "warn", open: true });
}

function setFileInfo() {
  els.fileInfo.textContent = state.filePath ? state.filePath : t("fileInfoUnsaved");
}

function markModelDirty(reason = "model changed") {
  setStatus("dirty", "dirty");
  setStatusReason(reason);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function normalizeProblemsHeight(rawValue) {
  const n = Number.parseFloat(String(rawValue || "").replace(/px$/i, "").trim());
  if (!Number.isFinite(n)) return null;
  return clamp(n, 80, 220);
}

function clampZoom(z) {
  return Math.max(0.02, z);
}

function zoomAt(clientX, clientY, nextZoom) {
  const wrap = $("previewWrap");
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const current = state.zoom || 1;
  const target = clampZoom(nextZoom);
  const worldX = (x - state.panX) / current;
  const worldY = (y - state.panY) / current;
  state.zoom = target;
  state.panX = x - worldX * target;
  state.panY = y - worldY * target;
  applyZoom();
}

function zoomByStep(step, origin) {
  const next = clampZoom(state.zoom + step);
  const point = origin || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  zoomAt(point.x, point.y, next);
}

function applyZoom() {
  const z = state.zoom;
  const px = Math.round(state.panX * 100) / 100;
  const py = Math.round(state.panY * 100) / 100;
  if (z === 1 && px === 0 && py === 0) {
    els.preview.style.transform = "none";
  } else {
    els.preview.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
  }
  if (els.zoomText) els.zoomText.textContent = `${Math.round(z * 100)}%`;
  localStorage.setItem("ae:zoom", String(z));
  localStorage.setItem("ae:panX", String(state.panX));
  localStorage.setItem("ae:panY", String(state.panY));
}

function fitPreviewToView() {
  const svg = els.preview.querySelector("svg");
  const wrap = $("previewWrap");
  if (!svg || !wrap) return false;
  const box = svg.getBBox();
  const rect = wrap.getBoundingClientRect();
  if (!box.width || !box.height || !rect.width || !rect.height) return false;
  const scale = Math.min(rect.width / box.width, rect.height / box.height);
  state.zoom = clampZoom(scale * 0.95);
  state.panX = rect.width / 2 - (box.x + box.width / 2) * state.zoom;
  state.panY = rect.height / 2 - (box.y + box.height / 2) * state.zoom;
  applyZoom();
  return true;
}

function renderProblems() {
  if (!els.problemsList) return;
  els.problemsList.innerHTML = "";
  const items = [...state.problems];
  const hasInternal = !!(state.model?.rawBlocks && state.model.rawBlocks.length);
  if (hasInternal && !state.devMode) {
    const already = items.some((p) => p.type === "info" && String(p.message || "").includes("Internal blocks"));
    if (!already) {
      items.unshift({ type: "info", message: "Internal blocks present (enable Developer mode to view)" });
    }
  }
  const hasActionable = items.some((p) => p.type === "error" || p.type === "warn");
  if (!items.length) {
    const div = document.createElement("div");
    div.className = "problemItem";
    div.textContent = "No problems";
    els.problemsList.appendChild(div);
    if (state.problemsUserCollapsed !== false) {
      document.body.classList.add("problems-collapsed");
      saveProblemsState();
    }
    return;
  }
  if (hasActionable) {
    if (state.problemsUserCollapsed !== true) {
      document.body.classList.remove("problems-collapsed");
      saveProblemsState();
    }
  } else if (state.problemsUserCollapsed !== false) {
    document.body.classList.add("problems-collapsed");
    saveProblemsState();
  }

  for (const p of items) {
    const div = document.createElement("div");
    div.className = "problemItem";
    const badge = document.createElement("span");
    badge.className = `badge ${p.type}`;
    badge.textContent = p.type.toUpperCase();
    const msg = document.createElement("span");
    const loc = p.line ? ` (L${p.line}${p.column ? `:C${p.column}` : ""})` : "";
    msg.textContent = `${p.message || "Unknown"}${loc}`;
    div.appendChild(badge);
    div.appendChild(msg);
    if (p.line && state.editor?.jumpToLine) {
      div.addEventListener("click", () => {
        state.editor.jumpToLine(p.line, p.column || 1);
      });
    }
    els.problemsList.appendChild(div);
  }
}

function updateInspectorState() {}

function setInspectorHeader(title, badgeText, badgeClass = "") {
  if (els.inspectorTitle) {
    els.inspectorTitle.textContent = title || "Inspector";
  }
  if (els.inspectorBadge) {
    if (badgeText) {
      els.inspectorBadge.textContent = badgeText;
      els.inspectorBadge.className = `badge ${badgeClass}`.trim();
      els.inspectorBadge.style.display = "inline-block";
    } else {
      els.inspectorBadge.textContent = "";
      els.inspectorBadge.className = "badge";
      els.inspectorBadge.style.display = "none";
    }
  }
}

function setConnectMode(on) {
  state.connectMode = !!on;
  if (!state.connectMode) state.connectFromNodeId = null;
  document.body.classList.toggle("connect-mode", state.connectMode);
  if (els.btnConnect) els.btnConnect.classList.toggle("active", state.connectMode);
  const svg = els.preview.querySelector("svg");
  if (svg) {
    applyConnectHandles(svg);
  }
  refreshSelectionActions();
}

function getPinnedOffset(node) {
  if (!node) return { x: 0, y: 0 };
  return node.pinnedOffset || node.position || { x: 0, y: 0 };
}

function isNodeLocked(nodeOrId) {
  if (!nodeOrId) return false;
  if (typeof nodeOrId === "string") {
    const n = state.model?.nodes?.find((x) => x.id === nodeOrId);
    return !!n?.locked;
  }
  return !!nodeOrId.locked;
}

function getUnlockedSelectedNodeIds() {
  return pickUnlockedIds(state.model?.nodes || [], state.selectedNodeIds);
}

function setPinnedOffset(node, next) {
  node.pinnedOffset = next;
  node.position = next;
  node.pinned = true;
}

function parseMermaidError(err) {
  const msg = err?.message ? String(err.message) : String(err || "Unknown error");
  const m = msg.match(/line\s+(\d+)(?:\s*,\s*col(?:umn)?\s+(\d+))?/i);
  if (!m) return { type: "error", message: msg };
  return { type: "error", message: msg, line: parseInt(m[1], 10), column: m[2] ? parseInt(m[2], 10) : 1 };
}

function parseMermaidErrorWithContext(err, text) {
  const base = parseMermaidError(err);
  const line = err?.hash?.loc?.first_line || base.line || null;
  const column = err?.hash?.loc?.first_column != null ? err.hash.loc.first_column + 1 : base.column || null;
  const lines = String(text || "").split(/\r?\n/);
  const source = line && lines[line - 1] ? lines[line - 1].slice(0, 80) : "";
  return {
    type: "error",
    message: base.message,
    line,
    column,
    source
  };
}

async function validateMermaidSyntax(text) {
  const mermaid = await getMermaid();
  if (!mermaid?.parse) return { ok: true };
  try {
    await mermaid.parse(text);
    return { ok: true };
  } catch (err) {
    const detail = parseMermaidErrorWithContext(err, text);
    return {
      ok: false,
      problem: {
        type: "error",
        message: `${detail.message}${detail.source ? ` | source: ${detail.source}` : ""}`,
        line: detail.line,
        column: detail.column
      }
    };
  }
}

function openProblemsDock(forceOpen = false) {
  if (forceOpen) {
    document.body.classList.remove("problems-collapsed");
    state.problemsUserCollapsed = false;
    saveProblemsState();
  }
}

function setProblems(items, { status = "error", open = true } = {}) {
  state.problems = Array.isArray(items) ? items : [{ type: "error", message: String(items || "Unknown error") }];
  const hasInternal = !!(state.model?.rawBlocks && state.model.rawBlocks.length);
  if (hasInternal && !state.devMode) {
    state.problems = [{ type: "info", message: "Internal blocks present (enable Developer mode to view)" }, ...state.problems];
  }
  renderProblems();
  if (status === "error") setStatus("error", "error");
  if (status === "warn") setStatus("warn", "out-of-sync");
  if (status === "ok") setStatus("ok", "ready");
  if (status === "error") setStatusReason("Mermaid parse/render error");
  if (status === "warn") setStatusReason("Source contains unsupported lines (RAW preserved)");
  if (open) openProblemsDock(true);
}

function applyPaneSizes(leftPx, rightPx) {
  if (leftPx !== null && leftPx !== undefined) {
    document.documentElement.style.setProperty("--left-w", `${leftPx}px`);
  }
  if (rightPx !== null && rightPx !== undefined) {
    document.documentElement.style.setProperty("--right-w", `${rightPx}px`);
  }
}

function loadPaneSizes() {
  try {
    const raw = localStorage.getItem("ae:paneSizes");
    if (!raw) return;
    const { left, right } = JSON.parse(raw);
    applyPaneSizes(left, right);
  } catch {}
}

function buildSampleMermaid() {
  return `flowchart LR
  subgraph ONPREM[On-Prem]
    CL1([Client])
    VPN1{{VPN GW}}
  end
  subgraph AWSVPC[AWS VPC]
    FW1[Firewall]
    LB1[ALB]
    AP1[App Server]
    DB1[(RDS)]
  end
  CL1 -->|HTTPS| FW1
  FW1 -->|HTTPS| LB1
  LB1 -->|HTTP| AP1
  AP1 -->|SQL:5432| DB1
  VPN1 -. IPsec Tunnel .- FW1
`;
}

function buildTemplateMermaid(kind) {
  if (kind === "empty") return "flowchart LR\n";
  if (kind === "web3") {
    return `flowchart LR
  U[Users]
  CDN[CDN]
  LB[ALB]
  AP[App]
  DB[(DB)]
  CACHE[(Cache)]
  U --> CDN
  CDN --> LB
  LB --> AP
  AP --> DB
  AP --> CACHE
`;
  }
  if (kind === "vpn") {
    return `flowchart LR
  subgraph ONPREM[On-Prem]
    CL[Client]
    VPN{{VPN GW}}
  end
  subgraph CLOUD[Cloud]
    FW[Firewall]
    APP[App]
  end
  CL --> VPN
  VPN -. IPsec .- FW
  FW --> APP
`;
  }
  if (kind === "simple") {
    return `flowchart LR
  A([Start])
  B[Process]
  C([End])
  A --> B
  B --> C
`;
  }
  return buildSampleMermaid();
}

function pickRoleId(matcher) {
  const ids = Object.keys(state.pack?.roles || {});
  if (!ids.length) return "server";
  const hit = ids.find((id) => matcher(String(id || "").toLowerCase()));
  return hit || ids[0];
}

function buildTemplateModel(kind) {
  const model = createInitialModel(state.pack?.packId, state.theme?.themeId);
  model.direction = "LR";
  const place = (x, y) => ({ x, y });
  const roleGeneric = pickRoleId(() => false);
  const roleClient = pickRoleId((id) => id.includes("client") || id.includes("user"));
  const roleLb = pickRoleId((id) => id.includes("lb") || id.includes("load"));
  const roleApp = pickRoleId((id) => id.includes("app") || id.includes("web") || id.includes("server"));
  const roleDb = pickRoleId((id) => id.includes("db") || id.includes("data") || id.includes("rds"));
  const edgeKind = Object.keys(state.pack?.edgeKinds || {})[0] || "http";

  if (kind === "workflow") {
    model.direction = "LR";
    model.nodes = [
      {
        id: "W1", label: "Start", role: roleGeneric, shape: "round", className: "accent-green",
        boundaryId: null, groupId: null, groupName: null, position: place(-240, 0), pinnedOffset: place(-240, 0), pinned: true
      },
      {
        id: "W2", label: "Process", role: roleGeneric, shape: "rect", className: "accent-blue",
        boundaryId: null, groupId: null, groupName: null, position: place(-80, 0), pinnedOffset: place(-80, 0), pinned: true
      },
      {
        id: "W3", label: "Decision", role: roleGeneric, shape: "diamond", className: "accent-amber",
        boundaryId: null, groupId: null, groupName: null, position: place(80, 0), pinnedOffset: place(80, 0), pinned: true
      },
      {
        id: "W4", label: "End", role: roleGeneric, shape: "round", className: "accent-green",
        boundaryId: null, groupId: null, groupName: null, position: place(240, 0), pinnedOffset: place(240, 0), pinned: true
      }
    ];
    model.edges = [
      { id: "E1", from: "W1", to: "W2", kind: edgeKind, label: "" },
      { id: "E2", from: "W2", to: "W3", kind: edgeKind, label: "" },
      { id: "E3", from: "W3", to: "W4", kind: edgeKind, label: "" }
    ];
    return model;
  }

  if (kind === "org") {
    model.direction = "TB";
    model.nodes = [
      {
        id: "O1", label: "CEO", role: roleGeneric, shape: "round", className: "accent-blue",
        boundaryId: null, groupId: null, groupName: null, position: place(0, -180), pinnedOffset: place(0, -180), pinned: true
      },
      {
        id: "O2", label: "Manager", role: roleGeneric, shape: "rect", className: "accent-green",
        boundaryId: null, groupId: null, groupName: null, position: place(0, 0), pinnedOffset: place(0, 0), pinned: true
      },
      {
        id: "O3", label: "Member", role: roleGeneric, shape: "rect", className: "accent-amber",
        boundaryId: null, groupId: null, groupName: null, position: place(0, 180), pinnedOffset: place(0, 180), pinned: true
      }
    ];
    model.edges = [
      { id: "E1", from: "O1", to: "O2", kind: edgeKind, label: "" },
      { id: "E2", from: "O2", to: "O3", kind: edgeKind, label: "" }
    ];
    return model;
  }

  if (kind === "infra") {
    model.nodes = [
      {
        id: "I1", label: "Client", role: roleClient, shape: "round", className: "accent-blue",
        boundaryId: null, groupId: null, groupName: null, position: place(-270, 0), pinnedOffset: place(-270, 0), pinned: true
      },
      {
        id: "I2", label: "LB", role: roleLb, shape: "hex", className: "accent-green",
        boundaryId: null, groupId: null, groupName: null, position: place(-90, 0), pinnedOffset: place(-90, 0), pinned: true
      },
      {
        id: "I3", label: "App", role: roleApp, shape: "rect", className: "accent-amber",
        boundaryId: null, groupId: null, groupName: null, position: place(90, 0), pinnedOffset: place(90, 0), pinned: true
      },
      {
        id: "I4", label: "DB", role: roleDb, shape: "cylinder", className: "accent-red",
        boundaryId: null, groupId: null, groupName: null, position: place(270, 0), pinnedOffset: place(270, 0), pinned: true
      }
    ];
    model.edges = [
      { id: "E1", from: "I1", to: "I2", kind: edgeKind, label: "" },
      { id: "E2", from: "I2", to: "I3", kind: edgeKind, label: "" },
      { id: "E3", from: "I3", to: "I4", kind: edgeKind, label: "" }
    ];
    return model;
  }

  return null;
}

function isModelEmpty(model) {
  return !model || (
    (!Array.isArray(model.nodes) || model.nodes.length === 0) &&
    (!Array.isArray(model.edges) || model.edges.length === 0) &&
    (!Array.isArray(model.boundaries) || model.boundaries.length === 0) &&
    (!Array.isArray(model.rawBlocks) || model.rawBlocks.length === 0)
  );
}

function applyBlankState({ resetFilePath = true } = {}) {
  state.model = createBlankModel(state.pack?.packId, state.theme?.themeId);
  if (els.selDir) els.selDir.value = state.model.direction || "TB";
  state.selectedNodeId = null;
  state.selectedNodeIds.clear();
  state.selectedEdgeId = null;
  state.hoverNodeId = null;
  state.hoverEdgeId = null;
  state.connectFromNodeId = null;
  state.edgeAmbiguous = null;
  state.prevRawBlocks = null;
  state.parseWarnings = [];
  state.problems = [];
  state.textDirty = false;
  setOutOfSync(false);
  renderFromModel();
  updateApplyButton();
  clearError();
  if (resetFilePath) {
    state.filePath = null;
    setFileInfo();
  }
  setStatus("ok", "ready");
}

function sanitizeFreeBoxLabel(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .replace(/\[\]/g, "［］")
    .replace(/\[/g, "［")
    .replace(/\]/g, "］")
    .replace(/-\.-?>/g, "→")
    .replace(/==>/g, "⇒")
    .replace(/-->/g, "→")
    .replace(/->/g, "→")
    .replace(/<--/g, "←")
    .replace(/<-/g, "←")
    .replace(/\s+/g, " ")
    .trim();
}

async function refreshAppVersion() {
  if (!els.appVersion) return;
  try {
    const res = await window.api?.getAppVersion?.();
    if (res?.ok && res.version) {
      els.appVersion.textContent = `v${res.version}`;
      return;
    }
  } catch {}
  els.appVersion.textContent = "vdev";
}

function openTipsDialog({ persistSeen = false } = {}) {
  if (!els.tipsDialog) return;
  if (persistSeen) {
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    } catch {}
  }
  els.tipsDialog.classList.remove("hidden");
}

function closeTipsDialog({ persistSeen = true } = {}) {
  if (!els.tipsDialog) return;
  if (persistSeen) {
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    } catch {}
  }
  els.tipsDialog.classList.add("hidden");
}

function getFallbackPack() {
  return {
    packId: "fallback-pack",
    name: "Fallback Pack",
    roles: {
      server: { label: "Server", idPrefix: "SV", shape: "rect", className: "node-default" },
      db: { label: "Database", idPrefix: "DB", shape: "cylinder", className: "node-default" },
      client: { label: "Client", idPrefix: "CL", shape: "round", className: "node-default" }
    },
    boundaryRoles: {
      vpc: { label: "Boundary", className: "boundary-default" }
    },
    edgeKinds: {
      http: { label: "HTTP", arrow: "-->", className: "edge-default" }
    }
  };
}

function getFallbackTheme() {
  return {
    themeId: "fallback-theme",
    name: "Fallback Theme",
    init: { theme: "default" },
    classDefs: {
      "node-default": "fill:#f6f8fa,stroke:#4b5563,color:#111",
      "boundary-default": "fill:#eef2f7,stroke:#6b7280,color:#111"
    },
    edgeStyles: {
      "edge-default": "stroke:#4b5563,stroke-width:1.5px"
    },
    boundaryStyles: {
      "boundary-default": "fill:#eef2f7,stroke:#6b7280"
    }
  };
}

function clearThemeVars() {
  if (!Array.isArray(state.appliedThemeVarKeys) || !state.appliedThemeVarKeys.length) return;
  for (const key of state.appliedThemeVarKeys) {
    document.documentElement.style.removeProperty(key);
  }
  state.appliedThemeVarKeys = [];
}

function applyThemeVars(theme) {
  clearThemeVars();
  const vars = theme && typeof theme === "object" ? theme.vars : null;
  if (!vars || typeof vars !== "object") return;
  const applied = [];
  for (const [key, value] of Object.entries(vars)) {
    if (!/^--[A-Za-z0-9_-]+$/.test(String(key))) continue;
    document.documentElement.style.setProperty(key, String(value));
    applied.push(key);
  }
  state.appliedThemeVarKeys = applied;
}

async function safeReadJson(relPath, fallbackValue, label) {
  try {
    return await readJson(relPath);
  } catch (err) {
    console.error(`[boot] ${label} load failed:`, err);
    showWarning(`${label} load failed. Using fallback.`);
    return clone(fallbackValue);
  }
}

function savePaneSizes(left, right) {
  localStorage.setItem("ae:paneSizes", JSON.stringify({ left, right }));
}

function saveCollapseState() {
  localStorage.setItem(
    "ae:collapse",
    JSON.stringify({
      left: document.body.classList.contains("left-collapsed"),
      right: document.body.classList.contains("right-collapsed")
    })
  );
}

function loadCollapseState() {
  try {
    const raw = localStorage.getItem("ae:collapse");
    if (!raw) return;
    const { left, right } = JSON.parse(raw);
    document.body.classList.toggle("left-collapsed", !!left);
    document.body.classList.toggle("right-collapsed", !!right);
  } catch {}
}

function saveProblemsState() {
  localStorage.setItem(
    "ae:problems",
    JSON.stringify({
      collapsed: document.body.classList.contains("problems-collapsed"),
      userCollapsed: state.problemsUserCollapsed
    })
  );
}

function loadProblemsState() {
  try {
    const raw = localStorage.getItem("ae:problems");
    if (!raw) return;
    const { collapsed, userCollapsed } = JSON.parse(raw);
    document.body.classList.toggle("problems-collapsed", !!collapsed);
    if (typeof userCollapsed === "boolean") state.problemsUserCollapsed = userCollapsed;
  } catch {}
}

function saveInspectorState() {}
function loadInspectorState() {}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2000);
}

function hasCapability(capability) {
  if (!capability) return true;
  return !!state.entitlements?.capabilities?.[capability];
}

function requiredCapabilityForExport(format, { pngScale = 1 } = {}) {
  const f = normalizeExportFormat(format);
  if (f === "pdf") return PRO_CAP_EXPORT_PDF;
  if (f === "modelJson") return PRO_CAP_EXPORT_MODEL_JSON;
  if (f === "png" && Number(pngScale) > 1) return PRO_CAP_EXPORT_PNG_HIGHRES;
  return null;
}

function setProDialogError(message) {
  if (!els.proStatusError) return;
  const msg = String(message || "");
  if (!msg) {
    els.proStatusError.textContent = "";
    els.proStatusError.classList.add("hidden");
    return;
  }
  els.proStatusError.textContent = msg;
  els.proStatusError.classList.remove("hidden");
}

function updateProUi() {
  const isPro = !!state.entitlements?.isPro;
  const source = state.entitlements?.source || "free-default";
  const plan = isPro ? t("planPro") : t("planFree");
  if (els.proPlanText) els.proPlanText.textContent = plan;
  if (els.btnProUnlock) {
    els.btnProUnlock.title = isPro ? t("proPlanTitleUnlocked", { source }) : t("proPlanTitleFree");
  }
  if (els.proStatusText) {
    els.proStatusText.textContent = t("proStatusLine", { plan, source });
  }
  const lockPdf = !hasCapability(PRO_CAP_EXPORT_PDF);
  const lockModel = !hasCapability(PRO_CAP_EXPORT_MODEL_JSON);
  if (els.btnExportPdf) {
    els.btnExportPdf.classList.toggle("locked", lockPdf);
  }
  if (els.btnExportModelJson) {
    els.btnExportModelJson.classList.toggle("locked", lockModel);
  }
  if (els.exportPngQualityHint) {
    const showLock = !!els.exportPngQuality && els.exportPngQuality.value === "highres" && !hasCapability(PRO_CAP_EXPORT_PNG_HIGHRES);
    els.exportPngQualityHint.classList.toggle("hidden", !showLock);
  }
}

async function refreshEntitlements(reason = "manual") {
  if (!window.api?.entitlementsGetStatus) {
    state.entitlements = {
      isPro: false,
      source: "unsupported",
      capabilities: {
        [PRO_CAP_EXPORT_PDF]: false,
        [PRO_CAP_EXPORT_PNG_HIGHRES]: false,
        [PRO_CAP_EXPORT_MODEL_JSON]: false
      }
    };
    updateProUi();
    return state.entitlements;
  }
  const res = await window.api.entitlementsGetStatus();
  if (res?.ok && res.status) {
    state.entitlements = res.status;
  } else {
    state.entitlements = {
      isPro: false,
      source: "error",
      capabilities: {
        [PRO_CAP_EXPORT_PDF]: false,
        [PRO_CAP_EXPORT_PNG_HIGHRES]: false,
        [PRO_CAP_EXPORT_MODEL_JSON]: false
      },
      lastError: res?.error || "failed to load entitlements"
    };
    console.warn("[entitlements] refresh failed", { reason, error: res?.error || "unknown" });
  }
  updateProUi();
  return state.entitlements;
}

function openProDialog({ requiredCapability = null, message = "" } = {}) {
  if (!els.proDialog) return;
  const capHint = requiredCapability ? `Pro required: ${requiredCapability}` : "";
  setProDialogError(message || capHint);
  updateProUi();
  els.proDialog.classList.remove("hidden");
}

function closeProDialog() {
  if (!els.proDialog) return;
  els.proDialog.classList.add("hidden");
  setProDialogError("");
}

async function handleProRequired(res, capability = null) {
  const requiredCapability = res?.requiredCapability || capability || null;
  await refreshEntitlements("pro-required");
  openProDialog({
    requiredCapability,
    message: res?.error || ""
  });
}

function beginTask(label = "processing...") {
  state.taskDepth += 1;
  if (!els.taskProgress) return;
  els.taskProgress.classList.remove("hidden");
  if (els.taskProgressLabel) els.taskProgressLabel.textContent = label;
  if (els.taskProgressBar) {
    els.taskProgressBar.classList.add("indeterminate");
  }
}

function endTask() {
  state.taskDepth = Math.max(0, state.taskDepth - 1);
  if (state.taskDepth > 0) return;
  if (!els.taskProgress) return;
  els.taskProgress.classList.add("hidden");
  if (els.taskProgressBar) {
    els.taskProgressBar.classList.add("indeterminate");
    els.taskProgressBar.style.width = "";
  }
}

function setTaskProgress(value, label = "") {
  if (!els.taskProgressBar) return;
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(0, Math.min(1, n));
  els.taskProgressBar.classList.remove("indeterminate");
  els.taskProgressBar.style.width = `${Math.round(clamped * 100)}%`;
  if (label && els.taskProgressLabel) els.taskProgressLabel.textContent = label;
}

async function withTask(label, fn) {
  beginTask(label);
  try {
    return await fn();
  } finally {
    endTask();
  }
}

function exportTimestampToken() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function normalizeExportFormat(value) {
  const v = String(value || "").toLowerCase();
  if (v === "svg") return "svg";
  if (v === "png") return "png";
  if (v === "pdf") return "pdf";
  if (v === "modeljson" || v === "model_json" || v === "json") return "modelJson";
  return "mermaid";
}

function extensionForExportFormat(format) {
  const f = normalizeExportFormat(format);
  if (f === "svg") return ".svg";
  if (f === "png") return ".png";
  if (f === "pdf") return ".pdf";
  if (f === "modelJson") return ".json";
  return ".mmd";
}

function buildDefaultExportPath(format) {
  const ext = extensionForExportFormat(format);
  if (state.filePath) {
    const base = state.filePath.replace(/\.[^.\\/]+$/, "");
    return `${base}${ext}`;
  }
  return `andersen-export-${exportTimestampToken()}${ext}`;
}

function normalizeExportPathInput(inputPath, format) {
  const ext = extensionForExportFormat(format);
  const trimmed = String(inputPath || "").trim();
  if (!trimmed) return "";
  if (/[\\/]$/.test(trimmed)) {
    return `${trimmed}andersen-export-${exportTimestampToken()}${ext}`;
  }
  if (trimmed.toLowerCase().endsWith(ext)) return trimmed;
  return `${trimmed.replace(/\.[^.\\/]+$/, "")}${ext}`;
}

function loadExportRecentPaths() {
  try {
    const raw = localStorage.getItem("ae:exportRecentPaths");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && x.trim()).slice(0, 5);
  } catch {
    return [];
  }
}

function saveExportRecentPath(pathValue) {
  const p = String(pathValue || "").trim();
  if (!p) return;
  const next = [p, ...state.exportRecentPaths.filter((x) => x !== p)].slice(0, 5);
  state.exportRecentPaths = next;
  try {
    localStorage.setItem("ae:exportRecentPaths", JSON.stringify(next));
  } catch {}
  renderExportRecentPaths();
}

function renderExportRecentPaths() {
  if (els.exportRecentList) {
    els.exportRecentList.innerHTML = "";
    for (const item of state.exportRecentPaths) {
      const opt = document.createElement("option");
      opt.value = item;
      els.exportRecentList.appendChild(opt);
    }
  }
}

function setExportError(message) {
  if (!els.exportError) return;
  const msg = String(message || "");
  if (!msg) {
    els.exportError.textContent = "";
    els.exportError.classList.add("hidden");
    return;
  }
  els.exportError.textContent = msg;
  els.exportError.classList.remove("hidden");
}

function validateExportPath(inputPath, format) {
  const raw = String(inputPath || "").trim();
  if (!raw) {
    return { ok: false, error: "保存先パスを入力してください。" };
  }
  if (raw.includes("\u0000")) {
    return { ok: false, error: "保存先パスに無効文字が含まれています。" };
  }
  if (/[<>:\"|?*]/.test(raw)) {
    return { ok: false, error: "保存先パスに無効文字（<>:\"|?*）が含まれています。" };
  }
  const normalized = normalizeExportPathInput(raw, format);
  const changed = normalized !== raw;
  return { ok: true, path: normalized, changed };
}

function closeExportDialog() {
  if (!els.exportDialog) return;
  els.exportDialog.classList.add("hidden");
  setExportError("");
  state.exportDialogCtx = null;
}

async function runExportFromDialog() {
  const ctx = state.exportDialogCtx;
  if (!ctx) return;
  const format = normalizeExportFormat(els.exportFormat?.value || ctx.format);
  const pngScale = format === "png" && els.exportPngQuality?.value === "highres" ? 2 : 1;
  const requiredCapability = requiredCapabilityForExport(format, { pngScale });
  if (requiredCapability && !hasCapability(requiredCapability)) {
    await handleProRequired(
      { code: "PRO_REQUIRED", requiredCapability, error: `Pro required: ${requiredCapability}` },
      requiredCapability
    );
    return;
  }
  const validation = validateExportPath(els.exportPathInput?.value, format);
  if (!validation.ok) {
    setExportError(validation.error);
    return;
  }
  const filePath = validation.path;
  if (validation.changed && els.exportPathInput) {
    els.exportPathInput.value = filePath;
  }
  let res = null;
  if (format === "svg") {
    const content = getSvgText();
    if (!content) {
      setExportError("SVGプレビューが取得できません。先にApplyしてレンダしてください。");
      return;
    }
    res = await window.api?.exportWriteFile?.({ format, filePath, content });
  } else if (format === "mermaid") {
    const content = getFullSourceForOutput();
    res = await window.api?.exportWriteFile?.({ format, filePath, content });
  } else if (format === "png") {
    const svgText = getSvgText();
    if (!svgText) {
      setExportError("SVGプレビューが取得できません。先にApplyしてレンダしてください。");
      return;
    }
    try {
      setTaskProgress(0.35, "rendering png...");
      const pngBase64 = await svgToPng(svgText, { scale: pngScale });
      setTaskProgress(0.75, "saving png...");
      res = await window.api?.exportWritePngFile?.({ pngBase64, filePath, pngScale });
    } catch (err) {
      setExportError(err?.message || "PNG変換に失敗しました。");
      return;
    }
  } else if (format === "pdf") {
    setTaskProgress(0.55, "printing pdf...");
    res = await window.api?.exportWritePdfFile?.({ filePath });
  } else if (format === "modelJson") {
    const modelJson = getModelJsonText();
    res = await window.api?.exportWriteModelJsonFile?.({ modelJson, filePath });
  }
  if (!res?.ok) {
    if (res?.code === "PRO_REQUIRED") {
      await handleProRequired(res, requiredCapability);
      return;
    }
    if (!res?.canceled) setExportError(res?.error || "Exportに失敗しました。");
    return;
  }
  saveExportRecentPath(res.filePath || filePath);
  if (els.exportOpenFolder?.checked) {
    await window.api?.showItemInFolder?.({ filePath: res.filePath });
  }
  const reason = `export-${format}`;
  addDocSnapshot(reason);
  showToast(`保存しました: ${res.filePath}`);
  closeExportDialog();
}

function openExportDialog(initialFormat) {
  if (!els.exportDialog || !els.exportFormat || !els.exportPathInput) return;
  const format = normalizeExportFormat(initialFormat);
  const requiredCapability = requiredCapabilityForExport(format, { pngScale: 1 });
  if (requiredCapability && !hasCapability(requiredCapability)) {
    void handleProRequired(
      { code: "PRO_REQUIRED", requiredCapability, error: `Pro required: ${requiredCapability}` },
      requiredCapability
    );
    return;
  }
  state.exportDialogCtx = { format };
  els.exportFormat.value = format;
  if (els.exportPngQuality) {
    els.exportPngQuality.value = "standard";
  }
  if (els.exportPngQualityRow) {
    els.exportPngQualityRow.classList.toggle("hidden", format !== "png");
  }
  if (els.exportPngQualityHint) {
    els.exportPngQualityHint.classList.add("hidden");
  }
  els.exportPathInput.value = buildDefaultExportPath(format);
  if (els.exportOpenFolder) els.exportOpenFolder.checked = false;
  renderExportRecentPaths();
  setExportError("");
  els.exportDialog.classList.remove("hidden");
  els.exportPathInput.focus();
  els.exportPathInput.select();
}

function wireExportDialog() {
  if (state.exportDialogWired) return;
  if (!els.exportDialog || !els.exportFormat || !els.exportPathInput) return;
  state.exportDialogWired = true;
  if (!state.exportRecentPaths.length) {
    state.exportRecentPaths = loadExportRecentPaths();
    renderExportRecentPaths();
  }

  els.exportFormat.addEventListener("change", () => {
    const format = normalizeExportFormat(els.exportFormat.value);
    if (els.exportPngQualityRow) {
      els.exportPngQualityRow.classList.toggle("hidden", format !== "png");
    }
    const v = String(els.exportPathInput.value || "").trim();
    els.exportPathInput.value = v ? normalizeExportPathInput(v, format) : buildDefaultExportPath(format);
    setExportError("");
    updateProUi();
  });

  if (els.exportPngQuality) {
    els.exportPngQuality.addEventListener("change", () => {
      const isHigh = els.exportPngQuality.value === "highres";
      if (isHigh && !hasCapability(PRO_CAP_EXPORT_PNG_HIGHRES)) {
        els.exportPngQuality.value = "standard";
        void handleProRequired(
          { code: "PRO_REQUIRED", requiredCapability: PRO_CAP_EXPORT_PNG_HIGHRES, error: `Pro required: ${PRO_CAP_EXPORT_PNG_HIGHRES}` },
          PRO_CAP_EXPORT_PNG_HIGHRES
        );
      }
      updateProUi();
    });
  }

  els.btnExportBrowse?.addEventListener("click", async () => {
    const format = normalizeExportFormat(els.exportFormat.value);
    const pngScale = format === "png" && els.exportPngQuality?.value === "highres" ? 2 : 1;
    const currentPath = String(els.exportPathInput.value || "").trim() || buildDefaultExportPath(format);
    const res = await window.api?.chooseExportPath?.({ format, filePath: currentPath, pngScale });
    if (res?.ok && res.filePath) {
      els.exportPathInput.value = res.filePath;
      setExportError("");
    } else if (res?.code === "PRO_REQUIRED") {
      await handleProRequired(res, requiredCapabilityForExport(format, { pngScale }));
    } else if (res && !res.canceled) {
      setExportError(res.error || "保存先の選択に失敗しました。");
    }
  });

  els.btnExportCancel?.addEventListener("click", () => closeExportDialog());
  els.btnExportRun?.addEventListener("click", async () => {
    await withTask("exporting...", async () => {
      await runExportFromDialog();
    });
  });
  els.exportDialog.addEventListener("click", (evt) => {
    if (evt.target === els.exportDialog) closeExportDialog();
  });
}

function wireProDialog() {
  if (els.btnProUnlock) {
    els.btnProUnlock.addEventListener("click", async () => {
      await refreshEntitlements("open-pro-dialog");
      openProDialog();
    });
  }
  if (els.btnProClose) {
    els.btnProClose.addEventListener("click", () => closeProDialog());
  }
  if (els.proDialog) {
    els.proDialog.addEventListener("click", (evt) => {
      if (evt.target === els.proDialog) closeProDialog();
    });
  }
  if (els.btnProPurchase) {
    els.btnProPurchase.addEventListener("click", async () => {
      setProDialogError("");
      const res = await window.api?.entitlementsPurchasePro?.();
      if (!res?.ok) {
        setProDialogError(res?.error || "Purchase failed.");
        await refreshEntitlements("purchase-failed");
        return;
      }
      await refreshEntitlements("purchase-success");
      showToast("Pro status updated");
    });
  }
  if (els.btnProRestore) {
    els.btnProRestore.addEventListener("click", async () => {
      setProDialogError("");
      const res = await window.api?.entitlementsRestore?.();
      if (!res?.ok) {
        setProDialogError(res?.error || "Restore failed.");
        await refreshEntitlements("restore-failed");
        return;
      }
      await refreshEntitlements("restore-success");
      showToast("Purchase restore completed");
    });
  }
}

function getEditorBaseText() {
  return state.editor.getValue();
}

function toEditorDisplayText(text) {
  const stripped = stripInternalBlocks(String(text ?? ""));
  const lines = stripped.split(/\r?\n/).filter((line) => !/^\s*%%AE:MODEL\b/.test(line));
  const normalized = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  const meaningful = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^%%\{.*\}%%$/.test(line));
  if (meaningful.length === 1 && /^(flowchart|graph)\b/i.test(meaningful[0])) {
    return "";
  }
  return /\r?\n$/.test(stripped) ? `${normalized}\n` : normalized;
}

function getFullSourceForOutput() {
  const base = stripInternalBlocks(getEditorBaseText());
  const normalized = [];
  let initKept = false;
  for (const line of String(base || "").split(/\r?\n/)) {
    const t = line.trim();
    if (/^%%AE:MODEL\b/.test(t)) continue;
    if (/^%%\{.*\}%%$/.test(t)) {
      if (initKept) continue;
      initKept = true;
    }
    normalized.push(line);
  }
  const modelLine = state.model ? embedModelComment(state.model) : "";
  const parts = [normalized.join("\n").trimEnd()];
  if (modelLine) parts.push(modelLine);
  const internal = buildInternalBlocksText(state.model?.rawBlocks || []);
  if (internal) parts.push(internal);
  return parts.join("\n") + "\n";
}

function loadDocHistory() {
  try {
    const raw = localStorage.getItem("ae:docHistory");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    state.docHistory = parsed.filter((x) => x && typeof x.content === "string").slice(0, state.docHistoryMax);
  } catch {
    state.docHistory = [];
  }
}

function saveDocHistory() {
  try {
    localStorage.setItem("ae:docHistory", JSON.stringify(state.docHistory.slice(0, state.docHistoryMax)));
  } catch {}
}

function addDocSnapshot(reason) {
  const content = getFullSourceForOutput();
  const item = {
    ts: Date.now(),
    reason: reason || "manual",
    content
  };
  state.docHistory.unshift(item);
  state.docHistory = state.docHistory.slice(0, state.docHistoryMax);
  saveDocHistory();
}

function formatMermaid(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let indent = 0;
  const pushLine = (line) => {
    out.push(`${"  ".repeat(indent)}${line.trim()}`);
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^end\b/i.test(line)) indent = Math.max(0, indent - 1);
    if (/^flowchart\b|^graph\b/i.test(line)) {
      out.push(line);
      continue;
    }
    pushLine(line);
    if (/^subgraph\b/i.test(line)) indent += 1;
  }
  return out.join("\n") + "\n";
}

async function readJson(relPath) {
  if (!relPath) {
    throw new Error("readJson path is empty");
  }
  let route = "none";
  try {
    if (window.api?.readAssetJson) {
      route = "readAssetJson";
      const res = await window.api.readAssetJson(relPath);
      if (res && typeof res === "object" && Object.prototype.hasOwnProperty.call(res, "ok")) {
        if (!res.ok) throw new Error(res.error || `Failed to read ${relPath}`);
        return res.content;
      }
      return res;
    }

    if (window.api?.readAssetText) {
      route = "readAssetText";
      const res = await window.api.readAssetText(relPath);
      const isWrapped = !!(res && typeof res === "object" && Object.prototype.hasOwnProperty.call(res, "ok"));
      if (isWrapped && !res.ok) throw new Error(res.error || `Failed to read ${relPath}`);
      const text = isWrapped ? res.content : res;
      if (typeof text !== "string") {
        throw new Error(`Invalid readAssetText response for ${relPath}`);
      }
      return JSON.parse(text);
    }

    route = "fetch";
    const url = new URL(String(relPath).replace(/^\/+/, ""), location.origin + "/");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} ${response.url}`);
    }
    return await response.json();
  } catch (err) {
    console.warn("[boot] readJson failed", { route, relPath, error: err?.message || err });
    throw err;
  }
}

async function getMermaid() {
  if (state.mermaid) return state.mermaid;
  if (window.mermaid) {
    state.mermaid = window.mermaid;
    return state.mermaid;
  }
  try {
    const mod = await import("../../node_modules/mermaid/dist/mermaid.esm.min.mjs");
    state.mermaid = mod.default || mod;
    return state.mermaid;
  } catch (err) {
    console.error("Mermaid import failed", err);
  }
  return null;
}

async function initMermaidBase(theme) {
  const baseTheme = theme?.init?.theme || "dark";
  const mermaid = await getMermaid();
  if (!mermaid) throw new Error("Mermaid module not found");
  mermaid.initialize({
    startOnLoad: false,
    theme: baseTheme,
    securityLevel: "loose"
  });
}

function createPlainEditor(textarea) {
  textarea.classList.add("editorFallback");
  return {
    getValue() {
      return textarea.value || "";
    },
    setValue(v) {
      textarea.value = v ?? "";
    },
    onChange(fn) {
      textarea.addEventListener("input", fn);
    },
    jumpToLine(line, column = 1) {
      const lines = textarea.value.split(/\r?\n/);
      let pos = 0;
      for (let i = 0; i < Math.max(0, line - 1); i += 1) {
        pos += (lines[i] || "").length + 1;
      }
      pos += Math.max(0, column - 1);
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    },
    undo() {
      document.execCommand("undo");
    },
    redo() {
      document.execCommand("redo");
    },
    setReadOnly(ro) {
      textarea.readOnly = ro === true || ro === "nocursor";
    },
    focus() {
      textarea.focus();
    }
  };
}

function createEditor(_container, textarea) {
  if (!window.CodeMirror) return createPlainEditor(textarea);
  const cm = window.CodeMirror.fromTextArea(textarea, {
    mode: "markdown",
    theme: "material-darker",
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2
  });
  return {
    cm,
    getValue() {
      return cm.getValue();
    },
    setValue(v) {
      cm.setValue(v ?? "");
    },
    onChange(fn) {
      cm.on("change", fn);
    },
    jumpToLine(line, column = 1) {
      cm.setCursor({ line: Math.max(0, line - 1), ch: Math.max(0, column - 1) });
      cm.focus();
    },
    undo() {
      cm.undo();
    },
    redo() {
      cm.redo();
    },
    setReadOnly(ro) {
      cm.setOption("readOnly", ro === true || ro === "nocursor");
    },
    focus() {
      cm.focus();
    }
  };
}

async function initEditor() {
  try {
    state.editor = createEditor(els.srcEditor, els.srcTextarea);
    // CodeMirror is mounted from textarea; keep the placeholder container hidden
    // and do not re-show textarea, otherwise a blank block remains above editor.
    if (els.srcEditor) els.srcEditor.style.display = "none";
    if (state.editor?.cm && els.srcTextarea) els.srcTextarea.style.display = "none";
  } catch (err) {
    console.warn("CodeMirror init failed. Falling back to textarea.", err);
    els.srcEditor.style.display = "none";
    els.srcTextarea.style.display = "block";
    state.editor = createPlainEditor(els.srcTextarea);
  }

  const onChange = debounce(() => {
    if (state.syncingEditor) return;
    const current = state.editor.getValue();
    if (state.lastProgrammaticEditorText !== null && current === state.lastProgrammaticEditorText) {
      state.lastProgrammaticEditorText = null;
      return;
    }
    state.textDirty = true;
    updateApplyButton();
    setStatus("dirty", "dirty");
    setStatusReason("Source edited");
    void renderFromText({ live: true });
  }, 300);

  state.editor.onChange(onChange);
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function updateEditorText(text) {
  const displayText = toEditorDisplayText(text);
  let cmCursor = null;
  let cmScroll = null;
  let taSel = null;
  let taScroll = null;
  if (state.editor?.cm) {
    cmCursor = state.editor.cm.getCursor();
    cmScroll = state.editor.cm.getScrollInfo();
  } else if (els.srcTextarea) {
    taSel = [els.srcTextarea.selectionStart || 0, els.srcTextarea.selectionEnd || 0];
    taScroll = [els.srcTextarea.scrollTop || 0, els.srcTextarea.scrollLeft || 0];
  }
  state.syncingEditor = true;
  state.lastProgrammaticEditorText = displayText ?? "";
  state.editor.setValue(displayText);
  state.syncingEditor = false;
  if (state.editor?.cm && cmCursor && cmScroll) {
    state.editor.cm.setCursor(cmCursor);
    state.editor.cm.scrollTo(cmScroll.left, cmScroll.top);
  } else if (els.srcTextarea && taSel) {
    const max = els.srcTextarea.value.length;
    const start = Math.min(taSel[0], max);
    const end = Math.min(taSel[1], max);
    els.srcTextarea.setSelectionRange(start, end);
    if (taScroll) {
      els.srcTextarea.scrollTop = taScroll[0];
      els.srcTextarea.scrollLeft = taScroll[1];
    }
  }
}

function syncEditorReadOnly() {
  state.editor.setReadOnly(false);
}

function updateApplyButton() {
  if (!els.btnApplyText) return;
  els.btnApplyText.style.display = "inline-flex";
  els.btnApplyText.disabled = !state.textDirty;
  els.btnApplyText.classList.toggle("dirty", state.textDirty);
  if (state.textDirty) {
    setStatusReason("Source edited (Apply pending)");
  } else if (!state.problems.length) {
    setStatusReason("");
  }
}

function updateInternalToggleVisibility() {
  const hasInternal = !!(state.model?.rawBlocks && state.model.rawBlocks.length);
  const showDev = state.devMode;
  document.body.classList.toggle("dev-mode", showDev);
  if (els.internalPanel) {
    els.internalPanel.classList.toggle("hidden", !showDev || !hasInternal);
    if (!showDev) {
      els.internalPanel.open = false;
    }
    if (!hasInternal) {
      els.internalPanel.open = false;
    }
  }
  if (els.internalToggleWrap) {
    els.internalToggleWrap.classList.toggle("hidden", !showDev);
  }
  if (!showDev && els.toggleInternalBlocks) {
    els.toggleInternalBlocks.checked = false;
    state.showInternalBlocks = false;
  }
  if (!hasInternal && !state.showInternalBlocks && els.toggleInternalBlocks) {
    els.toggleInternalBlocks.checked = false;
  }
  updateStatusDetailsVisibility();
}

function applyInspectorVisibility() {
  document.body.classList.toggle("inspector-hidden", !state.inspectorVisible);
  if (els.btnToggleInspector) {
    els.btnToggleInspector.classList.toggle("active", state.inspectorVisible);
    els.btnToggleInspector.textContent = state.inspectorVisible ? t("btnInspectorOn") : t("btnInspectorOff");
  }
}

function setInspectorEmptyState(isEmpty) {
  if (!els.inspector) return;
  els.inspector.classList.toggle("is-empty", !!isEmpty);
}

function nextId(prefix, existingIds) {
  let n = 1;
  while (existingIds.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

function boundaryPrefix(role) {
  switch (role) {
    case "onprem":
      return "ONPREM";
    case "vpc":
      return "VPC";
    case "subnet":
      return "SUBNET";
    case "dmz":
      return "DMZ";
    default:
      return "B";
  }
}

function addEdgeByNodes(from, to, { kind = null, label = "" } = {}) {
  if (!from || !to || from === to) return false;
  const ids = new Set(state.model.edges.map((e) => e.id));
  const id = nextId("E", ids);
  const edgeKind = kind || Object.keys(state.pack.edgeKinds || {})[0] || "http";
  state.model.edges.push({ id, from, to, kind: edgeKind, label: String(label || "") });
  pushHistory();
  renderFromModel();
  markModelDirty("edge added");
  return true;
}

function refreshSelectors() {
  els.selRole.innerHTML = "";
  const freeOpt = document.createElement("option");
  freeOpt.value = "__free_box__";
  freeOpt.textContent = "Free Box（自由記入）";
  els.selRole.appendChild(freeOpt);
  for (const [roleId, role] of Object.entries(state.pack.roles)) {
    const opt = document.createElement("option");
    opt.value = roleId;
    opt.textContent = `${role.label} (${roleId})`;
    els.selRole.appendChild(opt);
  }

  els.selBoundaryRole.innerHTML = "";
  for (const [roleId, role] of Object.entries(state.pack.boundaryRoles)) {
    const opt = document.createElement("option");
    opt.value = roleId;
    opt.textContent = `${role.label} (${roleId})`;
    els.selBoundaryRole.appendChild(opt);
  }

  els.selEdgeKind.innerHTML = "";
  for (const [kindId, kind] of Object.entries(state.pack.edgeKinds)) {
    const opt = document.createElement("option");
    opt.value = kindId;
    opt.textContent = `${kind.label} (${kindId})`;
    els.selEdgeKind.appendChild(opt);
  }
}

function refreshNodeEdgeSelects() {
  const ids = state.model.nodes.map((n) => n.id);
  const setOptions = (sel) => {
    sel.innerHTML = "";
    for (const id of ids) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      sel.appendChild(opt);
    }
  };
  setOptions(els.selEdgeFrom);
  setOptions(els.selEdgeTo);
}

function renderList(container, items) {
  container.innerHTML = "";
  for (const it of items) container.appendChild(it);
}

function highlightList() {
  const reset = (container) => {
    if (!container) return;
    container.querySelectorAll(".item").forEach((el) => {
      el.classList.remove("active");
      el.classList.remove("hover");
    });
  };
  const mark = (container, id, cls) => {
    if (!container || !id) return;
    const el = container.querySelector(`.item[data-ae-id="${id}"]`);
    if (el) el.classList.add(cls);
  };
  reset(els.nodeList);
  reset(els.edgeList);
  if (state.selectedNodeIds.size) {
    for (const id of state.selectedNodeIds) mark(els.nodeList, id, "active");
  } else {
    mark(els.nodeList, state.selectedNodeId, "active");
  }
  mark(els.nodeList, state.hoverNodeId, "hover");
  mark(els.edgeList, state.selectedEdgeId, "active");
  mark(els.edgeList, state.hoverEdgeId, "hover");
}

function focusListItem(container, id) {
  if (!container || !id) return;
  const item = container.querySelector(`.item[data-ae-id="${id}"]`);
  if (!item) return;
  item.scrollIntoView({ block: "nearest" });
  item.classList.add("flash");
  setTimeout(() => item.classList.remove("flash"), 1000);
}

function renderLists() {
  const nodeItems = state.model.nodes.map((n) => {
    const div = document.createElement("div");
    div.className = "item";
    if (n.locked) div.classList.add("locked");
    div.dataset.aeId = n.id;
    div.innerHTML = `<span class="tag">${n.id}</span><span class="name">${n.label}</span><span class="tag">${n.role}</span>`;
    const btn = document.createElement("button");
    btn.className = "btnMini";
    btn.textContent = "削除";
    btn.disabled = !!n.locked;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (n.locked) return;
      state.model.nodes = state.model.nodes.filter((x) => x.id !== n.id);
      state.model.edges = state.model.edges.filter((x) => x.from !== n.id && x.to !== n.id);
      pushHistory();
      renderFromModel();
    });
    div.appendChild(btn);
    div.addEventListener("click", (evt) => {
      if (n.locked) return;
      if (evt.shiftKey && !state.connectMode) {
        if (state.selectedNodeIds.has(n.id)) {
          state.selectedNodeIds.delete(n.id);
        } else {
          state.selectedNodeIds.add(n.id);
        }
        state.selectedNodeId = state.selectedNodeIds.size === 1 ? Array.from(state.selectedNodeIds)[0] : null;
        state.selectedEdgeId = null;
        state.edgeAmbiguous = null;
        renderPropPanel();
        const svg = els.preview.querySelector("svg");
        if (svg) applySelection(svg);
        highlightList();
        return;
      }
      selectNodeById(n.id);
      highlightList();
    });
    return div;
  });

  const edgeItems = state.model.edges.map((e) => {
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.aeId = e.id;
    div.innerHTML = `<span class="tag">${e.id}</span><span class="name">${e.from} → ${e.to} (${e.kind})</span><span class="tag">${e.label || ""}</span>`;
    const btn = document.createElement("button");
    btn.className = "btnMini";
    btn.textContent = "削除";
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      state.model.edges = state.model.edges.filter((x) => x.id !== e.id);
      pushHistory();
      renderFromModel();
    });
    div.appendChild(btn);
    div.addEventListener("click", () => {
      selectEdgeById(e.id);
      highlightList();
    });
    return div;
  });

  const boundaryItems = state.model.boundaries.map((b) => {
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.aeId = b.id;
    div.innerHTML = `<span class="tag">${b.id}</span><span class="name">${b.label}</span><span class="tag">${b.role}</span>`;
    const btn = document.createElement("button");
    btn.className = "btnMini";
    btn.textContent = "削除";
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      state.model.boundaries = state.model.boundaries.filter((x) => x.id !== b.id);
      state.model.nodes = state.model.nodes.map((n) => (n.boundaryId === b.id ? { ...n, boundaryId: null } : n));
      pushHistory();
      renderFromModel();
    });
    div.appendChild(btn);
    div.addEventListener("click", () => {
      const target = els.inspectorBody || els.inspector;
      if (target) target.textContent = JSON.stringify(b, null, 2);
      setInspectorHeader(`Boundary: ${b.id}`, "Selected", "ok");
    });
    return div;
  });

  renderList(els.nodeList, nodeItems);
  renderList(els.edgeList, edgeItems);
  renderList(els.boundaryList, boundaryItems);
  refreshNodeEdgeSelects();
  highlightList();
}

function parseMermaidToModel(text) {
  const originalLines = String(text || "").split(/\r?\n/);
  const warnings = [];
  const rawBlocks = [];
  const lines = [];

  for (let i = 0; i < originalLines.length; i += 1) {
    const line = originalLines[i];
    if (/^\s*%%AE:RAW_BEGIN/.test(line)) {
      const start = i + 1;
      const raw = [];
      i += 1;
      while (i < originalLines.length && !/^\s*%%AE:RAW_END/.test(originalLines[i])) {
        raw.push(originalLines[i]);
        i += 1;
      }
      const end = i + 1;
      rawBlocks.push({ start, end, lines: raw, fromRaw: true });
      continue;
    }
    lines.push({ text: line, lineNo: i + 1 });
  }

  const nodes = new Map();
  const edges = [];
  const boundaries = [];
  const boundaryStack = [];
  let direction = "LR";

  const shapeToRole = new Map();
  for (const [roleId, role] of Object.entries(state.pack.roles)) {
    if (role.shape) shapeToRole.set(role.shape, roleId);
  }
  const arrowToKind = new Map();
  for (const [kindId, kind] of Object.entries(state.pack.edgeKinds)) {
    if (kind.arrow) arrowToKind.set(kind.arrow, kindId);
  }

  const makeNode = (id, label, shape) => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label: label || id,
        role: shapeToRole.get(shape) || "server",
        shape: shape || "rect",
        boundaryId: boundaryStack.length ? boundaryStack[boundaryStack.length - 1].id : null,
        groupId: boundaryStack.length ? boundaryStack[boundaryStack.length - 1].id : null,
        groupName: boundaryStack.length ? boundaryStack[boundaryStack.length - 1].label : null
      });
    } else if (label) {
      nodes.get(id).label = label;
      if (shape) nodes.get(id).shape = shape;
    }
  };

  const detectShape = (raw) => {
    if (raw.startsWith("((") && raw.endsWith("))")) return "circle";
    if (raw.startsWith("([") && raw.endsWith("])")) return "round";
    if (raw.startsWith("[(") && raw.endsWith(")]")) return "cylinder";
    if (raw.startsWith("{") && raw.endsWith("}")) return "diamond";
    if (raw.startsWith("{{") && raw.endsWith("}}")) return "hex";
    if (raw.startsWith("[/") && raw.endsWith("/]")) return "parallelogram";
    if (raw.startsWith("[") && raw.endsWith("]")) return "rect";
    return "rect";
  };

  const extractLabel = (raw) => raw.replace(/^[\[\(\{\/]+/, "").replace(/[\]\)\}\/]+$/, "");

  const unsupportedBuffer = [];
  const flushUnsupported = () => {
    if (!unsupportedBuffer.length) return;
    const start = unsupportedBuffer[0].lineNo;
    const end = unsupportedBuffer[unsupportedBuffer.length - 1].lineNo;
    rawBlocks.push({ start, end, lines: unsupportedBuffer.map((l) => l.text), fromRaw: false });
    warnings.push({ type: "warn", message: `RAW preserved: lines ${start}-${end}`, line: start, column: 1 });
    unsupportedBuffer.length = 0;
  };

  const parseNodeToken = (token) => {
    const m = token.match(/^([A-Za-z0-9_\-]+)(.*)$/);
    if (!m) return { id: token, label: "", shape: "rect" };
    const id = m[1];
    const rest = m[2] || "";
    if (!rest) return { id, label: "", shape: "rect" };
    const shape = detectShape(rest);
    const label = extractLabel(rest);
    return { id, label, shape };
  };

  for (let i = 0; i < lines.length; i += 1) {
    const { text: line, lineNo } = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isMermaidMetaLine(trimmed)) {
      if (/^class\[/i.test(trimmed)) {
        warnings.push({
          type: "warn",
          message: "Invalid Mermaid syntax 'class[...]'. Use: class nodeId class_name;",
          line: lineNo,
          column: 1
        });
      } else if (/^class\s+\S+\s+\S+\s+\S+/i.test(trimmed)) {
        warnings.push({
          type: "warn",
          message: "className contains spaces. Use snake_case (e.g. vpn1_role).",
          line: lineNo,
          column: 1
        });
      }
      // keep as RAW so original text is preserved, but never parsed as node/edge.
      unsupportedBuffer.push({ text: line, lineNo });
      continue;
    }

    const mFlow = trimmed.match(/^(flowchart|graph)\s+(\w+)/i);
    if (mFlow) {
      direction = mFlow[2].toUpperCase();
      continue;
    }

    const mSub = trimmed.match(/^subgraph\s+([A-Za-z0-9_\-]+)(?:\[(.+)\])?$/i);
    if (mSub) {
      const id = mSub[1];
      const label = mSub[2] || id;
      const b = { id, label, role: "vpc", direction: "TB" };
      boundaries.push(b);
      boundaryStack.push(b);
      continue;
    }

    const mSubDirection = trimmed.match(/^direction\s+(TB|TD|BT|LR|RL)$/i);
    if (mSubDirection && boundaryStack.length) {
      boundaryStack[boundaryStack.length - 1].direction = mSubDirection[1].toUpperCase();
      continue;
    }

    if (/^end\b/i.test(trimmed)) {
      boundaryStack.pop();
      continue;
    }

    const mEdge = trimmed.match(/^(.+?)\s*([-.=]+>?)\s*\|([^|]+)\|\s*(.+)$/);
    if (mEdge) {
      const [, fromRaw, arrow, label, toRaw] = mEdge;
      const fromTok = parseNodeToken(fromRaw.trim());
      const toTok = parseNodeToken(toRaw.trim());
      const kind = arrowToKind.get(arrow) || "http";
      edges.push({ id: `E${edges.length + 1}`, from: fromTok.id, to: toTok.id, kind, label: label.trim() });
      makeNode(fromTok.id, fromTok.label, fromTok.shape);
      makeNode(toTok.id, toTok.label, toTok.shape);
      continue;
    }

    const mEdge2 = trimmed.match(/^(.+?)\s*([-.=]+>?)\s*(.+)$/);
    if (mEdge2) {
      const [, fromRaw, arrow, toRaw] = mEdge2;
      const fromTok = parseNodeToken(fromRaw.trim());
      const toTok = parseNodeToken(toRaw.trim());
      const kind = arrowToKind.get(arrow) || "http";
      edges.push({ id: `E${edges.length + 1}`, from: fromTok.id, to: toTok.id, kind, label: "" });
      makeNode(fromTok.id, fromTok.label, fromTok.shape);
      makeNode(toTok.id, toTok.label, toTok.shape);
      continue;
    }

    const mNode = trimmed.match(/^([A-Za-z0-9_\-]+)(\[.*\]|\(\[.*\]\)|\(\(.*\)\)|\[\(.*\)\]|\{\{.*\}\}|\{.*\}|\[\/.*\/\])$/);
    if (mNode) {
      const [, id, raw] = mNode;
      if (id.toLowerCase() === "class" || id.toLowerCase() === "classdef") {
        unsupportedBuffer.push({ text: line, lineNo });
        continue;
      }
      const shape = detectShape(raw);
      const label = extractLabel(raw);
      makeNode(id, label, shape);
      continue;
    }

    unsupportedBuffer.push({ text: line, lineNo });
  }
  flushUnsupported();

  for (const block of rawBlocks) {
    if (block.fromRaw) {
      warnings.push({ type: "warn", message: `RAW preserved: lines ${block.start}-${block.end}`, line: block.start, column: 1 });
    }
  }

  if (!nodes.size && !edges.length) {
    return { model: null, warnings: [{ type: "error", message: "No supported Mermaid elements found.", line: 1, column: 1 }], rawBlocks };
  }

  const model = {
    version: 1,
    packId: state.pack.packId,
    themeId: state.theme.themeId,
    diagramType: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    boundaries
  };

  model.rawBlocks = rawBlocks;
  model.nodes.forEach((n) => normalizeNodeClassName(n));
  return { model, warnings, rawBlocks };
}

function normalizeModelClassNames(model) {
  if (!model || !Array.isArray(model.nodes)) return model;
  const byBoundary = new Map((model.boundaries || []).map((b) => [b.id, b]));
  model.nodes.forEach((n) => {
    normalizeNodeClassName(n);
    const bid = n.boundaryId || n.groupId || null;
    n.boundaryId = bid;
    n.groupId = bid;
    n.groupName = bid && byBoundary.has(bid) ? byBoundary.get(bid).label : null;
  });
  return model;
}

function validateMermaidText(text) {
  const items = [];
  const lines = String(text || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^class\[/i.test(line)) {
      items.push({
        type: "error",
        message: "Invalid Mermaid syntax 'class[...]'. Use: class nodeId class_name;",
        line: i + 1,
        column: 1
      });
      continue;
    }
    const m = line.match(/^class\s+(.+)$/i);
    if (m) {
      const parts = m[1].split(/\s+/);
      const cls = parts.length >= 2 ? parts[parts.length - 1] : "";
      if (cls && slugifyClassName(cls) !== cls) {
        items.push({
          type: "warn",
          message: `className '${cls}' normalized to '${slugifyClassName(cls)}'`,
          line: i + 1,
          column: 1
        });
      }
    }
  }
  return items;
}

function renderFromModel({ preserveWarnings = false, updateSource = true } = {}) {
  const rev = bumpSyncRev();
  state.model = normalizeModelClassNames(state.model);
  state.model = normalizeModel(clone(state.model));
  state.model.direction = els.selDir.value || state.model.direction;
  if (state.selectedNodeIds.size) {
    const validNodeIds = new Set(state.model.nodes.map((n) => n.id));
    for (const id of Array.from(state.selectedNodeIds)) {
      if (!validNodeIds.has(id) || isNodeLocked(id)) state.selectedNodeIds.delete(id);
    }
    state.selectedNodeId = state.selectedNodeIds.size === 1 ? Array.from(state.selectedNodeIds)[0] : null;
  }
  if (state.selectedNodeId && !state.model.nodes.find((n) => n.id === state.selectedNodeId)) {
    state.selectedNodeId = null;
  }
  if (state.selectedEdgeId && !state.model.edges.find((e) => e.id === state.selectedEdgeId)) {
    state.selectedEdgeId = null;
  }
  refreshSelectionActions();
  state.edgeAmbiguous = null;
  const mermaidText = generateMermaid(state.model, state.pack, state.theme);
  const validation = validateMermaidText(mermaidText).filter((x) => x.type === "error");
  if (validation.length) {
    setProblems(validation, { status: "error", open: true });
    return;
  }
  if (updateSource) {
    const fullText = `${mermaidText}\n${buildInternalBlocksText(state.model.rawBlocks || [])}\n`;
    const displayText = state.showInternalBlocks ? fullText : stripInternalBlocks(fullText);
    updateEditorText(displayText);
  }
  updateInternalToggleVisibility();
  renderLists();
  renderPropPanel();
  renderMermaid(mermaidText, { expectedRev: rev });
  if (updateSource) {
    state.textDirty = false;
    setOutOfSync(false);
  }
  if (!preserveWarnings) state.parseWarnings = [];
  if (!preserveWarnings) {
    state.problems = [];
    renderProblems();
    setStatus("ok", "ready");
    setStatusReason("");
  }
  if (updateSource) updateApplyButton();
}

async function renderFromText({ live = false } = {}) {
  const text = getEditorBaseText();
  const rev = bumpSyncRev();

  const validation = await validateMermaidSyntax(text);
  if (!isLatestRev(rev)) return false;
  if (!validation.ok) {
    setProblems([validation.problem], { status: "error", open: true });
    state.textDirty = true;
    updateApplyButton();
    setOutOfSync(true, "Mermaid syntax error");
    return false;
  }

  state.prevRawBlocks = state.model?.rawBlocks ? [...state.model.rawBlocks] : [];

  const embedded = extractModelFromText(text);
  if (embedded) {
    normalizeModelClassNames(embedded);
    state.model = embedded;
    const previewText = generateMermaid(state.model, state.pack, state.theme);
    renderLists();
    renderPropPanel();
    updateInternalToggleVisibility();
    await renderMermaid(previewText, { expectedRev: rev });
    if (!isLatestRev(rev)) return false;
    state.textDirty = false;
    updateApplyButton();
    setOutOfSync(false);
    clearError();
    if (!live) pushHistory();
    return true;
  }

  const { model, warnings, rawBlocks } = parseMermaidToModel(text);
  if (!model) {
    setProblems(warnings.length ? warnings : [{ type: "error", message: "Parse failed" }], { status: "error", open: true });
    state.textDirty = true;
    updateApplyButton();
    setOutOfSync(true, "Mermaid->Model parse failed");
    return false;
  }

  state.model = model;
  if (state.selectedNodeIds.size) {
    const validNodeIds = new Set(state.model.nodes.map((n) => n.id));
    for (const id of Array.from(state.selectedNodeIds)) {
      if (!validNodeIds.has(id) || isNodeLocked(id)) state.selectedNodeIds.delete(id);
    }
  }
  state.selectedNodeId = state.selectedNodeIds.size === 1 ? Array.from(state.selectedNodeIds)[0] : null;
  refreshSelectionActions();
  normalizeModelClassNames(state.model);
  if (!state.showInternalBlocks && (!state.model.rawBlocks || state.model.rawBlocks.length === 0) && state.prevRawBlocks?.length) {
    state.model.rawBlocks = state.prevRawBlocks;
  }
  els.selDir.value = model.direction || els.selDir.value;
  state.parseWarnings = warnings;
  const rawInfo =
    rawBlocks && rawBlocks.length
      ? [{ type: "warn", message: `RAW preserved: ${rawBlocks.length} block(s)` }]
      : [];
  const mergedProblems = [...rawInfo, ...warnings];
  if (mergedProblems.length) {
    setProblems(mergedProblems, { status: warnings.length ? "warn" : "ok", open: warnings.length > 0 });
  } else {
    clearError();
  }
  updateInternalToggleVisibility();
  renderLists();
  renderPropPanel();
  const previewText = generateMermaid(state.model, state.pack, state.theme);
  await renderMermaid(previewText, { expectedRev: rev });
  if (!isLatestRev(rev)) return false;
  state.textDirty = false;
  updateApplyButton();
  setOutOfSync(warnings.length > 0, warnings.length ? "Source contains unsupported lines (RAW preserved)" : "");
  if (!live) pushHistory();
  return true;
}

function getNodeIdFromGroup(g) {
  if (!g) return null;
  if (g.dataset.aeNodeId) return g.dataset.aeNodeId;
  const title = g.querySelector("title");
  if (title && title.textContent) {
    g.dataset.aeNodeId = title.textContent.trim();
    return g.dataset.aeNodeId;
  }
  // Mermaid version differences: title can be missing. Fallback to id-pattern matching.
  const idLike = g.getAttribute("id") || "";
  if (idLike) {
    const m = idLike.match(/(?:flowchart|graph)-([A-Za-z0-9_\-]+)-\d+$/);
    if (m && m[1]) {
      g.dataset.aeNodeId = m[1];
      return g.dataset.aeNodeId;
    }
  }
  if (state.model?.nodes?.length) {
    const text = `${idLike} ${Array.from(g.querySelectorAll("[id]"))
      .map((n) => n.getAttribute("id"))
      .join(" ")}`;
    for (const n of state.model.nodes) {
      if (text.includes(`-${n.id}-`) || text.endsWith(`-${n.id}`) || text.includes(`${n.id}-`)) {
        g.dataset.aeNodeId = n.id;
        return g.dataset.aeNodeId;
      }
    }
  }
  return null;
}

function getNodeIdFromElement(el) {
  const g = el.closest("g.node");
  if (!g) return null;
  return getNodeIdFromGroup(g);
}

function clearSelectionState() {
  state.selectedNodeId = null;
  state.selectedNodeIds.clear();
  state.selectedEdgeId = null;
  state.edgeAmbiguous = null;
  refreshSelectionActions();
}

function getSelectedSingleGroupId() {
  if (!state.selectedNodeIds.size || !Array.isArray(state.model?.nodes)) return null;
  const selected = getUnlockedSelectedNodeIds();
  if (!selected.size) return null;
  let groupId = null;
  for (const n of state.model.nodes) {
    if (!selected.has(n.id)) continue;
    const gid = n.boundaryId || n.groupId || null;
    if (!gid) return null;
    if (groupId == null) groupId = gid;
    else if (groupId !== gid) return null;
  }
  return groupId;
}

function refreshSelectionActions() {
  if (!els.selectionActions) return;
  const count = state.selectedNodeIds.size;
  const canGroupOps = count >= 2;
  const canAlign = count >= 2;
  const canDistribute = count >= 3;
  const canUngroup = !!getSelectedSingleGroupId();
  const visible = !state.connectMode && (canGroupOps || canUngroup || canAlign || canDistribute);
  els.selectionActions.classList.toggle("hidden", !visible);
  els.selectionActions.setAttribute("aria-hidden", visible ? "false" : "true");
  if (els.btnSelectionGroup) els.btnSelectionGroup.classList.toggle("hidden", !canGroupOps);
  if (els.btnSelectionEqualize) els.btnSelectionEqualize.classList.toggle("hidden", !canGroupOps);
  if (els.btnSelectionUngroup) els.btnSelectionUngroup.classList.toggle("hidden", !canUngroup);
  if (els.btnSelectionAlignL) els.btnSelectionAlignL.classList.toggle("hidden", !canAlign);
  if (els.btnSelectionAlignC) els.btnSelectionAlignC.classList.toggle("hidden", !canAlign);
  if (els.btnSelectionAlignR) els.btnSelectionAlignR.classList.toggle("hidden", !canAlign);
  if (els.btnSelectionAlignT) els.btnSelectionAlignT.classList.toggle("hidden", !canAlign);
  if (els.btnSelectionAlignM) els.btnSelectionAlignM.classList.toggle("hidden", !canAlign);
  if (els.btnSelectionAlignB) els.btnSelectionAlignB.classList.toggle("hidden", !canAlign);
  if (els.btnSelectionDistH) els.btnSelectionDistH.classList.toggle("hidden", !canDistribute);
  if (els.btnSelectionDistV) els.btnSelectionDistV.classList.toggle("hidden", !canDistribute);
  if (els.btnSelectionDelete) els.btnSelectionDelete.classList.toggle("hidden", count < 1);
  if (els.selectionCount) els.selectionCount.textContent = t("selectionCount", { n: count });
}

function equalizeSelectedNodes() {
  if (state.connectMode || state.selectedNodeIds.size < 2) return;
  const selected = getUnlockedSelectedNodeIds();
  if (selected.size < 2) return;
  let changed = false;
  for (const n of state.model.nodes) {
    if (!selected.has(n.id)) continue;
    const wrapped = autoWrapLabel(n.label || n.id, 18);
    if (!wrapped || wrapped === n.label) continue;
    n.label = wrapped;
    changed = true;
  }
  if (!changed) return;
  renderFromModel();
  pushHistory();
  markModelDirty("labels equalized");
}

async function groupSelectedNodes() {
  if (state.connectMode || state.selectedNodeIds.size < 2) return false;
  const selected = getUnlockedSelectedNodeIds();
  if (selected.size < 2) return false;
  const entered = await requestTextInput("Group name", "Group");
  if (entered == null) return false;
  const label = String(entered || "").trim() || "Group";
  const boundaryRoleIds = Object.keys(state.pack?.boundaryRoles || {});
  const roleId = boundaryRoleIds.includes("vpc") ? "vpc" : (boundaryRoleIds[0] || "vpc");
  const ids = new Set((state.model.boundaries || []).map((b) => b.id));
  const id = nextId(boundaryPrefix(roleId), ids);
  state.model.boundaries.push({ id, label, role: roleId, direction: "TB" });
  for (const n of state.model.nodes) {
    if (!selected.has(n.id)) continue;
    n.boundaryId = id;
    n.groupId = id;
    n.groupName = label;
  }
  renderFromModel();
  pushHistory();
  markModelDirty("nodes grouped");
  return true;
}

function ungroupSelectedNodes() {
  if (state.connectMode || state.selectedNodeIds.size < 1) return false;
  const selected = getUnlockedSelectedNodeIds();
  if (!selected.size) return false;
  const groupId = getSelectedSingleGroupId();
  if (!groupId) return false;
  let changed = false;
  for (const n of state.model.nodes) {
    if (!selected.has(n.id)) continue;
    if ((n.boundaryId || n.groupId || null) !== groupId) continue;
    if (n.boundaryId || n.groupId || n.groupName) changed = true;
    n.boundaryId = null;
    n.groupId = null;
    n.groupName = null;
  }
  if (!changed) return false;
  const stillUsingGroup = state.model.nodes.some((n) => (n.boundaryId || n.groupId || null) === groupId);
  if (!stillUsingGroup) {
    state.model.boundaries = state.model.boundaries.filter((b) => b.id !== groupId);
  }
  renderFromModel();
  pushHistory();
  markModelDirty("nodes ungrouped");
  return true;
}

function nudgeSelectedNodes(dx, dy) {
  if (state.connectMode) return false;
  const selectedIds = state.selectedNodeIds.size
    ? getUnlockedSelectedNodeIds()
    : (state.selectedNodeId ? new Set([state.selectedNodeId]) : new Set());
  if (!selectedIds.size) return false;
  let changed = false;
  for (const node of state.model.nodes) {
    if (!selectedIds.has(node.id)) continue;
    const pos = getPinnedOffset(node);
    setPinnedOffset(node, { x: pos.x + dx, y: pos.y + dy });
    changed = true;
  }
  if (!changed) return false;
  renderFromModel({ updateSource: true, preserveWarnings: true });
  pushHistory();
  markModelDirty("node position changed");
  return true;
}

function getNodeBBoxInSvgSpace(nodeGroup) {
  if (!nodeGroup) return null;
  const svg = nodeGroup.ownerSVGElement;
  if (!svg) return null;
  const bbox = nodeGroup.getBBox();
  const ctm = nodeGroup.getCTM();
  if (!ctm) return null;
  const p1 = svg.createSVGPoint();
  p1.x = bbox.x;
  p1.y = bbox.y;
  const p2 = svg.createSVGPoint();
  p2.x = bbox.x + bbox.width;
  p2.y = bbox.y + bbox.height;
  const g1 = p1.matrixTransform(ctm);
  const g2 = p2.matrixTransform(ctm);
  return {
    x: Math.min(g1.x, g2.x),
    y: Math.min(g1.y, g2.y),
    w: Math.abs(g2.x - g1.x),
    h: Math.abs(g2.y - g1.y)
  };
}

function applyAlignment(mode) {
  if (state.connectMode || state.selectedNodeIds.size < 2) return false;
  const svg = els.preview.querySelector("svg");
  if (!svg) return false;
  const selected = getUnlockedSelectedNodeIds();
  if (selected.size < 2) return false;
  const nodeGroups = new Map();
  for (const gNode of svg.querySelectorAll("g.node")) {
    const gid = getNodeIdFromGroup(gNode);
    if (gid) nodeGroups.set(gid, gNode);
  }
  const infos = [];
  for (const node of state.model.nodes) {
    if (!selected.has(node.id)) continue;
    const gNode = nodeGroups.get(node.id);
    if (!gNode) continue;
    const rect = getNodeBBoxInSvgSpace(gNode);
    if (!rect) continue;
    infos.push({ id: node.id, node, rect });
  }
  if (infos.length < 2) return false;
  const next = alignRects(infos.map((it) => ({ id: it.id, ...it.rect })), mode);
  const byId = new Map(next.map((r) => [r.id, r]));
  let changed = false;
  for (const it of infos) {
    const to = byId.get(it.id);
    if (!to) continue;
    const dx = to.x - it.rect.x;
    const dy = to.y - it.rect.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
    const pos = getPinnedOffset(it.node);
    setPinnedOffset(it.node, { x: pos.x + dx, y: pos.y + dy });
    changed = true;
  }
  if (!changed) return false;
  renderFromModel({ updateSource: true, preserveWarnings: true });
  pushHistory();
  markModelDirty(`nodes aligned (${mode})`);
  return true;
}

function applyDistribute(axis) {
  if (state.connectMode || state.selectedNodeIds.size < 3) return false;
  const svg = els.preview.querySelector("svg");
  if (!svg) return false;
  const selected = getUnlockedSelectedNodeIds();
  if (selected.size < 3) return false;
  const nodeGroups = new Map();
  for (const gNode of svg.querySelectorAll("g.node")) {
    const gid = getNodeIdFromGroup(gNode);
    if (gid) nodeGroups.set(gid, gNode);
  }
  const infos = [];
  for (const node of state.model.nodes) {
    if (!selected.has(node.id)) continue;
    const gNode = nodeGroups.get(node.id);
    if (!gNode) continue;
    const rect = getNodeBBoxInSvgSpace(gNode);
    if (!rect) continue;
    infos.push({ id: node.id, node, rect });
  }
  if (infos.length < 3) return false;
  const next = distributeRects(infos.map((it) => ({ id: it.id, ...it.rect })), axis);
  const byId = new Map(next.map((r) => [r.id, r]));
  let changed = false;
  for (const it of infos) {
    const to = byId.get(it.id);
    if (!to) continue;
    const dx = to.x - it.rect.x;
    const dy = to.y - it.rect.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
    const pos = getPinnedOffset(it.node);
    setPinnedOffset(it.node, { x: pos.x + dx, y: pos.y + dy });
    changed = true;
  }
  if (!changed) return false;
  renderFromModel({ updateSource: true, preserveWarnings: true });
  pushHistory();
  markModelDirty(`nodes distributed (${axis})`);
  return true;
}

function applyToNodeOrSelection(contextNode, updater, dirtyReason) {
  if (!contextNode || typeof updater !== "function") return;
  const selected =
    state.selectedNodeIds.size > 1 && state.selectedNodeIds.has(contextNode.id)
      ? state.model.nodes.filter((n) => state.selectedNodeIds.has(n.id))
      : [contextNode];
  let changed = false;
  for (const n of selected) {
    if (updater(n)) changed = true;
  }
  if (!changed) return;
  renderFromModel();
  pushHistory();
  markModelDirty(dirtyReason);
}

function parseTranslate(transform) {
  const m = String(transform || "").match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
  if (!m) return { x: 0, y: 0 };
  return { x: parseFloat(m[1]) || 0, y: parseFloat(m[2]) || 0 };
}

function setNodeTransform(g, x, y) {
  g.setAttribute("transform", `translate(${x},${y})`);
}

function applyNodePositions(svg) {
  if (!state.model) return;
  let mapped = 0;
  let pinnedApplied = 0;
  const unresolvedPinned = [];
  const nodes = svg.querySelectorAll("g.node");
  for (const g of nodes) {
    const id = getNodeIdFromGroup(g);
    if (!id) continue;
    g.dataset.aeNodeId = id;
    g.dataset.nodeId = id;
    mapped += 1;
    const modelNode = state.model.nodes.find((n) => n.id === id);
    const base = parseTranslate(g.getAttribute("transform"));
    g.dataset.baseX = String(base.x);
    g.dataset.baseY = String(base.y);
    g.classList.toggle("ae-pinned", !!modelNode?.pinned);
    const pin = g.querySelector("text.ae-pin");
    if (modelNode?.pinned && !pin) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "ae-pin");
      t.setAttribute("x", "-10");
      t.setAttribute("y", "-6");
      t.textContent = "PIN";
      g.appendChild(t);
    }
    if (!modelNode?.pinned && pin) pin.remove();
    const offset = modelNode?.pinned ? getPinnedOffset(modelNode) : null;
    if (offset && modelNode?.pinned) {
      const x = base.x + offset.x;
      const y = base.y + offset.y;
      setNodeTransform(g, x, y);
      pinnedApplied += 1;
    } else if (modelNode?.pinned) {
      unresolvedPinned.push(modelNode.id);
    }
  }
  devLog("postRender/applyNodePositions", {
    mapped,
    pinnedApplied,
    unresolvedPinned
  });
}

function applySelection(svg) {
  svg.querySelectorAll("g.node.ae-selected, g.node.isSelected, g.node.isLocked").forEach((g) => {
    g.classList.remove("ae-selected");
    g.classList.remove("isSelected");
    g.classList.remove("isLocked");
  });
  svg.querySelectorAll("g.edgePath.ae-selected").forEach((g) => g.classList.remove("ae-selected"));
  svg.querySelectorAll("g.node.ae-hover").forEach((g) => g.classList.remove("ae-hover"));
  svg.querySelectorAll("g.edgePath.ae-hover").forEach((g) => g.classList.remove("ae-hover"));
  if (state.selectedNodeIds.size) {
    const nodes = svg.querySelectorAll("g.node");
    for (const g of nodes) {
      const id = getNodeIdFromElement(g);
      if (id && state.selectedNodeIds.has(id)) {
        g.classList.add("ae-selected");
        g.classList.add("isSelected");
      }
    }
  } else if (state.selectedNodeId) {
    const nodes = svg.querySelectorAll("g.node");
    for (const g of nodes) {
      const id = getNodeIdFromElement(g);
      if (id === state.selectedNodeId) {
        g.classList.add("ae-selected");
        g.classList.add("isSelected");
        break;
      }
    }
  }
  if (state.selectedEdgeId) {
    const edges = svg.querySelectorAll("g.edgePath");
    for (const g of edges) {
      if (g.dataset.aeEdgeId === state.selectedEdgeId) {
        g.classList.add("ae-selected");
        break;
      }
    }
  }

  if (state.hoverNodeId) {
    const nodes = svg.querySelectorAll("g.node");
    for (const g of nodes) {
      const id = getNodeIdFromElement(g);
      if (id === state.hoverNodeId) {
        g.classList.add("ae-hover");
        break;
      }
    }
  }
  if (state.hoverEdgeId) {
    const edges = svg.querySelectorAll("g.edgePath");
    for (const g of edges) {
      if (g.dataset.aeEdgeId === state.hoverEdgeId) {
        g.classList.add("ae-hover");
        break;
      }
    }
  }
  const nodes = svg.querySelectorAll("g.node");
  for (const g of nodes) {
    const id = getNodeIdFromElement(g);
    if (id && isNodeLocked(id)) g.classList.add("isLocked");
  }
  refreshSelectionActions();
}

function clientToSvg(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const res = pt.matrixTransform(inv);
  return { x: res.x, y: res.y };
}

function applyConnectHandles(svg) {
  svg.querySelectorAll("circle.ae-handle").forEach((n) => n.remove());
  if (!state.connectMode) return;
  const nodes = svg.querySelectorAll("g.node");
  for (const g of nodes) {
    const id = getNodeIdFromElement(g);
    if (!id) continue;
    const box = g.getBBox();
    const points = [
      { side: "top", x: box.x + box.width / 2, y: box.y - 8 },
      { side: "right", x: box.x + box.width + 8, y: box.y + box.height / 2 },
      { side: "bottom", x: box.x + box.width / 2, y: box.y + box.height + 8 },
      { side: "left", x: box.x - 8, y: box.y + box.height / 2 }
    ];
    for (const p of points) {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("class", "ae-handle");
      c.setAttribute("r", "5");
      c.setAttribute("cx", String(p.x));
      c.setAttribute("cy", String(p.y));
      c.dataset.nodeId = id;
      c.dataset.side = p.side;
      if (state.connectFromNodeId && state.connectFromNodeId === id) {
        c.classList.add("ae-handle-src");
      }
      g.appendChild(c);
    }
  }
}

function renderPropPanel() {
  const inspectorBody = els.inspectorBody || els.inspector;
  if (state.edgeAmbiguous) {
    setInspectorEmptyState(false);
    if (inspectorBody) inspectorBody.innerHTML = "";
    const row = document.createElement("div");
    row.className = "propRow";
    row.textContent = state.edgeAmbiguous.message;
    if (inspectorBody) inspectorBody.appendChild(row);
    setInspectorHeader("Edge", "Ambiguous", "warn");
    updateInspectorState();
    return;
  }
  if (state.selectedNodeIds.size > 1) {
    if (inspectorBody) {
      inspectorBody.innerHTML = "";
      const info = document.createElement("div");
      info.className = "propRow";
      info.textContent = `${state.selectedNodeIds.size} nodes selected`;
      inspectorBody.appendChild(info);

      const selectedIds = new Set(state.selectedNodeIds);
      const selectedNodes = state.model.nodes.filter((n) => selectedIds.has(n.id));
      const anchorNode = selectedNodes[0] || null;
      const applyToSelectedNodes = (fn, dirtyReason) => {
        if (!anchorNode) return;
        applyToNodeOrSelection(anchorNode, fn, dirtyReason);
      };

      const rowShape = document.createElement("div");
      rowShape.className = "propRow";
      const shapeLabel = document.createElement("div");
      shapeLabel.className = "propLabel";
      shapeLabel.textContent = "Shape (batch)";
      const shapeSelect = document.createElement("select");
      shapeSelect.className = "select wide";
      const shapes = [
        { id: "", label: "Default" },
        { id: "rect", label: "Rectangle" },
        { id: "round", label: "Round" },
        { id: "circle", label: "Circle" },
        { id: "cylinder", label: "Cylinder" },
        { id: "diamond", label: "Diamond" },
        { id: "hex", label: "Hex" },
        { id: "parallelogram", label: "Parallelogram" }
      ];
      const shapeValues = new Set(selectedNodes.map((n) => n.shape || ""));
      for (const s of shapes) {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label;
        if (shapeValues.size === 1 && shapeValues.has(s.id)) opt.selected = true;
        shapeSelect.appendChild(opt);
      }
      shapeSelect.addEventListener("change", () => {
        const nextShape = shapeSelect.value || null;
        applyToSelectedNodes((n) => {
          if ((n.shape || null) === nextShape) return false;
          n.shape = nextShape;
          return true;
        }, "node shape changed");
      });
      rowShape.appendChild(shapeLabel);
      rowShape.appendChild(shapeSelect);
      inspectorBody.appendChild(rowShape);

      const rowColor = document.createElement("div");
      rowColor.className = "propRow";
      const colorLabel = document.createElement("div");
      colorLabel.className = "propLabel";
      colorLabel.textContent = "Color (batch)";
      const colorRow = document.createElement("div");
      colorRow.className = "row";
      const palette = [
        { id: "", label: "Default" },
        { id: "accent-blue", label: "Blue" },
        { id: "accent-green", label: "Green" },
        { id: "accent-amber", label: "Amber" },
        { id: "accent-red", label: "Red" }
      ];
      for (const p of palette) {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = p.label;
        btn.addEventListener("click", () => {
          applyToSelectedNodes((n) => {
            const nextClass = p.id || null;
            if ((n.className || null) === nextClass) return false;
            n.className = nextClass;
            return true;
          }, "node class changed");
        });
        colorRow.appendChild(btn);
      }
      rowColor.appendChild(colorLabel);
      rowColor.appendChild(colorRow);
      inspectorBody.appendChild(rowColor);
    }
    setInspectorHeader("Inspector", `${state.selectedNodeIds.size} selected`, "ok");
    setInspectorEmptyState(false);
    updateInspectorState();
    return;
  }
  const target =
    state.selectedNodeId || state.selectedEdgeId
      ? { type: state.selectedNodeId ? "node" : "edge", id: state.selectedNodeId || state.selectedEdgeId, mode: "selected" }
      : state.hoverNodeId || state.hoverEdgeId
        ? { type: state.hoverNodeId ? "node" : "edge", id: state.hoverNodeId || state.hoverEdgeId, mode: "hover" }
        : null;

  if (!target) {
    if (inspectorBody) inspectorBody.textContent = t("inspectorSelectHint");
    setInspectorHeader(t("inspectorTitle"), t("inspectorSelect"), "muted");
    setInspectorEmptyState(true);
    updateInspectorState();
    return;
  }
  setInspectorEmptyState(false);

  const isHover = target.mode === "hover";
  if (inspectorBody) inspectorBody.innerHTML = "";
  if (target.type === "node") {
    setInspectorHeader(`Node: ${target.id}`, isHover ? "Hover preview" : "Selected", isHover ? "info" : "ok");
  } else {
    const edge = state.model.edges.find((e) => e.id === target.id);
    const label = edge ? `Edge: ${edge.from} → ${edge.to}` : `Edge: ${target.id}`;
    setInspectorHeader(label, isHover ? "Hover preview" : "Selected", isHover ? "info" : "ok");
  }

  const actions = document.createElement("div");
  actions.className = "row";
  const btnCenter = document.createElement("button");
  btnCenter.className = "btn";
  btnCenter.textContent = "Center";
  btnCenter.disabled = isHover;
  btnCenter.addEventListener("click", () => centerOnSelected());
  const btnDelete = document.createElement("button");
  btnDelete.className = "btn";
  btnDelete.textContent = "Delete";
  btnDelete.disabled = isHover;
  btnDelete.addEventListener("click", () => deleteSelected());
  const btnCopy = document.createElement("button");
  btnCopy.className = "btn";
  btnCopy.textContent = "Copy ID";
  btnCopy.addEventListener("click", () => navigator.clipboard?.writeText?.(target.id));
  actions.appendChild(btnCenter);
  actions.appendChild(btnDelete);
  actions.appendChild(btnCopy);
  if (inspectorBody) inspectorBody.appendChild(actions);

  if (target.type === "node") {
    const node = state.model.nodes.find((n) => n.id === target.id);
    if (!node) return;
    const rowLabel = document.createElement("div");
    rowLabel.className = "propRow";
    const labelLabel = document.createElement("div");
    labelLabel.className = "propLabel";
    labelLabel.textContent = "Label";
    const labelInput = document.createElement("input");
    labelInput.className = "input wide";
    labelInput.value = node.label || "";
    labelInput.disabled = isHover;
    rowLabel.appendChild(labelLabel);
    rowLabel.appendChild(labelInput);

    const rowComment = document.createElement("div");
    rowComment.className = "propRow";
    const commentLabel = document.createElement("div");
    commentLabel.className = "propLabel";
    commentLabel.textContent = "Comment";
    const commentInput = document.createElement("textarea");
    commentInput.className = "input wide";
    commentInput.rows = 3;
    commentInput.value = node.comment || "";
    commentInput.disabled = isHover;
    rowComment.appendChild(commentLabel);
    rowComment.appendChild(commentInput);

    const rowRole = document.createElement("div");
    rowRole.className = "propRow";
    const roleLabel = document.createElement("div");
    roleLabel.className = "propLabel";
    roleLabel.textContent = "Type";
    const roleSelect = document.createElement("select");
    roleSelect.className = "select wide";
    roleSelect.disabled = isHover;
    for (const [roleId, role] of Object.entries(state.pack.roles)) {
      const opt = document.createElement("option");
      opt.value = roleId;
      opt.textContent = role.label;
      if (roleId === node.role) opt.selected = true;
      roleSelect.appendChild(opt);
    }
    rowRole.appendChild(roleLabel);
    rowRole.appendChild(roleSelect);

    const rowShape = document.createElement("div");
    rowShape.className = "propRow";
    const shapeLabel = document.createElement("div");
    shapeLabel.className = "propLabel";
    shapeLabel.textContent = "Shape";
    const shapeSelect = document.createElement("select");
    shapeSelect.className = "select wide";
    shapeSelect.disabled = isHover;
    const shapes = [
      { id: "", label: "Default" },
      { id: "rect", label: "Rectangle" },
      { id: "round", label: "Round" },
      { id: "circle", label: "Circle" },
      { id: "cylinder", label: "Cylinder" },
      { id: "diamond", label: "Diamond" },
      { id: "hex", label: "Hex" },
      { id: "parallelogram", label: "Parallelogram" }
    ];
    for (const s of shapes) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      if ((node.shape || "") === s.id) opt.selected = true;
      if (!node.shape && !s.id) opt.selected = true;
      shapeSelect.appendChild(opt);
    }
    rowShape.appendChild(shapeLabel);
    rowShape.appendChild(shapeSelect);

    const rowZone = document.createElement("div");
    rowZone.className = "propRow";
    const zoneLabel = document.createElement("div");
    zoneLabel.className = "propLabel";
    zoneLabel.textContent = "Zone";
    const zoneRow = document.createElement("div");
    zoneRow.className = "row";
    const zoneSelect = document.createElement("select");
    zoneSelect.className = "select wide";
    zoneSelect.disabled = isHover;
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "(none)";
    zoneSelect.appendChild(noneOpt);
    for (const b of state.model.boundaries) {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = `${b.label} (${b.id})`;
      if ((node.boundaryId || node.groupId || "") === b.id) opt.selected = true;
      zoneSelect.appendChild(opt);
    }
    const btnNewZone = document.createElement("button");
    btnNewZone.className = "btn";
    btnNewZone.textContent = "New Zone";
    btnNewZone.disabled = isHover;
    zoneRow.appendChild(zoneSelect);
    zoneRow.appendChild(btnNewZone);
    rowZone.appendChild(zoneLabel);
    rowZone.appendChild(zoneRow);

    const rowZoneName = document.createElement("div");
    rowZoneName.className = "propRow";
    const zoneNameLabel = document.createElement("div");
    zoneNameLabel.className = "propLabel";
    zoneNameLabel.textContent = "Zone Name";
    const zoneNameInput = document.createElement("input");
    zoneNameInput.className = "input wide";
    const currentBoundary = state.model.boundaries.find((b) => b.id === (node.boundaryId || node.groupId));
    zoneNameInput.value = currentBoundary?.label || "";
    zoneNameInput.disabled = isHover || !currentBoundary;
    rowZoneName.appendChild(zoneNameLabel);
    rowZoneName.appendChild(zoneNameInput);

    const rowColor = document.createElement("div");
    rowColor.className = "propRow";
    const colorLabel = document.createElement("div");
    colorLabel.className = "propLabel";
    colorLabel.textContent = "Color";
    const colorRow = document.createElement("div");
    colorRow.className = "row";
    const palette = [
      { id: "", label: "Default" },
      { id: "accent-blue", label: "Blue" },
      { id: "accent-green", label: "Green" },
      { id: "accent-amber", label: "Amber" },
      { id: "accent-red", label: "Red" }
    ];
    for (const p of palette) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = p.label;
      btn.disabled = isHover;
      btn.addEventListener("click", () => {
        const nextClass = p.id || null;
        applyToNodeOrSelection(node, (n) => {
          if ((n.className || null) === nextClass) return false;
          n.className = nextClass;
          return true;
        }, "node class changed");
      });
      colorRow.appendChild(btn);
    }
    rowColor.appendChild(colorLabel);
    rowColor.appendChild(colorRow);

    const rowCustomStyle = document.createElement("div");
    rowCustomStyle.className = "propRow";
    const customLabel = document.createElement("div");
    customLabel.className = "propLabel";
    customLabel.textContent = "Custom Style";
    const customWrap = document.createElement("div");
    customWrap.className = "row";
    const fillInput = document.createElement("input");
    fillInput.className = "input";
    fillInput.placeholder = "fill #rrggbb";
    fillInput.value = node?.style?.fill || "";
    fillInput.disabled = isHover;
    const strokeInput = document.createElement("input");
    strokeInput.className = "input";
    strokeInput.placeholder = "stroke #rrggbb";
    strokeInput.value = node?.style?.stroke || "";
    strokeInput.disabled = isHover;
    const textColorInput = document.createElement("input");
    textColorInput.className = "input";
    textColorInput.placeholder = "text #rrggbb";
    textColorInput.value = node?.style?.color || "";
    textColorInput.disabled = isHover;
    const resetStyleBtn = document.createElement("button");
    resetStyleBtn.className = "btn";
    resetStyleBtn.textContent = "Reset";
    resetStyleBtn.disabled = isHover;
    customWrap.appendChild(fillInput);
    customWrap.appendChild(strokeInput);
    customWrap.appendChild(textColorInput);
    customWrap.appendChild(resetStyleBtn);
    rowCustomStyle.appendChild(customLabel);
    rowCustomStyle.appendChild(customWrap);

    const rowPinned = document.createElement("div");
    rowPinned.className = "propRow";
    const pinnedLabel = document.createElement("div");
    pinnedLabel.className = "propLabel";
    pinnedLabel.textContent = "Pinned";
    const pinBtn = document.createElement("button");
    pinBtn.className = "btn";
    pinBtn.textContent = node.pinned ? "Unpin" : "Pin";
    pinBtn.disabled = isHover;
    pinBtn.addEventListener("click", () => {
      node.pinned = !node.pinned;
      if (!node.pinned) node.position = null;
      renderFromModel();
    });
    rowPinned.appendChild(pinnedLabel);
    rowPinned.appendChild(pinBtn);

    if (inspectorBody) {
      inspectorBody.appendChild(rowLabel);
      inspectorBody.appendChild(rowComment);
      inspectorBody.appendChild(rowRole);
      inspectorBody.appendChild(rowShape);
      inspectorBody.appendChild(rowZone);
      inspectorBody.appendChild(rowZoneName);
      inspectorBody.appendChild(rowColor);
      inspectorBody.appendChild(rowCustomStyle);
      inspectorBody.appendChild(rowPinned);
    }

    const update = debounce(() => {
      const shapeVal = shapeSelect.value || null;
      applyToNodeOrSelection(node, (n) => {
        let changed = false;
        if (n === node) {
          if (n.label !== labelInput.value) {
            n.label = labelInput.value;
            changed = true;
          }
          if (n.comment !== commentInput.value) {
            n.comment = commentInput.value;
            changed = true;
          }
          if (n.role !== roleSelect.value) {
            n.role = roleSelect.value;
            changed = true;
          }
        }
        if ((n.shape || null) !== shapeVal) {
          n.shape = shapeVal || null;
          changed = true;
        }
        return changed;
      }, "node property changed");
    }, 300);
    labelInput.addEventListener("input", update);
    commentInput.addEventListener("input", update);
    roleSelect.addEventListener("change", update);
    shapeSelect.addEventListener("change", update);

    const applyNodeStyle = debounce(() => {
      const fill = normalizeHexColor(fillInput.value);
      const stroke = normalizeHexColor(strokeInput.value);
      const color = normalizeHexColor(textColorInput.value);
      if (fillInput.value && !fill) fillInput.classList.add("invalid");
      else fillInput.classList.remove("invalid");
      if (strokeInput.value && !stroke) strokeInput.classList.add("invalid");
      else strokeInput.classList.remove("invalid");
      if (textColorInput.value && !color) textColorInput.classList.add("invalid");
      else textColorInput.classList.remove("invalid");
      node.style = { ...(node.style || {}) };
      if (fill) node.style.fill = fill;
      else delete node.style.fill;
      if (stroke) node.style.stroke = stroke;
      else delete node.style.stroke;
      if (color) node.style.color = color;
      else delete node.style.color;
      if (!Object.keys(node.style).length) delete node.style;
      renderFromModel();
      pushHistory();
      markModelDirty("node style changed");
    }, 250);
    fillInput.addEventListener("input", applyNodeStyle);
    strokeInput.addEventListener("input", applyNodeStyle);
    textColorInput.addEventListener("input", applyNodeStyle);
    resetStyleBtn.addEventListener("click", () => {
      delete node.style;
      fillInput.value = "";
      strokeInput.value = "";
      textColorInput.value = "";
      fillInput.classList.remove("invalid");
      strokeInput.classList.remove("invalid");
      textColorInput.classList.remove("invalid");
      renderFromModel();
      pushHistory();
      markModelDirty("node style reset");
    });

    zoneSelect.addEventListener("change", () => {
      const bid = zoneSelect.value || null;
      node.boundaryId = bid;
      node.groupId = bid;
      const b = bid ? state.model.boundaries.find((x) => x.id === bid) : null;
      node.groupName = b?.label || null;
      renderFromModel();
      pushHistory();
      markModelDirty("zone assignment changed");
    });

    btnNewZone.addEventListener("click", async () => {
      const label = await requestTextInput("Zone name", "New Zone");
      if (!label) return;
      const roleId = "vpc";
      const ids = new Set(state.model.boundaries.map((b) => b.id));
      const id = nextId(boundaryPrefix(roleId), ids);
      state.model.boundaries.push({ id, label: label.trim(), role: roleId });
      node.boundaryId = id;
      node.groupId = id;
      node.groupName = label.trim();
      renderFromModel();
      pushHistory();
      markModelDirty("zone created");
    });

    zoneNameInput.addEventListener(
      "input",
      debounce(() => {
        const bid = node.boundaryId || node.groupId;
        if (!bid) return;
        const b = state.model.boundaries.find((x) => x.id === bid);
        if (!b) return;
        b.label = zoneNameInput.value || b.label;
        node.groupName = b.label;
        renderFromModel();
        pushHistory();
        markModelDirty("zone name changed");
      }, 300)
    );
  } else {
    const edge = state.model.edges.find((e) => e.id === target.id);
    if (!edge) return;
    const rowLabel = document.createElement("div");
    rowLabel.className = "propRow";
    const labelLabel = document.createElement("div");
    labelLabel.className = "propLabel";
    labelLabel.textContent = "Label";
    const labelInput = document.createElement("input");
    labelInput.className = "input wide";
    labelInput.value = edge.label || "";
    labelInput.disabled = isHover;
    rowLabel.appendChild(labelLabel);
    rowLabel.appendChild(labelInput);

    const rowKind = document.createElement("div");
    rowKind.className = "propRow";
    const kindLabel = document.createElement("div");
    kindLabel.className = "propLabel";
    kindLabel.textContent = "Kind";
    const kindSelect = document.createElement("select");
    kindSelect.className = "select wide";
    kindSelect.disabled = isHover;
    for (const [kindId, kind] of Object.entries(state.pack.edgeKinds)) {
      const opt = document.createElement("option");
      opt.value = kindId;
      opt.textContent = kind.label;
      if (kindId === edge.kind) opt.selected = true;
      kindSelect.appendChild(opt);
    }
    rowKind.appendChild(kindLabel);
    rowKind.appendChild(kindSelect);

    const rowEdgeStyle = document.createElement("div");
    rowEdgeStyle.className = "propRow";
    const edgeStyleLabel = document.createElement("div");
    edgeStyleLabel.className = "propLabel";
    edgeStyleLabel.textContent = "Style";
    const edgeStyleWrap = document.createElement("div");
    edgeStyleWrap.className = "row";
    const edgeColor = document.createElement("input");
    edgeColor.className = "input";
    edgeColor.placeholder = "color #rrggbb";
    edgeColor.value = edge?.style?.color || "";
    edgeColor.disabled = isHover;
    const edgeWidth = document.createElement("input");
    edgeWidth.className = "input";
    edgeWidth.type = "number";
    edgeWidth.min = "0.5";
    edgeWidth.max = "12";
    edgeWidth.step = "0.5";
    edgeWidth.placeholder = "width";
    edgeWidth.value = edge?.style?.width != null ? String(edge.style.width) : "";
    edgeWidth.disabled = isHover;
    const edgeDashed = document.createElement("label");
    edgeDashed.className = "toggle";
    const edgeDashedInput = document.createElement("input");
    edgeDashedInput.type = "checkbox";
    edgeDashedInput.checked = edge?.style?.dashed === true;
    edgeDashedInput.disabled = isHover;
    const edgeDashedText = document.createElement("span");
    edgeDashedText.textContent = "Dashed";
    edgeDashed.appendChild(edgeDashedInput);
    edgeDashed.appendChild(edgeDashedText);
    const edgeResetBtn = document.createElement("button");
    edgeResetBtn.className = "btn";
    edgeResetBtn.textContent = "Reset";
    edgeResetBtn.disabled = isHover;
    edgeStyleWrap.appendChild(edgeColor);
    edgeStyleWrap.appendChild(edgeWidth);
    edgeStyleWrap.appendChild(edgeDashed);
    edgeStyleWrap.appendChild(edgeResetBtn);
    rowEdgeStyle.appendChild(edgeStyleLabel);
    rowEdgeStyle.appendChild(edgeStyleWrap);

    if (inspectorBody) {
      inspectorBody.appendChild(rowLabel);
      inspectorBody.appendChild(rowKind);
      inspectorBody.appendChild(rowEdgeStyle);
    }

    const update = debounce(() => {
      edge.label = labelInput.value;
      edge.kind = kindSelect.value;
      renderFromModel();
      pushHistory();
      markModelDirty("edge property changed");
    }, 300);
    labelInput.addEventListener("input", update);
    kindSelect.addEventListener("change", update);
    const applyEdgeStyle = debounce(() => {
      const color = normalizeHexColor(edgeColor.value);
      const width = normalizeEdgeWidth(edgeWidth.value);
      if (edgeColor.value && !color) edgeColor.classList.add("invalid");
      else edgeColor.classList.remove("invalid");
      if (edgeWidth.value && !width) edgeWidth.classList.add("invalid");
      else edgeWidth.classList.remove("invalid");
      edge.style = { ...(edge.style || {}) };
      if (color) edge.style.color = color;
      else delete edge.style.color;
      if (width) edge.style.width = width;
      else delete edge.style.width;
      if (edgeDashedInput.checked) edge.style.dashed = true;
      else delete edge.style.dashed;
      if (!Object.keys(edge.style).length) delete edge.style;
      renderFromModel();
      pushHistory();
      markModelDirty("edge style changed");
    }, 250);
    edgeColor.addEventListener("input", applyEdgeStyle);
    edgeWidth.addEventListener("input", applyEdgeStyle);
    edgeDashedInput.addEventListener("change", applyEdgeStyle);
    edgeResetBtn.addEventListener("click", () => {
      delete edge.style;
      edgeColor.value = "";
      edgeWidth.value = "";
      edgeDashedInput.checked = false;
      edgeColor.classList.remove("invalid");
      edgeWidth.classList.remove("invalid");
      renderFromModel();
      pushHistory();
      markModelDirty("edge style reset");
    });
  }
  updateInspectorState();
}

function pushHistory() {
  const snapshot = JSON.stringify(state.model);
  if (state.historyIndex >= 0 && state.history[state.historyIndex] === snapshot) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
}

function undoModel() {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  state.model = JSON.parse(state.history[state.historyIndex]);
  renderFromModel({ preserveWarnings: true });
}

function redoModel() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  state.model = JSON.parse(state.history[state.historyIndex]);
  renderFromModel({ preserveWarnings: true });
}

function deleteSelected() {
  if (state.connectMode) return;
  if (state.selectedNodeIds.size > 0) {
    const selected = getUnlockedSelectedNodeIds();
    if (!selected.size) return;
    state.model.nodes = state.model.nodes.filter((n) => !selected.has(n.id));
    state.model.edges = state.model.edges.filter((e) => !selected.has(e.from) && !selected.has(e.to));
    clearSelectionState();
    pushHistory();
    renderFromModel();
    return;
  }
  if (state.selectedNodeId) {
    const id = state.selectedNodeId;
    if (isNodeLocked(id)) return;
    state.model.nodes = state.model.nodes.filter((n) => n.id !== id);
    state.model.edges = state.model.edges.filter((e) => e.from !== id && e.to !== id);
    clearSelectionState();
    pushHistory();
    renderFromModel();
    return;
  }
  if (state.selectedEdgeId) {
    const id = state.selectedEdgeId;
    state.model.edges = state.model.edges.filter((e) => e.id !== id);
    clearSelectionState();
    pushHistory();
    renderFromModel();
  }
}

function centerOnSelected() {
  const svg = els.preview.querySelector("svg");
  if (!svg) return;
  const wrap = $("previewWrap");
  if (!wrap) return;
  let target = null;
  if (state.selectedNodeId) {
    target = Array.from(svg.querySelectorAll("g.node")).find(
      (g) => getNodeIdFromElement(g) === state.selectedNodeId
    );
  } else if (state.selectedEdgeId) {
    target = Array.from(svg.querySelectorAll("g.edgePath")).find(
      (g) => g.dataset.aeEdgeId === state.selectedEdgeId
    );
  }
  if (!target) return;
  const bbox = target.getBBox();
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const wrapRect = wrap.getBoundingClientRect();
  const desiredX = wrapRect.width / 2;
  const desiredY = wrapRect.height / 2;
  state.panX = desiredX - cx * state.zoom;
  state.panY = desiredY - cy * state.zoom;
  applyZoom();
}

function selectNodeById(id) {
  if (id && isNodeLocked(id)) return;
  state.selectedNodeIds.clear();
  if (id) state.selectedNodeIds.add(id);
  state.selectedNodeId = id;
  state.selectedEdgeId = null;
  state.edgeAmbiguous = null;
  renderPropPanel();
  const svg = els.preview.querySelector("svg");
  if (svg) applySelection(svg);
  focusListItem(els.nodeList, id);
}

function selectEdgeById(id) {
  state.selectedEdgeId = id;
  state.selectedNodeId = null;
  state.selectedNodeIds.clear();
  state.edgeAmbiguous = null;
  renderPropPanel();
  const svg = els.preview.querySelector("svg");
  if (svg) applySelection(svg);
  focusListItem(els.edgeList, id);
}

function attachNodeInteractions(svg) {
  const nodes = svg.querySelectorAll("g.node");
  for (const g of nodes) {
    g.style.cursor = "default";
    g.addEventListener("mouseover", (evt) => {
      const id = getNodeIdFromElement(evt.target);
      if (!id) return;
      state.hoverNodeId = id;
      state.hoverEdgeId = null;
      renderPropPanel();
      applySelection(svg);
      highlightList();
    });
    g.addEventListener("mouseout", () => {
      state.hoverNodeId = null;
      renderPropPanel();
      applySelection(svg);
      highlightList();
    });
    g.addEventListener("click", (evt) => {
      if (suppressNextCanvasClick) {
        suppressNextCanvasClick = false;
        return;
      }
      const id = getNodeIdFromElement(evt.target);
      if (!id) return;
      if (isNodeLocked(id)) return;
      if (evt.shiftKey && !state.connectMode) {
        if (state.selectedNodeIds.has(id)) {
          state.selectedNodeIds.delete(id);
        } else {
          state.selectedNodeIds.add(id);
        }
        state.selectedNodeId = state.selectedNodeIds.size === 1 ? Array.from(state.selectedNodeIds)[0] : null;
        state.selectedEdgeId = null;
        state.edgeAmbiguous = null;
        renderPropPanel();
        applySelection(svg);
        highlightList();
        return;
      }
      selectNodeById(id);
    });
    g.addEventListener("dblclick", async (evt) => {
      const id = getNodeIdFromElement(evt.target);
      if (!id) return;
      const node = state.model.nodes.find((n) => n.id === id);
      const next = await requestTextInput("Node label", node?.label || id);
      if (next == null) return;
      node.label = next;
      selectNodeById(id);
      renderFromModel();
    });
  }

  const edgePathGroups = Array.from(svg.querySelectorAll("g.edgePath"));
  const edgePathFallback = Array.from(svg.querySelectorAll("path[id^='L-']"));
  const edgePaths = edgePathGroups.length ? edgePathGroups : edgePathFallback;
  const edgeLabels = svg.querySelectorAll("g.edgeLabel");
  const edgePathMap = new Map();
  const edgeLabelMap = new Map();
  const mappedEdgeIds = new Set();
  const candidatesByKey = new Map();
  for (const edge of state.model.edges) {
    const key = `${edge.from}|${edge.to}|${edge.label || ""}`;
    if (!candidatesByKey.has(key)) candidatesByKey.set(key, []);
    candidatesByKey.get(key).push(edge);
  }

  const candidatesByPair = new Map();
  for (const edge of state.model.edges) {
    const key = `${edge.from}|${edge.to}`;
    if (!candidatesByPair.has(key)) candidatesByPair.set(key, []);
    candidatesByPair.get(key).push(edge);
  }
  const pairCursor = new Map();

  const parseEdgeSignature = (g, idx) => {
    let from = null;
    let to = null;
    let label = "";
    const title = g.querySelector?.("title")?.textContent || "";
    const mLabel = title.match(/^(.+?)\s*[-.=]+>.*?\|(.+?)\|\s*(.+)$/);
    if (mLabel) {
      from = mLabel[1].trim();
      label = mLabel[2].trim();
      to = mLabel[3].trim();
    } else {
      const m = title.match(/^(.+?)\s*[-.=]+>\s*(.+)$/);
      if (m) {
        from = m[1].trim();
        to = m[2].trim();
      }
    }
    if (!label && edgeLabels[idx]) {
      const t = edgeLabels[idx].querySelector("text");
      if (t && t.textContent) label = t.textContent.trim();
    }
    if ((!from || !to) && g.getAttribute) {
      const id = g.getAttribute("id") || "";
      const idMatch = id.match(/^L-([^\\-]+)-([^\\-]+)/);
      if (idMatch) {
        if (state.model.nodes.find((n) => n.id === idMatch[1])) from = idMatch[1];
        if (state.model.nodes.find((n) => n.id === idMatch[2])) to = idMatch[2];
      }
    }
    return { from, to, label };
  };

  const openEdgeLabelEditor = async (edgeId) => {
    const edge = edgeId ? state.model.edges.find((e) => e.id === edgeId) : null;
    if (!edge) return;
    const next = await requestTextInput("Edge label", edge.label || "");
    if (next == null) return;
    edge.label = next;
    selectEdgeById(edge.id);
    renderFromModel();
    pushHistory();
    markModelDirty("edge label changed");
  };

  edgePaths.forEach((g, idx) => {
    const sig = parseEdgeSignature(g, idx);
    let edge = null;
    const rawId = g.getAttribute?.("id") || "";
    const idPair = rawId.match(/^L-([^\\-]+)-([^\\-]+)/);
    if (idPair) {
      const pairKey = `${idPair[1]}|${idPair[2]}`;
      const pair = candidatesByPair.get(pairKey) || [];
      if (pair.length === 1) {
        edge = pair[0];
      } else if (pair.length > 1) {
        const cursor = pairCursor.get(pairKey) || 0;
        edge = pair[Math.min(cursor, pair.length - 1)] || null;
        pairCursor.set(pairKey, cursor + 1);
      }
    }
    if (sig.from && sig.to) {
      const key = `${sig.from}|${sig.to}|${sig.label || ""}`;
      const exact = candidatesByKey.get(key) || [];
      if (exact.length === 1) edge = exact[0];
      if (!edge) {
        const pairKey = `${sig.from}|${sig.to}`;
        const pair = candidatesByPair.get(pairKey) || [];
        if (pair.length === 1) {
          edge = pair[0];
        } else if (pair.length > 1) {
          const cursor = pairCursor.get(pairKey) || 0;
          edge = pair[Math.min(cursor, pair.length - 1)] || null;
          pairCursor.set(pairKey, cursor + 1);
        }
      }
    }
    if (!edge && state.model.edges[idx] && !mappedEdgeIds.has(state.model.edges[idx].id)) {
      edge = state.model.edges[idx];
    }
    if (!edge) {
      edge = state.model.edges.find((e) => !mappedEdgeIds.has(e.id)) || null;
    }
    if (edge) {
      mappedEdgeIds.add(edge.id);
      g.dataset.aeEdgeId = edge.id;
      g.querySelectorAll?.("*").forEach((el) => {
        el.dataset.aeEdgeId = edge.id;
      });
      edgePathMap.set(edge.id, g);
      const labelG = edgeLabels[idx];
      if (labelG) {
        labelG.dataset.aeEdgeId = edge.id;
        labelG.querySelectorAll("*").forEach((el) => {
          el.dataset.aeEdgeId = edge.id;
        });
        edgeLabelMap.set(edge.id, labelG);
        labelG.addEventListener("dblclick", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          void openEdgeLabelEditor(edge.id);
        });
      }
      g.addEventListener("dblclick", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        void openEdgeLabelEditor(edge.id);
      });
    } else {
      g.dataset.aeEdgeAmbiguous = "1";
    }
    g.style.cursor = "default";
    g.addEventListener("mouseover", () => {
      if (g.dataset.aeEdgeId) {
        state.edgeAmbiguous = null;
        state.hoverEdgeId = g.dataset.aeEdgeId;
        state.hoverNodeId = null;
      } else {
        state.hoverEdgeId = null;
        state.edgeAmbiguous = { message: "Edge mapping ambiguous. Editing disabled." };
      }
      renderPropPanel();
      applySelection(svg);
      highlightList();
    });
    g.addEventListener("mouseout", () => {
      state.hoverEdgeId = null;
      state.edgeAmbiguous = null;
      renderPropPanel();
      applySelection(svg);
      highlightList();
    });
    g.addEventListener("click", () => {
      if (suppressNextCanvasClick) {
        suppressNextCanvasClick = false;
        return;
      }
      if (g.dataset.aeEdgeId) {
        state.edgeAmbiguous = null;
        selectEdgeById(g.dataset.aeEdgeId);
      } else {
        state.edgeAmbiguous = { message: "Edge mapping ambiguous. Editing disabled." };
        renderPropPanel();
      }
    });
  });

  const resolveEdgeIdFromEvent = (evt) => {
    const path = typeof evt.composedPath === "function" ? evt.composedPath() : [];
    for (const node of path) {
      if (!node || node === svg || !node.dataset) continue;
      if (node.dataset.aeEdgeId) return node.dataset.aeEdgeId;
      if (node.getAttribute) {
        const rawId = node.getAttribute("id") || "";
        const m = rawId.match(/^L-([^\\-]+)-([^\\-]+)/);
        if (m) {
          const hit = state.model.edges.find((e) => e.from === m[1] && e.to === m[2]);
          if (hit) return hit.id;
        }
      }
    }
    const host = evt.target?.closest?.("g.edgePath, g.edgeLabel");
    return host?.dataset?.aeEdgeId || null;
  };

  svg.addEventListener("dblclick", (evt) => {
    const edgeId = resolveEdgeIdFromEvent(evt);
    if (!edgeId) return;
    evt.preventDefault();
    evt.stopPropagation();
    void openEdgeLabelEditor(edgeId);
  });

  svg.addEventListener("click", (evt) => {
    if (suppressNextCanvasClick) {
      suppressNextCanvasClick = false;
      return;
    }
    const target = evt.target;
    if (!(target instanceof Element)) return;
    if (target.closest("g.node, g.edgePath, g.edgeLabel, circle.ae-handle")) return;
    clearSelectionState();
    renderPropPanel();
    applySelection(svg);
    highlightList();
  });

  let dragNode = null;
  let marquee = null;
  let marqueeCandidate = null;
  let suppressNextCanvasClick = false;
  const DRAG_THRESHOLD_PX = 2;
  const MARQUEE_START_THRESHOLD_PX = 5;
  let dragOverlayLines = [];
  const liveMutatedPaths = new Map();
  const liveMutatedLabels = new Map();
  const getNodeCenter = (nodeId) => {
    const nodeGroup = Array.from(svg.querySelectorAll("g.node")).find((x) => getNodeIdFromGroup(x) === nodeId);
    if (!nodeGroup) return null;
    const box = nodeGroup.getBBox();
    const local = svg.createSVGPoint();
    local.x = box.x + box.width / 2;
    local.y = box.y + box.height / 2;
    const ctm = nodeGroup.getCTM();
    if (!ctm) return null;
    const global = local.matrixTransform(ctm);
    return { x: global.x, y: global.y };
  };

  const clearDragOverlay = () => {
    for (const line of dragOverlayLines) line.remove();
    dragOverlayLines = [];
  };

  const toLocalPoint = (el, pt) => {
    try {
      const ctm = el.getCTM();
      if (!ctm) return pt;
      const inv = ctm.inverse();
      const sp = svg.createSVGPoint();
      sp.x = pt.x;
      sp.y = pt.y;
      const lp = sp.matrixTransform(inv);
      return { x: lp.x, y: lp.y };
    } catch {
      return pt;
    }
  };

  const setPathDForEndpoints = (pathEl, fromGlobal, toGlobal) => {
    const lf = toLocalPoint(pathEl, fromGlobal);
    const lt = toLocalPoint(pathEl, toGlobal);
    pathEl.setAttribute("transform", "");
    pathEl.setAttribute("d", `M ${lf.x},${lf.y} L ${lt.x},${lt.y}`);
  };

  const moveEdgeLabelToPathMid = (edgeId, pathEl, { trackRestore = false } = {}) => {
    const labelG = edgeLabelMap.get(edgeId);
    if (!labelG || !pathEl?.getPointAtLength) return;
    if (trackRestore && !liveMutatedLabels.has(labelG)) {
      liveMutatedLabels.set(labelG, labelG.getAttribute("transform") || "");
    }
    const len = pathEl.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return;
    const mid = pathEl.getPointAtLength(len / 2);
    const ctm = pathEl.getCTM();
    if (!ctm) return;
    const lp = svg.createSVGPoint();
    lp.x = mid.x;
    lp.y = mid.y;
    const global = lp.matrixTransform(ctm);
    const baseSpace = labelG.parentNode?.getCTM ? labelG.parentNode : labelG;
    const localMid = toLocalPoint(baseSpace, { x: global.x, y: global.y });
    labelG.setAttribute("transform", `translate(${localMid.x},${localMid.y})`);
  };

  const updateConnectedEdgesLive = (nodeId) => {
    const connected = state.model.edges.filter((e) => e.from === nodeId || e.to === nodeId);
    for (const edge of connected) {
      const host = edgePathMap.get(edge.id);
      if (!host) continue;
      const from = getNodeCenter(edge.from);
      const to = getNodeCenter(edge.to);
      if (!from || !to) continue;
      const paths =
        host.tagName?.toLowerCase() === "path" ? [host] : Array.from(host.querySelectorAll("path"));
      for (const p of paths) {
        if (!liveMutatedPaths.has(p)) {
          liveMutatedPaths.set(p, {
            d: p.getAttribute("d") || "",
            transform: p.getAttribute("transform") || ""
          });
        }
        setPathDForEndpoints(p, from, to);
      }
      if (paths[0]) {
        moveEdgeLabelToPathMid(edge.id, paths[0], { trackRestore: true });
      }
    }
  };

  const restoreLiveMutations = () => {
    for (const [p, meta] of liveMutatedPaths.entries()) {
      if (!p?.isConnected) continue;
      p.setAttribute("d", meta?.d || "");
      p.setAttribute("transform", meta?.transform || "");
    }
    for (const [g, t] of liveMutatedLabels.entries()) {
      if (g?.isConnected) g.setAttribute("transform", t || "");
    }
    liveMutatedPaths.clear();
    liveMutatedLabels.clear();
  };

  const syncPinnedNodeEdges = () => {
    const pinned = new Set(
      (state.model.nodes || [])
        .filter((n) => n?.pinned)
        .map((n) => n.id)
    );
    if (!pinned.size) return;
    for (const edge of state.model.edges || []) {
      if (!pinned.has(edge.from) && !pinned.has(edge.to)) continue;
      const host = edgePathMap.get(edge.id);
      if (!host) continue;
      const from = getNodeCenter(edge.from);
      const to = getNodeCenter(edge.to);
      if (!from || !to) continue;
      const paths =
        host.tagName?.toLowerCase() === "path" ? [host] : Array.from(host.querySelectorAll("path"));
      for (const p of paths) {
        setPathDForEndpoints(p, from, to);
      }
      if (paths[0]) {
        moveEdgeLabelToPathMid(edge.id, paths[0], { trackRestore: false });
      }
    }
  };
  syncPinnedNodeEdges();

  const updateDragOverlay = () => {
    if (!dragNode?.active) return;
    clearDragOverlay();
    const connected = state.model.edges.filter((e) => e.from === dragNode.id || e.to === dragNode.id);
    for (const edge of connected) {
      const from = getNodeCenter(edge.from);
      const to = getNodeCenter(edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "ae-temp-edge");
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
      svg.appendChild(line);
      dragOverlayLines.push(line);
    }
  };

  const intersects = (a, b) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const clearMarquee = () => {
    if (marquee?.rect?.isConnected) marquee.rect.remove();
    marquee = null;
  };

  const beginMarqueeSelection = (evt, candidate) => {
    const start = clientToSvg(svg, candidate.startClientX, candidate.startClientY);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "ae-selection-box");
    rect.setAttribute("x", String(start.x));
    rect.setAttribute("y", String(start.y));
    rect.setAttribute("width", "0");
    rect.setAttribute("height", "0");
    rect.setAttribute("pointer-events", "none");
    svg.appendChild(rect);
    marquee = {
      pointerId: candidate.pointerId,
      startClientX: candidate.startClientX,
      startClientY: candidate.startClientY,
      startSvgX: start.x,
      startSvgY: start.y,
      active: true,
      shiftAdd: !!candidate.shiftAdd,
      rect
    };
    marqueeCandidate = null;
    svg.setPointerCapture(evt.pointerId);
    evt.preventDefault();
    evt.stopPropagation();
  };

  svg.addEventListener("pointerdown", (evt) => {
    if (suppressNextCanvasClick) suppressNextCanvasClick = false;
    if (evt.button !== 0) return;
    const handle = evt.target.closest("circle.ae-handle");
    if (state.connectMode && handle) {
      evt.preventDefault();
      evt.stopPropagation();
      const fromId = handle.dataset.nodeId;
      if (!fromId) return;
      if (!state.connectFromNodeId) {
        state.connectFromNodeId = fromId;
        selectNodeById(fromId);
        applyConnectHandles(svg);
        return;
      }
      if (state.connectFromNodeId === fromId) {
        state.connectFromNodeId = null;
        applyConnectHandles(svg);
        return;
      }
      if (state.selectedEdgeId) {
        const edge = state.model.edges.find((e) => e.id === state.selectedEdgeId);
        if (edge) {
          edge.from = state.connectFromNodeId;
          edge.to = fromId;
          pushHistory();
          renderFromModel();
          markModelDirty("edge rewired");
        }
      } else {
        addEdgeByNodes(state.connectFromNodeId, fromId);
      }
      state.connectFromNodeId = null;
      return;
    }
    if (state.connectMode) {
      // In connect mode, only connector-handle clicks are used for edge creation.
      return;
    }
    const g = evt.target.closest("g.node");
    if (!g) {
      const blockedHandle = evt.target.closest("circle.ae-handle");
      if (blockedHandle) return;
      marqueeCandidate = {
        pointerId: evt.pointerId,
        startClientX: evt.clientX,
        startClientY: evt.clientY,
        shiftAdd: !!evt.shiftKey
      };
      return;
    }
    const id = getNodeIdFromElement(g);
    const node = state.model.nodes.find((n) => n.id === id);
    if (!node) return;
    if (node.locked) return;
    const selectedIds =
      state.selectedNodeIds.size > 1 && state.selectedNodeIds.has(id)
        ? Array.from(getUnlockedSelectedNodeIds())
        : [id];
    const nodeGroups = new Map();
    for (const gNode of svg.querySelectorAll("g.node")) {
      const gid = getNodeIdFromGroup(gNode);
      if (gid) nodeGroups.set(gid, gNode);
    }
    const items = [];
    for (const sid of selectedIds) {
      const sNode = state.model.nodes.find((n) => n.id === sid);
      const sGroup = nodeGroups.get(sid);
      if (!sNode || !sGroup) continue;
      const offset = getPinnedOffset(sNode);
      const currentTranslate = parseTranslate(sGroup.getAttribute("transform"));
      const baseX = parseFloat(sGroup.dataset.baseX || String(currentTranslate.x - offset.x));
      const baseY = parseFloat(sGroup.dataset.baseY || String(currentTranslate.y - offset.y));
      items.push({
        id: sid,
        node: sNode,
        g: sGroup,
        startPos: { ...offset },
        startTranslateX: currentTranslate.x,
        startTranslateY: currentTranslate.y,
        baseX,
        baseY
      });
    }
    if (!items.length) return;
    const startPt = clientToSvg(svg, evt.clientX, evt.clientY);
    dragNode = {
      g,
      id,
      node,
      items,
      pointerId: evt.pointerId,
      startClientX: evt.clientX,
      startClientY: evt.clientY,
      lastClientX: evt.clientX,
      lastClientY: evt.clientY,
      startPos: items[0]?.startPos || { x: 0, y: 0 },
      startSvgX: startPt.x,
      startSvgY: startPt.y,
      active: false,
      multi: items.length > 1
    };
    g.setPointerCapture(evt.pointerId);
    evt.preventDefault();
    evt.stopPropagation();
  });

  svg.addEventListener("pointermove", (evt) => {
    if (marqueeCandidate && evt.pointerId === marqueeCandidate.pointerId) {
      const dxPx = evt.clientX - marqueeCandidate.startClientX;
      const dyPx = evt.clientY - marqueeCandidate.startClientY;
      if (Math.hypot(dxPx, dyPx) >= MARQUEE_START_THRESHOLD_PX) {
        beginMarqueeSelection(evt, marqueeCandidate);
      }
      return;
    }
    if (marquee && evt.pointerId === marquee.pointerId) {
      const pt = clientToSvg(svg, evt.clientX, evt.clientY);
      const x = Math.min(marquee.startSvgX, pt.x);
      const y = Math.min(marquee.startSvgY, pt.y);
      const w = Math.abs(pt.x - marquee.startSvgX);
      const h = Math.abs(pt.y - marquee.startSvgY);
      marquee.rect.setAttribute("x", String(x));
      marquee.rect.setAttribute("y", String(y));
      marquee.rect.setAttribute("width", String(w));
      marquee.rect.setAttribute("height", String(h));
      return;
    }
    if (!dragNode) return;
    if (evt.pointerId !== dragNode.pointerId) return;
    dragNode.lastClientX = evt.clientX;
    dragNode.lastClientY = evt.clientY;

    if (!dragNode.active) {
      const dxPx = evt.clientX - dragNode.startClientX;
      const dyPx = evt.clientY - dragNode.startClientY;
      if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      dragNode.active = true;
      devLog("drag:start", {
        nodeId: dragNode.id,
        pinnedOffset: dragNode.startPos,
        syncRev: state.syncRev
      });
    }

    const pt = clientToSvg(svg, dragNode.lastClientX, dragNode.lastClientY);
    const deltaX = pt.x - dragNode.startSvgX;
    const deltaY = pt.y - dragNode.startSvgY;
    for (const item of dragNode.items) {
      const targetX = item.startTranslateX + deltaX;
      const targetY = item.startTranslateY + deltaY;
      const next = { x: targetX - item.baseX, y: targetY - item.baseY };
      setPinnedOffset(item.node, next);
      setNodeTransform(item.g, targetX, targetY);
      updateConnectedEdgesLive(item.id);
    }
    updateDragOverlay();
  });

  svg.addEventListener("pointerup", (evt) => {
    if (marqueeCandidate && evt.pointerId === marqueeCandidate.pointerId) {
      marqueeCandidate = null;
      return;
    }
    if (marquee && evt.pointerId === marquee.pointerId) {
      const x = parseFloat(marquee.rect.getAttribute("x") || "0");
      const y = parseFloat(marquee.rect.getAttribute("y") || "0");
      const w = parseFloat(marquee.rect.getAttribute("width") || "0");
      const h = parseFloat(marquee.rect.getAttribute("height") || "0");
      const box = { x, y, w, h };
      const nextSelected = marquee.shiftAdd ? new Set(state.selectedNodeIds) : new Set();
      for (const g of svg.querySelectorAll("g.node")) {
        const id = getNodeIdFromElement(g);
        if (!id) continue;
        if (isNodeLocked(id)) continue;
        const nb = getNodeBBoxInSvgSpace(g);
        if (!nb) continue;
        if (intersects(box, nb)) nextSelected.add(id);
      }
      state.selectedNodeIds = nextSelected;
      state.selectedNodeId = state.selectedNodeIds.size === 1 ? Array.from(state.selectedNodeIds)[0] : null;
      state.selectedEdgeId = null;
      state.edgeAmbiguous = null;
      renderPropPanel();
      applySelection(svg);
      highlightList();
      suppressNextCanvasClick = true;
      try {
        svg.releasePointerCapture(evt.pointerId);
      } catch {}
      clearMarquee();
      return;
    }
    if (!dragNode) return;
    if (evt.pointerId !== dragNode.pointerId) return;
    const id = dragNode.id;
    if (dragNode.active) {
      const pt = clientToSvg(svg, evt.clientX, evt.clientY);
      const deltaX = pt.x - dragNode.startSvgX;
      const deltaY = pt.y - dragNode.startSvgY;
      for (const item of dragNode.items) {
        const finalOffset = {
          x: item.startTranslateX + deltaX - item.baseX,
          y: item.startTranslateY + deltaY - item.baseY
        };
        setPinnedOffset(item.node, finalOffset);
      }
      dragNode.g.releasePointerCapture(evt.pointerId);
      const wasMulti = dragNode.multi;
      dragNode = null;
      devLog("drag:end", { nodeId: id, multi: wasMulti, syncRev: state.syncRev });
      if (!wasMulti) selectNodeById(id);
      pushHistory();
      restoreLiveMutations();
      clearDragOverlay();
      renderFromModel({ updateSource: true, preserveWarnings: true });
      markModelDirty("node position changed");
      return;
    }
    clearDragOverlay();
    restoreLiveMutations();
    dragNode.g.releasePointerCapture(evt.pointerId);
    dragNode = null;
  });

  svg.addEventListener("pointercancel", (evt) => {
    if (marqueeCandidate && evt.pointerId === marqueeCandidate.pointerId) {
      marqueeCandidate = null;
      return;
    }
    if (marquee && evt.pointerId === marquee.pointerId) {
      clearMarquee();
      try {
        svg.releasePointerCapture(evt.pointerId);
      } catch {}
      return;
    }
    if (!dragNode || evt.pointerId !== dragNode.pointerId) return;
    clearDragOverlay();
    restoreLiveMutations();
    try {
      dragNode.g.releasePointerCapture(evt.pointerId);
    } catch {}
    dragNode = null;
  });
}

function runPostRenderHook(svgEl) {
  if (!svgEl) {
    devLog("postRenderHook:svg missing");
    return;
  }
  applyNodePositions(svgEl);
  attachNodeInteractions(svgEl);
  applyConnectHandles(svgEl);
  applySelection(svgEl);
  if (state.pendingAutoFit) {
    state.pendingAutoFit = false;
    requestAnimationFrame(() => {
      fitPreviewToView();
    });
  }
  const mapped = Array.from(svgEl.querySelectorAll("g.node")).filter((g) => !!getNodeIdFromGroup(g)).length;
  devLog("postRenderHook", {
    svgFound: true,
    nodeElements: svgEl.querySelectorAll("g.node").length,
    mapped
  });
}

async function renderMermaid(text, { expectedRev = null } = {}) {
  const seq = ++state.renderSeq;
  clearError({ preserveStatus: state.textDirty || state.parseWarnings.length > 0 || state.outOfSync });

  const container = els.preview;

  try {
    const mermaid = await getMermaid();
    if (!mermaid) throw new Error("Mermaid module not found");
    const result = await mermaid.render(`mmd-${seq}`, text);
    if (expectedRev !== null && !isLatestRev(expectedRev)) return;
    const svgText = result.svg || result;
    container.innerHTML = svgText;

    if (seq !== state.renderSeq) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) {
      state.pendingAutoFit = false;
      setProblems(
        [{ type: "error", message: "Render produced no SVG. Check Mermaid syntax.", line: 1, column: 1 }],
        { status: "error", open: true }
      );
      return;
    }
    if (!svgEl.getAttribute("xmlns")) {
      svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    if (!svgEl.getAttribute("width") && svgEl.getAttribute("viewBox")) {
      const parts = svgEl.getAttribute("viewBox").split(/\s+/).map(Number);
      if (parts.length === 4) {
        svgEl.setAttribute("width", String(parts[2]));
        svgEl.setAttribute("height", String(parts[3]));
      }
    }
    runPostRenderHook(svgEl);
    state.lastSvgText = svgEl.outerHTML;
    if (!state.textDirty && state.parseWarnings.length === 0 && !state.outOfSync) {
      setStatus("ok", "ready");
    }
  } catch (err) {
    state.pendingAutoFit = false;
    if (seq !== state.renderSeq) return;
    if (expectedRev !== null && !isLatestRev(expectedRev)) return;
    if (state.lastSvgText) {
      container.innerHTML = state.lastSvgText;
      const svgEl = container.querySelector("svg");
      runPostRenderHook(svgEl);
    }
    setProblems([parseMermaidError(err)], { status: "error", open: true });
    console.error(err);
  }
}

function wireToolbar() {
  const closeToolbarMenus = (exceptTarget = null) => {
    document.querySelectorAll(".toolbar details.menu[open]").forEach((menu) => {
      if (exceptTarget && menu.contains(exceptTarget)) return;
      menu.open = false;
    });
  };

  const preparePersistContent = async () => {
    const prep = await prepareContentForSave({
      mode: "text",
      textDirty: state.textDirty,
      commit: async () => {
        const ok = await renderFromText({ live: false });
        if (ok) addDocSnapshot("apply-before-save");
        return ok;
      },
      buildContent: () => getFullSourceForOutput()
    });
    if (!prep.ok) {
      showError("保存前の反映に失敗しました。Problemsを修正してから保存してください。");
      return null;
    }
    return prep.content;
  };
  const handleOpen = async () => {
    await withTask("opening file...", async () => {
      const res = await window.api.openMmd();
      if (res.canceled) return;
      state.filePath = res.filePath;
      setFileInfo();
      const opened = res.content || "";
      updateEditorText(state.showInternalBlocks ? opened : stripInternalBlocks(opened));
      state.textDirty = false;
      updateApplyButton();
      const embedded = extractModelFromText(res.content || "");
      if (embedded) state.model = embedded;
      if (embedded) {
        pushHistory();
        renderFromModel();
        return;
      }
      showWarning("AE:MODEL not found. Parsing Mermaid source.");
      await renderFromText({ live: false });
    });
  };
  const handleSaveAs = async () => {
    await withTask("saving as...", async () => {
      const content = await preparePersistContent();
      if (!content) return;
      const res = await window.api.saveMmdAs({ content, defaultFilePath: state.filePath });
      if (res.canceled) return;
      state.filePath = res.filePath;
      setFileInfo();
    });
  };
  const handleSave = async () => {
    await withTask("saving...", async () => {
      const content = await preparePersistContent();
      if (!content) return;
      if (!state.filePath) {
        const res = await window.api.saveMmdAs({ content, defaultFilePath: state.filePath });
        if (res.canceled) return;
        state.filePath = res.filePath;
        setFileInfo();
        return;
      }
      const res = await window.api.saveMmd({ filePath: state.filePath, content });
      if (!res.ok) showError(res.error || "Save failed");
    });
  };
  const handleClearAll = async () => {
    const ok = window.confirm(t("clearAllConfirm"));
    if (!ok) return;
    applyBlankState({ resetFilePath: true });
    pushHistory();
  };
  const handleGroup = async () => {
    if (state.connectMode) return;
    if (getUnlockedSelectedNodeIds().size < 2) {
      showWarning("Group requires 2 or more selected nodes.");
      return;
    }
    await groupSelectedNodes();
  };
  const handleEqualize = () => {
    equalizeSelectedNodes();
  };
  const handleUngroup = () => {
    ungroupSelectedNodes();
  };
  const handleAlign = (mode) => {
    applyAlignment(mode);
  };
  const handleDistribute = (axis) => {
    applyDistribute(axis);
  };
  state.menuHandlers["file:open"] = handleOpen;
  state.menuHandlers["file:save"] = handleSave;
  state.menuHandlers["file:saveAs"] = handleSaveAs;
  state.menuHandlers["file:clearAll"] = handleClearAll;
  state.menuHandlers["edit:group"] = handleGroup;
  state.menuHandlers["edit:equalize"] = handleEqualize;

  els.btnNew.addEventListener("click", () => {
    if (els.newDialog) {
      els.newDialog.classList.remove("hidden");
      return;
    }
  });

  els.btnOpen.addEventListener("click", handleOpen);
  els.btnClearAll?.addEventListener("click", () => {
    void handleClearAll();
  });
  els.btnClearAllTop?.addEventListener("click", () => {
    els.btnClearAll?.click();
  });

  els.btnSaveAs.addEventListener("click", handleSaveAs);

  els.btnSave.addEventListener("click", handleSave);

  els.btnCopyMermaid.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getFullSourceForOutput());
    } catch (err) {
      showError(err);
    }
  });

  els.btnPasteMermaid.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      const displayText = state.showInternalBlocks ? text : stripInternalBlocks(text);
      updateEditorText(displayText);
      state.textDirty = true;
      updateApplyButton();
      await renderFromText({ live: true });
    } catch (err) {
      showError(err);
    }
  });

  els.btnCopySvg.addEventListener("click", async () => {
    try {
      const svgText = getSvgText();
      if (!svgText) return showError("SVGがありません");
      await navigator.clipboard.writeText(svgText);
    } catch (err) {
      showError(err);
    }
  });

  els.btnCopyPng.addEventListener("click", async () => {
    await withTask("copying png...", async () => {
      try {
        const svgText = getSvgText();
        if (!svgText) return showError("SVGがありません");
        setTaskProgress(0.4, "rendering png...");
        const pngBase64 = await svgToPng(svgText);
        setTaskProgress(0.8, "writing clipboard...");
        const blob = await (await fetch(pngBase64)).blob();
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
      } catch (err) {
        showError(err);
      }
    });
  });

  els.btnUndo.addEventListener("click", () => {
    if (isEditableTarget(document.activeElement) || document.activeElement === els.srcTextarea) {
      state.editor.undo();
    } else {
      undoModel();
    }
  });

  els.btnRedo.addEventListener("click", () => {
    if (isEditableTarget(document.activeElement) || document.activeElement === els.srcTextarea) {
      state.editor.redo();
    } else {
      redoModel();
    }
  });

  els.btnFormat.addEventListener("click", () => {
    const formatted = formatMermaid(state.editor.getValue());
    updateEditorText(formatted);
    state.textDirty = true;
    updateApplyButton();
    void renderFromText({ live: true });
  });

  els.btnRelayout.addEventListener("click", () => {
    // Re-layout: preview only (do not rewrite source text).
    renderFromModel({ updateSource: false });
    markModelDirty("re-layout requested");
  });
  if (els.btnGroup) {
    els.btnGroup.addEventListener("click", () => {
      void handleGroup();
    });
  }
  if (els.btnEqualize) {
    els.btnEqualize.addEventListener("click", () => {
      handleEqualize();
    });
  }
  if (els.selectionActions) {
    const stop = (evt) => {
      evt.stopPropagation();
    };
    els.selectionActions.addEventListener("pointerdown", stop);
    els.selectionActions.addEventListener("click", stop);
  }
  if (els.btnSelectionGroup) {
    els.btnSelectionGroup.addEventListener("click", () => {
      void handleGroup();
    });
  }
  if (els.btnSelectionEqualize) {
    els.btnSelectionEqualize.addEventListener("click", () => {
      handleEqualize();
    });
  }
  if (els.btnSelectionUngroup) {
    els.btnSelectionUngroup.addEventListener("click", () => {
      handleUngroup();
    });
  }
  if (els.btnSelectionAlignL) els.btnSelectionAlignL.addEventListener("click", () => handleAlign("left"));
  if (els.btnSelectionAlignC) els.btnSelectionAlignC.addEventListener("click", () => handleAlign("center"));
  if (els.btnSelectionAlignR) els.btnSelectionAlignR.addEventListener("click", () => handleAlign("right"));
  if (els.btnSelectionAlignT) els.btnSelectionAlignT.addEventListener("click", () => handleAlign("top"));
  if (els.btnSelectionAlignM) els.btnSelectionAlignM.addEventListener("click", () => handleAlign("middle"));
  if (els.btnSelectionAlignB) els.btnSelectionAlignB.addEventListener("click", () => handleAlign("bottom"));
  if (els.btnSelectionDistH) els.btnSelectionDistH.addEventListener("click", () => handleDistribute("x"));
  if (els.btnSelectionDistV) els.btnSelectionDistV.addEventListener("click", () => handleDistribute("y"));
  if (els.btnSelectionDelete) {
    els.btnSelectionDelete.addEventListener("click", () => {
      deleteSelected();
    });
  }

  if (els.btnConnect) {
    els.btnConnect.addEventListener("click", () => {
      setConnectMode(!state.connectMode);
    });
  }
  if (els.btnToggleInspector) {
    els.btnToggleInspector.addEventListener("click", () => {
      state.inspectorVisible = !state.inspectorVisible;
      localStorage.setItem("ae:inspectorVisible", state.inspectorVisible ? "1" : "0");
      applyInspectorVisibility();
    });
  }

  if (els.btnStatusDetails) {
    els.btnStatusDetails.addEventListener("click", () => {
      state.statusDetailsOpen = !state.statusDetailsOpen;
      localStorage.setItem("ae:statusDetailsOpen", state.statusDetailsOpen ? "1" : "0");
      updateStatusDetailsVisibility();
    });
  }

  if (els.btnExportMermaid) {
    els.btnExportMermaid.addEventListener("click", () => openExportDialog("mermaid"));
  }

  els.btnExportSvg.addEventListener("click", () => openExportDialog("svg"));

  els.btnExportPng.addEventListener("click", () => openExportDialog("png"));

  els.btnExportPdf.addEventListener("click", () => openExportDialog("pdf"));

  if (els.btnExportModelJson) {
    els.btnExportModelJson.addEventListener("click", () => openExportDialog("modelJson"));
  }

  els.btnZoomIn.addEventListener("click", (evt) => {
    const step = evt.shiftKey ? 0.25 : 0.1;
    zoomByStep(step);
  });

  els.btnZoomOut.addEventListener("click", (evt) => {
    const step = evt.shiftKey ? -0.25 : -0.1;
    zoomByStep(step);
  });

  els.btnZoomReset.addEventListener("click", () => {
    state.zoom = 1;
    applyZoom();
  });

  if (els.btnZoomFit) {
    els.btnZoomFit.addEventListener("click", () => {
      fitPreviewToView();
    });
  }

  const panStep = 24;
  els.btnPanUp.addEventListener("click", () => {
    state.panY -= panStep / state.zoom;
    applyZoom();
  });
  els.btnPanDown.addEventListener("click", () => {
    state.panY += panStep / state.zoom;
    applyZoom();
  });
  els.btnPanLeft.addEventListener("click", () => {
    state.panX -= panStep / state.zoom;
    applyZoom();
  });
  els.btnPanRight.addEventListener("click", () => {
    state.panX += panStep / state.zoom;
    applyZoom();
  });
  els.btnPanReset.addEventListener("click", () => {
    state.panX = 0;
    state.panY = 0;
    applyZoom();
  });

  if (els.btnPanSpeed) {
    const setLabel = () => {
      els.btnPanSpeed.textContent = state.panSpeed === 1 ? "Pan x1" : "Pan x2";
    };
    els.btnPanSpeed.addEventListener("click", () => {
      state.panSpeed = state.panSpeed === 1 ? 2 : 1;
      localStorage.setItem("ae:panSpeed", String(state.panSpeed));
      setLabel();
    });
    const saved = parseFloat(localStorage.getItem("ae:panSpeed") || "2");
    if (!Number.isNaN(saved)) state.panSpeed = saved;
    setLabel();
  }

  if (els.btnCollapseLeft) {
    els.btnCollapseLeft.addEventListener("click", () => {
      const next = !document.body.classList.contains("left-collapsed");
      document.body.classList.toggle("left-collapsed", next);
      saveCollapseState();
      if (next) {
        if (!localStorage.getItem("ae:toast:left")) {
          showToast("左ペインを復帰：画面左端の ⟩");
          localStorage.setItem("ae:toast:left", "1");
        }
      }
    });
  }
  if (els.btnCollapseRight) {
    els.btnCollapseRight.addEventListener("click", () => {
      const next = !document.body.classList.contains("right-collapsed");
      document.body.classList.toggle("right-collapsed", next);
      saveCollapseState();
      if (next) {
        if (!localStorage.getItem("ae:toast:right")) {
          showToast("右ペインを復帰：画面右端の ⟨");
          localStorage.setItem("ae:toast:right", "1");
        }
      }
    });
  }
  if (els.btnExpandLeft) {
    els.btnExpandLeft.addEventListener("click", () => {
      document.body.classList.remove("left-collapsed");
      saveCollapseState();
    });
  }
  if (els.btnExpandRight) {
    els.btnExpandRight.addEventListener("click", () => {
      document.body.classList.remove("right-collapsed");
      saveCollapseState();
    });
  }

  if (els.btnToggleProblems) {
    els.btnToggleProblems.addEventListener("click", () => {
      const next = !document.body.classList.contains("problems-collapsed");
      document.body.classList.toggle("problems-collapsed", next);
      state.problemsUserCollapsed = next;
      saveProblemsState();
    });
  }

  els.selTheme.addEventListener("change", () => {
    const themeId = els.selTheme.value;
    const theme = state.themes.find((t) => t.themeId === themeId) || state.themes[0];
    state.theme = theme;
    applyThemeVars(theme);
    initMermaidBase(theme).catch(showError);
    if (state.model) state.model.themeId = themeId;
    renderFromModel({ updateSource: false, preserveWarnings: true });
  });

  els.selDir.addEventListener("change", () => {
    renderFromModel();
  });

  if (els.selMode) {
    const modeLabel = els.selMode.previousElementSibling;
    if (modeLabel && modeLabel.classList.contains("lbl")) {
      modeLabel.title = "モード切替は廃止され、常時双方向同期になっています。";
      modeLabel.style.display = "none";
    }
    els.selMode.disabled = true;
    els.selMode.title = "モード切替は廃止され、常時双方向同期になっています。";
    els.selMode.style.display = "none";
  }

  if (els.selUiScale) {
    els.selUiScale.addEventListener("change", async () => {
      const value = normalizeUiScaleChoice(els.selUiScale.value) || "auto";
      els.selUiScale.value = value;
      if (window.api?.setUiScalePref) {
        const res = await window.api.setUiScalePref(value);
        if (!res?.ok) {
          if (els.statusWarn) els.statusWarn.textContent = `warn:${res?.error || "invalid ui scale"}`;
          return;
        }
      }
      const diag = await updateDiagnostics();
      try {
        const applied = await applyUiZoom(value, diag);
        if (els.statusWarn) els.statusWarn.textContent = `ui scale applied:${Math.round(applied.zoomFactor * 100)}%`;
      } catch (err) {
        if (els.statusWarn) els.statusWarn.textContent = `warn:${err?.message || "ui scale apply failed"}`;
      }
      await updateDiagnostics();
    });
  }

  if (els.selOzone) {
    els.selOzone.addEventListener("change", async () => {
      const value = els.selOzone.value;
      localStorage.setItem("ae:ozone", value);
      if (window.api?.setOzonePref) {
        const res = await window.api.setOzonePref(value);
        if (els.statusWarn) {
          els.statusWarn.textContent = res?.ok ? "restart required" : `warn:${res?.error || "invalid ozone"}`;
        }
      } else if (els.statusWarn) {
        els.statusWarn.textContent = "restart required";
      }
      updateDiagnostics();
    });
  }

  if (els.selLanguage) {
    els.selLanguage.addEventListener("change", () => {
      const value = els.selLanguage.value || "system";
      setLanguage(value);
      applyLanguageUi();
      applyInspectorVisibility();
      refreshSelectionActions();
    });
  }

  if (els.btnShowTips) {
    els.btnShowTips.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      openTipsDialog({ persistSeen: false });
      const menu = els.btnShowTips.closest("details.menu");
      if (menu) menu.open = false;
    });
  }

  if (els.btnTipsGotIt) {
    els.btnTipsGotIt.addEventListener("click", () => {
      closeTipsDialog({ persistSeen: true });
    });
  }

  if (els.tipsDialog) {
    els.tipsDialog.addEventListener("click", (evt) => {
      if (evt.target === els.tipsDialog) {
        closeTipsDialog({ persistSeen: true });
      }
    });
  }

  if (els.btnReportBug) {
    els.btnReportBug.addEventListener("click", async (evt) => {
      evt.preventDefault();
      const res = await window.api?.openExternalUrl?.({ url: SUPPORT_URL });
      if (!res?.ok) {
        showWarning(res?.error || "Could not open support URL.");
      }
    });
  }

  if (els.btnCopyDiagnostics) {
    els.btnCopyDiagnostics.addEventListener("click", async () => {
      if (!window.api?.copyDiagnostics) return;
      const res = await window.api.copyDiagnostics();
      if (res?.ok) {
        showToast("Diagnostics copied");
      } else {
        showError(res?.error || "Copy diagnostics failed");
      }
    });
  }

  if (els.btnApplyText) {
    els.btnApplyText.addEventListener("click", async () => {
      await withTask("applying text...", async () => {
        const ok = await renderFromText({ live: false });
        if (ok) addDocSnapshot("apply");
      });
    });
  }

  if (els.toggleInternalBlocks) {
    els.toggleInternalBlocks.addEventListener("change", () => {
      state.showInternalBlocks = els.toggleInternalBlocks.checked;
      const current = getEditorBaseText();
      const next = state.showInternalBlocks ? getFullSourceForOutput() : stripInternalBlocks(current);
      updateEditorText(next);
      updateInternalToggleVisibility();
    });
  }

  if (els.internalPanel) {
    els.internalPanel.addEventListener("toggle", () => {
      localStorage.setItem("ae:internalPanelOpen", els.internalPanel.open ? "1" : "0");
    });
  }

  if (els.toggleDevMode) {
    els.toggleDevMode.addEventListener("change", () => {
      state.devMode = els.toggleDevMode.checked;
      localStorage.setItem("ae:devMode", state.devMode ? "1" : "0");
      if (!state.devMode && state.statusDetailsOpen) {
        state.statusDetailsOpen = false;
        localStorage.setItem("ae:statusDetailsOpen", "0");
      }
      if (!state.devMode && state.showInternalBlocks) {
        state.showInternalBlocks = false;
        if (els.toggleInternalBlocks) els.toggleInternalBlocks.checked = false;
        const current = getEditorBaseText();
        updateEditorText(stripInternalBlocks(current));
      }
      updateInternalToggleVisibility();
      renderProblems();
      updateDiagnostics();
    });
  }

  if (els.btnRestoreSnapshot) {
    els.btnRestoreSnapshot.addEventListener("click", async () => {
      if (!state.docHistory.length) {
        showWarning("復元できる履歴がありません。");
        return;
      }
      const choices = state.docHistory
        .slice(0, 10)
        .map((h, i) => {
          const d = new Date(h.ts || Date.now());
          return `${i + 1}: ${d.toLocaleString()} (${h.reason || "snapshot"})`;
        })
        .join("\n");
      const picked = await requestTextInput(`復元する履歴番号を入力してください:\n${choices}`, "1");
      const idx = Number.parseInt(picked || "", 10) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= state.docHistory.length) return;
      const item = state.docHistory[idx];
      updateEditorText(state.showInternalBlocks ? item.content : stripInternalBlocks(item.content));
      state.textDirty = true;
      updateApplyButton();
      await renderFromText({ live: false });
    });
  }

  document.addEventListener("pointerdown", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) {
      closeToolbarMenus();
      return;
    }
    if (state.selectedNodeIds.size || state.selectedNodeId || state.selectedEdgeId) {
      const keepSelection =
        target.closest("#selectionActions") ||
        target.closest("g.node, g.edgePath, g.edgeLabel, circle.ae-handle") ||
        target.closest("#nodeList .item, #edgeList .item, #boundaryList .item") ||
        target.closest("#inspector");
      if (!keepSelection) {
        clearSelectionState();
        renderPropPanel();
        const svg = els.preview.querySelector("svg");
        if (svg) applySelection(svg);
        highlightList();
      }
    }
    closeToolbarMenus(target);
  });

}

function wireNativeMenuActions() {
  if (state.nativeMenuWired) return;
  if (!window.api?.onMenuAction) return;
  state.nativeMenuWired = true;
  const actionToDomId = {
    "file:new": "btnNew",
    "file:clearAll": "btnClearAll",
    "file:open": "btnOpen",
    "file:save": "btnSave",
    "file:saveAs": "btnSaveAs",
    "file:restoreSnapshot": "btnRestoreSnapshot",
    "file:exportSvg": "btnExportSvg",
    "file:exportMermaid": "btnExportMermaid",
    "file:exportPng": "btnExportPng",
    "file:exportPdf": "btnExportPdf",
    "file:exportModelJson": "btnExportModelJson",
    "edit:undo": "btnUndo",
    "edit:redo": "btnRedo",
    "edit:format": "btnFormat",
    "edit:group": "btnGroup",
    "edit:equalize": "btnEqualize",
    "diagram:relayout": "btnRelayout",
    "view:zoomIn": "btnZoomIn",
    "view:zoomOut": "btnZoomOut",
    "view:zoomReset": "btnZoomReset",
    "view:zoomFit": "btnZoomFit",
    "view:panReset": "btnPanReset",
    "view:toggleConnect": "btnConnect",
    "view:toggleDevMode": "toggleDevMode",
    "view:toggleInternal": "toggleInternalBlocks",
    "view:toggleProblems": "btnToggleProblems",
    "pane:collapseLeft": "btnCollapseLeft",
    "pane:collapseRight": "btnCollapseRight",
    "pane:expandLeft": "btnExpandLeft",
    "pane:expandRight": "btnExpandRight",
    "help:copyDiagnostics": "btnCopyDiagnostics"
  };
  window.api.onMenuAction((action) => {
    const direct = state.menuHandlers?.[action];
    if (typeof direct === "function") {
      void direct();
      return;
    }
    const id = actionToDomId[action];
    if (!id) {
      console.warn("[renderer] unmapped menu action:", action);
      return;
    }
    const el = document.getElementById(id);
    if (!el) {
      console.warn("[renderer] missing menu target:", action, id);
      return;
    }
    if (el.tagName === "INPUT" && el.type === "checkbox") {
      el.checked = !el.checked;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  });
}

function wirePreviewZoom() {
  const wrap = $("previewWrap");
  if (!wrap) return;
  let isPanning = false;
  let panPointerId = null;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  wrap.addEventListener("pointerdown", (evt) => {
    const isMiddle = evt.button === 1;
    const isOnUi = evt.target.closest(".previewZoom");
    if (!isMiddle || isOnUi) return;
    evt.preventDefault();
    evt.stopPropagation();
    isPanning = true;
    panPointerId = evt.pointerId;
    wrap.classList.add("panning");
    startX = evt.clientX;
    startY = evt.clientY;
    startPanX = state.panX;
    startPanY = state.panY;
    wrap.setPointerCapture(evt.pointerId);
  });

  wrap.addEventListener("pointermove", (evt) => {
    if (!isPanning) return;
    if (panPointerId !== evt.pointerId) return;
    const speed = state.panSpeed || 1;
    const dx = ((evt.clientX - startX) / state.zoom) * speed;
    const dy = ((evt.clientY - startY) / state.zoom) * speed;
    state.panX = startPanX + dx;
    state.panY = startPanY + dy;
    applyZoom();
  });

  const endPan = (evt) => {
    if (!isPanning) return;
    if (panPointerId !== evt.pointerId) return;
    isPanning = false;
    try {
      wrap.releasePointerCapture(evt.pointerId);
    } catch {}
    panPointerId = null;
    wrap.classList.remove("panning");
  };

  wrap.addEventListener("pointerup", endPan);
  wrap.addEventListener("pointercancel", endPan);

  wrap.addEventListener(
    "wheel",
    (evt) => {
      evt.preventDefault();
      const delta = evt.deltaY || 0;
      const step = delta > 0 ? -0.1 : 0.1;
      zoomAt(evt.clientX, evt.clientY, state.zoom + step);
    },
    { passive: false }
  );
}

function wireContextMenu() {
  const wrap = $("previewWrap");
  if (!wrap || !els.ctxMenu) return;

  const hide = () => closeContextMenu();
  els.ctxMenu.addEventListener("pointerdown", (evt) => {
    evt.stopPropagation();
  });
  els.ctxMenu.addEventListener("click", (evt) => {
    evt.stopPropagation();
  });
  window.addEventListener("click", hide);
  window.addEventListener(
    "scroll",
    () => {
      hide();
    },
    true
  );
  window.addEventListener("resize", hide);
  window.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") hide();
  });

  wrap.addEventListener("contextmenu", (evt) => {
    const svg = els.preview.querySelector("svg");
    if (!svg) return;
    evt.preventDefault();
    evt.stopPropagation();

    const nodeEl = evt.target.closest("g.node");
    const edgeEl = evt.target.closest("g.edgePath");

    if (nodeEl) {
      const nodeId = getNodeIdFromGroup(nodeEl);
      const node = state.model.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const applyToNodeOrSelection = (updater, dirtyMessage) => {
        const selected =
          state.selectedNodeIds.size > 1 && state.selectedNodeIds.has(node.id)
            ? state.model.nodes.filter((n) => state.selectedNodeIds.has(n.id))
            : [node];
        let changed = false;
        for (const n of selected) {
          if (updater(n)) changed = true;
        }
        if (!changed) return;
        renderFromModel();
        pushHistory();
        markModelDirty(dirtyMessage);
      };
      showContextMenu(evt.clientX, evt.clientY, (menu) => {
        addCtxTitle(menu, `Node: ${node.id}`);
        addCtxItem(menu, node.locked ? "Unlock" : "Lock", () => {
          const next = !node.locked;
          if (node.locked === next) return;
          node.locked = next;
          if (next) {
            state.selectedNodeIds.delete(node.id);
            if (state.selectedNodeId === node.id) state.selectedNodeId = null;
          }
          renderFromModel();
          pushHistory();
          markModelDirty("node lock changed");
        });
        addCtxItem(menu, "選択", () => selectNodeById(node.id));
        addCtxItem(menu, "Connect mode ON", () => {
          selectNodeById(node.id);
          setConnectMode(true);
          showToast("接続ハンドルをドラッグして接続先を選択");
        });
        addCtxGroup(menu, "形状", [
          {
            label: "Rectangle",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.shape || "") === "rect") return false;
                n.shape = "rect";
                return true;
              }, "node shape changed");
            }
          },
          {
            label: "Round",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.shape || "") === "round") return false;
                n.shape = "round";
                return true;
              }, "node shape changed");
            }
          },
          {
            label: "Circle",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.shape || "") === "circle") return false;
                n.shape = "circle";
                return true;
              }, "node shape changed");
            }
          },
          {
            label: "Diamond",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.shape || "") === "diamond") return false;
                n.shape = "diamond";
                return true;
              }, "node shape changed");
            }
          }
        ]);
        addCtxGroup(menu, "色", [
          {
            label: "Blue",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.className || "") === "accent-blue") return false;
                n.className = "accent-blue";
                return true;
              }, "node class changed");
            }
          },
          {
            label: "Green",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.className || "") === "accent-green") return false;
                n.className = "accent-green";
                return true;
              }, "node class changed");
            }
          },
          {
            label: "Amber",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.className || "") === "accent-amber") return false;
                n.className = "accent-amber";
                return true;
              }, "node class changed");
            }
          },
          {
            label: "Red",
            onClick: () => {
              applyToNodeOrSelection((n) => {
                if ((n.className || "") === "accent-red") return false;
                n.className = "accent-red";
                return true;
              }, "node class changed");
            }
          }
        ]);
        const zoneItems = [
          {
            label: "ゾーン解除",
            onClick: () => {
              node.boundaryId = null;
              node.groupId = null;
              node.groupName = null;
              renderFromModel();
              pushHistory();
              markModelDirty("zone cleared");
            }
          },
          {
            label: "新規ゾーン作成...",
            onClick: () => {
              void requestTextInput("Zone name", "New Zone").then((label) => {
                if (!label) return;
                const roleId = "vpc";
                const ids = new Set(state.model.boundaries.map((b) => b.id));
                const id = nextId(boundaryPrefix(roleId), ids);
                state.model.boundaries.push({ id, label: label.trim(), role: roleId });
                node.boundaryId = id;
                node.groupId = id;
                node.groupName = label.trim();
                renderFromModel();
                pushHistory();
                markModelDirty("zone created");
              });
            }
          }
        ];
        for (const b of state.model.boundaries) {
          zoneItems.push({
            label: `${b.label} (${b.id})`,
            onClick: () => {
              node.boundaryId = b.id;
              node.groupId = b.id;
              node.groupName = b.label;
              renderFromModel();
              pushHistory();
              markModelDirty("zone assignment changed");
            }
          });
        }
        addCtxGroup(menu, "ゾーン", zoneItems);
        addCtxItem(menu, node.pinned ? "Unpin" : "Pin", () => {
          node.pinned = !node.pinned;
          if (!node.pinned) {
            node.position = null;
            node.pinnedOffset = null;
          }
          renderFromModel();
          pushHistory();
          markModelDirty("node pin changed");
        });
        addCtxItem(menu, "削除", () => {
          selectNodeById(node.id);
          deleteSelected();
        });
      });
      return;
    }

    if (edgeEl) {
      const edgeId = edgeEl.dataset.aeEdgeId || null;
      const edge = edgeId ? state.model.edges.find((e) => e.id === edgeId) : null;
      if (!edge) return;
      showContextMenu(evt.clientX, evt.clientY, (menu) => {
        addCtxTitle(menu, `Edge: ${edge.id}`);
        addCtxItem(menu, "選択", () => selectEdgeById(edge.id));
        addCtxItem(menu, "破線切替", () => {
          edge.style = { ...(edge.style || {}) };
          edge.style.dashed = !edge.style.dashed;
          if (!edge.style.dashed) delete edge.style.dashed;
          if (!Object.keys(edge.style).length) delete edge.style;
          renderFromModel();
          pushHistory();
          markModelDirty("edge style changed");
        });
        addCtxItem(menu, "削除", () => {
          selectEdgeById(edge.id);
          deleteSelected();
        });
      });
      return;
    }

    showContextMenu(evt.clientX, evt.clientY, (menu) => {
      addCtxTitle(menu, "Canvas");
      addCtxItem(menu, state.connectMode ? "Connect mode OFF" : "Connect mode ON", () => {
        setConnectMode(!state.connectMode);
      });
      addCtxItem(menu, "パンをリセット", () => {
        state.panX = 0;
        state.panY = 0;
        applyZoom();
      });
    });
  });
}

function wireSplitters() {
  const leftSplitter = document.querySelector('.splitter[data-split="left"]');
  const rightSplitter = document.querySelector('.splitter[data-split="right"]');
  const problemSplitter = document.querySelector('.hsplitter[data-split="problems"]');
  if (!leftSplitter || !rightSplitter || !els.layout) return;

  const startDrag = (side, splitterEl, evt) => {
    if (evt.button !== 0) return;
    evt.preventDefault();
    evt.stopPropagation();
    document.body.classList.add("dragging");
    const rect = els.layout.getBoundingClientRect();
    const splitterW = 12;
    const minLeft = 220;
    const minRight = 300;
    const minCenter = 360;
    const available = Math.max(320, rect.width - splitterW * 2);
    const maxLeft = Math.max(minLeft + 24, available - minRight - minCenter);
    const maxRight = Math.max(minRight + 24, available - minLeft - minCenter);
    let pointerId = evt.pointerId;

    try {
      if (splitterEl && splitterEl.setPointerCapture != null && pointerId != null) {
        splitterEl.setPointerCapture(pointerId);
      }
    } catch {}

    const onMove = (e) => {
      if (pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;
      if (side === "left") {
        const left = clamp(e.clientX - rect.left, minLeft, maxLeft);
        applyPaneSizes(left, null);
      } else {
        const right = clamp(rect.right - e.clientX, minRight, maxRight);
        applyPaneSizes(null, right);
      }
    };
    const onUp = (e) => {
      if (pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;
      document.body.classList.remove("dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        if (splitterEl && splitterEl.releasePointerCapture != null && pointerId != null) {
          splitterEl.releasePointerCapture(pointerId);
        }
      } catch {}
      pointerId = null;
      const styles = getComputedStyle(document.documentElement);
      const left = parseFloat(styles.getPropertyValue("--left-w")) || 260;
      const right = parseFloat(styles.getPropertyValue("--right-w")) || 420;
      savePaneSizes(left, right);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  leftSplitter.addEventListener("pointerdown", (evt) => startDrag("left", leftSplitter, evt));
  rightSplitter.addEventListener("pointerdown", (evt) => startDrag("right", rightSplitter, evt));

  if (problemSplitter) {
    problemSplitter.addEventListener("mousedown", (evt) => {
      evt.preventDefault();
      document.body.classList.add("dragging");
      const pane = document.getElementById("paneRight");
      const rect = pane.getBoundingClientRect();
      const minH = 80;
      const maxH = Math.min(220, rect.height * 0.4);
      const onMove = (e) => {
        const h = clamp(rect.bottom - e.clientY, minH, maxH);
        document.documentElement.style.setProperty("--problems-h", `${h}px`);
      };
      const onUp = () => {
        document.body.classList.remove("dragging");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        localStorage.setItem("ae:problemsHeight", getComputedStyle(document.documentElement).getPropertyValue("--problems-h").trim());
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  // inspector splitter removed (inline inspector)
}

function wireModelControls() {
  if (els.nodeList) {
    els.nodeList.addEventListener("click", (evt) => {
      const target = evt.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".item")) return;
      clearSelectionState();
      renderPropPanel();
      const svg = els.preview.querySelector("svg");
      if (svg) applySelection(svg);
      highlightList();
    });
  }

  els.btnAddNode.addEventListener("click", async () => {
    const roleId = els.selRole.value;
    if (roleId === "__free_box__") {
      const label = sanitizeFreeBoxLabel(await requestTextInput("Free Box label", ""));
      if (!label) return;
      const ids = new Set(state.model.nodes.map((n) => n.id));
      const id = nextId("FB", ids);
      state.model.nodes.push({
        id,
        label,
        role: "free_box",
        shape: "rect",
        boundaryId: null,
        groupId: null,
        groupName: null
      });
      pushHistory();
      renderFromModel();
      markModelDirty("node added");
      return;
    }
    const role = state.pack.roles[roleId];
    if (!role) return;
    const ids = new Set(state.model.nodes.map((n) => n.id));
    const id = nextId(role.idPrefix || roleId.toUpperCase(), ids);
    state.model.nodes.push({ id, label: role.label, role: roleId, boundaryId: null, groupId: null, groupName: null });
    pushHistory();
    renderFromModel();
    markModelDirty("node added");
  });

  els.btnAddBoundary.addEventListener("click", () => {
    const roleId = els.selBoundaryRole.value;
    const role = state.pack.boundaryRoles[roleId];
    if (!role) return;
    const ids = new Set(state.model.boundaries.map((b) => b.id));
    const id = nextId(boundaryPrefix(roleId), ids);
    state.model.boundaries.push({ id, label: role.label, role: roleId });
    pushHistory();
    renderFromModel();
    markModelDirty("zone added");
  });

  els.btnAddEdge.addEventListener("click", () => {
    const from = els.selEdgeFrom.value;
    const to = els.selEdgeTo.value;
    const kind = els.selEdgeKind.value;
    if (!from || !to || !kind) return;
    const label = (els.txtEdgeLabel.value || "").trim();
    addEdgeByNodes(from, to, { kind, label });
    els.txtEdgeLabel.value = "";
  });
}

function wireKeys() {
  window.addEventListener("keydown", (evt) => {
    if (isEditableTarget(evt.target)) return;
    const key = evt.key.toLowerCase();
    if ((evt.metaKey || evt.ctrlKey) && key === "z") {
      evt.preventDefault();
      if (evt.shiftKey) {
        redoModel();
      } else {
        undoModel();
      }
    }
    if ((evt.metaKey || evt.ctrlKey) && key === "y") {
      evt.preventDefault();
      redoModel();
    }
    if ((evt.metaKey || evt.ctrlKey) && key === "k") {
      evt.preventDefault();
      if (state.selectedNodeId) centerOnSelected();
    }
    if (key === "escape") {
      if (state.connectFromNodeId) {
        state.connectFromNodeId = null;
        const svg = els.preview.querySelector("svg");
        if (svg) applyConnectHandles(svg);
      }
      clearSelectionState();
      renderPropPanel();
      const svg = els.preview.querySelector("svg");
      if (svg) applySelection(svg);
      highlightList();
    }
    if (key === "delete" || key === "backspace") {
      evt.preventDefault();
      deleteSelected();
    }
    if (evt.altKey && ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      evt.preventDefault();
      const step = evt.shiftKey ? 10 : 1;
      if (key === "arrowup") nudgeSelectedNodes(0, -step);
      if (key === "arrowdown") nudgeSelectedNodes(0, step);
      if (key === "arrowleft") nudgeSelectedNodes(-step, 0);
      if (key === "arrowright") nudgeSelectedNodes(step, 0);
      return;
    }
    if (key === "tab") {
      evt.preventDefault();
      const list = [
        ...state.model.nodes.filter((n) => !n.locked).map((n) => ({ type: "node", id: n.id })),
        ...state.model.edges.map((e) => ({ type: "edge", id: e.id }))
      ];
      if (!list.length) return;
      let idx = list.findIndex((x) => x.id === (state.selectedNodeId || state.selectedEdgeId));
      if (idx < 0) idx = 0;
      idx = (idx + (evt.shiftKey ? -1 : 1) + list.length) % list.length;
      const next = list[idx];
      if (next.type === "node") selectNodeById(next.id);
      else selectEdgeById(next.id);
      highlightList();
    }
    if (key === "c") {
      setConnectMode(!state.connectMode);
    }
  });
}

function wireNewDialog() {
  if (!els.newDialog) return;
  const close = () => els.newDialog.classList.add("hidden");
  els.btnNewCancel?.addEventListener("click", close);
  els.newDialog.addEventListener("click", (evt) => {
    if (evt.target === els.newDialog) close();
  });
  els.newDialog.querySelectorAll("[data-template]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const kind = btn.getAttribute("data-template");
      state.pendingAutoFit = true;
      const modelTemplate = buildTemplateModel(kind);
      if (modelTemplate) {
        state.model = modelTemplate;
        if (els.selDir) els.selDir.value = modelTemplate.direction || els.selDir.value;
        renderFromModel();
        state.filePath = null;
        setFileInfo();
        pushHistory();
        close();
        return;
      }
      const text = kind === "sample" ? buildSampleMermaid() : buildTemplateMermaid(kind);
      if (kind === "empty") {
        state.model = {
          version: 1,
          packId: state.pack.packId,
          themeId: state.theme.themeId,
          diagramType: "flowchart",
          direction: "LR",
          nodes: [],
          edges: [],
          boundaries: []
        };
        updateEditorText(text);
        renderFromModel();
      } else {
        updateEditorText(text);
        await renderFromText({ live: false });
      }
      state.filePath = null;
      setFileInfo();
      pushHistory();
      close();
    });
  });
}

function getSvgText() {
  if (state.lastSvgText) return state.lastSvgText;
  const svgEl = els.preview.querySelector("svg");
  if (!svgEl) return "";
  if (!svgEl.getAttribute("xmlns")) {
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  return svgEl.outerHTML;
}

function getModelJsonText() {
  const model = normalizeModelClassNames(clone(state.model || {}));
  return JSON.stringify(model, null, 2);
}

async function svgToPng(svgText, { scale = 1 } = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.documentElement;

  let width = parseFloat(svgEl.getAttribute("width")) || 0;
  let height = parseFloat(svgEl.getAttribute("height")) || 0;
  if ((!width || !height) && svgEl.getAttribute("viewBox")) {
    const parts = svgEl.getAttribute("viewBox").split(/\s+/).map(Number);
    width = parts[2] || width;
    height = parts[3] || height;
  }
  if (!width || !height) {
    width = 1200;
    height = 800;
  }

  if (!svgEl.getAttribute("width")) svgEl.setAttribute("width", String(width));
  if (!svgEl.getAttribute("height")) svgEl.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const dpr = window.devicePixelRatio || 1;
  const factor = Math.max(1, Number(scale) || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * dpr * factor);
  canvas.height = Math.ceil(height * dpr * factor);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * factor, 0, 0, dpr * factor, 0, 0);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}

async function loadThemes() {
  const files = [
    "templates/themes/infra-dark.json",
    "templates/themes/infra-light.json",
    "templates/themes/incident.json",
    "templates/themes/print.json"
  ];
  const themes = [];
  for (const f of files) {
    try {
      themes.push(await readJson(f));
    } catch (err) {
      console.warn("Theme load failed", f, err);
    }
  }
  return themes;
}

function fillThemeSelector() {
  els.selTheme.innerHTML = "";
  for (const t of state.themes) {
    const opt = document.createElement("option");
    opt.value = t.themeId;
    opt.textContent = t.name || t.themeId;
    els.selTheme.appendChild(opt);
  }
}

async function boot() {
  setStatus("ok", "booting");
  state.pack = await safeReadJson("templates/packs/hybrid-infra.json", getFallbackPack(), "pack");
  state.themes = await loadThemes();
  if (!state.themes.length) {
    state.themes = [getFallbackTheme()];
    showWarning("Theme load failed. Using fallback theme.");
  }
  state.theme = state.themes.find((t) => t.themeId === "infra-dark") || state.themes[0] || getFallbackTheme();
  applyThemeVars(state.theme);
  try {
    await initMermaidBase(state.theme);
  } catch (err) {
    console.error("[boot] mermaid init failed:", err);
    showWarning("Mermaid init failed. Retrying with fallback theme.");
    state.theme = getFallbackTheme();
    applyThemeVars(state.theme);
    await initMermaidBase(state.theme);
  }

  state.model = createInitialModel(state.pack.packId, state.theme.themeId);
  els.selDir.value = state.model.direction || "LR";

  fillThemeSelector();
  if (state.theme) els.selTheme.value = state.theme.themeId;

  loadPaneSizes();
  loadCollapseState();
  loadProblemsState();
  loadDocHistory();
  const savedZoom = parseFloat(localStorage.getItem("ae:zoom") || "1");
  const savedPanX = parseFloat(localStorage.getItem("ae:panX") || "0");
  const savedPanY = parseFloat(localStorage.getItem("ae:panY") || "0");
  if (!Number.isNaN(savedZoom)) state.zoom = clampZoom(savedZoom);
  if (!Number.isNaN(savedPanX)) state.panX = savedPanX;
  if (!Number.isNaN(savedPanY)) state.panY = savedPanY;
  if (els.toggleInternalBlocks) {
    els.toggleInternalBlocks.checked = state.showInternalBlocks;
  }
  const dev = localStorage.getItem("ae:devMode");
  if (dev) state.devMode = dev === "1";
  if (els.toggleDevMode) els.toggleDevMode.checked = state.devMode;
  const statusDetailsOpen = localStorage.getItem("ae:statusDetailsOpen");
  state.statusDetailsOpen = statusDetailsOpen === "1";
  const inspectorVisible = localStorage.getItem("ae:inspectorVisible");
  state.inspectorVisible = inspectorVisible === "1";
  applyLanguageUi(true);
  applyInspectorVisibility();
  if (els.internalPanel) {
    const open = localStorage.getItem("ae:internalPanelOpen");
    if (open === "0") els.internalPanel.open = false;
    else els.internalPanel.open = true;
    if (!state.devMode) {
      els.internalPanel.open = false;
    }
  }
  updateInternalToggleVisibility();
  const savedProblemsH = localStorage.getItem("ae:problemsHeight");
  if (savedProblemsH) {
    const h = normalizeProblemsHeight(savedProblemsH);
    if (h) {
      document.documentElement.style.setProperty("--problems-h", `${h}px`);
    }
  }
  await initEditor();
  refreshSelectors();
  syncEditorReadOnly();
  updateApplyButton();
  setFileInfo();
  void refreshAppVersion();
  applyZoom();
  updateDprStatus();
  const onViewportScaleChanged = debounce(() => {
    updateDprStatus();
    void syncAutoUiScaleIfNeeded();
  }, 120);
  window.addEventListener("resize", onViewportScaleChanged);
  window.addEventListener("focus", onViewportScaleChanged);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) onViewportScaleChanged();
  });
  const diag = await updateDiagnostics();
  if (els.selUiScale) {
    const pref = normalizeUiScaleChoice((diag && diag.uiScalePref) || "auto") || "auto";
    els.selUiScale.value = pref;
    try {
      await applyUiZoom(pref, diag);
      if (pref === "auto") {
        const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
        const scale = Math.round((Number(diag?.displayScale) || 1) * 100) / 100;
        state.lastAutoScaleKey = `${dpr}|${scale}`;
      }
    } catch (err) {
      if (els.statusWarn) els.statusWarn.textContent = `warn:${err?.message || "ui scale apply failed"}`;
    }
  }
  if (els.selOzone) {
    const storedOzone = localStorage.getItem("ae:ozone");
    const prefOzone = storedOzone || (diag && diag.ozoneHint) || "auto";
    els.selOzone.value = String(prefOzone);
  }
  if (els.inspectorBody) els.inspectorBody.textContent = t("inspectorSelectHint");
  setInspectorHeader(t("inspectorTitle"), t("inspectorSelect"), "muted");
  await refreshEntitlements("boot");

  wireToolbar();
  wireProDialog();
  wireNativeMenuActions();
  wireModelControls();
  wirePreviewZoom();
  wireContextMenu();
  wireSplitters();
  wireKeys();
  wireNewDialog();
  wireExportDialog();

  const firstRunKey = "ae:firstRunDone";
  if (!localStorage.getItem(firstRunKey)) {
    const sample = buildSampleMermaid();
    updateEditorText(sample);
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyZoom();
    await renderFromText({ live: false });
    localStorage.setItem(firstRunKey, "1");
  } else {
    try {
      if (isModelEmpty(state.model)) {
        const sample = buildSampleMermaid();
        updateEditorText(sample);
        await renderFromText({ live: false });
      } else {
        renderFromModel();
        pushHistory();
      }
    } catch (err) {
      console.error("[boot] renderFromModel failed. Falling back to sample:", err);
      showWarning("Startup model restore failed. Loaded sample instead.");
      const sample = buildSampleMermaid();
      updateEditorText(sample);
      await renderFromText({ live: false });
    }
  }

  if (localStorage.getItem(ONBOARDING_SEEN_KEY) !== "true") {
    openTipsDialog({ persistSeen: false });
  }
}

boot().catch((err) => {
  showError(err);
  try {
    if (!state.pack) state.pack = getFallbackPack();
    if (!state.theme) state.theme = getFallbackTheme();
    if (!state.model) {
      state.model = createInitialModel(state.pack.packId, state.theme.themeId);
    }
    if (!state.editor) {
      state.editor = createPlainEditor(els.srcTextarea);
    }
    const sample = buildSampleMermaid();
    updateEditorText(sample);
    syncEditorReadOnly();
    void renderFromText({ live: false });
  } catch (fallbackErr) {
    console.error("[boot] fallback failed:", fallbackErr);
  }
});
