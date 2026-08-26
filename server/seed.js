export const seedData = {
  launches: [
    {
      id: "LCH-1001",
      name: "Enterprise SSO rollout",
      customer: "Northstar Health",
      owner: "Platform",
      stage: "Readiness Review",
      targetDate: "2026-07-15",
      impact: 9,
      confidence: 72,
      blockers: 2,
      approvals: [{ role: "security", status: "approved" }],
      tasks: [
        { id: "TSK-1", title: "SOC2 control evidence attached", status: "done" },
        { id: "TSK-2", title: "SAML rollback playbook reviewed", status: "open" }
      ]
    },
    {
      id: "LCH-1002",
      name: "Usage-based billing migration",
      customer: "Atlas Robotics",
      owner: "Revenue Systems",
      stage: "Execution",
      targetDate: "2026-07-03",
      impact: 8,
      confidence: 61,
      blockers: 3,
      approvals: [{ role: "finance", status: "pending" }],
      tasks: [
        { id: "TSK-3", title: "Invoice dry run completed", status: "open" },
        { id: "TSK-4", title: "Customer success comms drafted", status: "done" }
      ]
    },
    {
      id: "LCH-1003",
      name: "EU data residency launch",
      customer: "Helio Bank",
      owner: "Infrastructure",
      stage: "Planning",
      targetDate: "2026-08-01",
      impact: 10,
      confidence: 84,
      blockers: 1,
      approvals: [{ role: "legal", status: "approved" }],
      tasks: [
        { id: "TSK-5", title: "DPA language confirmed", status: "done" },
        { id: "TSK-6", title: "Regional failover exercise scheduled", status: "open" }
      ]
    }
  ],
  auditLog: [
    {
      id: "AUD-1",
      at: "2026-06-25T09:00:00.000Z",
      actor: "system",
      action: "seed.loaded",
      target: "portfolio"
    }
  ]
};
