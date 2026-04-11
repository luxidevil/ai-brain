import { Router } from "express";
import { User } from "../models/user";
import { testMongoConnection } from "../lib/connectionPool";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, mongoUri } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists" });
    }

    let validatedUri: string | null = null;
    if (mongoUri && typeof mongoUri === "string" && mongoUri.trim()) {
      const trimmed = mongoUri.trim();
      if (!trimmed.startsWith("mongodb://") && !trimmed.startsWith("mongodb+srv://")) {
        return res.status(400).json({ error: "MongoDB URI must start with mongodb:// or mongodb+srv://" });
      }

      const result = await testMongoConnection(trimmed);
      if (!result.ok) {
        return res.status(400).json({
          error: "Could not connect to your MongoDB",
          detail: result.error,
          hint: "Make sure you've added our server IP (142.93.220.197) to your MongoDB Atlas Network Access list.",
        });
      }
      validatedUri = trimmed;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const brainToken = `bt_${crypto.randomBytes(32).toString("hex")}`;

    const user = await User.create({
      email: email.toLowerCase().trim(),
      name: name || "",
      passwordHash,
      brainToken,
      mongoUri: validatedUri,
    });

    const doc = user.toObject() as {
      email: string;
      name: string;
      brainToken: string;
      mongoUri: string | null;
      createdAt: Date;
    };

    res.status(201).json({
      message: "Account created. Save your brain token — it's your master key.",
      email: doc.email,
      name: doc.name,
      brainToken: doc.brainToken,
      storage: doc.mongoUri ? "your-mongodb" : "shared",
      createdAt: doc.createdAt,
    });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const doc = user.toObject() as {
      email: string;
      name: string;
      passwordHash: string;
      brainToken: string;
      mongoUri: string | null;
      createdAt: Date;
    };

    const valid = await bcrypt.compare(password, doc.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      email: doc.email,
      name: doc.name,
      brainToken: doc.brainToken,
      storage: doc.mongoUri ? "your-mongodb" : "shared",
      createdAt: doc.createdAt,
    });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Login failed" });
  }
});

router.put("/mongo-uri", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token || !token.startsWith("bt_")) {
      return res.status(401).json({ error: "Brain token required" });
    }

    const user = await User.findOne({ brainToken: token });
    if (!user) {
      return res.status(403).json({ error: "Invalid brain token" });
    }

    const { mongoUri } = req.body ?? {};

    if (mongoUri === null || mongoUri === "") {
      (user as Record<string, unknown>).mongoUri = null;
      await user.save();
      return res.json({ message: "Switched to shared storage", storage: "shared" });
    }

    if (typeof mongoUri !== "string" || (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://"))) {
      return res.status(400).json({ error: "MongoDB URI must start with mongodb:// or mongodb+srv://" });
    }

    const result = await testMongoConnection(mongoUri.trim());
    if (!result.ok) {
      return res.status(400).json({
        error: "Could not connect to your MongoDB",
        detail: result.error,
        hint: "Make sure you've added our server IP (142.93.220.197) to your MongoDB Atlas Network Access list.",
      });
    }

    (user as Record<string, unknown>).mongoUri = mongoUri.trim();
    await user.save();

    res.json({ message: "MongoDB URI updated. Your data now lives in your own database.", storage: "your-mongodb" });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to update MongoDB URI" });
  }
});

export default router;
