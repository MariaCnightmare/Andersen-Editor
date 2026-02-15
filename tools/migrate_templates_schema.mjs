#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const CANDIDATE_ROOTS = [
  "src/renderer/public/templates",
  "src/renderer/templates",
  "src/templates",
  "templates",
];

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile() && full.endsWith(".json")) out.push(full);
  }
  return out;
}

function migrateTheme(obj, file) {
  // theme: { themeId, name, mode, vars }
  if (!obj || typeof obj !== "object") return obj;

  if (!obj.themeId && typeof obj.id === "string") obj.themeId = obj.id;
  if (!obj.name && typeof obj.label === "string") obj.name = obj.label;

  // vars は必ず object に寄せる
  if (!obj.vars || typeof obj.vars !== "object" || Array.isArray(obj.vars)) obj.vars = {};

  // 旧キーは残しても動くが、混乱源なので消す
  if ("id" in obj) delete obj.id;
  if ("label" in obj) delete obj.label;

  // ありがち：{mode:"dark"} だけでCSS変数が空 → それでもOKだが、最低限 themeId は必須
  if (!obj.themeId) {
    console.warn(`[WARN] themeId missing after migration: ${file}`);
  }
  return obj;
}

function migratePack(obj, file) {
  // pack: { packId, name, ... }
  if (!obj || typeof obj !== "object") return obj;

  if (!obj.packId && typeof obj.id === "string") obj.packId = obj.id;
  if (!obj.name && typeof obj.label === "string") obj.name = obj.label;

  if ("id" in obj) delete obj.id;
  if ("label" in obj) delete obj.label;

  if (!obj.packId) {
    console.warn(`[WARN] packId missing after migration: ${file}`);
  }
  return obj;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

async function main() {
  const roots = [];
  for (const r of CANDIDATE_ROOTS) {
    if (await exists(r)) roots.push(r);
  }
  if (!roots.length) {
    console.error("[ERROR] templates root not found. Looked for:\n" + CANDIDATE_ROOTS.map((x) => `- ${x}`).join("\n"));
    process.exit(1);
  }

  let files = [];
  for (const r of roots) files.push(...(await walk(r)));
  files = files.sort();

  const themeFiles = files.filter((f) => f.includes(`${path.sep}themes${path.sep}`));
  const packFiles = files.filter((f) => f.includes(`${path.sep}packs${path.sep}`));

  let changed = 0;

  for (const f of themeFiles) {
    const raw = await fs.readFile(f, "utf8");
    const obj = JSON.parse(raw);
    const migrated = migrateTheme(obj, f);
    const out = pretty(migrated);
    if (out !== raw) {
      await fs.writeFile(f, out, "utf8");
      console.log(`[OK] migrated theme: ${f}`);
      changed++;
    }
  }

  for (const f of packFiles) {
    const raw = await fs.readFile(f, "utf8");
    const obj = JSON.parse(raw);
    const migrated = migratePack(obj, f);
    const out = pretty(migrated);
    if (out !== raw) {
      await fs.writeFile(f, out, "utf8");
      console.log(`[OK] migrated pack: ${f}`);
      changed++;
    }
  }

  console.log(`[DONE] files changed: ${changed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

