import mongoose, { Document, Schema } from "mongoose";

export interface IProvider {
  label: string;
  url: string;
}

export interface IUser extends Document {
  email: string;
  customerId: string;
  providers: IProvider[];
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
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
