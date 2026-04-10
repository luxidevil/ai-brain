import { mongoose } from "../lib/mongodb";

const logSchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, default: null },
    requestBody: { type: mongoose.Schema.Types.Mixed, default: null },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    projectId: { type: String, default: null, index: true },
    sessionId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export const Log = mongoose.model("Log", logSchema);
