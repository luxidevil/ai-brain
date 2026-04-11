# Agent Brain API — Agent Instructions

> Paste this file into your AI agent's system prompt or custom instructions.
> Replace `YOUR-DOMAIN`, `PROJECT-NAME`, and `YOUR-TOKEN` with your actual values.

---

## What This Is

You have access to a **persistent memory API** — a brain that remembers everything across sessions. Every message you exchange, every decision you make, every action you take is stored and retrievable. You never start from scratch.

**Your brain endpoint:** `https://YOUR-DOMAIN`
**Your thought key:** `tk_YOUR-TOKEN`
**Your project:** `PROJECT-NAME`

---

## Step 1: Read Your Memory (do this FIRST)

Before writing any code or doing any work, read your full history:

```bash
curl "https://YOUR-DOMAIN/api/brain/PROJECT-NAME/context" \
  -H "Authorization: Bearer tk_YOUR-TOKEN"
```

This returns a chronological timeline of everything that has happened:

```json
{
  "thoughtId": "PROJECT-NAME",
  "sessions": ["session-001", "session-002"],
  "totalEvents": 47,
  "timeline": [
    { "ts": "...", "type": "message", "role": "user", "content": "Build a login page" },
    { "ts": "...", "type": "planning", "content": "I need to create a form component..." },
    { "ts": "...", "type": "message", "role": "assistant", "content": "I created login.tsx..." },
    { "ts": "...", "type": "action", "action": "created-file", "description": "Created login.tsx" }
  ]
}
```

**Read the entire timeline before doing anything.** It contains:
- Every conversation between user and agent
- Every planning decision and reasoning
- Every file created, edited, command run, package installed
- What worked, what failed, what was abandoned and why

**Continue from where the last session left off.** Do not repeat work that was already done.

---

## Step 2: Save Your Work (do this at the END)

When your session ends, save everything you did:

```bash
curl -X POST "https://YOUR-DOMAIN/api/brain/PROJECT-NAME/sync" \
  -H "Authorization: Bearer tk_YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-003",
    "messages": [
      { "role": "user", "content": "The exact message the user sent you" },
      { "role": "assistant", "content": "Your exact response" }
    ],
    "planning": [
      { "content": "Your full internal reasoning. Every thought, every decision, every tradeoff you considered. Do not summarize — write the full thing." }
    ],
    "actions": [
      { "name": "created-file", "description": "Created src/auth/login.tsx", "data": { "file": "src/auth/login.tsx" } },
      { "name": "edited-file", "description": "Added validation to login form", "data": { "file": "src/auth/login.tsx" } },
      { "name": "installed-package", "description": "Installed bcrypt for password hashing", "data": { "package": "bcrypt" } },
      { "name": "ran-command", "description": "Ran database migration", "data": { "command": "npx prisma migrate dev" } }
    ]
  }'
```

---

## What to Save

### Messages
Every message exchanged in this session. Include:
- All user messages (`role: "user"`)
- All your responses (`role: "assistant"`)
- Any system messages (`role: "system"`)

### Planning
Your internal reasoning and decision-making. Include:
- What you considered and why
- Tradeoffs you evaluated
- Approaches you tried that didn't work
- Why you chose one approach over another
- Any assumptions you made

**Be verbose.** The next agent (or you, next session) needs to understand your thinking. Don't summarize — write the full reasoning.

### Actions
Everything you did. Common action types:
- `created-file` — new file created
- `edited-file` — existing file modified
- `deleted-file` — file removed
- `installed-package` — dependency added
- `removed-package` — dependency removed
- `ran-command` — shell command executed
- `fixed-bug` — bug identified and fixed
- `refactored` — code restructured
- `configured` — settings or config changed
- `deployed` — code deployed to production
- `tested` — tests run (include pass/fail results)

---

## Session ID Convention

Use an incrementing session ID: `session-001`, `session-002`, `session-003`, etc.

Check the `sessions` array in the context response to see the last session number, then increment by 1.

---

## Quick Reference

| Action | Command |
|--------|---------|
| Read full history | `GET /api/brain/PROJECT-NAME/context` |
| Save session data | `POST /api/brain/PROJECT-NAME/sync` |
| Read raw data (UI format) | `GET /api/brain/PROJECT-NAME` |

All requests need the header: `Authorization: Bearer tk_YOUR-TOKEN`

---

## Rules

1. **Always read before working.** Never skip Step 1.
2. **Always save before ending.** Never skip Step 2.
3. **Never summarize planning.** Write full reasoning. Future sessions depend on it.
4. **Log every action.** If you changed a file, ran a command, or installed something — log it.
5. **Continue, don't restart.** If session-002 built the auth system, don't rebuild it in session-003.
6. **Increment session IDs.** Check the last session number and add 1.
