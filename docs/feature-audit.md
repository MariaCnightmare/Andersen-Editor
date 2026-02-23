# Feature Audit (Current Worktree)

## Scope
- Sources reviewed:
  - `docs/SPEC.md`
  - `README.md`
  - `src/main/*`, `src/preload/*`, `src/renderer/*`, `src/core/*`
- Goal:
  - Detect mismatch between feature claims and actual implementation
  - Classify each feature as `Implemented` / `Partial` / `Missing`
  - Define action (`implement` / `spec fix` / `table fix`)

## Summary Table
| Feature | Spec Source | Status | Evidence | Decision |
|---|---|---|---|---|
| Flowchart editing and Mermaid generation | `docs/SPEC.md:27` | Implemented | `src/core/generateMermaid.js:48`, `src/renderer/renderer.js:1182` | Keep |
| Boundaries (subgraph) edit and reflect to Mermaid | `docs/SPEC.md:28` | Implemented | `src/renderer/renderer.js:2673`, `src/core/generateMermaid.js:67` | Keep |
| Style (classDef/class/linkStyle/style) | `docs/SPEC.md:29` | Implemented | `src/core/generateMermaid.js:111`, `src/core/generateMermaid.js:118`, `src/core/generateMermaid.js:139` | Keep |
| Export SVG/PNG/PDF | `docs/SPEC.md:30` | Implemented | `src/main/main.cjs:397`, `src/main/main.cjs:413`, `src/main/main.cjs:430` | Keep |
| AE:MODEL round-trip | `docs/SPEC.md:12-19` | Implemented | `src/core/codec.js:12`, `src/renderer/renderer.js:1208` | Keep |
| Text-first mode when AE:MODEL missing | `docs/SPEC.md:18-19` | Implemented | `src/renderer/renderer.js:2150` | Keep |
| Preview drag position -> model persistence | User priority item | Implemented (MVP) | Drag/pin exists: `src/renderer/renderer.js` (pointer drag + `pinnedOffset`); reflected via `%%AE:MODEL`: `src/core/generateMermaid.js` | Keep (AE:MODEL is source of truth for layout) |
| Edge add/rewire -> Mermaid reflection | User priority item | Implemented | Add edge: `src/renderer/renderer.js:2684`; connect rewire: `src/renderer/renderer.js:2031`; Mermaid output: `src/core/generateMermaid.js:95` | Keep |
| Zone/group setting -> Mermaid reflection | User priority item | Implemented | Boundary add: `src/renderer/renderer.js:2690`; node zone assign/edit: `src/renderer/renderer.js:1681`; subgraph output: `src/core/generateMermaid.js:67` | Keep |
| Export Mermaid (.mmd/.md/.txt) | User priority item | Implemented (MVP added) | IPC: `src/main/main.cjs:413`; preload API: `src/main/preload.cjs:13`; UI/menu: `src/renderer/index.html:75`, `src/main/appMenu.cjs:62`; handler: `src/renderer/renderer.js:2281` | Keep |
| Export JSON(MODEL) | User priority item | Implemented (MVP added) | IPC: `src/main/main.cjs:451`; preload API: `src/main/preload.cjs:13`; UI: `src/renderer/index.html:79`; handler: `src/renderer/renderer.js:2294` | Keep |
| Node style edit from Inspector (fill/stroke/text) | User priority item | Implemented (MVP added) | Inspector inputs + model update: `src/renderer/renderer.js`; Mermaid `style <nodeId> ...` output: `src/core/generateMermaid.js` | Keep |
| Edge style edit from Inspector (color/width/dashed) | User priority item | Implemented (MVP added) | Inspector inputs + model update: `src/renderer/renderer.js`; Mermaid `linkStyle <idx> ...` output: `src/core/generateMermaid.js` | Keep |

## Notes on Priority-4 Verification
- Mermaid Flowchart has no stable node-coordinate syntax; position persistence is intentionally stored in `%%AE:MODEL`.
- Current MVP:
  - Node drag persists to `pinnedOffset/position` and is embedded in `%%AE:MODEL`.
  - Node/edge style overrides persist in model and generate Mermaid `style` / `linkStyle`.
  - Dirty status is set after drag/edge/zone/style mutations (`markModelDirty`).

## Mermaid Stability Delta (This change set)
- Class name normalization introduced:
  - display: e.g. `"VPN1 role"`
  - identifier: e.g. `"vpn1_role"`
  - code: `src/core/className.mjs:1`
- Mermaid class syntax generation fixed to official style:
  - `classDef <className> ...;`
  - `class <nodeIds> <className>;`
  - no `class[...]`
  - code: `src/core/generateMermaid.js:111`, `src/core/generateMermaid.js:118`
- Parser no longer treats `class` / `classDef` lines as nodes:
  - code: `src/renderer/renderer.js:1090`
- Parser also excludes Mermaid meta lines (`style`, `linkStyle`, `click`, `link`, `accTitle`, `accDescr`, directives/comments):
  - code: `src/renderer/editorUtils.mjs`, `src/renderer/renderer.js`
- Render failure fallback keeps last successful SVG (does not replace preview with flattened Mermaid text):
  - code: `src/renderer/renderer.js`

## Follow-ups
- Add optional E2E for apply-time parse error diagnostics and non-crash behavior (see `docs/e2e-plan.md`).
- If product requirement changes to "positions persist in pure Mermaid", update spec and add explicit encoding strategy.
