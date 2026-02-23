import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInternalBlocksText,
  computeAutoUiZoomFactor,
  autoWrapLabel,
  alignRects,
  distributeRects,
  pickUnlockedIds,
  isMermaidMetaLine,
  isEditableTarget,
  normalizeUiScaleChoice,
  prepareContentForSave,
  resolveUiZoomFactor,
  stripInternalBlocks
} from "../src/renderer/editorUtils.mjs";
import {
  buildNodeClassAssignments,
  emitClassDefLines,
  normalizeNodeClassName,
  slugifyClassName
} from "../src/core/className.mjs";
import { createBlankModel } from "../src/core/presets.js";
import { generateMermaid } from "../src/core/generateMermaid.js";

test("save_text_mode_dirty_embedded_model_consistency", async () => {
  let committed = false;
  let modelLine = "%%AE:MODEL STALE";
  const prep = await prepareContentForSave({
    mode: "text",
    textDirty: true,
    commit: async () => {
      committed = true;
      modelLine = "%%AE:MODEL LATEST";
      return true;
    },
    buildContent: () => `flowchart LR\nA-->B\n${modelLine}\n`
  });

  assert.equal(prep.ok, true);
  assert.equal(committed, true);
  assert.match(prep.content, /%%AE:MODEL LATEST/);
  assert.doesNotMatch(prep.content, /%%AE:MODEL STALE/);
});

test("save_is_aborted_when_commit_fails", async () => {
  const prep = await prepareContentForSave({
    mode: "text",
    textDirty: true,
    commit: async () => false,
    buildContent: () => "should-not-be-used"
  });
  assert.deepEqual(prep, { ok: false });
});

test("keydown_in_input_no_delete_selected", () => {
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: false }), false);
  assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
});

test("raw_blocks_roundtrip", () => {
  const rawBlocks = [{ lines: ["x --> y", "style x fill:#fff"] }];
  const merged = `flowchart LR\nA-->B\n${buildInternalBlocksText(rawBlocks)}\n`;
  const stripped = stripInternalBlocks(merged);
  assert.match(merged, /%%AE:RAW_BEGIN/);
  assert.match(merged, /%%AE:RAW_END/);
  assert.doesNotMatch(stripped, /%%AE:RAW_BEGIN/);
  assert.match(stripped, /A-->B/);
});

test("ui_scale_choices_and_auto_resolution", () => {
  assert.equal(normalizeUiScaleChoice("auto"), "auto");
  assert.equal(normalizeUiScaleChoice("0.8"), "0.8");
  assert.equal(normalizeUiScaleChoice("1.2"), "1.2");
  assert.equal(normalizeUiScaleChoice("1.25"), null);
  assert.equal(normalizeUiScaleChoice("bad"), null);

  assert.equal(resolveUiZoomFactor("1.1", { devicePixelRatio: 2, displayScale: 2 }), 1.1);
  assert.equal(resolveUiZoomFactor("auto", { devicePixelRatio: 1, displayScale: 1 }), 1);
  assert.equal(resolveUiZoomFactor("auto", { devicePixelRatio: 1.5, displayScale: 1.5 }), 0.9);
  assert.equal(computeAutoUiZoomFactor({ devicePixelRatio: 2, displayScale: 2 }), 0.9);
});

test("class_name_slugify_no_space", () => {
  assert.equal(slugifyClassName("VPN1 role"), "vpn1_role");
});

test("render_does_not_emit_class_bracket_syntax", () => {
  const defs = emitClassDefLines({ "VPN1 role": "fill:#fff,stroke:#333" });
  const classes = buildNodeClassAssignments(
    [{ id: "VPN1", role: "vpn_gateway", className: "VPN1 role" }],
    { vpn_gateway: { className: "VPN1 role" } }
  );
  const all = [...defs, ...classes].join("\n");
  assert.doesNotMatch(all, /class\[/);
  assert.match(all, /classDef vpn1_role /);
  assert.match(all, /class VPN1 vpn1_role;/);
});

test("roundtrip_preserves_display_name", () => {
  const node = { id: "VPN1", className: "VPN1 role" };
  normalizeNodeClassName(node);
  assert.equal(node.classDisplayName, "VPN1 role");
  assert.equal(node.className, "vpn1_role");
});

test("mermaid_meta_lines_are_detected", () => {
  assert.equal(isMermaidMetaLine("classDef role_a fill:#fff"), true);
  assert.equal(isMermaidMetaLine("class A role_a;"), true);
  assert.equal(isMermaidMetaLine("style A fill:#fff"), true);
  assert.equal(isMermaidMetaLine("linkStyle 0 stroke:#333"), true);
  assert.equal(isMermaidMetaLine("%%{init: {\"theme\":\"dark\"}}%%"), true);
  assert.equal(isMermaidMetaLine("A --> B"), false);
});

test("node_and_edge_style_overrides_emit_mermaid_style_lines", () => {
  const model = {
    version: 1,
    packId: "p",
    themeId: "t",
    diagramType: "flowchart",
    direction: "LR",
    nodes: [
      { id: "A", label: "A", role: "server", style: { fill: "#112233", stroke: "#445566", color: "#ffffff" } },
      { id: "B", label: "B", role: "server" }
    ],
    edges: [{ id: "E1", from: "A", to: "B", kind: "http", label: "", style: { color: "#ff0000", width: 3, dashed: true } }],
    boundaries: []
  };
  const pack = {
    roles: { server: { shape: "rect", className: "role-server" } },
    edgeKinds: { http: { arrow: "-->", className: "edge-http" } },
    boundaryRoles: {}
  };
  const theme = {
    init: { theme: "default" },
    classDefs: { "role-server": "fill:#eee,stroke:#333,color:#111" },
    edgeStyles: { "edge-http": "stroke:#00f,stroke-width:1px" },
    boundaryStyles: {}
  };
  const out = generateMermaid(model, pack, theme);
  assert.match(out, /style A fill:#112233,stroke:#445566,color:#ffffff/);
  assert.match(out, /linkStyle 0 /);
  assert.match(out, /stroke:#ff0000/);
  assert.match(out, /stroke-width:3px/);
  assert.match(out, /stroke-dasharray:4 4/);
});

test("blank_model_preset_generates_parseable_minimal_flowchart", () => {
  const model = createBlankModel("p", "t");
  const pack = { roles: {}, edgeKinds: {}, boundaryRoles: {} };
  const theme = { init: { theme: "default" }, classDefs: {}, edgeStyles: {}, boundaryStyles: {} };
  const out = generateMermaid(model, pack, theme);
  assert.match(out, /flowchart TB/);
  assert.equal(model.nodes.length, 0);
  assert.equal(model.edges.length, 0);
  assert.equal(model.boundaries.length, 0);
});

test("template_like_models_emit_split_node_and_edge_lines", () => {
  const pack = {
    roles: { server: { shape: "rect", className: "role-server" } },
    edgeKinds: { http: { arrow: "-->", className: "edge-http" } },
    boundaryRoles: {}
  };
  const theme = { init: { theme: "default" }, classDefs: {}, edgeStyles: {}, boundaryStyles: {} };
  const templates = [
    {
      direction: "TB",
      nodes: [
        { id: "W1", label: "Start", role: "server", shape: "round" },
        { id: "W2", label: "Step", role: "server", shape: "rect" },
        { id: "W3", label: "Decision", role: "server", shape: "diamond" },
        { id: "W4", label: "End", role: "server", shape: "round" }
      ],
      edges: [
        { id: "E1", from: "W1", to: "W2", kind: "http", label: "" },
        { id: "E2", from: "W2", to: "W3", kind: "http", label: "" },
        { id: "E3", from: "W3", to: "W4", kind: "http", label: "Yes" }
      ]
    },
    {
      direction: "TB",
      nodes: [
        { id: "O1", label: "CEO", role: "server", shape: "round" },
        { id: "O2", label: "Manager", role: "server", shape: "rect" },
        { id: "O3", label: "Member", role: "server", shape: "rect" }
      ],
      edges: [
        { id: "E1", from: "O1", to: "O2", kind: "http", label: "" },
        { id: "E2", from: "O2", to: "O3", kind: "http", label: "" }
      ]
    },
    {
      direction: "LR",
      nodes: [
        { id: "I1", label: "Client", role: "server", shape: "rect" },
        { id: "I2", label: "LB", role: "server", shape: "rect" },
        { id: "I3", label: "App", role: "server", shape: "rect" },
        { id: "I4", label: "DB", role: "server", shape: "rect" }
      ],
      edges: [
        { id: "E1", from: "I1", to: "I2", kind: "http", label: "" },
        { id: "E2", from: "I2", to: "I3", kind: "http", label: "" },
        { id: "E3", from: "I3", to: "I4", kind: "http", label: "" }
      ]
    }
  ];
  for (const t of templates) {
    const out = generateMermaid(
      {
        version: 1,
        packId: "p",
        themeId: "t",
        diagramType: "flowchart",
        direction: t.direction,
        nodes: t.nodes,
        edges: t.edges,
        boundaries: []
      },
      pack,
      theme
    );
    assert.doesNotMatch(out, /-->.*-->/);
    assert.match(out, /flowchart (TB|LR)/);
  }
});

test("boundary_group_emits_subgraph_with_direction_tb", () => {
  const pack = {
    roles: { server: { shape: "rect", className: "role-server" } },
    edgeKinds: { http: { arrow: "-->", className: "edge-http" } },
    boundaryRoles: { vpc: { className: "boundary-vpc" } }
  };
  const theme = { init: { theme: "default" }, classDefs: {}, edgeStyles: {}, boundaryStyles: {} };
  const out = generateMermaid(
    {
      version: 1,
      packId: "p",
      themeId: "t",
      diagramType: "flowchart",
      direction: "LR",
      nodes: [
        { id: "A", label: "A", role: "server", boundaryId: "VPC1", groupId: "VPC1" },
        { id: "B", label: "B", role: "server", boundaryId: "VPC1", groupId: "VPC1" }
      ],
      edges: [{ id: "E1", from: "A", to: "B", kind: "http", label: "" }],
      boundaries: [{ id: "VPC1", label: "Group", role: "vpc", direction: "TB" }]
    },
    pack,
    theme
  );
  assert.match(out, /subgraph VPC1\[Group\]/);
  assert.match(out, /direction TB/);
  assert.match(out, /\n\s*A\[A\]/);
  assert.match(out, /\n\s*B\[B\]/);
  assert.match(out, /\n\s*A --> B/);
});

test("auto_wrap_label_and_generate_mermaid_remain_safe", () => {
  const wrapped = autoWrapLabel("This is a very long free box label for equalize", 18);
  assert.match(wrapped, /<br\/>/);
  const pack = {
    roles: { server: { shape: "rect", className: "role-server" } },
    edgeKinds: { http: { arrow: "-->", className: "edge-http" } },
    boundaryRoles: {}
  };
  const theme = { init: { theme: "default" }, classDefs: {}, edgeStyles: {}, boundaryStyles: {} };
  const out = generateMermaid(
    {
      version: 1,
      packId: "p",
      themeId: "t",
      diagramType: "flowchart",
      direction: "LR",
      nodes: [
        { id: "N1", label: wrapped, role: "server", shape: "rect" },
        { id: "N2", label: "Target", role: "server", shape: "rect" }
      ],
      edges: [{ id: "E1", from: "N1", to: "N2", kind: "http", label: "" }],
      boundaries: []
    },
    pack,
    theme
  );
  assert.match(out, /N1\[.*<br\/>.*\]/);
  assert.match(out, /\n\s*N1 --> N2/);
});

test("generate_mermaid_sanitizes_symbol_heavy_labels_for_group_and_nodes", () => {
  const pack = {
    roles: { server: { shape: "rect", className: "role-server" } },
    edgeKinds: { http: { arrow: "-->", className: "edge-http" } },
    boundaryRoles: { vpc: { className: "boundary-vpc" } }
  };
  const theme = { init: { theme: "default" }, classDefs: {}, edgeStyles: {}, boundaryStyles: {} };
  const out = generateMermaid(
    {
      version: 1,
      packId: "p",
      themeId: "t",
      diagramType: "flowchart",
      direction: "LR",
      nodes: [
        { id: "A", label: "A [] () --> ::: ```", role: "server", shape: "rect", boundaryId: "G1", groupId: "G1" },
        { id: "B", label: "B []", role: "server", shape: "rect", boundaryId: "G1", groupId: "G1" }
      ],
      edges: [{ id: "E1", from: "A", to: "B", kind: "http", label: "[] --> ::: ```" }],
      boundaries: [{ id: "G1", label: "Group [] -->", role: "vpc", direction: "TB" }]
    },
    pack,
    theme
  );
  assert.match(out, /subgraph G1\[Group \(\) -->\]/);
  assert.match(out, /\n\s*A\[A \(\) \(\) --> ::: ```\]/);
  assert.match(out, /\n\s*A -->\|\[\] --> ::: ```\| B/);
});

test("align_rects_aligns_by_selection_bbox", () => {
  const rects = [
    { id: "A", x: 10, y: 10, w: 20, h: 10 },
    { id: "B", x: 40, y: 30, w: 10, h: 20 },
    { id: "C", x: 25, y: 5, w: 15, h: 15 }
  ];
  const left = alignRects(rects, "left");
  assert.deepEqual(left.map((r) => r.x), [10, 10, 10]);
  const center = alignRects(rects, "center");
  const cx = (10 + 50) / 2;
  assert.equal(center[0].x, cx - 10);
  assert.equal(center[1].x, cx - 5);
  assert.equal(center[2].x, cx - 7.5);
  const bottom = alignRects(rects, "bottom");
  assert.equal(bottom[0].y + bottom[0].h, 50);
  assert.equal(bottom[1].y + bottom[1].h, 50);
  assert.equal(bottom[2].y + bottom[2].h, 50);
});

test("distribute_rects_evenly_on_axis", () => {
  const rects = [
    { id: "A", x: 0, y: 0, w: 10, h: 10 },
    { id: "B", x: 30, y: 40, w: 10, h: 10 },
    { id: "C", x: 100, y: 80, w: 10, h: 10 }
  ];
  const outX = distributeRects(rects, "x");
  assert.equal(outX[0].x, 0);
  assert.equal(outX[2].x, 100);
  assert.equal(outX[1].x, 50);
  const outY = distributeRects(rects, "y");
  assert.equal(outY[0].y, 0);
  assert.equal(outY[2].y, 80);
  assert.equal(outY[1].y, 40);
});

test("pick_unlocked_ids_excludes_locked_nodes", () => {
  const nodes = [
    { id: "A", locked: false },
    { id: "B", locked: true },
    { id: "C" }
  ];
  const picked = pickUnlockedIds(nodes, ["A", "B", "C"]);
  assert.deepEqual(Array.from(picked), ["A", "C"]);
});
