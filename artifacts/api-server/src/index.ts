import app from "./app";
import { logger } from "./lib/logger";
import { connectMongoDB } from "./lib/mongodb";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  try {
    await connectMongoDB();
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB — check MONGODB_URI");
    process.exit(1);
  }

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

main();
