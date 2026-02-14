import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInternalBlocksText,
  computeAutoUiZoomFactor,
  isEditableTarget,
  normalizeUiScaleChoice,
  prepareContentForSave,
  resolveUiZoomFactor,
  stripInternalBlocks
} from "../src/renderer/editorUtils.mjs";

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
