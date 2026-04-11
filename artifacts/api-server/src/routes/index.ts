import { Router, type IRouter } from "express";
import swaggerUi from "swagger-ui-express";
import healthRouter from "./health";
import authRouter from "./auth";
import brainRouter from "./brain";
import secretsRouter from "./secrets";
import itemsRouter from "./items";
import logsRouter from "./logs";
import messagesRouter from "./messages";
import syncRouter from "./sync";
import { swaggerSpec } from "../lib/swagger";

const router: IRouter = Router();

router.use("/docs", swaggerUi.serve);
router.get("/docs", swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Agent Brain API Docs",
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper .link { display: none; }
  `,
}));

router.get("/docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/brain", brainRouter);
router.use("/secrets", secretsRouter);
router.use("/items", itemsRouter);
router.use("/logs", logsRouter);
router.use("/messages", messagesRouter);
router.use("/sync", syncRouter);

export default router;
