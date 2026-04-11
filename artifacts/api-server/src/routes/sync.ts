import { Router, type Request, type Response } from "express";
import { Message } from "../models/message";
import { Item } from "../models/item";
import { Log } from "../models/log";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const auth = req as unknown as Record<string, unknown>;
  const authThoughtId = auth.authThoughtId as string | undefined;

  const {
    messages = [],
    planning = [],
    actions = [],
    logs = [],
    sessionId,
  } = req.body ?? {};

  // If authenticated with a Thought Key, always use that thought's ID as projectId.
  // This prevents typos from creating phantom thoughts.
  const projectId: string | undefined = authThoughtId ?? req.body?.projectId;

  if (!projectId) {
    res.status(400).json({
      error: "projectId is required when using a Brain Token. Use a Thought Key to auto-bind to a thought.",
    });
    return;
  }

  const errors: string[] = [];
  const results: Record<string, unknown> = {};

  if (
    !Array.isArray(messages) ||
    !Array.isArray(planning) ||
    !Array.isArray(actions) ||
    !Array.isArray(logs)
  ) {
    res.status(400).json({ error: "messages, planning, actions, and logs must all be arrays" });
    return;
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
          : String(p.content ?? p.raw ?? p.text ?? p.thinking ?? JSON.stringify(p));
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

  const totalSaved = Object.values(results).reduce(
    (sum, r) => (sum as number) + (((r as { saved?: number }).saved) ?? 0),
    0
  ) as number;

  res.status(errors.length > 0 ? 207 : 200).json({
    message: "Sync complete",
    saved: totalSaved,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
});

router.get("/context", async (req: Request, res: Response): Promise<void> => {
  const { limit: rawLimit } = req.query as Record<string, string>;
  const authThoughtId = (req as unknown as Record<string, unknown>).authThoughtId as string | undefined;
  const projectId = authThoughtId ?? (req.query.projectId as string | undefined);

  if (!projectId) {
    res.status(400).json({ error: "projectId is required (or use a Thought Key to auto-bind)" });
    return;
  }

  const limit = Math.min(Number(rawLimit) || 200, 500);

  try {
    const filter = { projectId };
    const [messages, items, logs] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).limit(limit),
      Item.find(filter).sort({ createdAt: -1 }).limit(limit),
      Log.find(filter).sort({ createdAt: -1 }).limit(50),
    ]);

    const timeline: (Record<string, unknown> & { _ts?: Date })[] = [];

    for (const m of messages) {
      const doc = m.toObject() as {
        role: string;
        content: string;
        sessionId?: string;
        agentId?: string;
        metadata?: Record<string, unknown>;
        createdAt: Date;
      };
      const isPlanning = doc.metadata?.type === "planning";
      timeline.push({
        type: isPlanning ? "planning" : "message",
        role: doc.role,
        content: doc.content,
        session: doc.sessionId ?? "unknown",
        ...(doc.agentId ? { agentId: doc.agentId } : {}),
        ...(isPlanning ? { metadata: doc.metadata } : {}),
        _ts: doc.createdAt,
      });
    }

    for (const item of items) {
      const doc = item.toObject() as {
        name: string;
        description: string;
        tags: string[];
        data: unknown;
        status: string;
        sessionId?: string;
        createdAt: Date;
      };
      timeline.push({
        type: "action",
        name: doc.name,
        description: doc.description,
        tags: doc.tags,
        data: doc.data,
        status: doc.status,
        session: doc.sessionId ?? "unknown",
        _ts: doc.createdAt,
      });
    }

    for (const log of logs) {
      const doc = log.toObject() as {
        method: string;
        path: string;
        statusCode: number;
        durationMs: number;
        sessionId?: string;
        createdAt: Date;
      };
      timeline.push({
        type: "log",
        method: doc.method,
        path: doc.path,
        statusCode: doc.statusCode,
        durationMs: doc.durationMs,
        session: doc.sessionId ?? "unknown",
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

router.get("/projects", async (_req: Request, res: Response): Promise<void> => {
  try {
    const projectIds = await Message.distinct("projectId", { projectId: { $ne: null } });
    res.json({ projects: projectIds, total: projectIds.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list projects" });
  }
});

router.get("/sessions", async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.query as Record<string, string>;
  try {
    const filter = projectId ? { projectId, sessionId: { $ne: null } } : { sessionId: { $ne: null } };
    const sessionIds = await Message.distinct("sessionId", filter);
    res.json({ projectId: projectId ?? null, sessions: sessionIds, total: sessionIds.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list sessions" });
  }
});

export default router;
