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

## Architecture

```
Brain API (your server — 1 master token)
  ├── Thought: "project-alpha" (own key: tk_abc...)
  │     ├── session-001
  │     │     └── messages, planning, actions, logs
  │     └── session-002
  │           └── messages, planning, actions, logs
  ├── Thought: "project-beta" (own key: tk_def...)
  │     └── session-001
  │           └── messages, planning, actions, logs
  └── ...
```

**Like GitHub:** the Brain is your account, Thoughts are your repos, each with its own access key.

### Two levels of access

| Token | Prefix | Can do |
|-------|--------|--------|
| **Brain token** (master) | `bt_` | List/create/delete thoughts, access any thought |
| **Thought key** (per-project) | `tk_` | Read/write only its own thought — nothing else |

An agent only needs a thought key. It goes straight to its thought, reads or writes, and can't see other thoughts.

---

## How It Works

```
Agent A (session 1)
  └─ builds something, hits a problem
  └─ POST /api/brain/my-project/sync  ──▶  saves everything
  └─ session ends

Agent B (session 2)
  └─ GET /api/brain/my-project/context  ──▶  reads full timeline
  └─ picks up exactly where Agent A left off
```

No integration required. No SDK. Just `curl`.

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/luxidevil/ai-brain.git
cd ai-brain
pnpm install
```

### 2. Set environment variables

```bash
cp .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/brain
BRAIN_TOKEN=bt_your-secret-master-token
PORT=8080
```

### 3. Run

```bash
pnpm run dev
```

API: `http://localhost:8080/api`
Dashboard: `http://localhost:3000`

---

## API Reference

### Brain endpoints (require brain token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/brain` | List all thoughts with counts |
| `POST` | `/api/brain` | Create a new thought (returns its unique key) |
| `DELETE` | `/api/brain/:thoughtId` | Delete a thought and all its data |
| `POST` | `/api/brain/:thoughtId/regenerate-key` | Regenerate a thought's access key |

### Thought endpoints (brain token OR thought key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/brain/:thoughtId` | Get all data inside a thought (for UI/humans) |
| `GET` | `/api/brain/:thoughtId/context` | Get clean chronological timeline (for agents) |
| `POST` | `/api/brain/:thoughtId/sync` | Push messages, planning, actions, and logs |

### Low-level CRUD (require brain token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST/DELETE` | `/api/messages` | CRUD messages |
| `GET/POST/PATCH/DELETE` | `/api/items` | CRUD items/actions |
| `GET/DELETE` | `/api/logs` | Read/clear request logs |
| `GET` | `/api/healthz` | Health check (no auth) |
| `GET` | `/api/docs` | Swagger UI (no auth) |

### Legacy sync endpoints (require brain token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sync` | Push data with projectId in body |
| `GET` | `/api/sync/read` | Read data by sessionId/projectId |
| `GET` | `/api/sync/context` | Full timeline by projectId |
| `GET` | `/api/sync/projects` | List all projectIds |
| `GET` | `/api/sync/sessions` | List sessions for a project |

---

## Usage

### 1. Create a thought (brain token)

```bash
curl -X POST https://YOUR-DOMAIN/api/brain \
  -H "Authorization: Bearer bt_YOUR-BRAIN-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"thoughtId": "my-project", "description": "My cool project"}'
```

Response:
```json
{
  "thoughtId": "my-project",
  "key": "tk_a1b2c3...",
  "message": "Thought created. Save this key — it grants direct access to this thought."
}
```

### 2. Push data into a thought (thought key)

```bash
curl -X POST https://YOUR-DOMAIN/api/brain/my-project/sync \
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-001",
    "messages": [
      { "role": "user", "content": "Build me a login page" },
      { "role": "assistant", "content": "I will create a login page with email and password fields..." }
    ],
    "planning": [
      { "content": "The user wants a login page. I need to create the form component, add validation, set up the API endpoint with bcrypt for password hashing. I should also handle error states and loading states in the UI. Let me start with the form component..." }
    ],
    "actions": [
      { "name": "created-file", "description": "Created login.tsx", "data": { "file": "src/login.tsx" } },
      { "name": "installed-package", "description": "Installed bcrypt" }
    ]
  }'
```

### 3. Read a thought — for agents (thought key)

```bash
curl https://YOUR-DOMAIN/api/brain/my-project/context \
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY"
```

Returns a single chronological timeline optimized for agents:

```json
{
  "thoughtId": "my-project",
  "sessions": ["session-001"],
  "counts": { "messages": 2, "planning": 1, "actions": 2 },
  "totalEvents": 5,
  "lastActivity": "2025-01-15T10:30:00.000Z",
  "timeline": [
    { "ts": "...", "type": "message", "role": "user", "content": "Build me a login page", "session": "session-001" },
    { "ts": "...", "type": "planning", "content": "The user wants a login page. I need to...", "session": "session-001" },
    { "ts": "...", "type": "message", "role": "assistant", "content": "I will create a login page...", "session": "session-001" },
    { "ts": "...", "type": "action", "action": "created-file", "description": "Created login.tsx", "session": "session-001" },
    { "ts": "...", "type": "action", "action": "installed-package", "description": "Installed bcrypt", "session": "session-001" }
  ]
}
```

### 4. Read a thought — for UI/humans (thought key)

```bash
curl https://YOUR-DOMAIN/api/brain/my-project \
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY"
```

Returns separate arrays (messages, items, logs) for rendering in a dashboard.

### 5. List all thoughts (brain token)

```bash
curl https://YOUR-DOMAIN/api/brain \
  -H "Authorization: Bearer bt_YOUR-BRAIN-TOKEN"
```

---

## Agent Prompt Template

Paste this into your agent's system prompt so it reads/writes its brain automatically:

```
You have a memory API. Before doing anything, read your memory:

curl "https://YOUR-DOMAIN/api/brain/PROJECT-NAME/context" \
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY"

This returns every message, decision, and action from all past sessions in
chronological order. Read it fully before writing any code. Continue from
where the last session left off.

At the end of this session, save everything back:

curl -X POST "https://YOUR-DOMAIN/api/brain/PROJECT-NAME/sync" \
  -H "Authorization: Bearer tk_YOUR-THOUGHT-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-XXX",
    "messages": [ ...all messages from this session... ],
    "planning": [ ...every thought and decision you made... ],
    "actions":  [ ...files changed, commands run, packages installed... ]
  }'
```

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

### 2. Team Collaboration — Free Shared Workspace

One hosted brain, multiple people. No subscription. No per-seat pricing.

```
Brain (1 shared instance — free to host)
  └── Thought: "our-startup"
        ├── Alice  → Thought Key → reads/writes her agent sessions
        ├── Bob    → Thought Key → reads/writes his agent sessions
        └── Agent  → Thought Key → pulls full project context
```

Everyone — humans and agents — works from the same shared memory. No Notion. No Linear. No $20/month per person. Just a MongoDB Atlas free tier and this API.

### 3. Multi-Agent Pipelines

Agent A researches. Agent B plans. Agent C builds. All three share one brain.

```
Agent A (researcher)
  └─ POST /api/brain/my-project/sync  →  stores research findings

Agent B (planner)
  └─ GET /api/brain/my-project/context  →  reads Agent A's findings
  └─ POST /api/brain/my-project/sync  →  stores the plan

Agent C (builder)
  └─ GET /api/brain/my-project/context  →  reads plan + research
  └─ builds without starting from zero
```

No handoff files. No copy-pasting context. Just read the brain.

### 4. Budget Teams — Alternative to Paid AI Tools

| Paid tool | What it does | AI Brain replaces it with |
|-----------|-------------|--------------------------|
| Notion AI | Shared docs + AI memory | Shared thought + messages |
| Linear | Task tracking | Actions/items per session |
| Mem.ai | AI memory layer | Full sync endpoint |
| GitHub Copilot Workspace | Agent context | Thought + planning steps |

All of the above: **$0**, self-hosted, fully yours.

### 5. Open Source Projects — Shared Contributor Memory

New contributor joins a project. Instead of spending days reading code, they read the brain.

```bash
curl "https://YOUR-DOMAIN/api/brain/my-open-source-lib/context" \
  -H "Authorization: Bearer tk_CONTRIBUTOR-KEY"
```

Every architectural decision, every bug fix, every "we tried X and it didn't work because Y" — all there.

---

## Dashboard

The included React dashboard provides a visual interface:

- **Thoughts tab** — lists all thoughts, click one to see its chat history
- **Chat view** — chronological chat-like display of messages (blue = user, green = agent), planning (amber), and actions (purple)
- **Session filter** — filter by session to see one conversation at a time
- **Overview tab** — architecture diagram and health status
- **How To tab** — copy-paste curl commands and agent prompt template

---

## Deployment

### Docker / VPS / Droplet

```bash
git clone https://github.com/luxidevil/ai-brain.git
cd ai-brain
pnpm install

# Set env vars
export MONGODB_URI="mongodb+srv://..."
export BRAIN_TOKEN="bt_your-secret-token"
export PORT=8080

# Build and run
pnpm run build
node artifacts/api-server/dist/index.mjs

# Or use PM2 for production:
npm install -g pm2
pm2 start artifacts/api-server/dist/index.mjs --name ai-brain
pm2 save
pm2 startup
```

### Nginx reverse proxy (optional)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then add SSL: `certbot --nginx -d yourdomain.com`

---

## Data Models

### Message
```json
{
  "role": "user | assistant | system | agent",
  "content": "message text",
  "projectId": "my-project",
  "sessionId": "session-001",
  "agentId": "agent-001",
  "metadata": { "type": "planning", "raw": { ... } }
}
```

> Planning steps are stored as messages with `role: "system"` and `metadata.type: "planning"`. Full raw content is preserved — no summarization.

### Item (Action)
```json
{
  "name": "file-edit",
  "description": "optional description",
  "tags": ["action", "filesystem"],
  "data": { "file": "App.tsx", "action": "modified" },
  "status": "active | inactive | archived",
  "projectId": "my-project",
  "sessionId": "session-001"
}
```

### Thought
```json
{
  "thoughtId": "my-project",
  "description": "My cool project",
  "key": "tk_a1b2c3..."
}
```

### Log (auto-captured)
```json
{
  "method": "POST",
  "path": "/api/items",
  "statusCode": 201,
  "durationMs": 38,
  "projectId": "my-project",
  "sessionId": "session-001"
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `BRAIN_TOKEN` | Yes | Master brain token (`bt_...`) for admin operations |
| `PORT` | No | Server port (default: 8080) |

---

## Project Structure

```
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── models/      # Mongoose models: Message, Item, Log, Thought
│   │       ├── routes/      # brain, items, messages, logs, sync, health
│   │       ├── middleware/   # Auth (brain token + thought keys), request logger
│   │       └── lib/         # MongoDB connection, Swagger spec
│   └── dashboard/           # React + Vite management UI
│       └── src/
│           └── App.tsx      # Thoughts, Overview, How To tabs
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

## What's New (v2)

- **Thought-first architecture** — thoughts are first-class entities with their own access keys
- **Dual auth** — brain token (master) and thought keys (per-project), like GitHub deploy keys
- **Agent-optimized context endpoint** — `/context` returns a single chronological timeline, no MongoDB noise
- **Full planning storage** — stores every word of agent thinking, not just summaries
- **Chat-like dashboard** — click a thought, see messages/planning/actions as a conversation
- **Session filtering** — filter by session in both API and dashboard
- **Backward compatible** — all v1 `/api/sync` endpoints still work

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) — PRs are welcome.

Ideas for contributions:
- Search/filter across thoughts
- Export to JSON/CSV
- Webhook notifications on new data
- Rate limiting per thought key
- Thought sharing between brains
- Vector search for semantic memory retrieval

---

## License

MIT — see [LICENSE](./LICENSE)
