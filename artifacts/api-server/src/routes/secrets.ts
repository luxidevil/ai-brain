import { Router, type Request } from "express";
import { Secret } from "../models/secret";
import { getUserConnection } from "../lib/connectionPool";

const router = Router();

function getAuth(req: Request) {
  return {
    level: (req as Record<string, unknown>).authLevel as string,
    thoughtId: (req as Record<string, unknown>).authThoughtId as string | undefined,
    mongoUri: (req as Record<string, unknown>).userMongoUri as string | null | undefined,
  };
}

async function getSecretModel(req: Request) {
  const { mongoUri } = getAuth(req);
  if (mongoUri) {
    const models = await getUserConnection(mongoUri);
    return models.Secret;
  }
  return Secret;
}

router.get("/brain", async (req, res) => {
  if (getAuth(req).level !== "brain") {
    return res.status(403).json({ error: "Brain token required to view brain secrets" });
  }

  try {
    const S = await getSecretModel(req);
    const secrets = await S.find({ scope: "brain" }).sort({ key: 1 });
    const result = secrets.map((s) => {
      const doc = s.toObject() as { key: string; value: string; createdAt: Date; updatedAt: Date };
      return { key: doc.key, value: doc.value, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
    });
    res.json({ scope: "brain", secrets: result, count: result.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.put("/brain/:key", async (req, res) => {
  if (getAuth(req).level !== "brain") {
    return res.status(403).json({ error: "Brain token required to manage brain secrets" });
  }

  const { key } = req.params;
  const { value } = req.body ?? {};

  if (value === undefined || value === null) {
    return res.status(400).json({ error: "value is required" });
  }

  try {
    const S = await getSecretModel(req);
    const secret = await S.findOneAndUpdate(
      { scope: "brain", thoughtId: null, key },
      { scope: "brain", thoughtId: null, key, value: String(value) },
      { upsert: true, new: true }
    );
    const doc = secret.toObject() as { key: string; updatedAt: Date };
    res.json({ message: `Secret '${key}' saved`, key: doc.key, scope: "brain", updatedAt: doc.updatedAt });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/brain/:key", async (req, res) => {
  if (getAuth(req).level !== "brain") {
    return res.status(403).json({ error: "Brain token required to manage brain secrets" });
  }

  try {
    const S = await getSecretModel(req);
    const result = await S.deleteOne({ scope: "brain", thoughtId: null, key: req.params.key });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: `Secret '${req.params.key}' not found` });
    }
    res.json({ message: `Secret '${req.params.key}' deleted` });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.get("/thought/:thoughtId", async (req, res) => {
  const auth = getAuth(req);
  const { thoughtId } = req.params;

  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    return res.status(403).json({ error: "Access denied to this thought's secrets" });
  }

  try {
    const S = await getSecretModel(req);

    const [thoughtSecrets, brainSecrets] = await Promise.all([
      S.find({ scope: "thought", thoughtId }).sort({ key: 1 }),
      auth.level === "brain" ? S.find({ scope: "brain" }).sort({ key: 1 }) : Promise.resolve([]),
    ]);

    const merged: Record<string, { value: string; scope: string; source: string }> = {};

    for (const s of brainSecrets) {
      const doc = s.toObject() as { key: string; value: string };
      merged[doc.key] = { value: doc.value, scope: "brain", source: "brain (global)" };
    }

    for (const s of thoughtSecrets) {
      const doc = s.toObject() as { key: string; value: string };
      merged[doc.key] = { value: doc.value, scope: "thought", source: `thought (${thoughtId})` };
    }

    const result = Object.entries(merged).map(([key, v]) => ({
      key,
      value: v.value,
      scope: v.scope,
      source: v.source,
    }));

    result.sort((a, b) => a.key.localeCompare(b.key));

    res.json({
      thoughtId,
      secrets: result,
      count: result.length,
      brainSecrets: brainSecrets.length,
      thoughtSecrets: thoughtSecrets.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.put("/thought/:thoughtId/:key", async (req, res) => {
  const auth = getAuth(req);
  const { thoughtId, key } = req.params;
  const { value } = req.body ?? {};

  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    return res.status(403).json({ error: "Access denied to this thought's secrets" });
  }

  if (value === undefined || value === null) {
    return res.status(400).json({ error: "value is required" });
  }

  try {
    const S = await getSecretModel(req);
    const secret = await S.findOneAndUpdate(
      { scope: "thought", thoughtId, key },
      { scope: "thought", thoughtId, key, value: String(value) },
      { upsert: true, new: true }
    );
    const doc = secret.toObject() as { key: string; updatedAt: Date };
    res.json({ message: `Secret '${key}' saved for thought '${thoughtId}'`, key: doc.key, scope: "thought", thoughtId, updatedAt: doc.updatedAt });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.delete("/thought/:thoughtId/:key", async (req, res) => {
  const auth = getAuth(req);
  const { thoughtId, key } = req.params;

  if (auth.level !== "brain" && auth.thoughtId !== thoughtId) {
    return res.status(403).json({ error: "Access denied to this thought's secrets" });
  }

  try {
    const S = await getSecretModel(req);
    const result = await S.deleteOne({ scope: "thought", thoughtId, key });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: `Secret '${key}' not found in thought '${thoughtId}'` });
    }
    res.json({ message: `Secret '${key}' deleted from thought '${thoughtId}'` });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
