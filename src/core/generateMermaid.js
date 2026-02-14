import { embedModelComment } from "./codec.js";
import { normalizeModel, clone } from "./model.js";
import {
  buildNodeClassAssignments,
  emitClassDefLines,
  normalizeClassName,
  normalizeNodeClassName
} from "./className.mjs";

function sanitizeLabel(s) {
  const t = String(s ?? "");
  // Mermaidのブラケットを壊しにくくする最低限のサニタイズ
  return t.replace(/\r?\n/g, " ").replace(/\]/g, ")").replace(/\[/g, "(");
}

function normalizeColorToken(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.toLowerCase();
  if (/^[a-z]+$/i.test(v)) return v.toLowerCase();
  return null;
}

function normalizeStrokeWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(12, Math.max(0.5, Math.round(n * 10) / 10));
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
  m.nodes.forEach((n) => normalizeNodeClassName(n));

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
  const edgeStyleLines = [];
  const edgeStylesByClass = new Map();
  if (theme.edgeStyles) {
    for (const [key, style] of Object.entries(theme.edgeStyles)) {
      const cls = normalizeClassName(key);
      if (cls) edgeStylesByClass.set(cls, style);
    }
  }
  m.edges.forEach((e, idx) => {
    const ek = pack.edgeKinds[e.kind];
    const arrow = ek ? ek.arrow : "-->";
    const label = sanitizeLabel(e.label || "");
    if (label) {
      lines.push(`  ${e.from} ${arrow}|${label}| ${e.to}`);
    } else {
      lines.push(`  ${e.from} ${arrow} ${e.to}`);
    }
    const styleParts = [];
    const edgeClass = normalizeClassName(ek?.className);
    if (edgeClass && edgeStylesByClass.has(edgeClass)) {
      styleParts.push(edgeStylesByClass.get(edgeClass));
    }
    const c = normalizeColorToken(e?.style?.color);
    const w = normalizeStrokeWidth(e?.style?.width);
    if (c) styleParts.push(`stroke:${c}`);
    if (w) styleParts.push(`stroke-width:${w}px`);
    if (e?.style?.dashed === true) styleParts.push("stroke-dasharray:4 4");
    if (styleParts.length) {
      edgeStyleLines.push(`  linkStyle ${idx} ${styleParts.join(",")}`);
    }
  });
  if (m.edges.length) lines.push("");

  // classDefs
  if (theme.classDefs) {
    lines.push(...emitClassDefLines(theme.classDefs));
    lines.push("");
  }

  // class assignments (nodes)
  const nodeClassLines = buildNodeClassAssignments(m.nodes, pack.roles);
  lines.push(...nodeClassLines);
  if (nodeClassLines.length) lines.push("");

  // boundary styles
  if (theme.boundaryStyles) {
    for (const b of m.boundaries) {
      const br = pack.boundaryRoles[b.role];
      const cls = normalizeClassName(br ? br.className : null);
      if (!cls) continue;
      const style =
        theme.boundaryStyles?.[cls] ||
        theme.boundaryStyles?.[Object.keys(theme.boundaryStyles || {}).find((k) => normalizeClassName(k) === cls)];
      if (style) {
        lines.push(`  style ${b.id} ${style}`);
      }
    }
    if (m.boundaries.length) lines.push("");
  }

  // per-node style overrides
  let nodeStyleCount = 0;
  for (const n of m.nodes) {
    const fill = normalizeColorToken(n?.style?.fill);
    const stroke = normalizeColorToken(n?.style?.stroke);
    const color = normalizeColorToken(n?.style?.color);
    const parts = [];
    if (fill) parts.push(`fill:${fill}`);
    if (stroke) parts.push(`stroke:${stroke}`);
    if (color) parts.push(`color:${color}`);
    if (parts.length) {
      lines.push(`  style ${n.id} ${parts.join(",")}`);
      nodeStyleCount += 1;
    }
  }
  if (nodeStyleCount) lines.push("");

  // linkStyle
  for (const line of edgeStyleLines) {
    lines.push(line);
  }

  return lines.join("\n") + "\n";
}
