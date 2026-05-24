import mongoose from "mongoose";

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);
}

export function dbState(): "connected" | "disconnected" | "connecting" | "disconnecting" {
  const states = ["disconnected", "connected", "connecting", "disconnecting"] as const;
  return states[mongoose.connection.readyState] ?? "disconnected";
}
