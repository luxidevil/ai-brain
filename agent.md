# Agent Integration Guide

This guide shows how to connect any AI agent to Agent Brain for persistent memory across sessions.

---

## Overview

Agent Brain stores everything your agent produces:

| What | Stored as | API field |
|------|-----------|-----------|
| User & assistant messages | `Message` | `messages[]` |
| Thinking / planning steps | `Message` (metadata.type = "planning") | `planning[]` |
| Tool calls / actions taken | `Item` | `actions[]` |
| HTTP request logs | `Log` | `logs[]` |
| Secrets / API keys | `Secret` | via `/api/secrets/*` |

All stored under a **projectId** (your Thought ID) and optional **sessionId**.

---

## Setup

1. Register and get your Brain Token:
```bash
curl -X POST https://YOUR_DOMAIN/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'
# → { "brainToken": "bt_..." }
```

2. Create a Thought for your project:
```bash
curl -X POST https://YOUR_DOMAIN/api/brain \
  -H "Authorization: Bearer bt_..." \
  -H "Content-Type: application/json" \
  -d '{"thoughtId":"my-agent","description":"My autonomous agent"}'
# → { "key": "tk_..." }
```

3. Use the `tk_...` Thought Key in your agent. **Keep it secret.**

---

## The Sync Endpoint

`POST /api/sync` is the main integration point. Send everything at once at the end of each agent run or after each turn.

```
Authorization: Bearer tk_...
Content-Type: application/json
```

```json
{
  "projectId": "my-agent",
  "sessionId": "run-2024-01-15-001",

  "messages": [
    { "role": "user",      "content": "Find the best price for AirPods" },
    { "role": "assistant", "content": "I'll search for current prices..." }
  ],

  "planning": [
    {
      "content": "I need to search multiple retailers and compare prices",
      "step": 1,
      "durationMs": 3200
    },
    {
      "content": "Analyzing search results — Amazon shows $179, Best Buy $189",
      "step": 2,
      "durationMs": 1800
    }
  ],

  "actions": [
    {
      "name": "web-search",
      "description": "Searched 'AirPods price 2024'",
      "tags": ["search", "web"],
      "data": { "query": "AirPods price 2024", "results": 12 }
    },
    {
      "name": "price-compare",
      "description": "Compared prices across 4 retailers",
      "tags": ["analysis"]
    }
  ]
}
```

All fields except `projectId` are optional.

---

## Recalling Context

At the start of a new session, fetch the full history:

```bash
curl "https://YOUR_DOMAIN/api/sync/context?projectId=my-agent" \
  -H "Authorization: Bearer tk_..."
```

Returns a flat chronological list of events:
```json
{
  "projectId": "my-agent",
  "total": 47,
  "events": [
    { "type": "message", "role": "user",      "content": "...", "session": "run-001" },
    { "type": "planning","content": "...",     "session": "run-001" },
    { "type": "action",  "name": "web-search","session": "run-001" },
    ...
  ]
}
```

Inject this into your agent's system prompt to resume from where it left off.

---

## Framework Examples

### Claude (Anthropic Python SDK)

```python
import anthropic
import requests

BRAIN_URL = "https://YOUR_DOMAIN"
THOUGHT_KEY = "tk_..."
PROJECT_ID = "my-claude-agent"

client = anthropic.Anthropic()

def get_context(session_id: str = None) -> str:
    r = requests.get(
        f"{BRAIN_URL}/api/sync/context",
        params={"projectId": PROJECT_ID},
        headers={"Authorization": f"Bearer {THOUGHT_KEY}"}
    )
    events = r.json().get("events", [])
    lines = []
    for e in events[-50:]:  # last 50 events
        if e["type"] == "message":
            lines.append(f"[{e['role']}]: {e['content']}")
        elif e["type"] == "planning":
            lines.append(f"[thinking]: {e['content']}")
        elif e["type"] == "action":
            lines.append(f"[action:{e['name']}]: {e.get('description','')}")
    return "\n".join(lines)

def save_session(messages: list, thinking: list, actions: list, session_id: str):
    requests.post(
        f"{BRAIN_URL}/api/sync",
        headers={"Authorization": f"Bearer {THOUGHT_KEY}", "Content-Type": "application/json"},
        json={
            "projectId": PROJECT_ID,
            "sessionId": session_id,
            "messages": messages,
            "planning": [{"content": t, "durationMs": 0} for t in thinking],
            "actions": actions,
        }
    )

def run_agent(user_input: str, session_id: str):
    # Load past context
    context = get_context()

    system = f"""You are a helpful assistant with persistent memory.

Past context:
{context}
"""
    messages = [{"role": "user", "content": user_input}]

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=16000,
        thinking={"type": "enabled", "budget_tokens": 10000},
        system=system,
        messages=messages,
    )

    thinking_steps = []
    answer = ""
    for block in response.content:
        if block.type == "thinking":
            thinking_steps.append(block.thinking)
        elif block.type == "text":
            answer = block.text

    messages.append({"role": "assistant", "content": answer})

    # Save everything
    save_session(
        messages=messages,
        thinking=thinking_steps,
        actions=[],
        session_id=session_id
    )

    return answer
```

### OpenAI Python SDK

```python
from openai import OpenAI
import requests

BRAIN_URL = "https://YOUR_DOMAIN"
THOUGHT_KEY = "tk_..."
PROJECT_ID = "my-openai-agent"

client = OpenAI()

def sync_to_brain(messages: list, session_id: str, actions: list = None):
    requests.post(
        f"{BRAIN_URL}/api/sync",
        headers={"Authorization": f"Bearer {THOUGHT_KEY}"},
        json={
            "projectId": PROJECT_ID,
            "sessionId": session_id,
            "messages": [
                {"role": m["role"], "content": m["content"]}
                for m in messages
                if m.get("content")
            ],
            "actions": actions or []
        }
    )

def get_brain_context() -> list[dict]:
    r = requests.get(
        f"{BRAIN_URL}/api/sync/context",
        params={"projectId": PROJECT_ID},
        headers={"Authorization": f"Bearer {THOUGHT_KEY}"}
    )
    events = r.json().get("events", [])
    # Convert to OpenAI message format
    history = []
    for e in events[-30:]:
        if e["type"] == "message" and e["role"] in ("user", "assistant"):
            history.append({"role": e["role"], "content": e["content"]})
    return history

def run(user_input: str, session_id: str) -> str:
    history = get_brain_context()
    history.append({"role": "user", "content": user_input})

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": "You are a helpful assistant with memory of past sessions."}] + history,
    )
    reply = response.choices[0].message.content
    history.append({"role": "assistant", "content": reply})

    sync_to_brain(history, session_id)
    return reply
```

### LangChain

```python
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.chat_history import BaseChatMessageHistory
import requests

BRAIN_URL = "https://YOUR_DOMAIN"
THOUGHT_KEY = "tk_..."

class BrainMemory(BaseChatMessageHistory):
    def __init__(self, project_id: str, session_id: str):
        self.project_id = project_id
        self.session_id = session_id
        self._messages = []
        self._load()

    def _load(self):
        r = requests.get(
            f"{BRAIN_URL}/api/sync/context",
            params={"projectId": self.project_id},
            headers={"Authorization": f"Bearer {THOUGHT_KEY}"}
        )
        for e in r.json().get("events", []):
            if e["type"] == "message":
                if e["role"] == "user":
                    self._messages.append(HumanMessage(content=e["content"]))
                elif e["role"] == "assistant":
                    self._messages.append(AIMessage(content=e["content"]))

    @property
    def messages(self):
        return self._messages

    def add_messages(self, messages):
        self._messages.extend(messages)
        requests.post(
            f"{BRAIN_URL}/api/sync",
            headers={"Authorization": f"Bearer {THOUGHT_KEY}"},
            json={
                "projectId": self.project_id,
                "sessionId": self.session_id,
                "messages": [
                    {"role": "user" if isinstance(m, HumanMessage) else "assistant", "content": m.content}
                    for m in messages
                ]
            }
        )

    def clear(self):
        self._messages = []
```

---

## Storing Secrets

Store API keys your agent needs inside Agent Brain's secrets vault:

```bash
# Store a secret for a specific thought
curl -X PUT https://YOUR_DOMAIN/api/secrets/thought/my-agent/OPENAI_API_KEY \
  -H "Authorization: Bearer tk_..." \
  -H "Content-Type: application/json" \
  -d '{"value":"sk-..."}'

# Retrieve all secrets for this thought (thought + brain level merged)
curl https://YOUR_DOMAIN/api/secrets/thought/my-agent \
  -H "Authorization: Bearer tk_..."
```

In Python:
```python
def get_secret(key: str) -> str:
    r = requests.get(
        f"{BRAIN_URL}/api/secrets/thought/{PROJECT_ID}",
        headers={"Authorization": f"Bearer {THOUGHT_KEY}"}
    )
    return r.json()["secrets"].get(key, {}).get("value", "")

openai_key = get_secret("OPENAI_API_KEY")
```

---

## Best Practices

| Practice | Why |
|----------|-----|
| Use a unique `sessionId` per run | Lets you filter history by session |
| Sync at the end of each turn | Keeps context up to date without slowing the agent |
| Trim context to last N events | Avoids token overflow when injecting history |
| Store agent API keys as Brain Secrets | Centralised credential management |
| Use `planning[]` for thinking steps | Keeps reasoning visible in the dashboard |
| Use `actions[]` for every tool call | Full audit trail of what the agent did |

---

## Health Check

```bash
curl https://YOUR_DOMAIN/api/healthz
# → { "status": "ok", "mongodb": "connected", "uptime": 3600 }
```

Use this to verify connectivity before running your agent.
