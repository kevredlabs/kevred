import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
