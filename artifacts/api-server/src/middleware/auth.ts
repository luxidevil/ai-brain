import { type Request, type Response, type NextFunction } from "express";

const PUBLIC_PATHS = [
  "/api/healthz",
  "/api/docs",
  "/api/docs.json",
];

export function brainAuth(req: Request, res: Response, next: NextFunction) {
  const brainToken = process.env.BRAIN_TOKEN;

  if (!brainToken) {
    return next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => req.path === p || req.path.startsWith("/api/docs")
  );
  if (isPublic) return next();

  const authHeader = req.headers["authorization"];
  const headerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.headers["x-brain-token"] as string | undefined;

  const queryToken = req.query.token as string | undefined;
  const provided = headerToken ?? queryToken;

  if (!provided) {
    return res.status(401).json({
      error: "Unauthorized",
      hint: 'Provide your Brain Token via: Authorization: Bearer <token>  or  X-Brain-Token: <token>',
    });
  }

  if (provided !== brainToken) {
    return res.status(403).json({ error: "Invalid Brain Token" });
  }

  next();
}
