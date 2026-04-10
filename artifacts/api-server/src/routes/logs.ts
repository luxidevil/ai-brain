import { Router } from "express";
import { Log } from "../models/log";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filter: Record<string, unknown> = {};
    if (req.query.method) filter.method = String(req.query.method).toUpperCase();
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;

    const [data, total] = await Promise.all([
      Log.find(filter).sort({ createdAt: -1 }).limit(limit),
      Log.countDocuments(filter),
    ]);

    res.json({ data, total });
  } catch {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

router.post("/", async (req, res) => {
  try {
    const log = await Log.create(req.body);
    res.status(201).json(log);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create log";
    res.status(400).json({ error: message });
  }
});

router.delete("/", async (req, res) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.projectId) filter.projectId = req.query.projectId;

    const result = await Log.deleteMany(filter);
    const scope = req.query.projectId ? `project ${req.query.projectId}` : "all";
    res.json({ message: `Logs cleared for ${scope}`, deleted: result.deletedCount });
  } catch {
    res.status(500).json({ error: "Failed to clear logs" });
  }
});

export default router;
