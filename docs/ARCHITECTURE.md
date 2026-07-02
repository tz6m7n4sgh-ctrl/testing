# LaunchOps Control Tower Architecture

LaunchOps is intentionally small enough to run locally and structured enough to demonstrate enterprise software habits: role boundaries, auditability, operational metrics, and deterministic risk scoring.

## System Context

```text
React portfolio UI
  -> Express REST API
  -> Launch store and risk scorer
  -> JSON persistence for local demo data
  -> Audit log and runtime metrics
```

## Runtime Responsibilities

| Layer | Responsibility |
| --- | --- |
| `src/App.jsx` | Portfolio dashboard, filters, approvals, and creation workflow |
| `server/index.js` | REST routes, static serving, and API composition |
| `server/store.js` | Persistence, risk scoring, approvals, audit log |
| `server/runtime.js` | Request IDs, security headers, runtime counters |
| `test/api.test.js` | RBAC, health, metrics, and approval contract coverage |

## Enterprise Boundaries

- Operators may create launches.
- Admins may approve launch gates.
- Viewers can read but cannot mutate launch state.
- Every mutation writes an audit event.
- Local generated JSON is ignored by Git.

## Extension Points

- Replace JSON persistence with Postgres.
- Wire launch gates to Slack, Jira, or GitHub deployments.
- Add SSO groups as real role sources.
- Add customer-specific launch templates.
