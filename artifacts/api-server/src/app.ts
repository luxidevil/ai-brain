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

// In production, serve the React dashboard WITHOUT requiring auth so that:
//   1. Known static files (CSS, JS, images) are served by express.static()
//   2. All non-API routes (SPA deep links) serve index.html
// Both MUST be registered before brainAuth so browsers can load assets freely.
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "public");

  // Serve known static files (assets, favicon, etc.)
  app.use(express.static(publicDir));

  // SPA fallback: any path that does NOT start with /api gets index.html
  // This lets React Router handle client-side routing
  app.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// Auth + API routes — everything below here requires a valid token
app.use(brainAuth);
app.use("/api", router);

export default app;
