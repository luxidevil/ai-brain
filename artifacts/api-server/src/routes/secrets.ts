import { Router, type Request, type Response } from "express";
import { Secret } from "../models/secret";
import { getUserConnection } from "../lib/connectionPool";
import type mongoose from "mongoose";

const router = Router();

type AnyModel = mongoose.Model<mongoose.Document & Record<string, unknown>>;

function getAuth(req: Request) {
  const r = req as unknown as Record<string, unknown>;
  return {
    level: r.authLevel as string,
    thoughtId: r.authThoughtId as string | undefined,
    mongoUri: r.userMongoUri as string | null | undefined,
  };
}

async function getSecretModel(req: Request): Promise<AnyModel> {
  const { mongoUri } = getAuth(req);
  if (mongoUri) {
    const models = await getUserConnection(mongoUri);
    return models.Secret as unknown as AnyModel;
  }
  return Secret as unknown as AnyModel;
}

router.get("/brain", async (req: Request, res: Response): Promise<void> => {
  if (getAuth(req).level !== "brain") {
    res.status(403).json({ error: "Brain token required to view brain secrets" });
    return;
  }

  try {
    const S = await getSecretModel(req);
    const secrets = await (S.find({ scope: "brain" }) as ReturnType<typeof S.find>).sort({ key: 1 });
    const result = secrets.map((s) => {
      const doc = (s as mongoose.Document).toObject() as { key: string; value: string; createdAt: Date; updatedAt: Date };
      return { key: doc.key, value: doc.value, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
    });
    res.json({ scope: "brain", secrets: result, count: result.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.put("/brain/:key", async (req: Request, res: Response): Promise<void> => {
  if (getAuth(req).level !== "brain") {
    res.status(403).json({ error: "Brain token required to manage brain secrets" });
    return;
  }

  const { key } = req.params;
  const { value } = req.body ?? {};

  if (value === undefined || value === null) {
    res.status(400).json({ error: "value is required" });
    return;
  }

  try {
    const S = await getSecretModel(req);
    await S.findOneAndUpdate(
      { scope: "brain", thoughtId: null, key } as Record<string, unknown>,
      { scope: "brain", thoughtId: null, key, value: String(value) } as Record<string, unknown>,
      { upsert: true, new: true }
    );
    res.json({ message: `Secret '${key}' saved`, key, scope: "brain" });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/brain/:key", async (req: Request, res: Response): Promise<void> => {
  if (getAuth(req).level !== "brain") {
    res.status(403).json({ error: "Brain token required to manage brain secrets" });
    return;
  }

  try {
    const S = await getSecretModel(req);
    const result = await S.deleteOne({ scope: "brain", thoughtId: null, key: req.params.key } as Record<string, unknown>);
    if ((result as { deletedCount?: number }).deletedCount === 0) {
      res.status(404).json({ error: `Secret '${req.params.key}' not found` });
      return;
    }
    res.json({ message: `Secret '${req.params.key}' deleted` });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/thought/:thoughtId", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const { thoughtId } = req.params;

  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    res.status(403).json({ error: "Access denied to this thought's secrets" });
    return;
  }

  try {
    const S = await getSecretModel(req);

    const [thoughtSecrets, brainSecrets] = await Promise.all([
      (S.find({ scope: "thought", thoughtId } as Record<string, unknown>) as ReturnType<typeof S.find>).sort({ key: 1 }),
      auth.level === "brain"
        ? (S.find({ scope: "brain" } as Record<string, unknown>) as ReturnType<typeof S.find>).sort({ key: 1 })
        : Promise.resolve([]),
    ]);

    const merged: Record<string, { value: string; scope: string; source: string }> = {};

    for (const s of brainSecrets) {
      const doc = (s as mongoose.Document).toObject() as { key: string; value: string };
      merged[doc.key] = { value: doc.value, scope: "brain", source: "brain (global)" };
    }

    for (const s of thoughtSecrets) {
      const doc = (s as mongoose.Document).toObject() as { key: string; value: string };
      merged[doc.key] = { value: doc.value, scope: "thought", source: `thought:${thoughtId}` };
    }

    res.json({ thoughtId, secrets: merged, count: Object.keys(merged).length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.put("/thought/:thoughtId/:key", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const { thoughtId, key } = req.params;

  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    res.status(403).json({ error: "Access denied to this thought's secrets" });
    return;
  }

  const { value } = req.body ?? {};
  if (value === undefined || value === null) {
    res.status(400).json({ error: "value is required" });
    return;
  }

  try {
    const S = await getSecretModel(req);
    await S.findOneAndUpdate(
      { scope: "thought", thoughtId, key } as Record<string, unknown>,
      { scope: "thought", thoughtId, key, value: String(value) } as Record<string, unknown>,
      { upsert: true, new: true }
    );
    res.json({ message: `Secret '${key}' saved for thought '${thoughtId}'`, key, thoughtId });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/thought/:thoughtId/:key", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const { thoughtId, key } = req.params;

  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    res.status(403).json({ error: "Access denied to this thought's secrets" });
    return;
  }

  try {
    const S = await getSecretModel(req);
    const result = await S.deleteOne({ scope: "thought", thoughtId, key } as Record<string, unknown>);
    if ((result as { deletedCount?: number }).deletedCount === 0) {
      res.status(404).json({ error: `Secret '${key}' not found` });
      return;
    }
    res.json({ message: `Secret '${key}' deleted from thought '${thoughtId}'` });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
