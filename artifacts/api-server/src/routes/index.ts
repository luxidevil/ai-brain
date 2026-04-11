import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import brainRouter from "./brain";
import secretsRouter from "./secrets";
import itemsRouter from "./items";
import logsRouter from "./logs";
import messagesRouter from "./messages";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/brain", brainRouter);
router.use("/secrets", secretsRouter);
router.use("/items", itemsRouter);
router.use("/logs", logsRouter);
router.use("/messages", messagesRouter);
router.use("/sync", syncRouter);

export default router;
