import mongoose, { Document, Schema } from "mongoose";

export type ApplicationStatus =
  | "Draft"
  | "Documents Pending"
  | "Ready to Apply"
  | "Submitted"
  | "Under Review"
  | "Conditional Offer"
  | "Unconditional Offer"
  | "Rejected"
  | "Withdrawn";

export interface IApplicationTimeline {
  title: string;
  date: string;
  completed: boolean;
  description?: string;
}

export interface IApplication extends Document {
  agencyId: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentName: string;
  studentAvatar?: string;
  studentEmail?: string;
  university: mongoose.Types.ObjectId;
  universityName: string;
  universityLogo?: string;
  course: mongoose.Types.ObjectId;
  courseName: string;
  country: string;
  intake: string;
  studyLevel: string;
  applicationDate: string;
  submissionDeadline: string;
  applicationFee: number;
  currency: string;
  feePaid: boolean;
  status: ApplicationStatus;
  counselor?: mongoose.Types.ObjectId;
  counselorName?: string;
  trackingNumber: string;
  attachedDocumentIds: string[];
  notes: string;
  timeline: IApplicationTimeline[];
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String, required: true },
    studentAvatar: { type: String },
    studentEmail: { type: String },
    university: { type: Schema.Types.ObjectId, ref: "University", required: true, index: true },
    universityName: { type: String, required: true },
    universityLogo: { type: String },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    courseName: { type: String, required: true },
    country: { type: String, required: true },
    intake: { type: String, required: true },
    studyLevel: { type: String, default: "Master's" },
    applicationDate: { type: String, default: () => new Date().toISOString().split("T")[0] },
    submissionDeadline: { type: String, default: "August 31, 2027" },
    applicationFee: { type: Number, default: 0 },
    currency: { type: String, default: "GBP" },
    feePaid: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "Draft",
        "Documents Pending",
        "Ready to Apply",
        "Submitted",
        "Under Review",
        "Conditional Offer",
        "Unconditional Offer",
        "Rejected",
        "Withdrawn",
      ],
      default: "Draft",
    },
    counselor: { type: Schema.Types.ObjectId, ref: "User" },
    counselorName: { type: String },
    trackingNumber: { type: String, default: () => `APP-${Math.floor(100000 + Math.random() * 900000)}` },
    attachedDocumentIds: [{ type: String }],
    notes: { type: String, default: "" },
    timeline: [
      {
        title: { type: String, required: true },
        date: { type: String, required: true },
        completed: { type: Boolean, default: false },
        description: { type: String },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.studentId = ret.student ? ret.student.toString() : undefined;
        ret.universityId = ret.university ? ret.university.toString() : undefined;
        ret.courseId = ret.course ? ret.course.toString() : undefined;
        ret.counselorId = ret.counselor ? ret.counselor.toString() : undefined;
        delete ret.__v;
        return ret;
      },
    },
  }
);

ApplicationSchema.index({ agencyId: 1, status: 1 });
ApplicationSchema.index({ agencyId: 1, student: 1 });
ApplicationSchema.index({ agencyId: 1, counselor: 1 });

export const Application = mongoose.model<IApplication>("Application", ApplicationSchema);
