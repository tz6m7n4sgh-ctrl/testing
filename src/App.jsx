import { useEffect, useMemo, useState } from "react";

const initialForm = {
  name: "",
  customer: "Enterprise Account",
  owner: "Operations",
  stage: "Planning",
  targetDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  impact: 7,
  confidence: 70,
  blockers: 0
};

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [launches, setLaunches] = useState([]);
  const [audit, setAudit] = useState([]);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [role, setRole] = useState("operator");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (stage) params.set("stage", stage);
      const suffix = params.toString() ? `?${params}` : "";
      const [metricsResponse, launchesResponse, auditResponse] = await Promise.all([
        fetch("/api/metrics"),
        fetch(`/api/launches${suffix}`),
        fetch("/api/audit")
      ]);
      if (!metricsResponse.ok || !launchesResponse.ok || !auditResponse.ok) throw new Error("API request failed");
      setMetrics(await metricsResponse.json());
      setLaunches(await launchesResponse.json());
      setAudit(await auditResponse.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query, stage]);

  const owners = useMemo(() => Object.keys(metrics?.byOwner || {}), [metrics]);

  async function createLaunch(event) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/launches", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-role": role },
      body: JSON.stringify(form)
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error?.message || "Create failed");
      return;
    }
    setForm(initialForm);
    await load();
  }

  async function approve(launch, approvalRole) {
    setError("");
    const response = await fetch(`/api/launches/${launch.id}/approvals`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-role": role },
      body: JSON.stringify({ role: approvalRole })
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error?.message || "Approval failed");
      return;
    }
    await load();
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Enterprise launch readiness</p>
          <h1>LaunchOps Control Tower</h1>
        </div>
        <label className="role-picker">
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="viewer">viewer</option>
            <option value="operator">operator</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="metric-grid">
        <Metric label="Launches" value={metrics?.total ?? "-"} />
        <Metric label="Critical" value={metrics?.critical ?? "-"} />
        <Metric label="Blocked" value={metrics?.blockedLaunches ?? "-"} />
        <Metric label="Approval debt" value={metrics?.approvalDebt ?? "-"} />
        <Metric label="Average risk" value={metrics?.averageRisk ?? "-"} />
      </section>

      <section className="workspace">
        <div className="panel launch-panel">
          <div className="panel-heading">
            <div>
              <h2>Portfolio queue</h2>
              <p>Sorted by readiness risk and filtered by operational context.</p>
            </div>
            <div className="filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search launches..." />
              <select value={stage} onChange={(event) => setStage(event.target.value)}>
                <option value="">All stages</option>
                <option>Planning</option>
                <option>Readiness Review</option>
                <option>Execution</option>
                <option>Launched</option>
              </select>
            </div>
          </div>

          {loading ? <p className="muted">Loading portfolio...</p> : launches.map((launch) => (
            <article className="launch-card" key={launch.id}>
              <div className="launch-main">
                <span className={`tier ${launch.readinessTier.toLowerCase()}`}>{launch.readinessTier}</span>
                <div>
                  <h3>{launch.name}</h3>
                  <p>{launch.customer} · {launch.owner} · {launch.stage}</p>
                </div>
              </div>
              <div className="risk-block">
                <strong>{launch.riskScore}</strong>
                <span>risk</span>
              </div>
              <div className="detail-grid">
                <span>Target {launch.targetDate}</span>
                <span>{launch.scheduleRisk} schedule</span>
                <span>{launch.openTasks} open tasks</span>
                <span>{launch.pendingApprovals} pending approvals</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => approve(launch, "security")}>Security approve</button>
                <button type="button" onClick={() => approve(launch, "finance")}>Finance approve</button>
              </div>
            </article>
          ))}
        </div>

        <aside className="panel">
          <h2>Create launch</h2>
          <form className="form" onSubmit={createLaunch}>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Customer<input value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} /></label>
            <label>Owner<input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label>
            <label>Stage<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>
              <option>Planning</option>
              <option>Readiness Review</option>
              <option>Execution</option>
              <option>Launched</option>
            </select></label>
            <label>Target date<input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label>
            <div className="three-cols">
              <label>Impact<input type="number" min="1" max="10" value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value })} /></label>
              <label>Confidence<input type="number" min="1" max="100" value={form.confidence} onChange={(event) => setForm({ ...form, confidence: event.target.value })} /></label>
              <label>Blockers<input type="number" min="0" max="20" value={form.blockers} onChange={(event) => setForm({ ...form, blockers: event.target.value })} /></label>
            </div>
            <button type="submit">Create launch</button>
          </form>
        </aside>
      </section>

      <section className="lower-grid">
        <div className="panel">
          <h2>Stage breakdown</h2>
          <Breakdown data={metrics?.byStage} />
        </div>
        <div className="panel">
          <h2>Schedule risk</h2>
          <Breakdown data={metrics?.byScheduleRisk} />
        </div>
        <div className="panel">
          <h2>Audit trail</h2>
          <div className="audit-list">
            {audit.slice(0, 6).map((entry) => (
              <div key={entry.id}>
                <strong>{entry.action}</strong>
                <span>{entry.actor} · {entry.target}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Breakdown({ data = {} }) {
  return (
    <div className="breakdown">
      {Object.entries(data).map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
