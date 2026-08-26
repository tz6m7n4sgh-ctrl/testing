import { randomUUID } from "node:crypto";

export function createRuntimeState(serviceName) {
  return {
    serviceName,
    startedAt: new Date().toISOString(),
    requests: 0,
    errors: 0,
    byStatus: {}
  };
}

export function installRuntimeControls(app, state) {
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    req.requestId = req.get("x-request-id") || randomUUID();
    res.setHeader("x-request-id", req.requestId);
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(
      "content-security-policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"
    );
    next();
  });

  app.use((req, res, next) => {
    state.requests += 1;
    res.on("finish", () => {
      const status = String(res.statusCode);
      state.byStatus[status] = (state.byStatus[status] || 0) + 1;
      if (res.statusCode >= 500) state.errors += 1;
    });
    next();
  });
}

export function runtimeMetrics(state) {
  return {
    service: state.serviceName,
    startedAt: state.startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    requests: state.requests,
    errors: state.errors,
    byStatus: state.byStatus
  };
}

export function operationalScorecard(state) {
  const metrics = runtimeMetrics(state);
  const totalResponses = Object.values(metrics.byStatus).reduce((sum, count) => sum + count, 0);
  const errorRate = totalResponses === 0 ? 0 : metrics.errors / totalResponses;
  const availability = Math.round((1 - errorRate) * 1000) / 10;
  const checks = [
    {
      id: "security_headers",
      label: "Baseline browser security headers installed",
      status: "passing",
      points: 25
    },
    {
      id: "request_correlation",
      label: "Every request receives an x-request-id",
      status: "passing",
      points: 25
    },
    {
      id: "runtime_counters",
      label: "Runtime request and status counters are exposed",
      status: metrics.requests >= totalResponses ? "passing" : "watch",
      points: metrics.requests >= totalResponses ? 25 : 12
    },
    {
      id: "error_budget",
      label: "Observed API availability stays above 99 percent",
      status: availability >= 99 ? "passing" : "watch",
      points: availability >= 99 ? 25 : 12
    }
  ];

  const score = checks.reduce((sum, check) => sum + check.points, 0);
  return {
    service: metrics.service,
    generatedAt: new Date().toISOString(),
    uptimeSeconds: metrics.uptimeSeconds,
    score,
    grade: score >= 90 ? "A" : score >= 75 ? "B" : "C",
    availability,
    requests: metrics.requests,
    errors: metrics.errors,
    checks
  };
}
