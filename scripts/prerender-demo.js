// Generate static API snapshots for the read-only GitHub Pages demo.
//
// Reuses the real store logic (risk scoring, enrichment, metrics) against a
// throwaway data file seeded from server/seed.js, then writes the same JSON the
// live API would return into public/demo/ so Vite copies it into the build.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../server/store.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmpData = join(rootDir, "data", ".demo-prerender.json");
const outDir = join(rootDir, "public", "demo");

const store = await createStore(tmpData);

const [metrics, launches, audit] = await Promise.all([
  store.metrics(),
  store.listLaunches(),
  store.auditLog()
]);

await mkdir(outDir, { recursive: true });
await Promise.all([
  writeFile(join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2)),
  writeFile(join(outDir, "launches.json"), JSON.stringify(launches, null, 2)),
  writeFile(join(outDir, "audit.json"), JSON.stringify(audit, null, 2))
]);

await rm(tmpData, { force: true });

console.log(`[prerender] wrote ${launches.length} launches, metrics, and audit to public/demo/`);
