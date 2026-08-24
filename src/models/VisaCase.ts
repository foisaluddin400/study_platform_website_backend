import mongoose, { Document, Schema } from "mongoose";

export type VisaStatus =
  | "Document Preparation"
  | "Ready to Submit"
  | "Submitted"
  | "Biometrics"
  | "Under Review"
  | "Decision"
  | "Approved"
  | "Refused";

export type VisaDocumentStatus = "Pending" | "Submitted" | "Approved";

export interface IVisaFeaturedDocument {
  id: string;
  name: string;
  description?: string;
  status: VisaDocumentStatus;
  required?: boolean;
}

export interface IVisaChecklist {
  id: string;
  item: string;
  completed: boolean;
  required: boolean;
  documentId?: string;
}

export interface IVisaTimeline {
  stage: string;
  date: string;
  status: "done" | "current" | "upcoming";
  notes?: string;
}

export interface IVisaCase extends Document {
  agencyId: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentName: string;
  studentAvatar?: string;
  country: string;
  visaType: string;
  applicationDate: string;
  status: VisaStatus;
  targetIntake: string;
  institutionName: string;
  casOrCoeNumber?: string;
  biometricsDate?: string;
  submissionDate?: string;
  decisionDate?: string;
  counselorName: string;
  checklist: IVisaChecklist[];
  featuredDocuments: IVisaFeaturedDocument[];
  timeline: IVisaTimeline[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisaCaseSchema = new Schema<IVisaCase>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String, required: true },
    studentAvatar: { type: String },
    country: { type: String, required: true },
    visaType: { type: String, default: "Student Visa (Subclass 500 / Tier 4 / Study Permit)" },
    applicationDate: { type: String, default: () => new Date().toISOString().split("T")[0] },
    status: {
      type: String,
      enum: [
        "Document Preparation",
        "Ready to Submit",
        "Submitted",
        "Biometrics",
        "Under Review",
        "Decision",
        "Approved",
        "Refused",
      ],
      default: "Document Preparation",
    },
    targetIntake: { type: String, required: true },
    institutionName: { type: String, required: true },
    casOrCoeNumber: { type: String },
    biometricsDate: { type: String },
    submissionDate: { type: String },
    decisionDate: { type: String },
    counselorName: { type: String, default: "Visa Specialist" },
    checklist: [
      {
        id: { type: String, required: true },
        item: { type: String, required: true },
        completed: { type: Boolean, default: false },
        required: { type: Boolean, default: true },
        documentId: { type: String },
      },
    ],
    featuredDocuments: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String },
        status: {
          type: String,
          enum: ["Pending", "Submitted", "Approved"],
          default: "Pending",
        },
        required: { type: Boolean, default: true },
      },
    ],
    timeline: [
      {
        stage: { type: String, required: true },
        date: { type: String, required: true },
        status: { type: String, enum: ["done", "current", "upcoming"], default: "upcoming" },
        notes: { type: String },
      },
    ],
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.studentId = ret.student ? ret.student.toString() : undefined;
        ret.casNumber = ret.casOrCoeNumber;
        delete ret.__v;
        return ret;
      },
    },
  }
);

VisaCaseSchema.index({ agencyId: 1, status: 1 });
VisaCaseSchema.index({ agencyId: 1, student: 1 });

export const VisaCase = mongoose.model<IVisaCase>("VisaCase", VisaCaseSchema);
