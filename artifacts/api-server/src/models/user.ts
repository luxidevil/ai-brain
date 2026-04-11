import { mongoose } from "../lib/mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    passwordHash: {
      type: String,
      required: true,
    },
    brainToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mongoUri: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = async function (password: string) {
  return bcrypt.hash(password, 12);
};

userSchema.statics.comparePassword = async function (
  password: string,
  hash: string
) {
  return bcrypt.compare(password, hash);
};

userSchema.statics.generateBrainToken = function () {
  return `bt_${crypto.randomBytes(32).toString("hex")}`;
};

export const User = mongoose.model("User", userSchema);
