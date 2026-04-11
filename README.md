# 🧠 Agent Brain

A MongoDB-backed personal memory system for AI agents. Lets agents store messages, planning steps, actions, and logs across sessions using a **Brain Token** (master auth) + **Thought Keys** (per-project namespaces). Includes a React dashboard for visual management.

---

## Features

- **Persistent memory** across agent sessions (messages, planning/thinking steps, actions, logs)
- **Multi-project namespacing** via Thought Keys (`tk_...`)
- **Master access** via Brain Token (`bt_...`)
- **BYODB** (Bring Your Own MongoDB) — each user can bring their own Atlas cluster
- **Secrets vault** — store API keys and credentials scoped to a brain or thought
- **React dashboard** — visual timeline of all agent activity, secrets panel, quick reference
- **Sync API** — single endpoint to store everything an agent produces in one call
- **Context recall** — flat chronological timeline for injecting past context into new sessions

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Agent Brain                         │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐   ┌─────────────┐ │
│  │  API Server  │    │   Dashboard  │   │  MongoDB    │ │
│  │  (Express)  │◄──►│   (React)    │   │  (Atlas)    │ │
│  │  Port 8080  │    │  Port 23183  │   │             │ │
│  └──────┬──────┘    └──────────────┘   └──────┬──────┘ │
│         │                                      │        │
│         └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Auth Levels

| Token | Prefix | Access |
|-------|--------|--------|
| Brain Token | `bt_...` | Full access — list/create/delete all thoughts, manage brain secrets |
| Thought Key | `tk_...` | Scoped to one thought — sync data, read context, manage thought secrets |
| `BRAIN_TOKEN` env | — | Single-user mode without DB auth |

---

## Quick Start

### 1. Register

```bash
curl -X POST https://your-domain/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret","name":"Your Name"}'
```

Response includes your `brainToken` (`bt_...`). **Save it — it won't be shown again.**

Optionally pass `"mongoUri": "mongodb+srv://..."` to use your own MongoDB cluster (BYODB).

### 2. Create a Thought (project namespace)

```bash
curl -X POST https://your-domain/api/brain \
  -H "Authorization: Bearer bt_..." \
  -H "Content-Type: application/json" \
  -d '{"thoughtId":"my-project","description":"My AI agent project"}'
```

Response includes a `key` (`tk_...`). **Save it — it won't be shown again.**

### 3. Sync agent output

```bash
curl -X POST https://your-domain/api/sync \
  -H "Authorization: Bearer tk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "sessionId": "session-001",
    "messages": [
      {"role": "user", "content": "Build me a website"},
      {"role": "assistant", "content": "Sure! Here is the plan..."}
    ],
    "planning": [
      {"content": "Analyzing requirements", "durationMs": 5000, "step": 1}
    ],
    "actions": [
      {"name": "create-file", "description": "Created index.html"}
    ]
  }'
```

### 4. Recall context in a new session

```bash
curl "https://your-domain/api/sync/context?projectId=my-project" \
  -H "Authorization: Bearer tk_..."
```

Returns a flat chronological timeline of all messages, planning steps, and actions.

---

## API Reference

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | None | Register account, get Brain Token |
| `POST` | `/api/auth/login` | None | Login, retrieve Brain Token |

### Brain (Thoughts)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/brain` | Brain | List all thoughts with counts |
| `POST` | `/api/brain` | Brain | Create thought, get Thought Key |
| `GET` | `/api/brain/:id` | Brain/Thought | Get thought detail + messages |
| `DELETE` | `/api/brain/:id` | Brain | Delete thought and all data |
| `POST` | `/api/brain/:id/regenerate-key` | Brain | Regenerate Thought Key |

### Sync

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sync` | Brain/Thought | Sync messages, planning, actions, logs |
| `GET` | `/api/sync/context` | Brain/Thought | Get flat timeline (`?projectId=x`) |
| `GET` | `/api/sync/projects` | Brain/Thought | List all project IDs |
| `GET` | `/api/sync/sessions` | Brain/Thought | List sessions (`?projectId=x`) |

### Messages / Items / Logs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/messages` | Brain/Thought | List messages |
| `POST` | `/api/messages` | Brain/Thought | Create message |
| `POST` | `/api/messages/batch` | Brain/Thought | Batch insert (max 100) |
| `DELETE` | `/api/messages/:id` | Brain/Thought | Delete message |
| `GET` | `/api/items` | Brain/Thought | List action items |
| `POST` | `/api/items` | Brain/Thought | Create item |
| `PATCH` | `/api/items/:id` | Brain/Thought | Update item |
| `GET` | `/api/logs` | Brain/Thought | List request logs |

### Secrets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/secrets/brain` | Brain | List brain-level secrets |
| `PUT` | `/api/secrets/brain/:key` | Brain | Set brain secret |
| `DELETE` | `/api/secrets/brain/:key` | Brain | Delete brain secret |
| `GET` | `/api/secrets/thought/:id` | Brain/Thought | List thought secrets (merged with brain) |
| `PUT` | `/api/secrets/thought/:id/:key` | Thought | Set thought secret |
| `DELETE` | `/api/secrets/thought/:id/:key` | Thought | Delete thought secret |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/healthz` | Returns API + MongoDB status |

---

## Data Models

### Message
```typescript
{
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  projectId?: string,
  sessionId?: string,
  agentId?: string,
  metadata?: Record<string, unknown>,  // { type: "planning", step, durationMs } for planning steps
  createdAt: Date
}
```

### Item (Action)
```typescript
{
  name: string,
  description?: string,
  tags: string[],          // always includes "action"
  data?: Record<string, unknown>,
  status: "active" | "completed" | "failed" | "archived",
  projectId?: string,
  sessionId?: string,
  createdAt: Date
}
```

### Secret
```typescript
{
  scope: "brain" | "thought",
  thoughtId?: string,      // null for brain-level secrets
  key: string,
  value: string,           // stored as plaintext (encrypt at rest via Atlas)
  createdAt: Date
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `BRAIN_TOKEN` | No | Static brain token for single-user mode |
| `SESSION_SECRET` | No | Session signing secret |
| `PORT` | No | Server port (default: 8080) |

---

## Dashboard

The React dashboard (built with Vite + Tailwind CSS) is available at the root path `/`.

Features:
- **Thoughts tab** — list all thoughts, create new ones, view/copy Thought Keys
- **Thought detail** — full chronological timeline (messages, planning steps 🧠, actions ⚡, logs)
- **Secrets panel** — manage per-thought and brain-level secrets with reveal/hide toggle
- **Overview tab** — live API + MongoDB status, quick API reference
- **How To tab** — step-by-step integration guide

The Brain Token is stored in `localStorage` under the key `brain_token`.

---

## Stack

| Layer | Technology |
|-------|------------|
| API | Node.js, Express v5, TypeScript |
| Database | MongoDB via Mongoose |
| Auth | Custom token-based (bcryptjs) |
| Dashboard | React 18, Vite, Tailwind CSS v4 |
| Build | esbuild (API), Vite (dashboard) |
| Package manager | pnpm workspaces |

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express API server
│   │   └── src/
│   │       ├── app.ts       # Express app setup
│   │       ├── index.ts     # Server entry + MongoDB connect
│   │       ├── lib/
│   │       │   ├── mongodb.ts         # Mongoose connection
│   │       │   ├── connectionPool.ts  # Per-user BYODB connections
│   │       │   └── logger.ts          # Pino logger
│   │       ├── middleware/
│   │       │   ├── auth.ts            # Brain Token + Thought Key auth
│   │       │   └── requestLogger.ts   # Request logging middleware
│   │       ├── models/
│   │       │   ├── user.ts            # User + brainToken
│   │       │   ├── thought.ts         # Thought namespace + key
│   │       │   ├── message.ts         # Chat messages + planning steps
│   │       │   ├── item.ts            # Actions / items
│   │       │   ├── log.ts             # Request logs
│   │       │   └── secret.ts          # Secrets vault
│   │       └── routes/
│   │           ├── auth.ts            # Register / login
│   │           ├── brain.ts           # Thought CRUD
│   │           ├── messages.ts        # Message CRUD
│   │           ├── items.ts           # Item CRUD
│   │           ├── logs.ts            # Log queries
│   │           ├── secrets.ts         # Secrets management
│   │           └── sync.ts            # Sync + context recall
│   └── dashboard/           # React dashboard
│       └── src/
│           ├── App.tsx      # Full dashboard UI
│           └── index.css    # Tailwind theme
└── README.md
```
