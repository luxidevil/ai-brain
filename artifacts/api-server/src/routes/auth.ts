import { Router } from "express";
import { User } from "../models/user";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body ?? {};

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

    const passwordHash = await bcrypt.hash(password, 12);
    const brainToken = `bt_${crypto.randomBytes(32).toString("hex")}`;

    const user = await User.create({
      email: email.toLowerCase().trim(),
      name: name || "",
      passwordHash,
      brainToken,
    });

    const doc = user.toObject() as {
      email: string;
      name: string;
      brainToken: string;
      createdAt: Date;
    };

    res.status(201).json({
      message: "Account created. Save your brain token — it's your master key.",
      email: doc.email,
      name: doc.name,
      brainToken: doc.brainToken,
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
      createdAt: doc.createdAt,
    });
  } catch (err: unknown) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Login failed" });
  }
});

export default router;
