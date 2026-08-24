import mongoose, { Document, Schema } from "mongoose";

export type PlanType = "LIFETIME_FREE";
export type SubscriptionStatus = "PENDING_ACTIVATION" | "ACTIVE" | "INACTIVE" | "CANCELLED" | "EXPIRED";

export interface ISubscription extends Document {
  agencyId: mongoose.Types.ObjectId;
  plan: PlanType;
  status: SubscriptionStatus;
  subscriptionStart?: Date;
  subscriptionEnd?: Date;
  maxStudents: number;
  maxCounselors: number;
  maxStorageMb: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, unique: true },
    plan: {
      type: String,
      enum: ["LIFETIME_FREE"],
      default: "LIFETIME_FREE",
    },
    status: {
      type: String,
      enum: ["PENDING_ACTIVATION", "ACTIVE", "INACTIVE", "CANCELLED", "EXPIRED"],
      default: "PENDING_ACTIVATION",
    },
    subscriptionStart: { type: Date },
    subscriptionEnd: { type: Date },
    maxStudents: { type: Number, default: 999999 },
    maxCounselors: { type: Number, default: 999999 },
    maxStorageMb: { type: Number, default: 102400 }, // 100GB
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

SubscriptionSchema.index({ status: 1 });

export const Subscription = mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
