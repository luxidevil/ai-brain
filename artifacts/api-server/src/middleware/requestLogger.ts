import { type Request, type Response, type NextFunction } from "express";
import { Log } from "../models/log";

const SKIP_PATHS = new Set(["/api/healthz", "/api/docs", "/api/docs.json", "/api/logs"]);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  if (SKIP_PATHS.has(req.path) || req.path.startsWith("/api/docs")) {
    return next();
  }

  const originalJson = res.json.bind(res);
  let responseBody: unknown = null;

  res.json = function (body: unknown) {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    const durationMs = Date.now() - start;

    Log.create({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      requestBody: Object.keys(req.body ?? {}).length > 0 ? req.body : null,
      responseBody,
      ip: req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    }).catch(() => {});
  });

  next();
}
