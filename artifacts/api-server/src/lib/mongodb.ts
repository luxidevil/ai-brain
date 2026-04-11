import mongoose from "mongoose";
import { logger } from "./logger";

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB");
    throw err;
  }
}

export { mongoose };
