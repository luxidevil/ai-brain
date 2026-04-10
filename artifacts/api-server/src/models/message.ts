import { mongoose } from "../lib/mongodb";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system", "agent"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    projectId: {
      type: String,
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      index: true,
    },
    agentId: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ projectId: 1, sessionId: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
