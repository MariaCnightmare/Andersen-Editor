# Andersen Editor

Andersen Editor は、Mermaid テキスト編集と GUI 操作を往復できる Electron ベースの図編集ツールです。  
保存時は `Mermaid + %%AE:MODEL (+ RAW blocks)` を保持しつつ、エディタ表示は Mermaid 本文のみを扱います。

## 概要

- Mermaid を直接編集しながら、GUI（ノード一覧/Inspector/プレビュー）で同時編集できる
- 編集は常時双方向同期（テキスト変更 <-> モデル変更）
- Mermaid 構文エラー時も最後に成功したプレビューを保持し、`Problems` に詳細を表示
- Export（Mermaid / SVG / PNG / PDF / MODEL JSON）
- Electron ネイティブメニュー連携（File/Edit/View/Help）

## セットアップ

### 前提

- Node.js 18+ 推奨
- npm
- Electron 実行環境（Linux/Windows）

### インストール

```bash
npm install
```

### 起動（Electron）

```bash
npm run start:electron
```

### 起動（Web開発）

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

## 基本フロー

1. `File > 新規` でテンプレートを作成
2. 左ペイン（ノード/エッジ/境界）か右ペイン（Mermaid）で編集
3. 中央プレビューで配置調整・接続操作
4. `Problems` で警告/エラー確認
5. `Export` から出力

## 重要な同期仕様

- GUI編集（追加/削除/移動/属性変更）は Mermaid テキストへ即時反映されます
- Mermaid テキスト編集は parse 成功時のみモデルへ反映されます
- parse 失敗時は `Problems` 更新のみ行い、最後の成功プレビューを維持します
- エディタ表示には `%%AE:MODEL` / RAW ブロックは出しません
- ノード/エッジをすべて削除した場合、エディタ表示は空文字になります

## 機能別ガイド

### 1. File

使う場面:
- 新規作成、既存 `.mmd` の読み込み、保存

使い方:
- `新規`: テンプレート選択ダイアログから開始
- `開く`: `.mmd` を読み込み
- `保存`: 現在パスへ保存
- `名前を付けて保存`: 新規パスへ保存

### 2. Clipboard

使う場面:
- 他ツールとの受け渡し、チーム共有

使い方:
- `Copy Mermaid`: 現在ソースをクリップボードへ
- `Paste Mermaid`: クリップボード内容を貼り付けて再解析
- `Copy SVG`: 現在プレビューSVGをコピー
- `Copy PNG`: 現在プレビューをPNG化してコピー

### 3. Export

使う場面:
- 納品、資料作成、外部連携

使い方:
- `Export` メニューから形式を選択
- 保存先を指定して実行

対応形式:
- Mermaid (`.mmd`)
- SVG (`.svg`)
- PNG (`.png`)
- PDF (`.pdf`) ※ Pro
- MODEL JSON (`.json`) ※ Pro

補足:
- PNG 高解像度（倍率>1）は Pro 判定の対象です

### 4. Undo / Redo / Format / Re-layout

使う場面:
- 編集の取り消し/やり直し、コード整形、再配置

使い方:
- `Undo` / `Redo`: 編集履歴を前後移動
- `Format`: Mermaid テキスト整形
- `Re-layout`: 現在モデルを再レンダして配置を整える

### 5. Connect モード

使う場面:
- ノード間の接続を素早く追加/付け替え

使い方:
- `Connect` を ON
- ノードに表示されるコネクタ（ハンドル）をクリック
- 接続元 -> 接続先の順でクリックするとエッジ作成
- `Esc` でキャンセル可能

### 6. Theme / Direction / UI設定

使う場面:
- 見た目の切り替え、向き変更、表示倍率調整

使い方:
- `Theme`: テーマ切り替え（CSS変数を再適用）
- `Direction`: `LR` / `TB` 切り替え
- `UI Scale`: UI倍率設定
- `Ozone`: 表示バックエンド指定（環境向け）

### 7. 左ペイン（テンプレ/モデル）

使う場面:
- 構成要素をフォームで追加・管理

使い方:
- `ノード追加`: role選択して追加
- `ノード一覧`: 選択/削除
- `エッジ追加`: from/to/kind/label 指定して追加
- `エッジ一覧`: 選択/削除
- `境界追加`: subgraph 追加
- `境界一覧`: 選択/削除
- `プロパティ`: 選択中要素の詳細編集

### 8. 中央プレビュー

使う場面:
- レイアウト確認、ドラッグ編集、ズーム/パン

使い方:
- ノードドラッグで位置変更
- ホイール/ボタンでズーム
- パン操作（UIボタン、または中クリックドラッグ）
- `Fit` / `Center` で表示を整える

### 9. 右ペイン（Inspector / Mermaid / Problems）

使う場面:
- コード編集、詳細プロパティ編集、エラー確認

使い方:
- Mermaid エディタで直接編集
- Inspector でノード/エッジ属性編集（label, role, shape, style, zone, pin など）
- エッジ/ラベルのダブルクリックでラベル編集
- Problems でエラー行へジャンプ

### 10. コンテキストメニュー（右クリック）

使う場面:
- ノード/エッジの素早い編集

使い方:
- ノード右クリック: 選択、Connect ON、形状/色/ゾーン変更、Pin、削除
- エッジ右クリック: 選択、破線切替、削除
- 余白右クリック: Connect ON/OFF、パンリセット

### 11. パネル表示制御

使う場面:
- 作業領域の最適化

使い方:
- 左右パネルを折りたたみ/展開
- Inspector 表示切替
- Problems 表示切替
- スプリッタで幅調整

### 12. Dev mode / Internal blocks

使う場面:
- 解析・検証・復元操作

使い方:
- `Dev mode` ON で内部機能表示
- `Show internal blocks` で MODEL/RAW を表示（開発向け）
- `Copy diagnostics` で診断情報コピー
- `Restore snapshot` で保存スナップショットから復元

### 13. Pro Unlock

使う場面:
- Pro対象のExport機能を利用

使い方:
- 右上 `Free/Pro` ボタンでダイアログ表示
- `Proを有効化` で購入
- `購入を復元` で復元

## ショートカット

- `CmdOrCtrl+N`: 新規
- `CmdOrCtrl+O`: 開く
- `CmdOrCtrl+S`: 保存
- `CmdOrCtrl+Shift+S`: 名前を付けて保存
- `CmdOrCtrl+Shift+F`: Mermaid整形
- `CmdOrCtrl+Shift+L`: Re-layout
- `CmdOrCtrl+= / - / 0 / 9`: ズームイン / ズームアウト / 100% / Fit
- `CmdOrCtrl+Shift+0`: パンリセット
- `CmdOrCtrl+Z`: Undo
- `CmdOrCtrl+Shift+Z` / `CmdOrCtrl+Y`: Redo
- `Delete` / `Backspace`: 選択要素削除（入力欄以外）
- `Tab`: ノード/エッジ選択巡回
- `C`: Connect モード切替
- `Esc`: 選択解除/接続キャンセル

## トラブルシュート

- `SVGがありません`:
  - Mermaid 構文エラーを解消し、プレビュー生成を確認
- 保存/Export 失敗:
  - パス権限、ディスク空き容量、ファイルロックを確認
- `Problems` に parse エラー:
  - 該当行へジャンプして Mermaid 構文を修正
- Electron で dbus 警告:
  - Linux/WSL 環境由来のことがあり、起動自体に問題なければ無視可

## ディレクトリ構成（主要）

- `src/main/`
  - `main.cjs`: Electron main、IPC、ダイアログ/Export実処理
  - `appMenu.cjs`: ネイティブメニュー定義
  - `preload.cjs`: renderer 公開API
- `src/preload/`
  - `menuBridge.cjs`: メニュー状態同期
- `src/renderer/`
  - `index.html`: UI
  - `style.css`: UIスタイル
  - `renderer.js`: アプリ本体（編集/同期/プレビュー/操作）
  - `editorUtils.mjs`: 補助ユーティリティ
- `src/core/`
  - `codec.js`: AE:MODEL 埋め込み/抽出
  - `generateMermaid.js`: モデル->Mermaid生成
  - `model.js`: モデル正規化
- `docs/`: 仕様/監査ドキュメント

## 開発メモ

- 保存形式は `Mermaid + %%AE:MODEL + RAW blocks`
- Mermaid の `securityLevel` は `loose`
- 入力は信頼できるデータを前提に扱う

## ライセンス

MIT（`package.json` の `license` 準拠）

## 謝辞

- [Electron](https://www.electronjs.org/)
- [Mermaid](https://mermaid.js.org/)
- [CodeMirror](https://codemirror.net/)
