import { Request, Response, NextFunction } from "express";
import { verifyJwt, JwtPayload } from "../lib/jwt";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = verifyJwt(token);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
