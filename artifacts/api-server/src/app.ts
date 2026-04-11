import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { requestLogger } from "./middleware/requestLogger";
import { brainAuth } from "./middleware/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// In production, serve React dashboard static files BEFORE auth middleware
// so browsers can load CSS/JS without needing a Bearer token
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "public");
  app.use(express.static(publicDir));
}

// Auth middleware only applies to routes registered after this point
app.use(brainAuth);
app.use("/api", router);

// SPA fallback: serve index.html for all non-API routes in production
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "public");
  app.get("/*path", (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
