import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { summarizeGpuStatus, formatDiagnosticsText } = require("../src/main/gpuDiagnostics.cjs");

test("gpu_status_enabled_when_core_features_enabled", () => {
  const summary = summarizeGpuStatus({
    gpu_compositing: "enabled",
    webgl: "enabled",
    canvas_oop_rasterization: "enabled"
  });
  assert.equal(summary.enabled, true);
  assert.equal(summary.reason, "feature_status_enabled");
});

test("gpu_status_disabled_when_env_flag_requested", () => {
  const summary = summarizeGpuStatus(
    {
      gpu_compositing: "enabled",
      webgl: "enabled"
    },
    { disableRequested: true }
  );
  assert.equal(summary.enabled, false);
  assert.equal(summary.reason, "disabled_by_env:AE_DISABLE_GPU=1");
});

test("diagnostics_text_includes_ozone_decision_path", () => {
  const text = formatDiagnosticsText(
    {
      sessionType: "wayland",
      isWsl: true,
      envDisplay: ":0",
      envWaylandDisplay: "wayland-0",
      envOzoneHint: "",
      ozoneHint: "x11",
      ozoneEnabled: true,
      ozoneDecision: {
        resolved: "x11",
        reason: "wsl_decorations_default",
        prefHint: "",
        wsl: true
      }
    },
    { summary: { enabled: true }, info: {} }
  );
  assert.match(text, /ozone\.resolved=x11/);
  assert.match(text, /ozone\.reason=wsl_decorations_default/);
  assert.match(text, /env\.DISPLAY=:0/);
});
