import mongoose, { Document, Schema } from "mongoose";

export interface IProvider {
  label: string;
  url: string;
}

export type RoutingMode = "sequential" | "parallel";

export interface IUser extends Document {
  email: string;
  customerId: string;
  providers: IProvider[];
  mode: RoutingMode;
  createdAt: Date;
}

const ProviderSchema = new Schema<IProvider>(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customerId: { type: String, required: true, unique: true, index: true },
    providers: { type: [ProviderSchema], default: [] },
    mode: { type: String, enum: ["sequential", "parallel"], default: "sequential" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
