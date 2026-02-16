function createWindowsStoreBridge() {
  return {
    available: false,
    async getEntitlement() {
      return { ok: false, error: "Store entitlement API unavailable in this build." };
    },
    async purchasePro() {
      return { ok: false, error: "Store purchase API unavailable in this build." };
    },
    async restore() {
      return { ok: false, error: "Store restore API unavailable in this build." };
    }
  };
}

module.exports = {
  createWindowsStoreBridge
};

