#!/usr/bin/env node
// Pushes source files to GitHub via REST API (avoids git timeout on large repos)
import { readFileSync } from "fs";
import { execSync } from "child_process";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "luxidevil/ai-brain";
const BRANCH = "main";
const MESSAGE = process.argv[2] || "Update source files";

const FILES = [
  "artifacts/dashboard/src/App.tsx",
  "artifacts/api-server/src/app.ts",
  "artifacts/api-server/src/routes/sync.ts",
  "artifacts/api-server/src/routes/brain.ts",
  "artifacts/api-server/src/routes/auth.ts",
  "artifacts/api-server/src/middleware/auth.ts",
  "artifacts/api-server/src/lib/mongodb.ts",
  "artifacts/api-server/src/lib/connectionPool.ts",
  "artifacts/api-server/src/models/message.ts",
  "artifacts/api-server/src/models/item.ts",
  "artifacts/api-server/src/models/log.ts",
  "artifacts/api-server/src/models/thought.ts",
  "artifacts/api-server/src/models/secret.ts",
  "artifacts/api-server/build.mjs",
  "artifacts/api-server/tsconfig.json",
  "artifacts/dashboard/vite.config.ts",
  "artifacts/dashboard/tsconfig.json",
  "deploy.sh",
  "github_push.mjs",
  "replit.md",
];

async function api(path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  return res.json();
}

(async () => {
  const ref = await api(`/git/refs/heads/${BRANCH}`);
  const parentSha = ref.object?.sha;
  if (!parentSha) { console.error("❌ Could not get parent SHA"); process.exit(1); }

  const parentCommit = await api(`/git/commits/${parentSha}`);
  const baseTree = parentCommit.tree?.sha;

  const treeItems = [];
  for (const f of FILES) {
    try {
      const content = readFileSync(f, "utf8");
      treeItems.push({ path: f, mode: "100644", type: "blob", content });
    } catch { /* skip missing files */ }
  }

  const tree = await api("/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTree, tree: treeItems }),
  });

  const commit = await api("/git/commits", {
    method: "POST",
    body: JSON.stringify({ message: MESSAGE, tree: tree.sha, parents: [parentSha] }),
  });

  const update = await api(`/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  if (update.ref) {
    console.log(`✅ Pushed successfully!\n   Commit: ${commit.sha}`);
  } else {
    console.error("❌ Failed:", JSON.stringify(update).slice(0, 200));
    process.exit(1);
  }
})();
