function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clone(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeDirection(direction) {
  const d = String(direction || "LR").toUpperCase();
  return ["TB", "TD", "BT", "LR", "RL"].includes(d) ? d : "LR";
}

function normalizeBoundary(boundary, index) {
  const id = String(boundary?.id || `B${index + 1}`);
  const label = String(boundary?.label || id);
  const role = String(boundary?.role || "vpc");
  return { id, label, role };
}

function normalizeNode(node, index, boundaryMap) {
  const id = String(node?.id || `N${index + 1}`);
  const label = String(node?.label || id);
  const role = String(node?.role || "server");
  const boundaryId = node?.boundaryId || node?.groupId || null;
  const normalizedBoundaryId = boundaryId && boundaryMap.has(String(boundaryId)) ? String(boundaryId) : null;
  const out = {
    id,
    label,
    role,
    boundaryId: normalizedBoundaryId,
    groupId: normalizedBoundaryId,
    groupName: normalizedBoundaryId ? boundaryMap.get(normalizedBoundaryId)?.label || null : null
  };
  if (node?.shape) out.shape = String(node.shape);
  if (node?.comment != null) out.comment = String(node.comment);
  if (node?.className != null) out.className = String(node.className);
  if (node?.classDisplayName != null) out.classDisplayName = String(node.classDisplayName);
  if (node?.style && typeof node.style === "object") out.style = { ...node.style };
  if (node?.position && typeof node.position === "object") {
    out.position = {
      x: toFiniteNumber(node.position.x, 0),
      y: toFiniteNumber(node.position.y, 0)
    };
  }
  let hasPinnedOffset = false;
  if (node?.pinnedOffset && typeof node.pinnedOffset === "object") {
    hasPinnedOffset = true;
    out.pinnedOffset = {
      x: toFiniteNumber(node.pinnedOffset.x, 0),
      y: toFiniteNumber(node.pinnedOffset.y, 0)
    };
  }
  if (node?.pinned != null) {
    out.pinned = !!node.pinned;
  } else if (hasPinnedOffset) {
    // Backward compatibility: preserve pinned behavior when only pinnedOffset exists.
    out.pinned = true;
  }
  return out;
}

function normalizeEdge(edge, index) {
  const id = String(edge?.id || `E${index + 1}`);
  return {
    id,
    from: String(edge?.from || ""),
    to: String(edge?.to || ""),
    kind: String(edge?.kind || "http"),
    label: String(edge?.label || ""),
    ...(edge?.style && typeof edge.style === "object" ? { style: { ...edge.style } } : {})
  };
}

function normalizeRawBlock(block) {
  return {
    start: Number.isFinite(block?.start) ? Number(block.start) : null,
    end: Number.isFinite(block?.end) ? Number(block.end) : null,
    lines: Array.isArray(block?.lines) ? block.lines.map((line) => String(line ?? "")) : [],
    fromRaw: !!block?.fromRaw
  };
}

export function createInitialModel(packId = "", themeId = "") {
  return {
    version: 1,
    packId: String(packId || ""),
    themeId: String(themeId || ""),
    diagramType: "flowchart",
    direction: "LR",
    nodes: [],
    edges: [],
    boundaries: [],
    rawBlocks: []
  };
}

export function normalizeModel(model) {
  const src = model && typeof model === "object" ? model : {};
  const base = createInitialModel(src.packId, src.themeId);
  base.version = Number.isFinite(src.version) ? Number(src.version) : 1;
  base.diagramType = String(src.diagramType || "flowchart");
  base.direction = normalizeDirection(src.direction);

  const boundaries = Array.isArray(src.boundaries) ? src.boundaries.map(normalizeBoundary) : [];
  const boundaryMap = new Map(boundaries.map((b) => [b.id, b]));
  const nodes = Array.isArray(src.nodes) ? src.nodes.map((node, i) => normalizeNode(node, i, boundaryMap)) : [];
  const edges = Array.isArray(src.edges) ? src.edges.map(normalizeEdge) : [];

  base.boundaries = boundaries;
  base.nodes = nodes;
  base.edges = edges;
  base.rawBlocks = Array.isArray(src.rawBlocks) ? src.rawBlocks.map(normalizeRawBlock) : [];
  return base;
}
