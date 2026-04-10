# Why We Built Agent Brain API

## The Problem

AI agents are powerful but amnesiac.

Every session starts with a blank slate. The agent doesn't know what it built yesterday, what approaches it tried, what decisions it made, or what's already been figured out. If you're working on a complex project across multiple sessions — or using multiple agents that need to share context — you're constantly re-explaining, re-exploring, and re-discovering.

We hit this wall repeatedly. An agent would spend time planning an approach, implement part of it, then the session would end. The next session would start over: re-read the files, re-understand the architecture, re-plan the approach. Sometimes it would make different decisions than the last session — not because the new decision was better, but because it had no memory of why the last decision was made.

The deeper problem: agents make decisions based on context they can see. When that context is gone, the decisions change.

## The Insight

The solution isn't to make the context window bigger. It's to make the right things persistent.

An agent doesn't need to remember every word of every past conversation. It needs to know:
- What was decided and why
- What was tried and what happened
- What actions were taken (files created, packages installed, APIs called)
- Where things were left off

This is structured information. It fits naturally in a database. And it can be written and read with a simple REST API.

## The Design

We made two decisions that shape everything else:

**1. One command to write, one command to read.**

We didn't want agents to learn an SDK or integrate a library. We wanted any agent — regardless of what language or framework it uses — to be able to store and retrieve memory with a single `curl` command. `/api/sync` writes everything. `/api/sync/read` reads everything. That's the whole interface for 90% of use cases.

**2. Structure over free-form.**

Memory is split into three types:
- **Messages** — the conversation that happened
- **Planning** — the reasoning and decisions made
- **Actions** — what was actually done

This separation makes the memory useful. An agent reading back a session can quickly find what decisions were made (planning), what the conversation was about (messages), and exactly what happened (actions) — without wading through a flat log.

## The Result

Any agent that reads from the brain before starting work picks up where the last agent left off. It knows what was tried. It knows what was decided. It knows what the current state is.

Sessions become continuations instead of restarts.

## What This Isn't

This isn't a vector database or a RAG system. There's no embedding, no semantic search, no ML. It's deliberately simple: structured data in MongoDB, retrieved by session ID.

Simple is the point. The brain should be easy to self-host, easy to inspect, easy to debug, and easy to extend. Complexity can be added later. Simplicity can't be added at all.

## What's Next

The natural next steps are:
- **`projectId` support** — one person, multiple projects, separate memory for each
- **Authentication** — API key per agent or per project
- **Search** — find sessions by content, not just by ID
- **Summaries** — auto-compress old sessions to save space

All of these are additive. The core stays the same: one command to write, one command to read.
