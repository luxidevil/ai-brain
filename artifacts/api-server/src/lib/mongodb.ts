import mongoose from "mongoose";
import { logger } from "./logger";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI environment variable is required but was not provided.");
}

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(uri as string, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      tls: true,
    });
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB");
    throw err;
  }
}

export { mongoose };
