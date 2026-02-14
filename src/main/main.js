const { app, BrowserWindow, ipcMain, dialog, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { installAppMenu, wireMenuStateIpc } = require("./appMenu");

let mainWindow = null;

app.commandLine.appendSwitch("high-dpi-support", "1");

let diagInfo = {
  sessionType: process.env.XDG_SESSION_TYPE || "unknown",
  envWaylandDisplay: process.env.WAYLAND_DISPLAY || "",
  envDisplay: process.env.DISPLAY || "",
  backend: "unknown",
  displayScale: 1,
  zoomFactor: 1,
  forcedScale: null,
  forcedScaleSource: null,
  warning: null,
  ozoneEnabled: false,
  ozoneHint: null,
  uiScalePref: null
};

const isWsl = !!(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
if (isWsl) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("use-gl", "swiftshader");
}

function parseScale(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0.4 || n > 4) return null;
  return n;
}

function getConfigPath() {
  try {
    return path.join(app.getPath("userData"), "andersen-config.json");
  } catch {
    return null;
  }
}

function readUiScalePref() {
  try {
    const cfgPath = getConfigPath();
    if (!cfgPath || !fs.existsSync(cfgPath)) return null;
    const raw = fs.readFileSync(cfgPath, "utf-8");
    const json = JSON.parse(raw);
    return json && json.uiScale ? String(json.uiScale) : null;
  } catch {
    return null;
  }
}

function readOzonePref() {
  try {
    const cfgPath = getConfigPath();
    if (!cfgPath || !fs.existsSync(cfgPath)) return null;
    const raw = fs.readFileSync(cfgPath, "utf-8");
    const json = JSON.parse(raw);
    return json && json.ozone ? String(json.ozone) : null;
  } catch {
    return null;
  }
}

function parseOzoneHint(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
const allowed = new Set(["auto", "wayland", "x11"]);
  if (!allowed.has(v)) return null;
  return v;
}

const envScale =
  process.env.AE_FORCE_DEVICE_SCALE_FACTOR || process.env.ELECTRON_FORCE_DEVICE_SCALE_FACTOR;
const prefScale = readUiScalePref();
if (prefScale) diagInfo.uiScalePref = String(prefScale);
const parsedEnvScale = parseScale(envScale);
const chosenScale = parsedEnvScale ?? null;

if (envScale && !parsedEnvScale) {
  diagInfo.warning = `invalid AE_FORCE_DEVICE_SCALE_FACTOR: ${envScale}`;
}
if (chosenScale) {
  app.commandLine.appendSwitch("force-device-scale-factor", String(chosenScale));
  diagInfo.forcedScale = chosenScale;
  diagInfo.forcedScaleSource = "env";
}

if (isWsl) {
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  diagInfo.warning = diagInfo.warning || "GPU disabled for WSL";
}

const envOzoneHint = process.env.ELECTRON_OZONE_PLATFORM_HINT;
const envOzone = process.env.AE_OZONE === "1";
const prefOzone = readOzonePref();
let parsedEnvOzone = parseOzoneHint(envOzoneHint);
let parsedPrefOzone = parseOzoneHint(prefOzone);
if (envOzoneHint === "off") parsedEnvOzone = "x11";
if (prefOzone === "off") parsedPrefOzone = "x11";
if (isWsl && diagInfo.envDisplay && !parsedEnvOzone) {
  if (parsedPrefOzone && parsedPrefOzone !== "x11") {
    diagInfo.warning = diagInfo.warning || "WSL forcing ozone=x11";
    parsedPrefOzone = "x11";
  }
}
if (envOzoneHint && !parsedEnvOzone) {
  diagInfo.warning = `invalid ELECTRON_OZONE_PLATFORM_HINT: ${envOzoneHint}`;
}
if (!envOzoneHint && prefOzone && !parsedPrefOzone) {
  diagInfo.warning = `invalid ozone pref: ${prefOzone}`;
}
const forceAuto = process.env.AE_OZONE_AUTO === "1";
const autoOzone = diagInfo.envWaylandDisplay && (!diagInfo.envDisplay || forceAuto) ? "auto" : null;
const ozoneHint = parsedEnvOzone || (envOzone ? "auto" : null) || parsedPrefOzone || autoOzone || null;

if (ozoneHint) {
  app.commandLine.appendSwitch("enable-features", "UseOzonePlatform");
  if (ozoneHint === "wayland") {
    app.commandLine.appendSwitch("ozone-platform", "wayland");
  } else if (ozoneHint === "x11") {
    app.commandLine.appendSwitch("ozone-platform", "x11");
  } else {
    app.commandLine.appendSwitch("ozone-platform-hint", ozoneHint);
  }
  process.env.ELECTRON_OZONE_PLATFORM_HINT = ozoneHint;
  diagInfo.ozoneEnabled = true;
  diagInfo.ozoneHint = ozoneHint;
} else if (ozoneHint === "off") {
  diagInfo.ozoneEnabled = false;
  diagInfo.ozoneHint = "off";
}

if (diagInfo.ozoneEnabled) {
  if (diagInfo.ozoneHint === "x11") diagInfo.backend = "x11";
  else if (diagInfo.ozoneHint === "wayland") diagInfo.backend = "wayland";
  else if (diagInfo.envWaylandDisplay) diagInfo.backend = "wayland";
  else diagInfo.backend = "x11";
} else {
  diagInfo.backend = diagInfo.envWaylandDisplay ? "xwayland" : "x11";
}

function createWindow() {
  const simpleUi = process.env.AE_SIMPLE_UI === "1";
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    backgroundColor: simpleUi ? "#ffffff" : "#0b0f16",
    webPreferences: {
      contextIsolation: !simpleUi,
      nodeIntegration: simpleUi,
      preload: simpleUi ? undefined : path.join(__dirname, "preload.js")
    }
  });

  if (simpleUi) {
    mainWindow.loadFile(path.join(__dirname, "..", "renderer", "simple.html"));
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }

  if (process.env.AE_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.on("console-message", (_evt, level, message, line, sourceId) => {
    const src = sourceId ? sourceId.split("/").slice(-1)[0] : "";
    console.log(`[renderer:${level}] ${message} ${src ? `(${src}:${line})` : ""}`);
  });

  mainWindow.webContents.on("did-fail-load", (_evt, code, desc, url) => {
    console.error(`[renderer] did-fail-load ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on("did-fail-provisional-load", (_evt, code, desc, url) => {
    console.error(`[renderer] did-fail-provisional-load ${code} ${desc} ${url}`);
  });

  mainWindow.webContents.on("render-process-gone", (_evt, details) => {
    console.error(`[renderer] process gone: ${details.reason}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents
      .executeJavaScript(
        "try{const info={ready:document.readyState,bodyLen:document.body?.innerText?.length||0,bodyClass:document.body?.className||'',toolbar:!!document.querySelector('.toolbar'),layout:!!document.querySelector('#layout')};console.log('[diag] ready',info);}catch(e){console.log('[diag] err',e?.message||e)}"
      )
      .catch(() => {});
    if (process.env.AE_DEBUG_OVERLAY === "1") {
      mainWindow.webContents
        .executeJavaScript(
          "try{const bar=document.createElement('div');bar.id='ae-debug';bar.textContent='AE DEBUG: '+(document.body?.className||'')+' | toolbar:'+!!document.querySelector('.toolbar')+' layout:'+!!document.querySelector('#layout');bar.style.cssText='position:fixed;top:6px;right:6px;z-index:9999;padding:6px 8px;background:#fffb;color:#111;border:1px solid #333;font:12px monospace';document.body.appendChild(bar);}catch(e){}"
        )
        .catch(() => {});
    }
    if (process.env.AE_SAFE_UI === "1") {
      mainWindow.webContents
        .executeJavaScript(
          "try{[...document.querySelectorAll('link[rel=stylesheet],style')].forEach(n=>n.remove());document.body.innerHTML='';const pre=document.createElement('pre');pre.textContent='SAFE UI MODE\\nbodyLen='+(document.body?.innerText?.length||0)+'\\nclass='+document.body?.className;pre.style.cssText='padding:16px;font:14px monospace;color:#111;background:#fff';document.body.appendChild(pre);}catch(e){console.log('[safe-ui] err',e?.message||e)}"
        )
        .catch(() => {});
    }
    if (process.env.AE_FORCE_BG === "1") {
      mainWindow.webContents
        .executeJavaScript(
          "try{document.documentElement.style.background='#fff';document.body.style.background='#fff';document.body.style.color='#111';document.body.style.visibility='visible';document.body.style.opacity='1';document.body.style.display='block';document.body.style.transform='none';document.body.style.zoom='1';}catch(e){}"
        )
        .catch(() => {});
    }
    if (process.env.AE_DEBUG_STYLE === "1") {
      mainWindow.webContents
        .executeJavaScript(
          "try{const b=getComputedStyle(document.body);const l=document.querySelector('#layout');const lb=l?getComputedStyle(l):null;console.log('[style] body', {display:b.display,visibility:b.visibility,opacity:b.opacity,transform:b.transform,background:b.backgroundColor,color:b.color});console.log('[style] layout', l?{display:lb.display,visibility:lb.visibility,opacity:lb.opacity,transform:lb.transform}:null);console.log('[style] bodyHTML', document.body?.outerHTML?.slice(0,200) || '');}catch(e){console.log('[style] err',e?.message||e)}"
        )
        .catch(() => {});
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (!simpleUi) {
    mainWindow.maximize();
  }
}

app.whenReady().then(() => {
  wireMenuStateIpc();
  createWindow();
  if (mainWindow) installAppMenu(mainWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    if (mainWindow) installAppMenu(mainWindow);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function ensureWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Main window not available");
  return mainWindow;
}

ipcMain.handle("diag:getInfo", async () => {
  try {
    const win = ensureWindow();
    diagInfo.zoomFactor = await win.webContents.getZoomFactor();
  } catch {}
  try {
    diagInfo.displayScale = screen.getPrimaryDisplay().scaleFactor;
  } catch {}
  return diagInfo;
});

ipcMain.handle("config:setUiScale", async (_evt, value) => {
  try {
    const cfgPath = getConfigPath();
    if (!cfgPath) return { ok: false, error: "config path unavailable" };
    let next = {};
    try {
      if (fs.existsSync(cfgPath)) {
        next = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      }
    } catch {}
    if (value === "auto" || value === "" || value == null) {
      delete next.uiScale;
      fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2), "utf-8");
      diagInfo.uiScalePref = null;
      return { ok: true, cleared: true };
    }
    const parsed = parseScale(value);
    if (!parsed) return { ok: false, error: `invalid uiScale: ${value}` };
    next.uiScale = String(parsed);
    fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2), "utf-8");
    diagInfo.uiScalePref = String(parsed);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "write failed" };
  }
});

ipcMain.handle("ui:setZoomFactor", async (_evt, value) => {
  try {
    const parsed = parseScale(value);
    if (!parsed) return { ok: false, error: `invalid zoomFactor: ${value}` };
    const win = ensureWindow();
    await win.webContents.setZoomFactor(parsed);
    diagInfo.zoomFactor = parsed;
    return { ok: true, zoomFactor: parsed };
  } catch (err) {
    return { ok: false, error: err?.message || "zoom apply failed" };
  }
});

ipcMain.handle("ui:getZoomFactor", async () => {
  try {
    const win = ensureWindow();
    const zoomFactor = await win.webContents.getZoomFactor();
    return { ok: true, zoomFactor };
  } catch (err) {
    return { ok: false, error: err?.message || "zoom read failed" };
  }
});

ipcMain.handle("config:setOzone", async (_evt, value) => {
  const v = String(value || "").trim();
  const allowed = new Set(["auto", "wayland", "x11", "off"]);
  if (!allowed.has(v)) return { ok: false, error: `invalid ozone: ${value}` };
  try {
    const cfgPath = getConfigPath();
    if (!cfgPath) return { ok: false, error: "config path unavailable" };
    let next = {};
    try {
      if (fs.existsSync(cfgPath)) {
        next = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      }
    } catch {}
    next.ozone = v;
    fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2), "utf-8");
    diagInfo.ozoneHint = v;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "write failed" };
  }
});

// --- Asset read (templates/docs) ---
ipcMain.handle("asset:readText", async (_evt, relPath) => {
  const root = app.getAppPath();
  const full = path.resolve(root, relPath);

  // path traversal guard
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!full.startsWith(rootWithSep)) {
    return { ok: false, error: "Path traversal detected." };
  }
  if (!fs.existsSync(full)) {
    return { ok: false, error: `Not found: ${relPath}` };
  }
  const content = fs.readFileSync(full, "utf-8");
  return { ok: true, content };
});

// --- Open/Save Mermaid (.mmd) ---
ipcMain.handle("dialog:openMmd", async () => {
  const win = ensureWindow();
  const result = await dialog.showOpenDialog(win, {
    title: "Mermaidファイルを開く",
    properties: ["openFile"],
    filters: [
      { name: "Mermaid", extensions: ["mmd", "md", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return { canceled: false, filePath, content };
});

ipcMain.handle("dialog:saveMmdAs", async (_evt, args) => {
  const win = ensureWindow();
  const { content, defaultFilePath } = args || {};

  const result = await dialog.showSaveDialog(win, {
    title: "Mermaidファイルを保存",
    defaultPath: defaultFilePath || "diagram.mmd",
    filters: [
      { name: "Mermaid", extensions: ["mmd"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) return { canceled: true };

  fs.writeFileSync(result.filePath, content ?? "", "utf-8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("fs:saveMmd", async (_evt, args) => {
  const { filePath, content } = args || {};
  if (!filePath) return { ok: false, error: "filePath is empty" };
  fs.writeFileSync(filePath, content ?? "", "utf-8");
  return { ok: true };
});

// --- Export SVG/PNG/PDF ---
ipcMain.handle("export:svg", async (_evt, args) => {
  const win = ensureWindow();
  const { svgText, defaultFilePath } = args || {};
  if (!svgText) return { ok: false, error: "svgText is empty." };

  const result = await dialog.showSaveDialog(win, {
    title: "SVGとしてエクスポート",
    defaultPath: defaultFilePath || "diagram.svg",
    filters: [{ name: "SVG", extensions: ["svg"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  fs.writeFileSync(result.filePath, svgText, "utf-8");
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle("export:png", async (_evt, args) => {
  const win = ensureWindow();
  const { pngBase64, defaultFilePath } = args || {};
  if (!pngBase64) return { ok: false, error: "pngBase64 is empty." };

  const result = await dialog.showSaveDialog(win, {
    title: "PNGとしてエクスポート",
    defaultPath: defaultFilePath || "diagram.png",
    filters: [{ name: "PNG", extensions: ["png"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  const base64 = pngBase64.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync(result.filePath, Buffer.from(base64, "base64"));
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle("export:pdf", async (_evt, args) => {
  const win = ensureWindow();
  const { defaultFilePath } = args || {};

  const result = await dialog.showSaveDialog(win, {
    title: "PDFとしてエクスポート",
    defaultPath: defaultFilePath || "diagram.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  // 印刷用クラス（renderer側でも付与するが二重でもOK）
  await win.webContents.executeJavaScript(`document.body.classList.add("printing")`);
  await new Promise((r) => setTimeout(r, 60));

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    marginsType: 0,
    pageSize: "A4"
  });

  await win.webContents.executeJavaScript(`document.body.classList.remove("printing")`);
  fs.writeFileSync(result.filePath, pdfBuffer);
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle("export:modelJson", async (_evt, args) => {
  const win = ensureWindow();
  const { modelJson, defaultFilePath } = args || {};
  if (!modelJson) return { ok: false, error: "modelJson is empty." };
  const result = await dialog.showSaveDialog(win, {
    title: "MODEL(JSON)としてエクスポート",
    defaultPath: defaultFilePath || "diagram.model.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, modelJson, "utf-8");
  return { ok: true, filePath: result.filePath };
});
