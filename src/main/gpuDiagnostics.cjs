function pickPrimaryGpuDevice(gpuInfo) {
  const devices = Array.isArray(gpuInfo?.gpuDevice) ? gpuInfo.gpuDevice : [];
  if (!devices.length) return null;
  return devices.find((d) => d?.active) || devices[0];
}

function summarizeGpuStatus(featureStatus, { disableRequested = false } = {}) {
  const status = featureStatus && typeof featureStatus === "object" ? featureStatus : {};
  const gpuCompositing = String(status.gpu_compositing || "unknown");
  const webgl = String(status.webgl || "unknown");
  const blocking = Object.entries(status).find(([, v]) => String(v || "").toLowerCase() !== "enabled");
  if (disableRequested) {
    return {
      enabled: false,
      reason: "disabled_by_env:AE_DISABLE_GPU=1",
      gpuCompositing,
      webgl
    };
  }
  if (gpuCompositing.toLowerCase() !== "enabled") {
    return {
      enabled: false,
      reason: `gpu_compositing=${gpuCompositing}`,
      gpuCompositing,
      webgl
    };
  }
  if (webgl.toLowerCase() !== "enabled") {
    return {
      enabled: false,
      reason: `webgl=${webgl}`,
      gpuCompositing,
      webgl
    };
  }
  if (blocking) {
    return {
      enabled: false,
      reason: `${blocking[0]}=${blocking[1]}`,
      gpuCompositing,
      webgl
    };
  }
  return {
    enabled: true,
    reason: "feature_status_enabled",
    gpuCompositing,
    webgl
  };
}

function summarizeGpuInfo(gpuInfo) {
  const device = pickPrimaryGpuDevice(gpuInfo);
  return {
    vendorId: device?.vendorId ?? null,
    deviceId: device?.deviceId ?? null,
    deviceString: device?.deviceString || "unknown",
    driverVendor: gpuInfo?.auxAttributes?.glVendor || "unknown",
    driverRenderer: gpuInfo?.auxAttributes?.glRenderer || "unknown",
    driverVersion: gpuInfo?.auxAttributes?.driverVersion || "unknown"
  };
}

function formatDiagnosticsText(diag, gpuDiag) {
  const gpu = gpuDiag || {};
  const gpuSummary = gpu.summary || {};
  const gpuInfo = gpu.info || {};
  const ozoneDecision = diag?.ozoneDecision || {};
  return [
    `sessionType=${diag?.sessionType || "unknown"}`,
    `isWsl=${diag?.isWsl ? "true" : "false"}`,
    `backend=${diag?.backend || "unknown"}`,
    `env.ELECTRON_OZONE_PLATFORM_HINT=${diag?.envOzoneHint || ""}`,
    `env.DISPLAY=${diag?.envDisplay || ""}`,
    `env.WAYLAND_DISPLAY=${diag?.envWaylandDisplay || ""}`,
    `env.XDG_SESSION_TYPE=${diag?.sessionType || "unknown"}`,
    `displayScale=${diag?.displayScale ?? "unknown"}`,
    `zoomFactor=${diag?.zoomFactor ?? "unknown"}`,
    `uiScalePref=${diag?.uiScalePref || "auto"}`,
    `ozone=${diag?.ozoneHint || (diag?.ozoneEnabled ? "auto" : "off")}`,
    `ozone.resolved=${ozoneDecision.resolved || "unknown"}`,
    `ozone.reason=${ozoneDecision.reason || "unknown"}`,
    `ozone.pref=${ozoneDecision.prefHint || ""}`,
    `ozone.wsl=${ozoneDecision.wsl ? "true" : "false"}`,
    `gpu.enabled=${gpuSummary.enabled === true ? "true" : "false"}`,
    `gpu.reason=${gpuSummary.reason || "unknown"}`,
    `gpu.gpu_compositing=${gpuSummary.gpuCompositing || "unknown"}`,
    `gpu.webgl=${gpuSummary.webgl || "unknown"}`,
    `gpu.adapter=${gpuInfo.deviceString || "unknown"}`,
    `gpu.vendorId=${gpuInfo.vendorId ?? "unknown"}`,
    `gpu.deviceId=${gpuInfo.deviceId ?? "unknown"}`,
    `gpu.driverVendor=${gpuInfo.driverVendor || "unknown"}`,
    `gpu.driverRenderer=${gpuInfo.driverRenderer || "unknown"}`,
    `gpu.driverVersion=${gpuInfo.driverVersion || "unknown"}`
  ].join("\n");
}

module.exports = {
  summarizeGpuStatus,
  summarizeGpuInfo,
  formatDiagnosticsText
};
