import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "PLATFORM_SUPER_ADMIN" | "AGENCY_ADMIN" | "COUNSELOR" | "STUDENT";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  roleTitle?: string;
  agencyId?: mongoose.Types.ObjectId;
  branch?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  isBlocked: boolean;
  emailVerified: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  lastLogin?: Date;
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["PLATFORM_SUPER_ADMIN", "AGENCY_ADMIN", "COUNSELOR", "STUDENT"],
      required: true,
      default: "STUDENT",
    },
    roleTitle: { type: String, trim: true },
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: "Agency",
      required: function (this: IUser) {
        return this.role !== "PLATFORM_SUPER_ADMIN";
      },
    },
    branch: { type: String, default: "Main Branch" },
    phone: { type: String, trim: true },
    avatar: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: true },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserSchema.index({ agencyId: 1, email: 1 });
UserSchema.index({ agencyId: 1, role: 1 });

UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>("User", UserSchema);
