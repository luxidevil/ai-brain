import { Router, type Request, type Response } from "express";
import { User } from "../models/user";
import { testMongoConnection } from "../lib/connectionPool";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, mongoUri } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    if (typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    let validatedUri: string | null = null;
    if (mongoUri && typeof mongoUri === "string" && mongoUri.trim()) {
      const trimmed = mongoUri.trim();
      if (!trimmed.startsWith("mongodb://") && !trimmed.startsWith("mongodb+srv://")) {
        res.status(400).json({ error: "MongoDB URI must start with mongodb:// or mongodb+srv://" });
        return;
      }

      const result = await testMongoConnection(trimmed);
      if (!result.ok) {
        res.status(400).json({
          error: "Could not connect to your MongoDB",
          detail: result.error,
          hint: "Make sure the connection string is correct and your IP is whitelisted.",
        });
        return;
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
    res.status(500).json({ error: err instanceof Error ? err.message : "Registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const doc = user.toObject() as {
      email: string;
      name: string;
      brainToken: string;
      mongoUri: string | null;
      passwordHash: string;
      createdAt: Date;
    };

    const valid = await bcrypt.compare(String(password), doc.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
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
    res.status(500).json({ error: err instanceof Error ? err.message : "Login failed" });
  }
});

export default router;
