import { mongoose } from "../lib/mongodb";

const secretSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
    },
    scope: {
      type: String,
      enum: ["brain", "thought"],
      required: true,
    },
    thoughtId: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

secretSchema.index({ scope: 1, thoughtId: 1, key: 1 }, { unique: true });

export const Secret = mongoose.model("Secret", secretSchema);
