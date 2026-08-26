// Data-access layer.
//
// In the normal full-stack app the frontend talks to the Express API at
// `/api/*`. When the site is built for a static host such as GitHub Pages
// (VITE_STATIC=1) there is no backend, so reads fall back to pre-generated
// JSON snapshots (see scripts/prerender-demo.js) and writes are disabled with
// a clear read-only message.

const BASE = import.meta.env.BASE_URL || "/";
export const IS_STATIC = import.meta.env.VITE_STATIC === "1";

const READ_ONLY_MESSAGE =
  "This hosted demo is read-only. Clone the repo and run `npm run dev` for the full-stack experience.";

async function staticJson(name) {
  const response = await fetch(`${BASE}demo/${name}.json`);
  if (!response.ok) throw new Error("Demo data is unavailable");
  return response.json();
}

export async function getMetrics() {
  if (IS_STATIC) return staticJson("metrics");
  const response = await fetch("/api/metrics");
  if (!response.ok) throw new Error("API request failed");
  return response.json();
}

export async function listLaunches({ q = "", stage = "" } = {}) {
  if (IS_STATIC) {
    const all = await staticJson("launches");
    const query = q.trim().toLowerCase();
    return all
      .filter((launch) => !stage || launch.stage === stage)
      .filter((launch) => {
        if (!query) return true;
        return [launch.name, launch.customer, launch.owner, launch.stage]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (stage) params.set("stage", stage);
  const suffix = params.toString() ? `?${params}` : "";
  const response = await fetch(`/api/launches${suffix}`);
  if (!response.ok) throw new Error("API request failed");
  return response.json();
}

export async function getAudit() {
  if (IS_STATIC) return staticJson("audit");
  const response = await fetch("/api/audit");
  if (!response.ok) throw new Error("API request failed");
  return response.json();
}

export async function createLaunch(form, role) {
  if (IS_STATIC) throw new Error(READ_ONLY_MESSAGE);
  const response = await fetch("/api/launches", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-role": role },
    body: JSON.stringify(form)
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || "Create failed");
  }
  return response.json();
}

export async function approveLaunch(id, role, approvalRole) {
  if (IS_STATIC) throw new Error(READ_ONLY_MESSAGE);
  const response = await fetch(`/api/launches/${id}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-role": role },
    body: JSON.stringify({ role: approvalRole })
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || "Approval failed");
  }
  return response.json();
}
