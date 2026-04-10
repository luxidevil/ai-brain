# Agent Brain API

> **Give your AI agents a memory.**

A self-hosted REST API that lets any AI agent persist its session — messages, planning steps, actions, and logs — to MongoDB Atlas. One command to write. One command to read. Everything else is automatic.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/atlas)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io)

---

## Why We Built This

Every AI agent starts from scratch.

No memory of what it built last session. No record of what it tried and failed. No way to tell another agent "I already figured this out — here's what happened."

We kept running into the same wall: agents would make real progress on a problem, then lose the entire thread. The next session would repeat the same planning steps, make the same mistakes, explore the same dead ends.

The fix isn't more context window. It's persistent memory that any agent can write to and read from — a **brain** that lives outside the agent and outlasts any single session.

Agent Brain API is that brain. It stores everything — every message, every planning step, every action taken — and makes it readable by any future agent in one command.

---

## How It Works

```
Agent A (session 1)
  └─ builds something, hits a problem
  └─ POST /api/sync  ──▶  saves messages + planning + actions
  └─ session ends

Agent B (session 2)
  └─ GET /api/sync/read  ──▶  reads everything Agent A did
  └─ picks up exactly where it left off
```

No integration required. No SDK. Just `curl`.

---

## Use Cases

### 1. Solo Developer — Persistent Agent Memory

Your agent forgets everything between sessions. With AI Brain, it doesn't.

```
Session 1: Agent builds auth system, stores everything
Session 2: Agent reads session 1, picks up exactly where it left off
Session 3: Agent reads sessions 1+2, never repeats a mistake
```

Every decision made, every file changed, every dead end explored — stored forever, readable instantly.

---

### 2. Team Collaboration — Free Shared Workspace

One hosted brain, multiple people. No subscription. No per-seat pricing.

```
Brain (1 shared instance — free to host)
  └── Thought: "our-startup"
        ├── Alice  → Thought Token → reads/writes her agent sessions
        ├── Bob    → Thought Token → reads/writes his agent sessions
        └── Agent  → Thought Token → pulls full project context
```

Everyone — humans and agents — works from the same shared memory. No Notion. No Linear. No $20/month per person. Just a MongoDB Atlas free tier and this API.

---

### 3. Multi-Agent Pipelines

Agent A researches. Agent B plans. Agent C builds. All three share one brain.

```
Agent A (researcher)
  └─ POST /api/sync  →  stores research findings

Agent B (planner)
  └─ GET /api/sync/read  →  reads Agent A's findings
  └─ POST /api/sync  →  stores the plan

Agent C (builder)
  └─ GET /api/sync/read  →  reads plan + research
  └─ builds without starting from zero
```

No handoff files. No copy-pasting context. Just read the brain.

---

### 4. Budget Teams — Alternative to Paid AI Tools

| Paid tool | What it does | AI Brain replaces it with |
|-----------|-------------|--------------------------|
| Notion AI | Shared docs + AI memory | Shared projectId + messages |
| Linear | Task tracking | Actions/items per session |
| Mem.ai | AI memory layer | Full sync endpoint |
| GitHub Copilot Workspace | Agent context | projectId + planning steps |

All of the above: **$0**, self-hosted, fully yours.

---

### 5. Open Source Projects — Shared Contributor Memory

New contributor joins a project. Instead of spending days reading code, they read the brain.

```bash
curl "https://YOUR-DOMAIN/api/sync/read?projectId=my-open-source-lib"
# Returns: every decision ever made, why things were built the way they were,
#          what approaches were tried, what was abandoned and why
```

The institutional knowledge of the project, instantly accessible to any new agent or contributor.

---

## Memory Structure

```
Brain  (your deployed instance)
  │
  ├── Thought: "startup-mvp"          ← projectId
  │     ├── session-001               ← sessionId
  │     │     ├── messages            ← conversation history
  │     │     ├── planning            ← decisions + reasoning
  │     │     ├── actions             ← what was done
  │     │     └── logs                ← request audit trail
  │     └── session-002
  │
  └── Thought: "side-project"
        └── session-001
```

---

## Dashboard

![Agent Brain API Dashboard](./docs/assets/dashboard-overview.jpg)

The management dashboard gives you a live view of everything stored:
- **Overview** — architecture diagram + live health check + copy-ready sync command
- **Messages** — browse, filter, and delete stored messages by session or role
- **Actions** — view all actions/items stored by agents
- **Logs** — auto-captured log of every API request made

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/luxidevil/ai-brain.git
cd ai-brain
pnpm install
```

### 2. Set up environment

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

Edit `.env`:
```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/mydb
SESSION_SECRET=any-long-random-string
PORT=8080
```

> Get `MONGODB_URI` from: MongoDB Atlas → Connect → Drivers → copy connection string

### 3. Start the servers

```bash
# API server (terminal 1)
pnpm --filter @workspace/api-server run dev

# Dashboard (terminal 2)
pnpm --filter @workspace/dashboard run dev
```

- API + Swagger docs: `http://localhost:8080/api/docs`
- Dashboard: `http://localhost:5173`

---

## The Two Commands That Matter

### Write (from any agent)

```bash
curl -X POST https://YOUR-DOMAIN/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "project-x-session-1",
    "messages": [
      { "role": "user", "content": "Build me a proxy scraper" },
      { "role": "agent", "content": "Starting with authentication layer..." }
    ],
    "planning": [
      { "summary": "Decided to use sshpass over URL embedding", "durationMs": 4200 },
      { "summary": "Proxy auth format: user:pass@host:port", "durationMs": 1800 }
    ],
    "actions": [
      { "name": "file-created", "data": { "file": "scraper.py" } },
      { "name": "package-installed", "data": { "package": "requests" } }
    ]
  }'
```

Response:
```json
{
  "ok": true,
  "totalSaved": 5,
  "results": {
    "messages": { "saved": 2 },
    "planning": { "saved": 2 },
    "actions": { "saved": 1 }
  }
}
```

### Read (from any agent)

```bash
curl "https://YOUR-DOMAIN/api/sync/read?sessionId=project-x-session-1"
```

Response:
```json
{
  "sessionId": "project-x-session-1",
  "messages": { "data": [...], "total": 2 },
  "planning": { "data": [...], "total": 2 },
  "actions": { "data": [...], "total": 1 },
  "logs": { "data": [...], "total": 12 }
}
```

---

## What to Paste Into Any Agent

Copy this and paste it at the start of any new agent session:

```
You have access to a persistent memory API at https://YOUR-DOMAIN/api.

Before starting work, read the previous session:
  curl "https://YOUR-DOMAIN/api/sync/read?sessionId=YOUR_PROJECT_ID"

When you finish working, save everything:
  curl -X POST https://YOUR-DOMAIN/api/sync \
    -H "Content-Type: application/json" \
    -d '{
      "sessionId": "YOUR_PROJECT_ID",
      "messages": [ ...all messages from this session... ],
      "planning": [ ...all planning steps you took... ],
      "actions": [ ...all actions you performed... ]
    }'
```

---

## All Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/healthz` | Server + MongoDB status |
| `POST` | `/api/sync` | Push messages, planning, actions at once |
| `GET` | `/api/sync/read` | Read all data for a session |
| `GET` | `/api/messages` | List messages (`?sessionId=` `?role=` `?agentId=`) |
| `POST` | `/api/messages` | Create a message |
| `POST` | `/api/messages/batch` | Batch create up to 100 messages |
| `GET` | `/api/messages/:id` | Get one message |
| `DELETE` | `/api/messages` | Delete messages (`?sessionId=` to scope) |
| `GET` | `/api/items` | List actions/items |
| `POST` | `/api/items` | Create an item |
| `PUT` | `/api/items/:id` | Update an item |
| `DELETE` | `/api/items/:id` | Delete an item |
| `GET` | `/api/logs` | View auto-captured request logs |
| `POST` | `/api/logs` | Write a manual log entry |
| `DELETE` | `/api/logs` | Clear all logs |

Full interactive docs at `/api/docs` (Swagger UI).

---

## Data Models

### Message
```json
{
  "role": "user | assistant | system | agent",
  "content": "message text",
  "sessionId": "project-x-session-1",
  "agentId": "agent-001",
  "metadata": { "model": "gpt-4o", "tokensUsed": 42 }
}
```

> Planning steps are stored as messages with `role: "system"` and `metadata.type: "planning"`.

### Item (Action)
```json
{
  "name": "file-edit",
  "description": "optional description",
  "tags": ["action", "filesystem"],
  "data": { "file": "App.tsx", "action": "modified" },
  "status": "active | inactive | archived"
}
```

### Log (auto-captured)
```json
{
  "method": "POST",
  "path": "/api/items",
  "statusCode": 201,
  "durationMs": 38,
  "requestBody": {},
  "responseBody": {},
  "ip": "...",
  "userAgent": "..."
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `SESSION_SECRET` | ✅ | Random string for session signing |
| `PORT` | No | Server port (default: 8080) |

---

## Project Structure

```
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── models/      # Mongoose models: Message, Item, Log
│   │       ├── routes/      # items, messages, logs, sync, health
│   │       ├── middleware/  # Auto request logger → MongoDB
│   │       └── lib/         # MongoDB connection, Swagger spec
│   └── dashboard/           # React + Vite management UI
│       └── src/
│           └── App.tsx      # Overview, Messages, Actions, Logs tabs
├── docs/
│   └── assets/              # Screenshots and documentation assets
├── .env.example             # Environment variable template
├── CONTRIBUTING.md
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| API Framework | Express 5 |
| Database | MongoDB Atlas (Mongoose) |
| API Docs | Swagger UI |
| Dashboard | React + Vite + Tailwind CSS |
| Language | TypeScript |
| Build | esbuild |
| Monorepo | pnpm workspaces |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — PRs are welcome.

Ideas for contributions:
- `projectId` support (multiple projects per user)
- API key authentication
- Search/filter endpoints
- Export to JSON/CSV

---

## License

MIT — see [LICENSE](./LICENSE)
