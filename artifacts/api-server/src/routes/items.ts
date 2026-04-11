import { Router, type Request, type Response } from "express";
import { Item } from "../models/item";

const router = Router();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.skip) || 0;
    const filter: Record<string, unknown> = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.projectId) filter.projectId = req.query.projectId;
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;
    if (req.query.tag) filter.tags = req.query.tag;

    const [data, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Item.countDocuments(filter),
    ]);

    res.json({ data, total, limit, skip });
  } catch {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    res.json(item);
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Validation failed";
    res.status(400).json({ error });
  }
});

router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    res.json(item);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Update failed";
    res.status(400).json({ error });
  }
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }
    res.json({ message: "Item deleted", id: req.params.id });
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});

export default router;
