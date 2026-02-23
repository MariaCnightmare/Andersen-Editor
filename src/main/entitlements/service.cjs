const { buildCapabilityStatus, resolveExportCapability } = require("./capabilities.cjs");
const { createWindowsStoreBridge } = require("./windowsStoreBridge.cjs");

function asBoolEnv(name) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

class EntitlementService {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.bridge = createWindowsStoreBridge();
    this.storeBuild = asBoolEnv("AE_STORE_BUILD");
    this.devPro = asBoolEnv("AE_DEV_PRO") && !this.storeBuild;
    this.state = {
      isPro: false,
      source: "free-default",
      updatedAt: 0,
      capabilities: buildCapabilityStatus(false),
      lastError: null,
      bridgeAvailable: !!this.bridge?.available,
      devOverride: this.devPro,
      storeBuild: this.storeBuild
    };
  }

  getStatus() {
    return { ...this.state, capabilities: { ...this.state.capabilities } };
  }

  hasCapability(capability) {
    if (!capability) return true;
    return !!this.state.capabilities?.[capability];
  }

  async refresh(reason = "manual") {
    let isPro = false;
    let source = this.storeBuild ? "store-build" : "free-default";
    let lastError = null;

    if (this.storeBuild) {
      isPro = false;
      source = "store-build";
    } else if (this.devPro) {
      isPro = true;
      source = "dev-flag";
    } else if (this.bridge?.available) {
      const res = await this.bridge.getEntitlement();
      if (res?.ok) {
        isPro = !!res.isPro;
        source = "store";
      } else {
        lastError = res?.error || "Failed to refresh entitlements from store.";
      }
    }

    this.state = {
      isPro,
      source,
      updatedAt: Date.now(),
      capabilities: buildCapabilityStatus(isPro),
      lastError,
      bridgeAvailable: !!this.bridge?.available,
      devOverride: this.devPro,
      storeBuild: this.storeBuild
    };
    this.logger?.info?.(`[entitlements] refresh(${reason}) => ${isPro ? "PRO" : "FREE"} via ${source}`);
    return this.getStatus();
  }

  async purchasePro() {
    if (this.storeBuild) {
      return {
        ok: false,
        code: "STORE_DISABLED",
        error: "Pro purchase is not available in this Store build yet.",
        status: await this.refresh("purchase-store-disabled")
      };
    }
    if (this.devPro) {
      return { ok: true, status: await this.refresh("purchase-dev") };
    }
    if (!this.bridge?.available) {
      return {
        ok: false,
        code: "STORE_UNAVAILABLE",
        error: "Store purchase API unavailable on this environment.",
        status: this.getStatus()
      };
    }
    const res = await this.bridge.purchasePro();
    if (!res?.ok) {
      return {
        ok: false,
        code: "PURCHASE_FAILED",
        error: res?.error || "Purchase failed.",
        status: await this.refresh("purchase-failed")
      };
    }
    return { ok: true, status: await this.refresh("purchase-success") };
  }

  async restore() {
    if (this.storeBuild) {
      return {
        ok: false,
        code: "STORE_DISABLED",
        error: "Pro restore is not available in this Store build yet.",
        status: await this.refresh("restore-store-disabled")
      };
    }
    if (this.devPro) {
      return { ok: true, status: await this.refresh("restore-dev") };
    }
    if (!this.bridge?.available) {
      return {
        ok: false,
        code: "STORE_UNAVAILABLE",
        error: "Store restore API unavailable on this environment.",
        status: this.getStatus()
      };
    }
    const res = await this.bridge.restore();
    if (!res?.ok) {
      return {
        ok: false,
        code: "RESTORE_FAILED",
        error: res?.error || "Restore failed.",
        status: await this.refresh("restore-failed")
      };
    }
    return { ok: true, status: await this.refresh("restore-success") };
  }
}

function createEntitlementService(opts) {
  return new EntitlementService(opts);
}

module.exports = {
  createEntitlementService,
  resolveExportCapability
};
