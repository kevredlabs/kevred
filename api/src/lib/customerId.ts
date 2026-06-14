import crypto from "crypto";

export function generateCustomerId(): string {
  return `k_${crypto.randomBytes(8).toString("hex")}`;
}
