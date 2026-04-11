import { mongoose } from "../lib/mongodb";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
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
  },
  { timestamps: true }
);

export const Item = mongoose.model("Item", itemSchema);
