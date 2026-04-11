import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { requestLogger } from "./middleware/requestLogger";
import { brainAuth } from "./middleware/auth";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(brainAuth);

app.get("/", (_req, res) => {
  res.json({
    name: "Agent Brain API",
    version: "2.0",
    description: "A self-hosted memory API for AI agents. Store messages, planning steps, actions, and logs in MongoDB Atlas.",
    docs: "/api/docs",
    health: "/api/healthz",
    github: "https://github.com/luxidevil/ai-brain",
    endpoints: {
      brain: "GET /api/brain — list thoughts (requires brain token)",
      context: "GET /api/brain/:thoughtId/context — read timeline (requires thought key)",
      sync: "POST /api/brain/:thoughtId/sync — push session data (requires thought key)",
    },
    auth: {
      brain_token: "bt_... — master access to all thoughts",
      thought_key: "tk_... — scoped access to one thought",
      header: "Authorization: Bearer <token>",
    },
  });
});

app.use("/api", router);

export default app;
