import { clone, normalizeModel } from "./model.js";

export const BLANK_MODEL = Object.freeze({
  version: 1,
  packId: "",
  themeId: "",
  diagramType: "flowchart",
  direction: "TB",
  nodes: [],
  edges: [],
  boundaries: [],
  rawBlocks: []
});

export function createBlankModel(packId = "", themeId = "") {
  const m = clone(BLANK_MODEL);
  m.packId = String(packId || "");
  m.themeId = String(themeId || "");
  return normalizeModel(m);
}

