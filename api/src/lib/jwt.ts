import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
const EXPIRY = "7d";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signJwt(payload: JwtPayload): string {
  if (!SECRET) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: EXPIRY });
}

export function verifyJwt(token: string): JwtPayload {
  if (!SECRET) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}
