import { Router } from "express";
import { Message } from "../models/message";
import { Item } from "../models/item";
import { Log } from "../models/log";

const router = Router();

/**
 * POST /sync
 * One-shot endpoint — push messages, planning, actions, and logs for a project session.
 *
 * Tree structure:
 *   Brain (this API)
 *     └── projectId  ("my-game", "ecommerce-app", etc.)
 *           └── sessionId  ("session-001", "session-002", etc.)
 *                 └── messages, planning, actions, logs
 */
router.post("/", async (req, res) => {
  const {
    messages = [],
    planning = [],
    actions = [],
    logs = [],
    sessionId,
    projectId,
  } = req.body ?? {};

  const errors: string[] = [];
  const results: Record<string, unknown> = {};

  if (
    !Array.isArray(messages) ||
    !Array.isArray(planning) ||
    !Array.isArray(actions) ||
    !Array.isArray(logs)
  ) {
    return res.status(400).json({
      error: "messages, planning, actions, and logs must all be arrays",
    });
  }

  // ── Messages ─────────────────────────────────────────────────
  if (messages.length > 0) {
    try {
      const docs = messages.map((m: Record<string, unknown>) => ({
        ...m,
        projectId: m.projectId ?? projectId ?? null,
        sessionId: m.sessionId ?? sessionId ?? null,
      }));
      const created = await Message.insertMany(docs, { ordered: false });
      results.messages = { saved: created.length };
    } catch (err: unknown) {
      errors.push(`messages: ${err instanceof Error ? err.message : "insert failed"}`);
      results.messages = { saved: 0 };
    }
  }

  // ── Planning steps (stored as system messages) ────────────────
  if (planning.length > 0) {
    try {
      const docs = planning.map((p: Record<string, unknown>) => ({
        role: "system",
        content: p.summary ?? p.content ?? p.description ?? JSON.stringify(p),
        projectId: p.projectId ?? projectId ?? null,
        sessionId: p.sessionId ?? sessionId ?? null,
        agentId: p.agentId ?? null,
        metadata: {
          type: "planning",
          durationMs: p.durationMs ?? null,
          ...(typeof p.metadata === "object" ? p.metadata as object : {}),
        },
      }));
      const created = await Message.insertMany(docs, { ordered: false });
      results.planning = { saved: created.length };
    } catch (err: unknown) {
      errors.push(`planning: ${err instanceof Error ? err.message : "insert failed"}`);
      results.planning = { saved: 0 };
    }
  }

  // ── Actions (stored as Items) ─────────────────────────────────
  if (actions.length > 0) {
    try {
      const docs = actions.map((a: Record<string, unknown>) => ({
        name: a.name ?? a.action ?? "untitled-action",
        description: a.description ?? null,
        tags: Array.isArray(a.tags) ? ["action", ...a.tags] : ["action"],
        data: typeof a.data === "object" ? a.data as object : { raw: a },
        status: "active" as const,
        projectId: a.projectId ?? projectId ?? null,
        sessionId: a.sessionId ?? sessionId ?? null,
      }));
      const created = await Item.insertMany(docs, { ordered: false });
      results.actions = { saved: created.length };
    } catch (err: unknown) {
      errors.push(`actions: ${err instanceof Error ? err.message : "insert failed"}`);
      results.actions = { saved: 0 };
    }
  }

  // ── Logs ──────────────────────────────────────────────────────
  if (logs.length > 0) {
    try {
      const docs = (logs as Record<string, unknown>[]).map((l) => ({
        ...l,
        projectId: l.projectId ?? projectId ?? null,
        sessionId: l.sessionId ?? sessionId ?? null,
      }));
      const created = await Log.insertMany(docs, { ordered: false });
      results.logs = { saved: created.length };
    } catch (err: unknown) {
      errors.push(`logs: ${err instanceof Error ? err.message : "insert failed"}`);
      results.logs = { saved: 0 };
    }
  }

  const totalSaved = Object.values(results).reduce(
    (sum, r) => sum + ((r as { saved: number }).saved ?? 0),
    0
  );

  res.status(errors.length === 0 ? 201 : 207).json({
    ok: errors.length === 0,
    projectId: projectId ?? null,
    sessionId: sessionId ?? null,
    totalSaved,
    results,
    ...(errors.length > 0 && { errors }),
  });
});

/**
 * GET /sync/read
 * Read everything for a project session in one call.
 * Filter by projectId and/or sessionId.
 */
router.get("/read", async (req, res) => {
  const { projectId, sessionId, limit = "50" } = req.query as Record<string, string>;
  const lim = Math.min(Number(limit), 200);

  try {
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    if (sessionId) filter.sessionId = sessionId;

    const [allMessages, actions, logs] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).limit(lim),
      Item.find(filter).sort({ createdAt: -1 }).limit(lim),
      Log.find(filter).sort({ createdAt: -1 }).limit(lim),
    ]);

    const messages = allMessages.filter((m) => m.metadata?.type !== "planning");
    const planning = allMessages.filter((m) => m.metadata?.type === "planning");

    res.json({
      projectId: projectId ?? null,
      sessionId: sessionId ?? null,
      messages: { data: messages, total: messages.length },
      planning: { data: planning, total: planning.length },
      actions: { data: actions, total: actions.length },
      logs: { data: logs, total: logs.length },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Read failed" });
  }
});

/**
 * GET /sync/projects
 * List all unique projectIds stored in the brain.
 */
router.get("/projects", async (_req, res) => {
  try {
    const projectIds = await Message.distinct("projectId", { projectId: { $ne: null } });
    res.json({ projects: projectIds, total: projectIds.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list projects" });
  }
});

/**
 * GET /sync/sessions
 * List all unique sessionIds for a given projectId.
 */
router.get("/sessions", async (req, res) => {
  const { projectId } = req.query as Record<string, string>;
  try {
    const filter = projectId ? { projectId, sessionId: { $ne: null } } : { sessionId: { $ne: null } };
    const sessionIds = await Message.distinct("sessionId", filter);
    res.json({
      projectId: projectId ?? null,
      sessions: sessionIds,
      total: sessionIds.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list sessions" });
  }
});

export default router;
