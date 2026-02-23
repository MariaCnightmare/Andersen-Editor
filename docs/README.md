# Andersen-Editor GitHub Pages セットアップ

この `docs/` 配下には、Microsoft Partner Center の入力項目に使う公開ページを配置しています。

- `index.html` : Webサイト URL 用
- `privacy.html` : プライバシーポリシー URL 用
- `support.html` : サポートページ

## 公開方法（既存 `Andersen-Editor` リポジトリの `docs` を使う）

1. `docs/index.html`, `docs/privacy.html`, `docs/support.html` を含むコミットを `main` ブランチへ push
2. GitHub リポジトリ画面で `Settings` -> `Pages` を開く
3. `Build and deployment` の `Source` を `Deploy from a branch` に設定
4. `Branch` を `main`、`Folder` を `/docs` に設定して保存
5. 数分後、`https://<GitHubユーザー名>.github.io/Andersen-Editor/` で公開される

### Partner Center に入力するURL例

- Webサイト: `https://<GitHubユーザー名>.github.io/Andersen-Editor/`
- プライバシーポリシーURL: `https://<GitHubユーザー名>.github.io/Andersen-Editor/privacy.html`
- サポートURL（任意）: `https://<GitHubユーザー名>.github.io/Andersen-Editor/support.html`

## 別リポジトリ `andersen-editor-site` を使う場合

1. `andersen-editor-site` リポジトリを作成
2. この `docs/` 内のHTMLをリポジトリ直下へコピー（`index.html` など）
3. `Settings` -> `Pages` で `main` / `/(root)` を指定
4. `https://<GitHubユーザー名>.github.io/andersen-editor-site/` を Partner Center に設定

## アイコン表示について

ページは `Andersen-Editor_icon.png` を同階層から参照します。

- 推奨配置先: `docs/Andersen-Editor_icon.png`
- 未配置時は `AE` のフォールバック表示になります。

## スクリーンショット差し替え

`index.html` の「スクリーンショット」セクションはプレースホルダーです。
実画像を掲載する場合は `docs/` 配下に画像を置き、HTML内の該当箇所を更新してください。
