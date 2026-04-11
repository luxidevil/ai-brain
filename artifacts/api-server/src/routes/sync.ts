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

  if (planning.length > 0) {
    try {
      const docs = planning.map((p: Record<string, unknown>) => {
        const content = typeof p === "string"
          ? p
          : p.content ?? p.raw ?? p.text ?? p.thinking ?? JSON.stringify(p);
        return {
          role: "system",
          content,
          projectId: p.projectId ?? projectId ?? null,
          sessionId: p.sessionId ?? sessionId ?? null,
          agentId: (typeof p === "object" ? p.agentId : null) ?? null,
          metadata: {
            type: "planning",
            step: typeof p === "object" ? p.step ?? null : null,
            durationMs: typeof p === "object" ? p.durationMs ?? null : null,
            raw: typeof p === "object" ? p : null,
            ...(typeof p === "object" && typeof p.metadata === "object" ? (p.metadata as object) : {}),
          },
        };
      });
      const created = await Message.insertMany(docs, { ordered: false });
      results.planning = { saved: created.length };
    } catch (err: unknown) {
      errors.push(`planning: ${err instanceof Error ? err.message : "insert failed"}`);
      results.planning = { saved: 0 };
    }
  }

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

  const status = errors.length === 0 ? 201 : 207;
  res.status(status).json({
    ok: errors.length === 0,
    results,
    ...(errors.length > 0 ? { errors } : {}),
  });
});

/**
 * GET /sync/read
 * Read all data for a given sessionId (and optionally projectId).
 */
router.get("/read", async (req, res) => {
  const { sessionId, projectId } = req.query as Record<string, string>;

  if (!sessionId && !projectId) {
    return res.status(400).json({ error: "sessionId or projectId is required" });
  }

  try {
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    if (sessionId) filter.sessionId = sessionId;

    const [messages, items, logs] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }),
      Item.find({ ...filter, tags: "action" }).sort({ createdAt: 1 }),
      Log.find(filter).sort({ createdAt: 1 }),
    ]);

    res.json({
      projectId: projectId ?? null,
      sessionId: sessionId ?? null,
      messages,
      actions: items,
      logs,
      totals: {
        messages: messages.length,
        actions: items.length,
        logs: logs.length,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

/**
 * GET /sync/context
 * Returns a full chronological timeline of all events for a projectId.
 */
router.get("/context", async (req, res) => {
  const { projectId } = req.query as Record<string, string>;

  if (!projectId) {
    return res.status(400).json({ error: "projectId is required" });
  }

  try {
    const filter = { projectId };

    const [messages, items, logs] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }),
      Item.find({ ...filter, tags: "action" }).sort({ createdAt: 1 }),
      Log.find(filter).sort({ createdAt: 1 }),
    ]);

    const timeline: Array<Record<string, unknown> & { _ts?: Date }> = [];

    for (const msg of messages) {
      const doc = msg.toObject() as Record<string, unknown> & { createdAt?: Date; metadata?: Record<string, unknown> };
      timeline.push({
        type: doc.metadata && typeof doc.metadata === "object" && (doc.metadata as Record<string, unknown>).type === "planning" ? "planning" : "message",
        role: doc.role,
        content: doc.content,
        session: doc.sessionId ?? "unknown",
        ...(doc.agentId ? { agentId: doc.agentId } : {}),
        _ts: doc.createdAt,
      });
    }

    for (const item of items) {
      const doc = item.toObject() as Record<string, unknown> & { createdAt?: Date };
      timeline.push({
        type: "action",
        name: doc.name,
        description: doc.description,
        data: doc.data,
        session: doc.sessionId ?? "unknown",
        _ts: doc.createdAt,
      });
    }

    for (const logDoc of logs) {
      const doc = logDoc.toObject() as Record<string, unknown> & { createdAt?: Date; level?: string; message?: string };
      timeline.push({
        type: "log",
        method: doc.method,
        path: doc.path,
        statusCode: doc.statusCode,
        durationMs: doc.durationMs,
        session: doc.sessionId ?? "unknown",
        ...(doc.level ? { level: doc.level } : {}),
        ...(doc.message ? { message: doc.message } : {}),
        _ts: doc.createdAt,
      });
    }

    timeline.sort((a, b) => (a._ts?.getTime?.() ?? 0) - (b._ts?.getTime?.() ?? 0));
    const events = timeline.map(({ _ts: _stripped, ...e }) => e);

    res.json({ projectId, total: events.length, events });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
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
