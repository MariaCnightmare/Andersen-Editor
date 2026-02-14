import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("shortcut_undo_single_fire", () => {
  const appMenuPath = path.join(process.cwd(), "src/main/appMenu.js");
  const src = fs.readFileSync(appMenuPath, "utf-8");

  const undoBlock = src.match(/id:\s*"edit\.undo"[\s\S]*?click:\s*\(\)\s*=>\s*sendAction\(win,\s*"edit:undo"\)/);
  const redoBlock = src.match(/id:\s*"edit\.redo"[\s\S]*?click:\s*\(\)\s*=>\s*sendAction\(win,\s*"edit:redo"\)/);

  assert.ok(undoBlock, "undo menu item should exist");
  assert.ok(redoBlock, "redo menu item should exist");
  assert.doesNotMatch(undoBlock[0], /accelerator\s*:/, "undo should not register menu accelerator");
  assert.doesNotMatch(redoBlock[0], /accelerator\s*:/, "redo should not register menu accelerator");
});
