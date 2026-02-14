# Andersen-Editor E2E Plan

## Goal
Electron 実機で「入力欄フォーカス時の `Ctrl/Cmd+Z` がネイティブ Undo として動作し、モデル Undo が誤発火しない」ことを自動検証する。

## Recommended Tooling
- `Playwright` (`@playwright/test`) + Electron launch (`_electron.launch`)
- 理由:
  - Electron の実プロセスを起動できる
  - キーボード操作とフォーカス制御を再現しやすい
  - CI でヘッドレス実行しやすい

## Target Scenario
1. アプリ起動
2. 右ペインの入力欄（Inspector の `input` か `textarea`）へフォーカス
3. 入力値を変更
4. `Ctrl/Cmd+Z` を送信
5. 入力欄の値が 1 手戻ることを確認
6. ノード/エッジ数が変化しないことを確認（`deleteSelected()` 等の誤発火なし）

## Suggested Test Cases
- `e2e/undo-input-focus.native-undo.spec.ts`
  - 前提: ノードを 1 つ選択して Inspector の入力欄を表示
  - 操作: 入力欄編集 -> `Ctrl/Cmd+Z`
  - 期待:
    - 入力欄テキストが直前値へ戻る
    - 選択ノードが削除されていない
    - Problems パネルに新規エラーが出ていない

## Implementation Steps
1. 依存追加: `npm i -D @playwright/test`
2. `playwright.config.ts` を作成し、Electron 実行コマンドを `npm run dev` ではなく直接 `electron .` に設定
3. 最小 E2E を 1 本追加（上記シナリオ）
4. `npm run test:e2e` を追加
5. Linux CI で `xvfb-run -a npm run test:e2e` 実行

## CI Notes
- Linux では Xvfb 必須（GUI 依存）
- フォーカス不安定対策として:
  - `await locator.focus()` 後に短い待機
  - `expect(locator).toBeFocused()` を挟む
- 環境差 (`Ctrl`/`Meta`) は `process.platform` で分岐

## Out of Scope (for now)
- PNG/PDF export など重い UI 経路
- パフォーマンス計測
