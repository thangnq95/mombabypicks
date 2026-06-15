#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const API_BASE = "https://api.multica.ai";
const WORKSPACE_SLUG = "product-review-factory";
const WORKSPACE_ID = "f8d942dc-2892-4f08-94a1-e14599dce279";
const SQUAD_ID = "06be5e0c-2523-415f-b2bd-99f11869d435";
const HERMES_RUNTIME_ID = "c3886908-7ebc-49a8-ad6c-d06c1945da53";
const HERMES_AGENT_ID = "d2087048-2de2-4577-8a07-121694e6b793";
const STRATEGIST_AGENT_ID = "a5d95464-0d0f-42f8-b2df-3155a8b4ba3e";
const CONTENT_AGENT_ID = "51492cb1-e195-4a55-80a2-db8e8860708d";
const PUBLISHER_AGENT_ID = "23982435-19f3-4238-ad26-2cf099671843";
const PINTEREST_AGENT_ID = "dac609e5-4535-4e93-bad0-9a0bee2e216f";
const DEFAULT_PROJECT_ID = "d8a90396-4efd-4a8e-9c48-00620258e511";

function usage() {
  console.log([
    "Usage:",
    "  node scripts/multica-squad.mjs bootstrap",
    "  node scripts/multica-squad.mjs dispatch <issue-id-or-identifier>",
    "  node scripts/multica-squad.mjs inspect <issue-id>",
  ].join("\n"));
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (cmd === "bootstrap") {
    const state = await readMulticaState();
    const headers = makeHeaders(state.token);
    const hermes = await ensureHermesAgent(headers);
    const squad = await ensureAffiliateSquad(headers, hermes.id);
    console.log(JSON.stringify({ hermes, squad }, null, 2));
    return;
  }

  if (cmd === "dispatch") {
    const issueRef = process.argv[3];
    if (!issueRef) {
      usage();
      process.exitCode = 1;
      return;
    }
    const state = await readMulticaState();
    const headers = makeHeaders(state.token);
    const issue = await resolveIssue(headers, issueRef);
    const squad = await ensureAffiliateSquad(headers, HERMES_AGENT_ID);

    await api(headers, `/api/issues/${issue.id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "in_progress",
        assignee_type: "squad",
        assignee_id: squad.id,
        project_id: issue.project_id ?? DEFAULT_PROJECT_ID,
      }),
    });

    await api(headers, `/api/issues/${issue.id}/comments`, {
      method: "POST",
      body: JSON.stringify({
        type: "comment",
        content: [
          "STATE: Strategizing",
          `ASSIGNEE: squad:${squad.id}`,
          "NEXT: Affiliate_Strategist",
          "RULE: keep all outputs attached to this ticket; no copy/paste handoff outside Multica.",
        ].join("\n"),
      }),
    });

    const task = await api(headers, "/api/issues/quick-create", {
      method: "POST",
      body: JSON.stringify({
        squad_id: squad.id,
        project_id: issue.project_id ?? DEFAULT_PROJECT_ID,
        parent_issue_id: issue.id,
        prompt: [
          "Read the parent issue and drive the sprint automatically through Multica tickets.",
          "Return only the next action package for Affiliate_Strategist.",
          "Do not invent ASINs. Do not do repo work. Keep the output ticket-ready.",
          `Parent issue: ${issue.identifier}`,
        ].join("\n"),
      }),
    });

    await sleep(1500);
    const tasks = await api(headers, `/api/issues/${issue.id}/task-runs`);
    const active = await api(headers, `/api/issues/${issue.id}/active-task`);
    console.log(JSON.stringify({
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
      },
      quick_task: task,
      task_runs: tasks,
      active,
    }, null, 2));
    return;
  }

  if (cmd === "inspect") {
    const issueId = process.argv[3];
    if (!issueId) {
      usage();
      process.exitCode = 1;
      return;
    }
    const state = await readMulticaState();
    const headers = makeHeaders(state.token);
    const issue = await api(headers, `/api/issues/${issueId}`);
    const comments = await api(headers, `/api/issues/${issueId}/comments`);
    const tasks = await api(headers, `/api/issues/${issueId}/task-runs`);
    console.log(JSON.stringify({ issue, comments, tasks }, null, 2));
    return;
  }

  usage();
  process.exitCode = 1;
}

async function ensureHermesAgent(headers) {
  const agents = await api(headers, `/api/agents?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`);
  const existing = Array.isArray(agents)
    ? agents.find((agent) => agent?.name === "Hermes" && agent?.runtime_id === HERMES_RUNTIME_ID)
    : null;
  if (existing) return existing;

  return api(headers, "/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: "Hermes",
      description: "Orchestrates Multica ticket flow for MomBabyPicks.",
      instructions: [
        "You are Hermes, the orchestration agent for MomBabyPicks.",
        "Create and track Multica tickets as the source of truth.",
        "Route work to Affiliate_Strategist, Affiliate_Content_Producer, Affiliate_Hugo_Publisher, and Affiliate_Pinterest_Growth.",
        "Never write article drafts; never do repo work; only manage ticket state, handoffs, and validation checkpoints.",
        "Do not require copy/paste. Use Multica tickets and comments as the workflow surface.",
        "Do not wait for human review during normal sprint execution.",
        "Treat In Review as an AI QA gate owned by Affiliate_Hugo_Publisher.",
        "If the AI QA checklist passes, move the ticket to the next state automatically.",
        "Mark a sprint complete only when the live URL, Pinterest pack, and commit hash are all recorded in the ticket.",
      ].join("\n"),
      runtime_id: HERMES_RUNTIME_ID,
      visibility: "workspace",
      max_concurrent_tasks: 1,
    }),
  });
}

async function ensureAffiliateSquad(headers, hermesAgentId) {
  const squads = await api(headers, "/api/squads");
  const squad = Array.isArray(squads)
    ? squads.find((entry) => entry?.id === SQUAD_ID)
    : null;
  if (!squad) throw new Error("Affiliate squad not found");

  const updated = await api(headers, `/api/squads/${SQUAD_ID}`, {
    method: "PUT",
    body: JSON.stringify({
      description: "Automated affiliate content pipeline for MomBabyPicks. Multica ticket is the source of truth.",
      instructions: [
        "1. Hermes opens or updates the Multica ticket first.",
        "2. Affiliate_Strategist produces product candidates and sprint brief.",
        "3. Affiliate_Content_Producer writes raw Hugo markdown only.",
        "4. Affiliate_Hugo_Publisher validates the markdown, saves to repo, and runs Hugo as the AI QA gate.",
        "5. Affiliate_Pinterest_Growth creates the Pinterest pack only after the article URL is live.",
        "6. Hermes records live URL, Pinterest pack, and commit hash in the ticket, then closes the sprint.",
        "7. No copy/paste handoff is allowed outside Multica ticket comments.",
        "8. Human review is optional and should not block normal ticket flow when validation has already passed.",
      ].join("\n"),
      leader_id: hermesAgentId,
    }),
  });

  const members = await api(headers, `/api/squads/${SQUAD_ID}/members`);
  const memberSet = new Set((Array.isArray(members) ? members : []).map((m) => `${m.member_type}:${m.member_id}`));
  const desired = [
    ["agent", hermesAgentId, "leader"],
    ["agent", STRATEGIST_AGENT_ID, "strategist"],
    ["agent", CONTENT_AGENT_ID, "writer"],
    ["agent", PUBLISHER_AGENT_ID, "validator"],
    ["agent", PINTEREST_AGENT_ID, "pinterest"],
  ];
  for (const [memberType, memberId, role] of desired) {
    if (!memberSet.has(`${memberType}:${memberId}`)) {
      await api(headers, `/api/squads/${SQUAD_ID}/members`, {
        method: "POST",
        body: JSON.stringify({ member_type: memberType, member_id: memberId, role }),
      });
    } else {
      await api(headers, `/api/squads/${SQUAD_ID}/members/role`, {
        method: "PATCH",
        body: JSON.stringify({ member_type: memberType, member_id: memberId, role }),
      });
    }
  }
  return updated;
}

async function resolveIssue(headers, issueRef) {
  if (/^[0-9a-f-]{36}$/i.test(issueRef)) {
    return api(headers, `/api/issues/${issueRef}`);
  }
  const issues = await api(headers, `/api/issues/search?q=${encodeURIComponent(issueRef)}&include_closed=true`);
  const hit = issues?.issues?.[0];
  if (!hit) throw new Error(`Could not find issue matching ${issueRef}`);
  return hit;
}

function makeHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Workspace-Slug": WORKSPACE_SLUG,
    "X-Client-Platform": "desktop",
    "X-Client-OS": "macos",
    "Content-Type": "application/json",
  };
}

async function api(headers, path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Multica API ${res.status} ${res.statusText} for ${path}: ${text}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readMulticaState() {
  const src = path.join(os.homedir(), "Library/Application Support/Multica/Local Storage/leveldb");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "multica-leveldb-"));
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === "LOCK") continue;
    await fs.copyFile(path.join(src, entry.name), path.join(tmp, entry.name));
  }

  const helper = String.raw`
    const { Level } = require('level');
    (async () => {
      const db = new Level(process.cwd(), { valueEncoding: 'utf8' });
      await db.open();
      let token = null;
      let workspaceSlug = null;
      try {
        for await (const [k, v] of db.iterator()) {
          if (String(k).includes('multica_token')) token = String(v).replace(/^\u0001/, '');
          if (String(k).includes('multica_tabs')) {
            const m = String(v).match(/activeWorkspaceSlug\\\":\\\"([^\\\"]+)/);
            if (m) workspaceSlug = m[1];
          }
        }
        process.stdout.write(JSON.stringify({ token, workspaceSlug }));
      } finally {
        await db.close();
      }
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `;

  execFileSync("npm", ["init", "-y"], { cwd: tmp, stdio: "ignore" });
  execFileSync("npm", ["install", "level"], { cwd: tmp, stdio: "ignore" });
  const payload = execFileSync(process.execPath, ["-e", helper], {
    cwd: tmp,
    encoding: "utf8",
  }).trim();
  const parsed = JSON.parse(payload);
  if (!parsed.token) throw new Error("Could not find multica_token in profile storage");
  return parsed;
}

await main();
