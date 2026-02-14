import { embedModelComment } from "./codec.js";
import { normalizeModel, clone } from "./model.js";

function sanitizeLabel(s) {
  const t = String(s ?? "");
  // Mermaidのブラケットを壊しにくくする最低限のサニタイズ
  return t.replace(/\r?\n/g, " ").replace(/\]/g, ")").replace(/\[/g, "(");
}

function nodeShape(shape, label) {
  const L = sanitizeLabel(label);
  switch (shape) {
    case "rect":
      return `[${L}]`;
    case "round":
      return `([${L}])`;
    case "circle":
      return `((${L}))`;
    case "cylinder":
      return `[(${L})]`;
    case "diamond":
      return `{${L}}`;
    case "hex":
      return `{{${L}}}`;
    case "parallelogram":
      return `[/${L}/]`;
    default:
      return `[${L}]`;
  }
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return map;
}

export function generateMermaid(model, pack, theme) {
  const m = normalizeModel(clone(model));

  const initLine = `%%{init: ${JSON.stringify(theme.init)} }%%`;
  const modelLine = embedModelComment(m);

  const lines = [];
  lines.push(initLine);
  lines.push(modelLine);
  lines.push(`flowchart ${m.direction}`);

  // boundaries
  const nodesByBoundary = groupBy(m.nodes, (n) => n.boundaryId || "__NONE__");
  const boundariesById = new Map(m.boundaries.map((b) => [b.id, b]));

  // output subgraphs
  for (const b of m.boundaries) {
    const bNodes = nodesByBoundary.get(b.id) || [];
    lines.push(`  subgraph ${b.id}[${sanitizeLabel(b.label)}]`);
    for (const n of bNodes) {
      const role = pack.roles[n.role];
      const shape = n.shape || (role ? role.shape : "rect");
      lines.push(`    ${n.id}${nodeShape(shape, n.label)}`);
    }
    lines.push(`  end`);
    lines.push("");
  }

  // nodes without boundary
  const noneNodes = nodesByBoundary.get("__NONE__") || [];
  for (const n of noneNodes) {
    const role = pack.roles[n.role];
    const shape = n.shape || (role ? role.shape : "rect");
    lines.push(`  ${n.id}${nodeShape(shape, n.label)}`);
  }
  if (noneNodes.length) lines.push("");

  // edges
  const edgeStyleIndices = []; // { idx, className }
  m.edges.forEach((e, idx) => {
    const ek = pack.edgeKinds[e.kind];
    const arrow = ek ? ek.arrow : "-->";
    const label = sanitizeLabel(e.label || "");
    if (label) {
      lines.push(`  ${e.from} ${arrow}|${label}| ${e.to}`);
    } else {
      lines.push(`  ${e.from} ${arrow} ${e.to}`);
    }
    if (ek && ek.className && theme.edgeStyles && theme.edgeStyles[ek.className]) {
      edgeStyleIndices.push({ idx, className: ek.className });
    }
  });
  if (m.edges.length) lines.push("");

  // classDefs
  if (theme.classDefs) {
    for (const [className, def] of Object.entries(theme.classDefs)) {
      lines.push(`  classDef ${className} ${def}`);
    }
    lines.push("");
  }

  // class assignments (nodes)
  const classToNodes = new Map();
  for (const n of m.nodes) {
    const role = pack.roles[n.role];
    const cls = n.className || (role ? role.className : null);
    if (!cls) continue;
    if (!classToNodes.has(cls)) classToNodes.set(cls, []);
    classToNodes.get(cls).push(n.id);
  }
  for (const [cls, ids] of classToNodes.entries()) {
    lines.push(`  class ${ids.join(",")} ${cls}`);
  }
  if (classToNodes.size) lines.push("");

  // boundary styles
  if (theme.boundaryStyles) {
    for (const b of m.boundaries) {
      const br = pack.boundaryRoles[b.role];
      const cls = br ? br.className : null;
      if (!cls) continue;
      const style = theme.boundaryStyles[cls];
      if (style) {
        lines.push(`  style ${b.id} ${style}`);
      }
    }
    if (m.boundaries.length) lines.push("");
  }

  // linkStyle
  for (const it of edgeStyleIndices) {
    const style = theme.edgeStyles[it.className];
    lines.push(`  linkStyle ${it.idx} ${style}`);
  }

  return lines.join("\n") + "\n";
}
