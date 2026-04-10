import { Router, type IRouter } from "express";
import mongoose from "mongoose";

const router: IRouter = Router();

/**
 * @openapi
 * /healthz:
 *   get:
 *     tags: [health]
 *     summary: Health check
 *     description: Returns the server status, MongoDB connection state, and process uptime.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 *             example:
 *               status: ok
 *               mongodb: connected
 *               uptime: 3600
 */
router.get("/healthz", (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus =
    mongoState === 1
      ? "connected"
      : mongoState === 2
        ? "connecting"
        : "disconnected";

  res.json({
    status: "ok",
    mongodb: mongoStatus,
    uptime: Math.floor(process.uptime()),
  });
});

export default router;
