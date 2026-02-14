// src/main/appMenu.js
const { Menu, app, dialog, ipcMain } = require("electron");

function sendAction(win, action) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("ae:menuAction", action);
}

function installAppMenu(win) {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),

    {
      label: "ファイル",
      submenu: [
        {
          label: "新規",
          accelerator: "CmdOrCtrl+N",
          click: () => sendAction(win, "file:new")
        },
        {
          label: "開く…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendAction(win, "file:open")
        },
        { type: "separator" },
        {
          label: "保存",
          accelerator: "CmdOrCtrl+S",
          click: () => sendAction(win, "file:save")
        },
        {
          label: "名前を付けて保存…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendAction(win, "file:saveAs")
        },
        { type: "separator" },
        {
          label: "SVGを書き出し…",
          click: () => sendAction(win, "file:exportSvg")
        },
        {
          label: "Mermaidを書き出し…",
          click: () => sendAction(win, "file:exportMermaid")
        },
        {
          label: "PNGを書き出し…",
          click: () => sendAction(win, "file:exportPng")
        },
        {
          label: "PDFを書き出し…",
          click: () => sendAction(win, "file:exportPdf")
        },
        {
          label: "MODEL(JSON)を書き出し…",
          click: () => sendAction(win, "file:exportModelJson")
        },
        { type: "separator" },
        ...(isMac ? [{ role: "close" }] : [{ role: "quit" }])
      ]
    },

    {
      label: "編集",
      submenu: [
        // Undo/Redo は renderer の wireKeys() に一本化している。
        // 二重発火防止のため、このメニュー項目には accelerator を付けない。
        {
          label: "取り消し",
          id: "edit.undo",
          click: () => sendAction(win, "edit:undo")
        },
        {
          label: "やり直し",
          id: "edit.redo",
          click: () => sendAction(win, "edit:redo")
        },
        { type: "separator" },
        {
          label: "Mermaid整形",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => sendAction(win, "edit:format")
        },
        {
          label: "再レイアウト（ピン解除）",
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => sendAction(win, "diagram:relayout")
        },
        { type: "separator" },
        { role: "copy", label: "コピー" },
        { role: "paste", label: "貼り付け" },
        { role: "selectAll", label: "すべて選択" }
      ]
    },

    {
      label: "表示",
      submenu: [
        {
          label: "ズームイン",
          accelerator: "CmdOrCtrl+=",
          click: () => sendAction(win, "view:zoomIn")
        },
        {
          label: "ズームアウト",
          accelerator: "CmdOrCtrl+-",
          click: () => sendAction(win, "view:zoomOut")
        },
        {
          label: "等倍（100%）",
          accelerator: "CmdOrCtrl+0",
          click: () => sendAction(win, "view:zoomReset")
        },
        {
          label: "画面にフィット",
          accelerator: "CmdOrCtrl+9",
          click: () => sendAction(win, "view:zoomFit")
        },
        { type: "separator" },
        {
          label: "パンをリセット",
          accelerator: "CmdOrCtrl+Shift+0",
          click: () => sendAction(win, "view:panReset")
        },
        { type: "separator" },

        // これらは Preload 側で状態同期する（チェックが追従する）
        {
          label: "Connect Mode",
          id: "view.connectMode",
          type: "checkbox",
          click: () => sendAction(win, "view:toggleConnect")
        },
        {
          label: "Developer Mode",
          id: "view.devMode",
          type: "checkbox",
          click: () => sendAction(win, "view:toggleDevMode")
        },
        {
          label: "Internal Blocksを表示",
          id: "view.internalBlocks",
          type: "checkbox",
          click: () => sendAction(win, "view:toggleInternal")
        },
        {
          label: "Problemsパネルを表示",
          id: "view.problemsVisible",
          type: "checkbox",
          checked: true,
          click: () => sendAction(win, "view:toggleProblems")
        },

        { type: "separator" },
        {
          label: "左ペインを折りたたむ",
          id: "pane.leftCollapsed",
          type: "checkbox",
          click: () => sendAction(win, "pane:collapseLeft")
        },
        {
          label: "右ペインを折りたたむ",
          id: "pane.rightCollapsed",
          type: "checkbox",
          click: () => sendAction(win, "pane:collapseRight")
        },

        { type: "separator" },
        // 開発用（配布版では隠す／無効化してもOK）
        { role: "reload", label: "再読み込み" },
        { role: "forceReload", label: "強制再読み込み" },
        { role: "toggleDevTools", label: "DevTools切替" }
      ]
    },

    {
      label: "ヘルプ",
      submenu: [
        {
          label: "Copy Diagnostics",
          click: () => sendAction(win, "help:copyDiagnostics")
        },
        {
          label: "プロジェクトページを開く",
          click: async () => {
            await dialog.showMessageBox(win, {
              type: "info",
              title: "Andersen-Editor",
              message: "プロジェクトページは準備中です",
              detail: "公開URLが確定したらこのメニューから開けるようにします。"
            });
          }
        },
        {
          label: "About",
          click: async () => {
            await dialog.showMessageBox(win, {
              type: "info",
              title: "Andersen-Editor",
              message: "Andersen-Editor",
              detail: "Native menu bridge is enabled."
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Preload から送られてくる UI 状態で、メニューのチェック状態を同期する
 * 例: connect-mode / problems-collapsed / left-collapsed / right-collapsed / devMode checkbox etc
 */
function wireMenuStateIpc() {
  ipcMain.on("ae:menuState", (_evt, st) => {
    const menu = Menu.getApplicationMenu();
    if (!menu || !st || typeof st !== "object") return;

    const setChecked = (id, value) => {
      const item = menu.getMenuItemById(id);
      if (!item) return;
      item.checked = !!value;
    };

    if ("devMode" in st) setChecked("view.devMode", st.devMode);
    if ("internalBlocks" in st) setChecked("view.internalBlocks", st.internalBlocks);
    if ("connectMode" in st) setChecked("view.connectMode", st.connectMode);
    if ("problemsVisible" in st) setChecked("view.problemsVisible", st.problemsVisible);
    if ("leftCollapsed" in st) setChecked("pane.leftCollapsed", st.leftCollapsed);
    if ("rightCollapsed" in st) setChecked("pane.rightCollapsed", st.rightCollapsed);
  });
}

module.exports = {
  installAppMenu,
  wireMenuStateIpc
};
