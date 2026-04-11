import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "fs";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(brainAuth);

app.get("/", (_req, res) => {
  const htmlPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(htmlPath)) {
    res.type("html").sendFile(htmlPath);
  } else {
    const altPath = path.join(__dirname, "..", "src", "public", "index.html");
    if (fs.existsSync(altPath)) {
      res.type("html").sendFile(altPath);
    } else {
      res.json({
        name: "Agent Brain API",
        version: "2.0",
        docs: "/api/docs",
        health: "/api/healthz",
      });
    }
  }
});

app.use("/api", router);

export default app;
