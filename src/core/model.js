export function createInitialModel(packId, themeId) {
  return {
    version: 1,
    packId,
    themeId,
    diagramType: "flowchart",
    direction: "LR",
    nodes: [
      { id: "CL1", label: "Client", role: "client", boundaryId: null },
      { id: "FW1", label: "Firewall", role: "firewall", boundaryId: "ONPREM1" },
      { id: "VPN1", label: "VPN GW", role: "vpn_gateway", boundaryId: "ONPREM1" },
      { id: "AP1", label: "AP Server", role: "app", boundaryId: "ONPREM1" },
      { id: "DB1", label: "DB", role: "db", boundaryId: "ONPREM1" },
      { id: "LB1", label: "ALB", role: "lb", boundaryId: "VPC1" },
      { id: "SV1", label: "App Server", role: "server", boundaryId: "VPC1" },
      { id: "DB2", label: "RDS", role: "db", boundaryId: "VPC1" },
      { id: "NET1", label: "Internet", role: "internet", boundaryId: null }
    ],
    edges: [
      { id: "E1", from: "CL1", to: "NET1", kind: "http", label: "" },
      { id: "E2", from: "NET1", to: "FW1", kind: "http", label: "HTTPS" },
      { id: "E3", from: "FW1", to: "AP1", kind: "http", label: "Allow 443" },
      { id: "E4", from: "AP1", to: "DB1", kind: "sql", label: "5432" },
      { id: "E5", from: "VPN1", to: "LB1", kind: "tunnel", label: "IPsec" },
      { id: "E6", from: "LB1", to: "SV1", kind: "http", label: "HTTP" },
      { id: "E7", from: "SV1", to: "DB2", kind: "sql", label: "SQL" }
    ],
    boundaries: [
      { id: "ONPREM1", label: "On-Prem", role: "onprem" },
      { id: "VPC1", label: "AWS VPC", role: "vpc" }
    ]
  };
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function normalizeModel(model) {
  // ノード・エッジ順を安定化（id昇順）
  model.nodes.sort((a, b) => a.id.localeCompare(b.id));
  model.edges.sort((a, b) => a.id.localeCompare(b.id));
  model.boundaries.sort((a, b) => a.id.localeCompare(b.id));
  return model;
}
