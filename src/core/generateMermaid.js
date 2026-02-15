import { embedModelComment } from "./codec.js";
import { normalizeModel, clone } from "./model.js";
import {
  buildNodeClassAssignments,
  emitClassDefLines,
  normalizeClassName,
  normalizeNodeClassName
} from "./className.mjs";

function normalizeUnsafeText(s) {
  return String(s ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/%%/g, "％％")
    .replace(/\|/g, "¦")
    .replace(/"/g, "”");
}

function sanitizeNodeLabel(s) {
  const t = normalizeUnsafeText(s);
  // Mermaid token delimiters for node shapes
  return t
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")");
}

function sanitizeEdgeLabel(s) {
  const t = normalizeUnsafeText(s);
  // Edge labels are wrapped by |...|
  return t.replace(/\|/g, "¦");
}

function sanitizeLabel(s) {
  return sanitizeNodeLabel(s);
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
  const L = sanitizeNodeLabel(label);
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

function byStableId(a, b) {
  const ai = String(a?.id || "");
  const bi = String(b?.id || "");
  return ai.localeCompare(bi);
}

export function generateMermaid(model, pack, theme) {
  const m = normalizeModel(clone(model));
  m.nodes.forEach((n) => normalizeNodeClassName(n));
  const sortedBoundaries = [...(m.boundaries || [])].sort(byStableId);
  const sortedNodes = [...(m.nodes || [])].sort(byStableId);
  const sortedEdges = [...(m.edges || [])].sort((a, b) => {
    const ai = String(a?.id || "");
    const bi = String(b?.id || "");
    if (ai && bi && ai !== bi) return ai.localeCompare(bi);
    const af = `${a?.from || ""}|${a?.to || ""}|${a?.kind || ""}|${a?.label || ""}`;
    const bf = `${b?.from || ""}|${b?.to || ""}|${b?.kind || ""}|${b?.label || ""}`;
    return af.localeCompare(bf);
  });

  const initLine = `%%{init: ${JSON.stringify(theme.init)} }%%`;
  const modelLine = embedModelComment(m);

  const lines = [];
  lines.push(initLine);
  lines.push(modelLine);
  lines.push(`flowchart ${m.direction}`);

  // boundaries
  const nodesByBoundary = groupBy(sortedNodes, (n) => n.boundaryId || "__NONE__");

  // output subgraphs
  for (const b of sortedBoundaries) {
    const bNodes = [...(nodesByBoundary.get(b.id) || [])].sort(byStableId);
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
  const noneNodes = [...(nodesByBoundary.get("__NONE__") || [])].sort(byStableId);
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
  sortedEdges.forEach((e, idx) => {
    const ek = pack.edgeKinds[e.kind];
    const arrow = ek ? ek.arrow : "-->";
    const label = sanitizeEdgeLabel(e.label || "");
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
  if (sortedEdges.length) lines.push("");

  // classDefs
  if (theme.classDefs) {
    const orderedClassDefs = Object.fromEntries(
      Object.entries(theme.classDefs).sort(([a], [b]) => String(a).localeCompare(String(b)))
    );
    lines.push(...emitClassDefLines(orderedClassDefs));
    lines.push("");
  }

  // class assignments (nodes)
  const nodeClassLines = buildNodeClassAssignments(sortedNodes, pack.roles);
  lines.push(...nodeClassLines);
  if (nodeClassLines.length) lines.push("");

  // boundary styles
  if (theme.boundaryStyles) {
    for (const b of sortedBoundaries) {
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
    if (sortedBoundaries.length) lines.push("");
  }

  // per-node style overrides
  let nodeStyleCount = 0;
  for (const n of sortedNodes) {
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
