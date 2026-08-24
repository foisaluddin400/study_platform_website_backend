import mongoose, { Document, Schema } from "mongoose";

export interface IMessageAttachment {
  name: string;
  size: string;
  type: string;
  fileUrl?: string;
}

export interface IMessage extends Document {
  agencyId: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: "student" | "counselor" | "system";
  senderAvatar?: string;
  recipient?: mongoose.Types.ObjectId;
  student?: mongoose.Types.ObjectId;
  text: string;
  read: boolean;
  isDeleted?: boolean;
  attachment?: IMessageAttachment;
  timestamp: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ["student", "counselor", "system"], required: true },
    senderAvatar: { type: String },
    recipient: { type: Schema.Types.ObjectId, ref: "User" },
    student: { type: Schema.Types.ObjectId, ref: "Student", index: true },
    text: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    attachment: {
      name: { type: String },
      size: { type: String },
      type: { type: String },
      fileUrl: { type: String },
    },
    timestamp: {
      type: String,
      default: () =>
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.senderId = ret.sender ? ret.sender.toString() : undefined;
        ret.recipientId = ret.recipient ? ret.recipient.toString() : undefined;
        ret.message = ret.text;
        delete ret.__v;
        return ret;
      },
    },
  }
);

MessageSchema.index({ agencyId: 1, student: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
