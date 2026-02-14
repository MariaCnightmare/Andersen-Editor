export function slugifyClassName(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const normalized = raw
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "class_custom";
}

export function normalizeNodeClassName(node) {
  if (!node || !node.className) return node;
  const display = node.classDisplayName || node.className;
  const className = slugifyClassName(display);
  node.classDisplayName = display;
  node.className = className;
  return node;
}

export function normalizeClassName(value) {
  if (!value) return null;
  return slugifyClassName(value);
}

export function emitClassDefLines(classDefs = {}) {
  const lines = [];
  for (const [className, def] of Object.entries(classDefs || {})) {
    const cls = normalizeClassName(className);
    if (!cls) continue;
    lines.push(`  classDef ${cls} ${def};`);
  }
  return lines;
}

export function buildNodeClassAssignments(nodes = [], roles = {}) {
  const classToNodes = new Map();
  for (const n of nodes) {
    const role = roles?.[n.role];
    const cls = normalizeClassName(n.className || role?.className || null);
    if (!cls) continue;
    if (!classToNodes.has(cls)) classToNodes.set(cls, []);
    classToNodes.get(cls).push(n.id);
  }
  const lines = [];
  for (const [cls, ids] of classToNodes.entries()) {
    lines.push(`  class ${ids.join(",")} ${cls};`);
  }
  return lines;
}
