import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { generateToken, hashToken } from "../lib/token";
import { signJwt } from "../lib/jwt";
import { sendMagicLink } from "../lib/mailer";
import { MagicToken } from "../models/MagicToken";
import { User } from "../models/User";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/auth/magic-link", magicLinkLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await MagicToken.deleteMany({ email: normalizedEmail });
  await MagicToken.create({ email: normalizedEmail, tokenHash, expiresAt });

  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const magicUrl = `${appUrl}/auth/verify?token=${token}`;

  await sendMagicLink(normalizedEmail, magicUrl);

  // Même réponse si l'email existe ou non → pas d'énumération
  res.json({ ok: true });
});

router.get("/auth/verify", verifyLimiter, async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const tokenHash = hashToken(token);
  const magicToken = await MagicToken.findOne({ tokenHash });

  if (!magicToken || magicToken.expiresAt < new Date()) {
    await MagicToken.deleteOne({ tokenHash });
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Single-use : suppression immédiate avant d'émettre le JWT
  await MagicToken.deleteOne({ _id: magicToken._id });

  let user = await User.findOne({ email: magicToken.email });
  if (!user) {
    user = await User.create({ email: magicToken.email });
  }

  const jwt = signJwt({ userId: user._id.toString(), email: user.email });

  res.cookie("token", jwt, COOKIE_OPTIONS).json({ ok: true });
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie("token").json({ ok: true });
});

router.get("/auth/me", requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
