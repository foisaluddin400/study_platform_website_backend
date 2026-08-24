import mongoose, { Document, Schema } from "mongoose";

export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "Todo" | "In Progress" | "Completed";

export interface ITaskItem extends Document {
  agencyId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  student?: mongoose.Types.ObjectId;
  studentName?: string;
  assignedTo: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  category: "Document" | "Application" | "Visa" | "Follow-up" | "General" | "Financial" | "Offer";
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITaskItem>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    student: { type: Schema.Types.ObjectId, ref: "Student" },
    studentName: { type: String },
    assignedTo: { type: String, required: true },
    priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    dueDate: { type: String, required: true },
    status: { type: String, enum: ["Todo", "In Progress", "Completed"], default: "Todo" },
    category: {
      type: String,
      enum: ["Document", "Application", "Visa", "Follow-up", "General", "Financial", "Offer"],
      default: "General",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.studentId = ret.student ? ret.student.toString() : undefined;
        delete ret.__v;
        return ret;
      },
    },
  }
);

TaskSchema.index({ agencyId: 1, status: 1 });
TaskSchema.index({ agencyId: 1, assignedTo: 1 });

export const Task = mongoose.model<ITaskItem>("Task", TaskSchema);
