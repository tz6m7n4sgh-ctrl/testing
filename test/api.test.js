import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../server/index.js";

async function startServer(dataFile) {
  const app = await createApp({ dataFile });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("serves portfolio metrics and security headers", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "launchops-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const { server, baseUrl } = await startServer(join(tempDir, "data.json"));
  t.after(() => server.close());

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.match(health.headers.get("content-security-policy"), /frame-ancestors 'none'/);

  const metrics = await fetch(`${baseUrl}/api/metrics`);
  assert.equal(metrics.status, 200);
  const metricBody = await metrics.json();
  assert.ok(metricBody.total >= 3);
  assert.ok("approvalDebt" in metricBody);
  assert.ok("byScheduleRisk" in metricBody);
});

test("enforces role-based launch creation and approval", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "launchops-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const { server, baseUrl } = await startServer(join(tempDir, "data.json"));
  t.after(() => server.close());

  const forbidden = await fetch(`${baseUrl}/api/launches`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-role": "viewer" },
    body: JSON.stringify({ name: "Mobile rollout" })
  });
  assert.equal(forbidden.status, 403);

  const created = await fetch(`${baseUrl}/api/launches`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-role": "operator" },
    body: JSON.stringify({ name: "Mobile rollout", customer: "Acme", impact: 8, confidence: 66 })
  });
  assert.equal(created.status, 201);
  const launch = await created.json();

  const approved = await fetch(`${baseUrl}/api/launches/${launch.id}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-role": "admin" },
    body: JSON.stringify({ role: "security" })
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).pendingApprovals, 0);
});

test("exposes an operational scorecard", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "launchops-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const { server, baseUrl } = await startServer(join(tempDir, "data.json"));
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/metrics/scorecard`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.grade, "A");
  assert.ok(body.checks.some((check) => check.id === "request_correlation"));
});
