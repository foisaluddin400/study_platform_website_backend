import mongoose, { Document, Schema } from "mongoose";

export type AppointmentType =
  | "Counselling"
  | "Document Review"
  | "Application Review"
  | "Visa Consultation"
  | "Follow-up";

export interface IAppointment extends Document {
  agencyId: mongoose.Types.ObjectId;
  title: string;
  student?: mongoose.Types.ObjectId;
  studentName: string;
  studentAvatar?: string;
  counselorName: string;
  counselor?: mongoose.Types.ObjectId;
  date: string;
  time: string;
  duration: string;
  type: AppointmentType;
  location: string;
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    title: { type: String, required: true, trim: true },
    student: { type: Schema.Types.ObjectId, ref: "Student" },
    studentName: { type: String, required: true },
    studentAvatar: { type: String },
    counselorName: { type: String, required: true },
    counselor: { type: Schema.Types.ObjectId, ref: "User" },
    date: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: String, default: "45 mins" },
    type: {
      type: String,
      enum: ["Counselling", "Document Review", "Application Review", "Visa Consultation", "Follow-up"],
      default: "Counselling",
    },
    location: {
      type: String,
      default: "Zoom Video Call",
    },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled", "Rescheduled"],
      default: "Scheduled",
    },
    notes: { type: String },
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

AppointmentSchema.index({ agencyId: 1, date: 1 });
AppointmentSchema.index({ agencyId: 1, student: 1 });

export const Appointment = mongoose.model<IAppointment>("Appointment", AppointmentSchema);
