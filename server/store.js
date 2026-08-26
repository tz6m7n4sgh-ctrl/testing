import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { seedData } from "./seed.js";
import { ApiError } from "./http.js";

const VALID_STAGES = new Set(["Planning", "Readiness Review", "Execution", "Launched"]);

export function riskScore(launch) {
  const daysToLaunch = Math.ceil((Date.parse(launch.targetDate) - Date.now()) / 86400000);
  const urgency = daysToLaunch <= 7 ? 18 : daysToLaunch <= 21 ? 10 : 4;
  const blockerRisk = Number(launch.blockers || 0) * 12;
  const confidencePenalty = Math.max(0, 100 - Number(launch.confidence || 0));
  return Math.min(100, Math.round(urgency + blockerRisk + confidencePenalty * 0.45 + Number(launch.impact || 0) * 1.5));
}

export function readinessTier(launch) {
  const score = riskScore(launch);
  if (score >= 75) return "Critical";
  if (score >= 55) return "Watch";
  if (score >= 35) return "Managed";
  return "Ready";
}

export function enrichLaunch(launch) {
  const openTasks = launch.tasks.filter((task) => task.status !== "done").length;
  const pendingApprovals = launch.approvals.filter((approval) => approval.status !== "approved").length;
  const scheduleRisk = scheduleRiskBand(launch);
  return {
    ...launch,
    riskScore: riskScore(launch),
    readinessTier: readinessTier(launch),
    scheduleRisk,
    openTasks,
    pendingApprovals
  };
}

export function scheduleRiskBand(launch) {
  const daysToLaunch = Math.ceil((Date.parse(launch.targetDate) - Date.now()) / 86400000);
  if (daysToLaunch < 0) return "overdue";
  if (daysToLaunch <= 7 && Number(launch.blockers || 0) > 0) return "compressed";
  if (daysToLaunch <= 21) return "near-term";
  return "healthy";
}

export async function createStore(filePath) {
  async function ensureFile() {
    await mkdir(dirname(filePath), { recursive: true });
    try {
      await readFile(filePath, "utf8");
    } catch {
      await write(seedData);
    }
  }

  async function read() {
    await ensureFile();
    return JSON.parse(await readFile(filePath, "utf8"));
  }

  async function write(data) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
    return data;
  }

  function audit(data, actor, action, target, details = {}) {
    data.auditLog.unshift({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor,
      action,
      target,
      details
    });
    data.auditLog = data.auditLog.slice(0, 100);
  }

  return {
    async listLaunches(filters = {}) {
      const data = await read();
      const query = String(filters.q || "").trim().toLowerCase();
      return data.launches
        .filter((launch) => !filters.stage || launch.stage === filters.stage)
        .filter((launch) => !filters.owner || launch.owner === filters.owner)
        .filter((launch) => {
          if (!query) return true;
          return [launch.name, launch.customer, launch.owner, launch.stage].join(" ").toLowerCase().includes(query);
        })
        .map(enrichLaunch)
        .sort((a, b) => b.riskScore - a.riskScore);
    },

    async createLaunch(input, actor) {
      const name = String(input.name || "").trim();
      if (name.length < 4) {
        throw new ApiError(400, "invalid_launch", "name must be at least 4 characters", { field: "name" });
      }

      const item = {
        id: `LCH-${randomUUID().slice(0, 8).toUpperCase()}`,
        name,
        customer: String(input.customer || "Internal").trim(),
        owner: String(input.owner || "Operations").trim(),
        stage: VALID_STAGES.has(input.stage) ? input.stage : "Planning",
        targetDate: input.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        impact: clamp(input.impact, 1, 10, 6),
        confidence: clamp(input.confidence, 1, 100, 70),
        blockers: clamp(input.blockers, 0, 20, 0),
        approvals: [],
        tasks: []
      };

      const data = await read();
      data.launches.push(item);
      audit(data, actor, "launch.created", item.id, { name: item.name });
      await write(data);
      return enrichLaunch(item);
    },

    async approveLaunch(id, input, actor) {
      const data = await read();
      const launch = data.launches.find((item) => item.id === id);
      if (!launch) throw new ApiError(404, "launch_not_found", "launch was not found");

      const role = String(input.role || "").trim();
      if (!role) throw new ApiError(400, "invalid_approval", "approval role is required");

      const existing = launch.approvals.find((approval) => approval.role === role);
      if (existing) existing.status = "approved";
      else launch.approvals.push({ role, status: "approved" });

      audit(data, actor, "launch.approved", launch.id, { role });
      await write(data);
      return enrichLaunch(launch);
    },

    async metrics() {
      const launches = (await this.listLaunches()).map(enrichLaunch);
      const approvalDebt = launches.reduce((sum, launch) => sum + launch.pendingApprovals, 0);
      return {
        total: launches.length,
        critical: launches.filter((launch) => launch.readinessTier === "Critical").length,
        blockedLaunches: launches.filter((launch) => Number(launch.blockers || 0) > 0).length,
        approvalDebt,
        averageRisk: launches.length ? Math.round(launches.reduce((sum, launch) => sum + launch.riskScore, 0) / launches.length) : 0,
        byStage: groupCount(launches, "stage"),
        byScheduleRisk: groupCount(launches, "scheduleRisk"),
        byOwner: groupCount(launches, "owner"),
        topRisks: launches.slice(0, 3)
      };
    },

    async auditLog() {
      const data = await read();
      return data.auditLog;
    }
  };
}

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function groupCount(items, field) {
  return items.reduce((result, item) => {
    result[item[field]] = (result[item[field]] || 0) + 1;
    return result;
  }, {});
}
