import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
  agencyId: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "offer" | "document" | "visa" | "task" | "appointment" | "payment" | "general";
  link?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["offer", "document", "visa", "task", "appointment", "payment", "general"],
      default: "general",
    },
    link: { type: String },
    isRead: { type: Boolean, default: false },
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

NotificationSchema.index({ agencyId: 1, user: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
