# Andersen-Editor

Mermaid + 図形編集（Hybrid Infra Pack）

## WSLg / HiDPI で表示が荒いとき

WSLg では分数スケーリング（125%など）や XWayland 経由表示でボケが出ることがあります。以下を順に試してください。

1. **UI Scale / Ozone 設定**
   - アプリ上部の `UI Scale` と `Ozone` を調整後、再起動してください。
   - `Ozone=Auto` は Wayland 優先で起動を試みます。

2. **Windows 側スケーリングの見直し**
   - 100% / 200% などキリの良いスケールが改善するケースがあります。

3. **.wslgconfig の設定**
   - `C:\\ProgramData\\Microsoft\\WSL\\.wslgconfig` に以下を追加し、`wsl --shutdown` で再起動します。
   ```ini
   [system-distro-env]
   WESTON_RDP_DISABLE_FRACTIONAL_HI_DPI_SCALING=true
   ```

4. **強制スケールの環境変数**
   - 起動前に以下を設定できます（再起動必須）。
   ```bash
   AE_FORCE_DEVICE_SCALE_FACTOR=1.25 npm run dev
   ```
   - `ELECTRON_FORCE_DEVICE_SCALE_FACTOR` も利用可能です。
