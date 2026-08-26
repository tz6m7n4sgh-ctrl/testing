import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createStore } from "./store.js";
import { createRuntimeState, installRuntimeControls, operationalScorecard, runtimeMetrics } from "./runtime.js";
import { asyncRoute, errorHandler, notFound, requireObjectBody, requireRole } from "./http.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

export async function createApp(options = {}) {
  const dataFile = resolve(rootDir, options.dataFile || process.env.DATA_FILE || "./data/launchops.json");
  const store = await createStore(dataFile);
  const runtime = createRuntimeState("launchops-control-tower");
  const app = express();

  installRuntimeControls(app, runtime);
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "launchops-control-tower", time: new Date().toISOString() });
  });

  app.get("/api/metrics/runtime", (_req, res) => {
    res.json(runtimeMetrics(runtime));
  });

  app.get("/api/metrics/scorecard", (_req, res) => {
    res.json(operationalScorecard(runtime));
  });

  app.get("/api/metrics", asyncRoute(async (_req, res) => {
    res.json(await store.metrics());
  }));

  app.get("/api/launches", asyncRoute(async (req, res) => {
    res.json(await store.listLaunches(req.query));
  }));

  app.post("/api/launches", asyncRoute(async (req, res) => {
    const role = requireRole(req, ["operator", "admin"]);
    const item = await store.createLaunch(requireObjectBody(req.body), role);
    res.status(201).json(item);
  }));

  app.post("/api/launches/:id/approvals", asyncRoute(async (req, res) => {
    const role = requireRole(req, ["admin"]);
    const item = await store.approveLaunch(req.params.id, requireObjectBody(req.body), role);
    res.json(item);
  }));

  app.get("/api/audit", asyncRoute(async (_req, res) => {
    res.json(await store.auditLog());
  }));

  app.use("/api", notFound);
  app.use(express.static(join(rootDir, "dist")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(rootDir, "dist", "index.html"));
  });
  app.use(errorHandler("launchops-control-tower"));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4410);
  const app = await createApp();
  app.listen(port, () => {
    console.log(`LaunchOps Control Tower running on http://localhost:${port}`);
  });
}
