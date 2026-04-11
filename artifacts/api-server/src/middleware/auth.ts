import { type Request, type Response, type NextFunction } from "express";
import { User } from "../models/user";
import { Thought } from "../models/thought";

function setReqField(req: Request, key: string, value: unknown): void {
  (req as unknown as Record<string, unknown>)[key] = value;
}

export async function brainAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const PUBLIC_PATHS = [
    "/api/healthz",
    "/api/docs",
    "/api/docs.json",
    "/api/auth/register",
    "/api/auth/login",
    "/",
  ];

  if (
    PUBLIC_PATHS.includes(req.path) ||
    req.path.startsWith("/api/docs")
  ) {
    return next();
  }

  const header = req.headers.authorization ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!provided) {
    res.status(401).json({
      error: "Unauthorized",
      hint: "Provide a Brain Token (master) or Thought Key via: Authorization: Bearer <token>",
    });
    return;
  }

  const envBrainToken = process.env.BRAIN_TOKEN;
  if (envBrainToken && provided === envBrainToken) {
    setReqField(req, "authLevel", "brain");
    return next();
  }

  if (provided.startsWith("bt_")) {
    try {
      const user = await User.findOne({ brainToken: provided });
      if (!user) {
        res.status(403).json({ error: "Invalid Brain Token" });
        return;
      }
      const doc = user.toObject() as unknown as { _id: unknown; mongoUri?: string | null };
      setReqField(req, "authLevel", "brain");
      setReqField(req, "authUserId", String(doc._id));
      setReqField(req, "userMongoUri", doc.mongoUri ?? null);
      return next();
    } catch {
      res.status(500).json({ error: "Auth lookup failed" });
      return;
    }
  }

  if (provided.startsWith("tk_")) {
    try {
      const thought = await Thought.findOne({ key: provided });
      if (!thought) {
        res.status(403).json({ error: "Invalid Thought Key" });
        return;
      }
      const doc = thought.toObject() as unknown as { thoughtId: string };
      setReqField(req, "authLevel", "thought");
      setReqField(req, "authThoughtId", doc.thoughtId);
      return next();
    } catch {
      res.status(500).json({ error: "Auth lookup failed" });
      return;
    }
  }

  res.status(403).json({ error: "Invalid token" });
}
