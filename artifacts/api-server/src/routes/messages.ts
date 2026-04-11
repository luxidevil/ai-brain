import { Router, type Request, type Response } from "express";
import { Message } from "../models/message";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  const req = _req;
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Number(req.query.skip) || 0;
    const filter: Record<string, unknown> = {};

    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.agentId) filter.agentId = req.query.agentId;

    const [data, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
      Message.countDocuments(filter),
    ]);

    res.json({ data, total, limit, skip });
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) { res.status(404).json({ error: "Message not found" }); return; }
    res.json(message);
  } catch {
    res.status(404).json({ error: "Message not found" });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const message = await Message.create(req.body);
    res.status(201).json(message);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Validation failed";
    res.status(400).json({ error });
  }
});

router.post("/batch", async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Body must be a non-empty array of messages" });
      return;
    }
    if (messages.length > 100) {
      res.status(400).json({ error: "Maximum 100 messages per batch" });
      return;
    }
    const created = await Message.insertMany(messages);
    res.status(201).json({ created: created.length, data: created });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Batch insert failed";
    res.status(400).json({ error });
  }
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) { res.status(404).json({ error: "Message not found" }); return; }
    res.json({ message: "Message deleted", id: req.params.id });
  } catch {
    res.status(404).json({ error: "Message not found" });
  }
});

router.delete("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;

    const result = await Message.deleteMany(filter);
    const scope = req.query.projectId
      ? `project ${String(req.query.projectId)}${req.query.sessionId ? ` / session ${String(req.query.sessionId)}` : ""}`
      : "all projects";
    res.json({ message: `Messages cleared for ${scope}`, deleted: result.deletedCount });
  } catch {
    res.status(500).json({ error: "Failed to clear messages" });
  }
});

export default router;
