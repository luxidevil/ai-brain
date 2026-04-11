import mongoose from "mongoose";
import { logger } from "./logger";

const messageSchemaDefinition = {
  role: { type: String, enum: ["user", "assistant", "system", "agent"], default: "user" },
  content: { type: String, default: "" },
  sessionId: { type: String, default: null, index: true },
  projectId: { type: String, default: null, index: true },
  agentId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
};

const itemSchemaDefinition = {
  name: { type: String, required: true },
  description: { type: String, default: "" },
  tags: { type: [String], default: [] },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
  projectId: { type: String, default: null, index: true },
  sessionId: { type: String, default: null, index: true },
};

const logSchemaDefinition = {
  method: String,
  path: String,
  statusCode: Number,
  durationMs: Number,
  requestBody: mongoose.Schema.Types.Mixed,
  responseBody: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  projectId: { type: String, default: null, index: true },
  sessionId: { type: String, default: null, index: true },
};

const thoughtSchemaDefinition = {
  thoughtId: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "" },
  key: { type: String, required: true, unique: true, index: true },
};

const secretSchemaDefinition = {
  key: { type: String, required: true, trim: true },
  value: { type: String, required: true },
  scope: { type: String, enum: ["brain", "thought"], required: true },
  thoughtId: { type: String, default: null, index: true },
};

export interface UserModels {
  Message: mongoose.Model<unknown>;
  Item: mongoose.Model<unknown>;
  Log: mongoose.Model<unknown>;
  Thought: mongoose.Model<unknown>;
  Secret: mongoose.Model<unknown>;
}

interface PoolEntry {
  conn: mongoose.Connection;
  models: UserModels;
  lastUsed: number;
}

const pool = new Map<string, PoolEntry>();
const POOL_TTL_MS = 30 * 60 * 1000;

function createModels(conn: mongoose.Connection): UserModels {
  const msgSchema = new mongoose.Schema(messageSchemaDefinition, { timestamps: true });
  const itemSchema = new mongoose.Schema(itemSchemaDefinition, { timestamps: true });
  const logSchema = new mongoose.Schema(logSchemaDefinition, { timestamps: true });
  const thoughtSchema = new mongoose.Schema(thoughtSchemaDefinition, { timestamps: true });
  const secretSchema = new mongoose.Schema(secretSchemaDefinition, { timestamps: true });
  secretSchema.index({ scope: 1, thoughtId: 1, key: 1 }, { unique: true });

  return {
    Message: conn.model("Message", msgSchema),
    Item: conn.model("Item", itemSchema),
    Log: conn.model("Log", logSchema),
    Thought: conn.model("Thought", thoughtSchema),
    Secret: conn.model("Secret", secretSchema),
  };
}

export async function getUserConnection(mongoUri: string): Promise<UserModels> {
  const now = Date.now();
  const existing = pool.get(mongoUri);
  if (existing) {
    existing.lastUsed = now;
    return existing.models;
  }

  const conn = await mongoose.createConnection(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  }).asPromise();

  const models = createModels(conn);
  pool.set(mongoUri, { conn, models, lastUsed: now });

  setInterval(() => {
    const cutoff = Date.now() - POOL_TTL_MS;
    for (const [uri, entry] of pool.entries()) {
      if (entry.lastUsed < cutoff) {
        entry.conn.close().catch(() => {});
        pool.delete(uri);
        logger.info({ uri: uri.slice(0, 30) }, "Closed idle user connection");
      }
    }
  }, POOL_TTL_MS).unref();

  return models;
}

export async function testMongoConnection(mongoUri: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const conn = await mongoose.createConnection(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 10000,
    }).asPromise();
    await conn.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}
