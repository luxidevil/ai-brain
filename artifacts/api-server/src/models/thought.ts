import { mongoose } from "../lib/mongodb";

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

export const Thought = mongoose.model("Thought", thoughtSchema);
