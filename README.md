# LaunchOps Control Tower

[![CI](https://github.com/rrg1225/launchops-control-tower/actions/workflows/ci.yml/badge.svg)](https://github.com/rrg1225/launchops-control-tower/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-REST%20API-111827?logo=express)
![RBAC](https://img.shields.io/badge/RBAC-Approval%20Gates-2A9D8F)
![License](https://img.shields.io/badge/License-MIT-green)

LaunchOps Control Tower is a full-stack enterprise launch readiness workspace. It helps teams track customer-facing launches, score operational risk, enforce approval gates, and keep an audit trail for readiness reviews.

## Why It Matters

Many portfolio projects show CRUD. LaunchOps shows the operational layer companies actually care about: risk scoring, role-based permissions, auditability, security headers, runtime metrics, and production build verification.

## Features

- React dashboard for launch portfolio risk, filters, approvals, and audit trail.
- Express REST API with request IDs, CSP, security headers, and structured errors.
- Deterministic launch risk scoring based on urgency, blockers, confidence, and impact.
- Role-based write controls through `x-user-role`: `viewer`, `operator`, and `admin`.
- Local JSON persistence with seed data for a no-service demo.
- Mutation audit log with bounded history.
- CI, API tests, architecture docs, and production build scripts.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API defaults to `http://localhost:4410`.

## Scripts

```bash
npm test      # API contract, RBAC, and security-header tests
npm run build # production React bundle
npm run start # serve API and built frontend
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health |
| `GET` | `/api/metrics` | Portfolio readiness metrics |
| `GET` | `/api/metrics/runtime` | Request counters and uptime |
| `GET` | `/api/metrics/scorecard` | Operational readiness score and checks |
| `GET` | `/api/launches` | Filterable launch list |
| `POST` | `/api/launches` | Create launch, requires `operator` or `admin` |
| `POST` | `/api/launches/:id/approvals` | Approve gate, requires `admin` |
| `GET` | `/api/audit` | Mutation audit trail |

## Quality Gates

- `npm test` covers RBAC, approvals, health, metrics, and security headers.
- GitHub Actions runs tests and build on pull requests and `main`.
- Local runtime data is ignored by Git.
- Architecture notes live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT

## Enterprise Readiness

This repository now includes contribution guidelines, a security policy, operational runbook notes, PR review gates, and automated readiness checks. See [docs/ENTERPRISE_READINESS.md](docs/ENTERPRISE_READINESS.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md).
