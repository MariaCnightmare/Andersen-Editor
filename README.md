# Andersen Editor

Andersen Editor は、Mermaid テキスト編集と GUI 操作を往復できる Electron ベースの図編集ツールです。  
`Mermaid + %%AE:MODEL (+ RAW blocks)` 形式で保存し、テキスト編集とプレビュー操作の両方を扱えます。

## 概要

- Mermaid を直接編集しつつ、プレビューでノード/エッジ/ゾーンを調整
- Mermaid 構文エラー時も UI を壊さず、`Problems` に詳細を表示
- Export（Mermaid / SVG / PNG / PDF / MODEL JSON）
- ネイティブメニュー（File/Edit/View/Help）から主要操作が可能

## 主な機能

- Mermaid round-trip
  - テキスト更新 -> parse 成功時のみモデル更新・再レンダ
  - parse 失敗時は最後に成功した SVG を保持し、`Problems` 更新のみ
- Inspector
  - ノード/エッジ属性編集（ラベル、shape、色、style、zone、pin など）
- Connect モード
  - ノード間の接続追加
- Export
  - Mermaid source (`.mmd`)
  - SVG (`.svg`)
  - PNG (`.png`)
  - PDF (`.pdf`)
  - MODEL JSON (`.json`)

## セットアップ

## 前提

- Node.js 18+ 推奨
- npm
- Linux/WSLg を含む Electron 実行環境

## インストール

```bash
npm install
```

## 起動

```bash
npm run dev
```

## テスト

```bash
npm test
```

## ビルド（Linux AppImage）

```bash
npm run dist
```

## 使い方（基本フロー）

1. `ファイル > 新規` でテンプレートを選択
2. 右ペインの Mermaid を編集、またはプレビュー/Inspector で編集
3. `Apply` でテキストを確定反映（構文エラー時は反映されない）
4. `Problems` で警告/エラーを確認
5. `ファイル > 書き出し` から Export

## 操作

## ショートカット（主なもの）

- `CmdOrCtrl+N`: 新規
- `CmdOrCtrl+O`: 開く
- `CmdOrCtrl+S`: 保存
- `CmdOrCtrl+Shift+S`: 名前を付けて保存
- `CmdOrCtrl+Shift+F`: Mermaid整形
- `CmdOrCtrl+Shift+L`: 再レイアウト
- `CmdOrCtrl+= / - / 0 / 9`: ズームイン / ズームアウト / 100% / Fit
- `CmdOrCtrl+Shift+0`: パンをリセット

## エディタ/プレビュー操作

- `CmdOrCtrl+Z`: Undo
- `CmdOrCtrl+Shift+Z` / `CmdOrCtrl+Y`: Redo
- `Delete` / `Backspace`: 選択要素削除（入力欄以外）
- `Tab`: ノード/エッジ選択を巡回
- `C`: Connect モード切替
- `Esc`: 選択解除
- プレビューのパン: 中クリックドラッグ
- プレビューのズーム: ホイール or ズームUI

## ノード追加/削除

- 左ペインの `ノード追加` / `エッジ追加` / `境界追加`
- 選択後 `Delete`、またはコンテキストメニューから削除

## Problems の見方

- parse/render エラー時に `Problems` に message/line/column/source を表示
- クリックで該当行へジャンプ
- エラー中も前回成功した SVG を維持

## Export

## 現行の標準導線

ネイティブメニュー `ファイル` から実行します。  
各形式は OS の保存ダイアログ（保存先指定）を使って出力します。

- `SVGを書き出し...`
- `Mermaidを書き出し...`
- `PNGを書き出し...`
- `PDFを書き出し...`
- `MODEL(JSON)を書き出し...`

## 保存先指定・参照ボタンについて

コードベースには、保存先パス入力 + `参照...` ボタン付きの Export ダイアログ実装（`#exportDialog`）があります。  
ただし現行UIでは Export の標準導線をネイティブメニューに寄せており、通常操作では OS の保存ダイアログを使用します。

## 失敗時の対処

- `SVGがありません` が出る: 先に `Apply` してプレビューを生成
- 保存に失敗する: パス権限・ディスク空き容量・ファイルロックを確認
- Mermaid構文エラー: `Problems` を修正して再実行

## 開発者向け

## ディレクトリ構成（主要）

- `src/main/`
  - `main.js`: Electron main、IPC、ダイアログ/Export実処理
  - `appMenu.js`: ネイティブメニュー定義
  - `preload.js`: renderer 公開API
- `src/preload/`
  - `menuBridge.js`: メニュー状態同期（チェック状態）
- `src/renderer/`
  - `index.html`: UI
  - `style.css`: UIスタイル
  - `renderer.js`: アプリ本体（編集/同期/プレビュー/操作）
  - `editorUtils.mjs`: 補助ユーティリティ
- `src/core/`
  - `codec.js`: AE:MODEL 埋め込み/抽出
  - `generateMermaid.js`: モデル->Mermaid生成
  - `model.js`: モデル正規化
- `templates/`: pack/theme テンプレート
- `tests/`: Node test
- `docs/`: 仕様/監査ドキュメント

## 開発メモ

- 保存形式は `Mermaid + %%AE:MODEL + RAW blocks`
- Mermaid の `securityLevel` は `loose`
- 入力は信頼できるデータを前提に扱うこと

## スクリーンショット

README 用のスクリーンショットは現時点で未同梱です（`docs/` 配下に追加予定）。

## ライセンス

MIT（`package.json` の `license` 準拠）

## 謝辞

- [Electron](https://www.electronjs.org/)
- [Mermaid](https://mermaid.js.org/)
- [CodeMirror](https://codemirror.net/)
