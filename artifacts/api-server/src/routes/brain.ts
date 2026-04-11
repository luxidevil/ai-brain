import { Router, type Request } from "express";
import { Message } from "../models/message";
import { Item } from "../models/item";
import { Log } from "../models/log";
import { Thought } from "../models/thought";
import { Secret } from "../models/secret";
import { getUserConnection } from "../lib/connectionPool";
import crypto from "crypto";

const router = Router();

function getAuth(req: Request) {
  return {
    level: (req as Record<string, unknown>).authLevel as string,
    thoughtId: (req as Record<string, unknown>).authThoughtId as string | undefined,
    mongoUri: (req as Record<string, unknown>).userMongoUri as string | null | undefined,
  };
}

function requireBrain(req: Request) {
  return getAuth(req).level === "brain";
}

function canAccess(req: Request, thoughtId: string) {
  const auth = getAuth(req);
  return auth.level === "brain" || auth.thoughtId === thoughtId;
}

async function getModels(req: Request) {
  const { mongoUri } = getAuth(req);
  if (mongoUri) {
    return getUserConnection(mongoUri);
  }
  return { Message, Item, Log, Thought, Secret };
}

router.get("/", async (req, res) => {
  if (!requireBrain(req)) {
    return res.status(403).json({ error: "Brain token required to list all thoughts" });
  }

  try {
    const m = await getModels(req);

    const thoughts = await m.Thought.find().sort({ createdAt: -1 });

    const result = [];
    for (const t of thoughts) {
      const doc = t.toObject() as { thoughtId: string; description: string; createdAt: Date; key: string };
      const filter = { projectId: doc.thoughtId };
      const [messages, items, logs] = await Promise.all([
        m.Message.countDocuments(filter),
        m.Item.countDocuments(filter),
        m.Log.countDocuments(filter),
      ]);
      result.push({
        thoughtId: doc.thoughtId,
        description: doc.description,
        key: doc.key,
        counts: { messages, items, logs },
        total: messages + items + logs,
        createdAt: doc.createdAt,
      });
    }

    const [orphanMsgProjects, orphanItemProjects] = await Promise.all([
      m.Message.distinct("projectId", {
        projectId: { $ne: null, $nin: thoughts.map((t) => (t as unknown as { thoughtId: string }).thoughtId) },
      }),
      m.Item.distinct("projectId", {
        projectId: { $ne: null, $nin: thoughts.map((t) => (t as unknown as { thoughtId: string }).thoughtId) },
      }),
    ]);

    const orphanIds = new Set([...orphanMsgProjects, ...orphanItemProjects]);
    for (const id of orphanIds) {
      const filter = { projectId: id };
      const [messages, items, logs] = await Promise.all([
        m.Message.countDocuments(filter),
        m.Item.countDocuments(filter),
        m.Log.countDocuments(filter),
      ]);
      result.push({
        thoughtId: id,
        description: "(legacy - no key assigned)",
        key: null,
        counts: { messages, items, logs },
        total: messages + items + logs,
        createdAt: null,
      });
    }

    res.json({
      brain: "ai-brain",
      thoughts: result,
      totalThoughts: result.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list thoughts" });
  }
});

router.post("/", async (req, res) => {
  if (!requireBrain(req)) {
    return res.status(403).json({ error: "Brain token required to create thoughts" });
  }

  const { thoughtId, description } = req.body ?? {};

  if (!thoughtId || typeof thoughtId !== "string") {
    return res.status(400).json({ error: "thoughtId is required (string)" });
  }

  try {
    const m = await getModels(req);

    const exists = await m.Thought.findOne({ thoughtId });
    if (exists) {
      return res.status(409).json({ error: `Thought '${thoughtId}' already exists` });
    }

    const key = `tk_${crypto.randomBytes(32).toString("hex")}`;

    const thought = await m.Thought.create({
      thoughtId,
      description: description || "",
      key,
    });

    res.status(201).json({
      thoughtId: (thought as unknown as { thoughtId: string }).thoughtId,
      key,
      message: "Thought created. Save this key — it grants direct access to this thought.",
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create thought" });
  }
});

router.get("/:thoughtId", async (req, res) => {
  try {
    const { thoughtId } = req.params;

    if (!canAccess(req, thoughtId)) {
      return res.status(403).json({ error: "Access denied to this thought" });
    }

    const m = await getModels(req);
    const filter = { projectId: thoughtId };

    const [messages, items, logs, thought] = await Promise.all([
      m.Message.find(filter).sort({ createdAt: 1 }),
      m.Item.find(filter).sort({ createdAt: 1 }),
      m.Log.find(filter).sort({ createdAt: 1 }),
      m.Thought.findOne({ thoughtId }),
    ]);

    if (messages.length === 0 && items.length === 0 && logs.length === 0) {
      return res.status(404).json({ error: `Thought '${thoughtId}' not found` });
    }

    res.json({
      thoughtId,
      description: thought ? (thought as unknown as { description: string }).description : null,
      messages,
      items,
      logs,
      counts: {
        messages: messages.length,
        items: items.length,
        logs: logs.length,
      },
      total: messages.length + items.length + logs.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/:thoughtId/context", async (req, res) => {
  try {
    const { thoughtId } = req.params;

    if (!canAccess(req, thoughtId)) {
      return res.status(403).json({ error: "Access denied to this thought" });
    }

    const m = await getModels(req);
    const filter: Record<string, unknown> = { projectId: thoughtId };
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;

    const [messages, items, thought] = await Promise.all([
      m.Message.find(filter).sort({ createdAt: 1 }),
      m.Item.find(filter).sort({ createdAt: 1 }),
      m.Thought.findOne({ thoughtId }),
    ]);

    if (messages.length === 0 && items.length === 0) {
      return res.status(404).json({ error: `Thought '${thoughtId}' not found` });
    }

    const timeline: Array<{ ts: string; type: string; [key: string]: unknown }> = [];

    for (const msg of messages) {
      const doc = msg.toObject() as Record<string, unknown> & {
        createdAt?: Date;
        metadata?: Record<string, unknown>;
      };
      const meta = doc.metadata as Record<string, unknown> | null;
      const isPlanning = meta && meta.type === "planning";

      if (isPlanning) {
        timeline.push({
          ts: doc.createdAt?.toISOString() ?? "",
          type: "planning",
          content: doc.content as string,
          ...(doc.sessionId ? { session: doc.sessionId } : {}),
          ...(doc.agentId ? { agent: doc.agentId } : {}),
        });
      } else {
        timeline.push({
          ts: doc.createdAt?.toISOString() ?? "",
          type: "message",
          role: doc.role as string,
          content: doc.content as string,
          ...(doc.sessionId ? { session: doc.sessionId } : {}),
          ...(doc.agentId ? { agent: doc.agentId } : {}),
        });
      }
    }

    for (const item of items) {
      const doc = item.toObject() as Record<string, unknown> & { createdAt?: Date };
      timeline.push({
        ts: doc.createdAt?.toISOString() ?? "",
        type: "action",
        action: doc.name as string,
        description: doc.description as string,
        ...(doc.data ? { data: doc.data } : {}),
        ...(doc.sessionId ? { session: doc.sessionId } : {}),
      });
    }

    timeline.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const sessions = [...new Set(timeline.filter((e) => e.session).map((e) => e.session as string))];

    const counts = {
      messages: timeline.filter((e) => e.type === "message").length,
      planning: timeline.filter((e) => e.type === "planning").length,
      actions: timeline.filter((e) => e.type === "action").length,
    };

    const lastActivity = timeline.length > 0 ? timeline[timeline.length - 1].ts : null;

    res.json({
      thoughtId,
      description: thought ? (thought as unknown as { description: string }).description : null,
      sessions,
      counts,
      totalEvents: timeline.length,
      lastActivity,
      timeline,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/:thoughtId/sync", async (req, res) => {
  const { thoughtId } = req.params;

  if (!canAccess(req, thoughtId)) {
    return res.status(403).json({ error: "Access denied to this thought" });
  }

  const {
    messages = [],
    planning = [],
    actions = [],
    logs = [],
    sessionId,
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

  const m = await getModels(req);

  if (messages.length > 0) {
    try {
      const docs = messages.map((msg: Record<string, unknown>) => ({
        ...msg,
        projectId: thoughtId,
        sessionId: msg.sessionId ?? sessionId ?? null,
      }));
      const created = await m.Message.insertMany(docs, { ordered: false });
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
          projectId: thoughtId,
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
      const created = await m.Message.insertMany(docs, { ordered: false });
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
        data: typeof a.data === "object" ? (a.data as object) : { raw: a },
        status: "active" as const,
        projectId: thoughtId,
        sessionId: a.sessionId ?? sessionId ?? null,
      }));
      const created = await m.Item.insertMany(docs, { ordered: false });
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
        projectId: thoughtId,
        sessionId: l.sessionId ?? sessionId ?? null,
      }));
      const created = await m.Log.insertMany(docs, { ordered: false });
      results.logs = { saved: created.length };
    } catch (err: unknown) {
      errors.push(`logs: ${err instanceof Error ? err.message : "insert failed"}`);
      results.logs = { saved: 0 };
    }
  }

  const status = errors.length === 0 ? 201 : 207;
  res.status(status).json({
    ok: errors.length === 0,
    thoughtId,
    results,
    ...(errors.length > 0 ? { errors } : {}),
  });
});

router.delete("/:thoughtId", async (req, res) => {
  if (!requireBrain(req)) {
    return res.status(403).json({ error: "Brain token required to delete thoughts" });
  }

  try {
    const { thoughtId } = req.params;
    const m = await getModels(req);
    const filter = { projectId: thoughtId };

    const [msgResult, itemResult, logResult] = await Promise.all([
      m.Message.deleteMany(filter),
      m.Item.deleteMany(filter),
      m.Log.deleteMany(filter),
      m.Thought.deleteOne({ thoughtId }),
    ]);

    const totalDeleted =
      (msgResult.deletedCount ?? 0) +
      (itemResult.deletedCount ?? 0) +
      (logResult.deletedCount ?? 0);

    if (totalDeleted === 0) {
      return res.status(404).json({ error: `Thought '${thoughtId}' not found` });
    }

    res.json({
      message: `Thought '${thoughtId}' deleted`,
      deleted: {
        messages: msgResult.deletedCount,
        items: itemResult.deletedCount,
        logs: logResult.deletedCount,
      },
      totalDeleted,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/:thoughtId/regenerate-key", async (req, res) => {
  if (!requireBrain(req)) {
    return res.status(403).json({ error: "Brain token required to regenerate keys" });
  }

  try {
    const { thoughtId } = req.params;
    const m = await getModels(req);
    const newKey = `tk_${crypto.randomBytes(32).toString("hex")}`;
    const thought = await m.Thought.findOneAndUpdate(
      { thoughtId },
      { key: newKey },
      { new: true }
    );

    if (!thought) {
      return res.status(404).json({ error: `Thought '${thoughtId}' not found` });
    }

    res.json({ thoughtId, key: newKey, message: "Key regenerated" });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
