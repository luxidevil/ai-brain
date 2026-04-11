import { type Request, type Response, type NextFunction } from "express";
import { Thought } from "../models/thought";
import { User } from "../models/user";

const PUBLIC_PATHS = [
  "/",
  "/api/healthz",
  "/api/docs",
  "/api/docs.json",
  "/api/auth/register",
  "/api/auth/login",
];

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  const headerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.headers["x-brain-token"] as string | undefined;
  const queryToken = req.query.token as string | undefined;
  return headerToken ?? queryToken;
}

export function brainAuth(req: Request, res: Response, next: NextFunction) {
  const isPublic = PUBLIC_PATHS.some(
    (p) => req.path === p || req.path.startsWith("/api/docs") || req.path.startsWith("/api/auth/")
  );
  if (isPublic) return next();

  const provided = extractToken(req);

  if (!provided) {
    return res.status(401).json({
      error: "Unauthorized",
      hint: "Provide a Brain Token (master) or Thought Key via: Authorization: Bearer <token>",
    });
  }

  const envBrainToken = process.env.BRAIN_TOKEN;
  if (envBrainToken && provided === envBrainToken) {
    (req as Record<string, unknown>).authLevel = "brain";
    return next();
  }

  if (provided.startsWith("bt_")) {
    User.findOne({ brainToken: provided })
      .then((user) => {
        if (!user) {
          return res.status(403).json({ error: "Invalid Brain Token" });
        }
        (req as Record<string, unknown>).authLevel = "brain";
        (req as Record<string, unknown>).authUserId = (user as unknown as { _id: string })._id;
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "Auth lookup failed" });
      });
    return;
  }

  if (provided.startsWith("tk_")) {
    Thought.findOne({ key: provided })
      .then((thought) => {
        if (!thought) {
          return res.status(403).json({ error: "Invalid Thought Key" });
        }
        (req as Record<string, unknown>).authLevel = "thought";
        (req as Record<string, unknown>).authThoughtId = (thought as unknown as { thoughtId: string }).thoughtId;
        next();
      })
      .catch(() => {
        res.status(500).json({ error: "Auth lookup failed" });
      });
    return;
  }

  return res.status(403).json({ error: "Invalid token" });
}
