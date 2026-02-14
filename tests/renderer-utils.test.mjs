import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInternalBlocksText,
  computeAutoUiZoomFactor,
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
