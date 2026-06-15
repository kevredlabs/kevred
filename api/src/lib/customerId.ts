import crypto from "crypto";

export function generateCustomerId(): string {
  return crypto.randomBytes(8).toString("hex");
}
