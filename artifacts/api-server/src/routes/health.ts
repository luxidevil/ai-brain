import { Router, type IRouter } from "express";
import mongoose from "mongoose";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus =
    mongoState === 1 ? "connected" :
    mongoState === 2 ? "connecting" :
    "disconnected";

  res.json({
    status: "ok",
    mongodb: mongoStatus,
    uptime: Math.floor(process.uptime()),
  });
});

export default router;
