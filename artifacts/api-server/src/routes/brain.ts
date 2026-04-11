import { Router, type Request, type Response } from "express";
import { Message } from "../models/message";
import { Item } from "../models/item";
import { Log } from "../models/log";
import { Thought } from "../models/thought";
import { Secret } from "../models/secret";
import { getUserConnection } from "../lib/connectionPool";
import crypto from "crypto";
import type mongoose from "mongoose";

const router = Router();

function getAuth(req: Request) {
  const r = req as unknown as Record<string, unknown>;
  return {
    level: r.authLevel as string,
    thoughtId: r.authThoughtId as string | undefined,
    mongoUri: r.userMongoUri as string | null | undefined,
  };
}

function requireBrain(req: Request) {
  return getAuth(req).level === "brain";
}

type AnyModel = mongoose.Model<mongoose.Document & Record<string, unknown>>;

interface Models {
  Message: AnyModel;
  Item: AnyModel;
  Log: AnyModel;
  Thought: AnyModel;
  Secret: AnyModel;
}

async function getModels(req: Request): Promise<Models> {
  const { mongoUri } = getAuth(req);
  if (mongoUri) {
    const m = await getUserConnection(mongoUri);
    return m as unknown as Models;
  }
  return { Message, Item, Log, Thought, Secret } as unknown as Models;
}

router.get("/", async (req: Request, res: Response): Promise<void> => {
  if (!requireBrain(req)) {
    res.status(403).json({ error: "Brain token required to list all thoughts" });
    return;
  }

  try {
    const m = await getModels(req);
    const thoughts = await m.Thought.find({}).sort({ createdAt: -1 });

    const result = [];
    for (const t of thoughts) {
      const doc = (t as mongoose.Document).toObject() as unknown as { thoughtId: string; description: string; createdAt: Date; key: string };
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

    const thoughtIds = thoughts.map((t) => ((t as mongoose.Document).toObject() as unknown as { thoughtId: string }).thoughtId);

    const [orphanMsgProjects, orphanItemProjects] = await Promise.all([
      m.Message.distinct("projectId", { projectId: { $ne: null, $nin: thoughtIds } }),
      m.Item.distinct("projectId", { projectId: { $ne: null, $nin: thoughtIds } }),
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
        thoughtId: id as string,
        description: "(legacy - no key assigned)",
        key: null,
        counts: { messages, items, logs },
        total: messages + items + logs,
        createdAt: null,
      });
    }

    res.json({ brain: "ai-brain", thoughts: result, totalThoughts: result.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list thoughts" });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  if (!requireBrain(req)) {
    res.status(403).json({ error: "Brain token required to create thoughts" });
    return;
  }

  const { thoughtId, description } = req.body ?? {};

  if (!thoughtId || typeof thoughtId !== "string") {
    res.status(400).json({ error: "thoughtId is required (string)" });
    return;
  }

  try {
    const m = await getModels(req);
    const exists = await m.Thought.findOne({ thoughtId });
    if (exists) {
      res.status(409).json({ error: `Thought '${thoughtId}' already exists` });
      return;
    }

    const key = `tk_${crypto.randomBytes(32).toString("hex")}`;
    const thought = await m.Thought.create({ thoughtId, description: description || "", key });
    const doc = (thought as mongoose.Document).toObject() as unknown as { thoughtId: string; description: string; key: string; createdAt: Date };

    res.status(201).json({
      message: `Thought '${thoughtId}' created`,
      thoughtId: doc.thoughtId,
      description: doc.description,
      key: doc.key,
      createdAt: doc.createdAt,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/:thoughtId", async (req: Request, res: Response): Promise<void> => {
  const { thoughtId } = req.params;

  const auth = getAuth(req);
  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    res.status(403).json({ error: "Access denied to this thought" });
    return;
  }

  try {
    const m = await getModels(req);
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const [thought, messages, items, logs] = await Promise.all([
      m.Thought.findOne({ thoughtId }),
      m.Message.find({ projectId: thoughtId }).sort({ createdAt: 1 }).limit(limit),
      m.Item.find({ projectId: thoughtId }).sort({ createdAt: -1 }).limit(limit),
      m.Log.find({ projectId: thoughtId }).sort({ createdAt: -1 }).limit(50),
    ]);

    if (!thought) {
      res.status(404).json({ error: `Thought '${thoughtId}' not found` });
      return;
    }

    res.json({ thoughtId, thought, messages, items, logs });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/:thoughtId", async (req: Request, res: Response): Promise<void> => {
  if (!requireBrain(req)) {
    res.status(403).json({ error: "Brain token required to delete thoughts" });
    return;
  }

  try {
    const { thoughtId } = req.params;
    const m = await getModels(req);
    const filter = { projectId: thoughtId };

    const [msgResult, itemResult, logResult] = await Promise.all([
      m.Message.deleteMany(filter),
      m.Item.deleteMany(filter),
      m.Log.deleteMany(filter),
    ]);

    await m.Thought.deleteOne({ thoughtId });

    const totalDeleted =
      ((msgResult as { deletedCount?: number }).deletedCount ?? 0) +
      ((itemResult as { deletedCount?: number }).deletedCount ?? 0) +
      ((logResult as { deletedCount?: number }).deletedCount ?? 0);

    res.json({
      message: `Thought '${thoughtId}' deleted`,
      deleted: {
        messages: (msgResult as { deletedCount?: number }).deletedCount,
        items: (itemResult as { deletedCount?: number }).deletedCount,
        logs: (logResult as { deletedCount?: number }).deletedCount,
      },
      totalDeleted,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/:thoughtId/regenerate-key", async (req: Request, res: Response): Promise<void> => {
  if (!requireBrain(req)) {
    res.status(403).json({ error: "Brain token required to regenerate keys" });
    return;
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
      res.status(404).json({ error: `Thought '${thoughtId}' not found` });
      return;
    }

    res.json({ thoughtId, key: newKey, message: "Key regenerated" });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
