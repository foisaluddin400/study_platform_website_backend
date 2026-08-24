import mongoose, { Document as MongoDoc, Schema } from "mongoose";

export type DocumentCategory = string;

export type DocumentStatus =
  | "Uploaded"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Correction Required";

export interface IDocumentItem extends MongoDoc {
  agencyId: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentName?: string;
  uploadedBy?: mongoose.Types.ObjectId;
  name: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileSize: string;
  fileType: string;
  category: string;
  uploadDate: string;
  status: DocumentStatus;
  reviewer?: string;
  reviewNotes?: string;
  expiryDate?: string;
  requiredForCountry: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentItem>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    storagePath: { type: String, required: true },
    fileSize: { type: String, default: "1.2 MB" },
    fileType: { type: String, default: "PDF" },
    category: {
      type: String,
      default: "Academic",
    },
    uploadDate: { type: String, default: () => new Date().toISOString().split("T")[0] },
    status: {
      type: String,
      enum: ["Uploaded", "Under Review", "Approved", "Rejected", "Correction Required"],
      default: "Under Review",
    },
    reviewer: { type: String },
    reviewNotes: { type: String },
    expiryDate: { type: String },
    requiredForCountry: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.studentId = ret.student ? ret.student.toString() : undefined;
        delete ret.storagePath;
        delete ret.__v;
        return ret;
      },
    },
  }
);

DocumentSchema.index({ agencyId: 1, student: 1 });
DocumentSchema.index({ agencyId: 1, category: 1 });
DocumentSchema.index({ agencyId: 1, status: 1 });

export const DocumentModel = mongoose.model<IDocumentItem>("Document", DocumentSchema);
