import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { summarizeGpuStatus } = require("../src/main/gpuDiagnostics.js");

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
