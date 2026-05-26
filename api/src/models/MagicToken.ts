import mongoose, { Document, Schema } from "mongoose";

export interface IMagicToken extends Document {
  email: string;
  tokenHash: string;
  expiresAt: Date;
}

const MagicTokenSchema = new Schema<IMagicToken>({
  email: { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

// index TTL : MongoDB supprime automatiquement le document après expiresAt
MagicTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MagicTokenSchema.index({ tokenHash: 1 });

export const MagicToken = mongoose.model<IMagicToken>("MagicToken", MagicTokenSchema);
