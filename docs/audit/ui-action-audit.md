# UI Action Audit (Andersen-Editor)

最終更新: 2026-02-14
対象: 現行ワークツリー（HEAD）

## 1. 監査結果サマリ
- 監査対象UI（Toolbar/Menu/Context menu/Pane controls）をコード接続まで追跡。
- 主要アクションは実装済み。無反応ボタンは確認されず。
- Export は Mermaid/SVG について「保存先パス入力 + 参照 + 実書き込み」に刷新（本ドキュメント更新と同時実装）。
- UI-only 要素: `Mode` セレクタは機能廃止のため `disabled + reason` を設定し非表示化。

## 2. 配線一覧（根拠付き）

### File / Export / Clipboard
| UI Action | Status | UI要素 | イベント接続 | 実処理/IPC |
|---|---|---|---|---|
| 新規 | Implemented | `src/renderer/index.html:99` `#btnNew` | `src/renderer/renderer.js:2931` | 新規ダイアログ (`wireNewDialog`) `src/renderer/renderer.js:3654` |
| 開く | Implemented | `src/renderer/index.html:100` `#btnOpen` | `src/renderer/renderer.js:2938` | `window.api.openMmd` -> `dialog:openMmd` `src/main/main.cjs:445` |
| 保存 | Implemented | `src/renderer/index.html:101` `#btnSave` | `src/renderer/renderer.js:2967` | `prepareContentForSave` 経由 `fs:saveMmd` `src/main/main.cjs:481` |
| 名前を付けて保存 | Implemented | `src/renderer/index.html:102` `#btnSaveAs` | `src/renderer/renderer.js:2958` | `dialog:saveMmdAs` `src/main/main.cjs:462` |
| Copy Mermaid | Implemented | `src/renderer/index.html:108` | `src/renderer/renderer.js:2981` | `navigator.clipboard.writeText` |
| Paste Mermaid | Implemented | `src/renderer/index.html:109` | `src/renderer/renderer.js:2989` | `navigator.clipboard.readText` + `renderFromText` |
| Copy SVG | Implemented | `src/renderer/index.html:110` | `src/renderer/renderer.js:3002` | `getSvgText()` |
| Copy PNG | Implemented | `src/renderer/index.html:111` | `src/renderer/renderer.js:3012` | `svgToPng()` + Clipboard API |
| Export Mermaid | Implemented | `src/renderer/index.html:117` | `src/renderer/renderer.js:3070` | Exportモーダル `openExportDialog('mermaid')` `src/renderer/renderer.js:946` |
| Export SVG | Implemented | `src/renderer/index.html:118` | `src/renderer/renderer.js:3075` | Exportモーダル `openExportDialog('svg')` `src/renderer/renderer.js:946` |
| Export PNG | Implemented | `src/renderer/index.html:119` | `src/renderer/renderer.js:3079` | 既存 `export:png` `src/main/main.cjs:604` |
| Export PDF | Implemented | `src/renderer/index.html:120` | `src/renderer/renderer.js:3092` | 既存 `export:pdf` `src/main/main.cjs:621` |
| Export MODEL(JSON) | Implemented | `src/renderer/index.html:121` | `src/renderer/renderer.js:3099` | 既存 `export:modelJson` `src/main/main.cjs:647` |

### Edit / Diagram / View
| UI Action | Status | UI要素 | イベント接続 | 実処理 |
|---|---|---|---|---|
| Undo | Implemented | `src/renderer/index.html:127` | `src/renderer/renderer.js:3025` | editor undo or model undo |
| Redo | Implemented | `src/renderer/index.html:128` | `src/renderer/renderer.js:3033` | editor redo or model redo |
| Format | Implemented | `src/renderer/index.html:129` | `src/renderer/renderer.js:3041` | `formatMermaid` + live render |
| Apply | Implemented | `src/renderer/index.html:130` | `src/renderer/renderer.js:3301` | `renderFromText({live:false})` |
| Re-layout | Implemented | `src/renderer/index.html:131` | `src/renderer/renderer.js:3049` | `renderFromModel` + dirty |
| Connect | Implemented | `src/renderer/index.html:132` | `src/renderer/renderer.js:3056` | `setConnectMode` |
| Zoom/Pan controls | Implemented | `src/renderer/index.html:263-281` | `src/renderer/renderer.js:3114-3166` | zoom/pan state更新 |
| マウスホイールズーム | Implemented | `#previewWrap` | `src/renderer/renderer.js:3416` | `zoomAt` |
| パン（中クリック） | Implemented | `#previewWrap` | `src/renderer/renderer.js:3375` | pointer captureでpan |

### Context menu
| UI Action | Status | UI要素 | イベント接続 | 実処理 |
|---|---|---|---|---|
| Canvas context menu | Implemented | `src/renderer/index.html:336` `#ctxMenu` | `src/renderer/renderer.js:3428` | Connect/Pan reset |
| Node context menu | Implemented | 右クリック `g.node` | `src/renderer/renderer.js:3461` | 形状/色/ゾーン/Pin/削除 |
| Edge context menu | Implemented | 右クリック `g.edgePath` | `src/renderer/renderer.js:3613` | 破線切替/削除 |

### Main menu bridge
- Main menu action dispatch: `src/main/appMenu.cjs:33-229`
- Action -> DOM bridge: `src/preload/menuBridge.js:5-45`
- Renderer側は該当ボタン click に集約（例: export `src/preload/menuBridge.js:12-16` -> `src/renderer/renderer.js:3069-3112`）

## 3. Missing / Partial / UI-only

### A. Export UX（対応済み）
- 期待: Export時に保存先パスを直接編集でき、参照ボタンで選べる。
- 旧状況: 形式ごとに即 `showSaveDialog` を開くのみ（入力欄なし）。
- 原因: Export処理が renderer 直結で、モーダルUIが未実装。
- 対応: 実装済み。
  - Exportモーダル追加: `src/renderer/index.html:60-87`
  - パス検証/拡張子補正: `src/renderer/renderer.js:886-900`
  - Browse: `chooseExportPath` IPC `src/main/main.cjs:518`
  - 書き込み: `export:writeFile` IPC `src/main/main.cjs:545`
  - フォルダを開く: `shell:showItemInFolder` `src/main/main.cjs:559`

### B. Mode selector（UI-only）
- Feature名: `Mode` (`モデル編集/テキスト編集`)
- 期待: モード切替として動作。
- 現状: 実際のモード運用は廃止済みで、UIは表示しても意味がない。
- 原因: 双方向同期方針へ移行済み。
- 対応方針: 実装しない。`disabled + reason` を付与し非表示化。
  - `src/renderer/renderer.js:3243-3251`

### C. Export導線の統一度
- Status: Partially
- 現状: Mermaid/SVG は新モーダル、PNG/PDF/MODEL は既存の直接保存ダイアログ。
- 原因: MVP優先で Mermaid/SVG を先行実装。
- 方針: 次PRで Export UI を単一モーダルへ統合（format optionsを拡張）。

## 4. Inspector/Mermaid 上部余白の調査
- 症状: Mermaidコード領域の上に不自然な空白。
- 原因:
  - CodeMirror生成後に `textarea` が再表示され、空きブロックが残る経路があった。
  - 根拠: `src/renderer/renderer.js:1173-1180` (`initEditor`)
- 対応:
  - CodeMirror利用時は `textarea` を `display:none` 維持。
  - `srcEditor` プレースホルダは非表示維持。
- 関連レイアウト:
  - `editorArea` のflex構成 `src/renderer/style.css:448-456`
  - inline inspector の空要素抑制 `src/renderer/style.css:432-445`
- Before/After:
  - Before: コード領域上部に空白ブロックが残る。
  - After: 余白ブロックが消え、コード領域が上から詰まって表示。

## 5. 今回の実装差分（要点）
- Exportモーダルと保存先入力/参照UIを追加（Mermaid/SVG）。
- Main IPCに choose path / write file / open folder を追加。
- 既存Export（PNG/PDF/MODEL）は互換維持。
- UI-only (`Mode`) を明示無効化。
- 左ペインの追加ボタン縦崩れ修正（`.row` のflex調整）。

