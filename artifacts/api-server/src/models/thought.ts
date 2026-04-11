import { mongoose } from "../lib/mongodb";
import crypto from "crypto";

const thoughtSchema = new mongoose.Schema(
  {
    thoughtId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

thoughtSchema.statics.generateKey = function () {
  return `tk_${crypto.randomBytes(32).toString("hex")}`;
};

export const Thought = mongoose.model("Thought", thoughtSchema);
