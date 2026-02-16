/**
 * className utility (tiny + dependency-free)
 * - string: "a b"
 * - array:  ["a", cond && "b"]
 * - object: { a: true, b: false }
 */
export function cn(...args) {
  const out = [];

  for (const a of args) {
    if (!a) continue;

    if (typeof a === "string") {
      out.push(a);
      continue;
    }

    if (Array.isArray(a)) {
      const v = cn(...a);
      if (v) out.push(v);
      continue;
    }

    if (typeof a === "object") {
      for (const [k, v] of Object.entries(a)) {
        if (v) out.push(k);
      }
      continue;
    }
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function slugifyClassName(value) {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "default_class";
}

export function normalizeClassName(value) {
  if (value == null) return "";
  return slugifyClassName(value);
}

export function normalizeNodeClassName(node) {
  if (!node || typeof node !== "object") return node;
  const original = node.classDisplayName || node.className || "";
  if (original) {
    node.classDisplayName = String(original);
    node.className = normalizeClassName(original);
  } else {
    node.className = "";
  }
  return node;
}

export function emitClassDefLines(classDefs) {
  if (!classDefs || typeof classDefs !== "object") return [];
  const lines = [];
  for (const [name, style] of Object.entries(classDefs)) {
    const cls = normalizeClassName(name);
    const styleText = String(style ?? "").trim();
    if (!cls || !styleText) continue;
    lines.push(`  classDef ${cls} ${styleText}`);
  }
  return lines;
}

export function buildNodeClassAssignments(nodes, roles) {
  if (!Array.isArray(nodes)) return [];
  const lines = [];
  for (const node of nodes) {
    const nodeId = String(node?.id || "").trim();
    if (!nodeId) continue;
    const roleClass = roles && node?.role ? roles[node.role]?.className : "";
    const cls = normalizeClassName(node?.className || roleClass || "");
    if (!cls) continue;
    lines.push(`  class ${nodeId} ${cls};`);
  }
  return lines;
}

export const className = cn;
export default cn;
