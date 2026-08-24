import mongoose, { Document, Schema } from "mongoose";

export type OfferType = "Conditional" | "Unconditional";
export type OfferAcceptanceStatus = "Pending" | "Accepted" | "Declined";

export interface IOfferCondition {
  id: string;
  text: string;
  fulfilled: boolean;
}

export interface IOffer extends Document {
  agencyId: mongoose.Types.ObjectId;
  application: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentName: string;
  studentAvatar?: string;
  universityName: string;
  universityLogo?: string;
  courseName: string;
  country: string;
  intake: string;
  offerType: OfferType;
  offerDate: string;
  deadline: string;
  tuitionFee: number;
  currency: string;
  depositAmount: number;
  depositPaid: boolean;
  conditions: IOfferCondition[];
  acceptanceStatus: OfferAcceptanceStatus;
  offerLetterUrl?: string;
  offerLetterFileName?: string;
  offerLetterStoragePath?: string;
  offerLetterMimeType?: string;
  offerLetterSize?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    application: { type: Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String, required: true },
    studentAvatar: { type: String },
    universityName: { type: String, required: true },
    universityLogo: { type: String },
    courseName: { type: String, required: true },
    country: { type: String, required: true },
    intake: { type: String, required: true },
    offerType: { type: String, enum: ["Conditional", "Unconditional"], default: "Conditional" },
    offerDate: { type: String, default: () => new Date().toISOString().split("T")[0] },
    deadline: { type: String, default: "September 30, 2027" },
    tuitionFee: { type: Number, required: true },
    currency: { type: String, default: "GBP" },
    depositAmount: { type: Number, default: 2000 },
    depositPaid: { type: Boolean, default: false },
    conditions: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
        fulfilled: { type: Boolean, default: false },
      },
    ],
    acceptanceStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Declined"],
      default: "Pending",
    },
    offerLetterUrl: {
      type: String,
      default: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
    offerLetterFileName: { type: String },
    offerLetterStoragePath: { type: String },
    offerLetterMimeType: { type: String },
    offerLetterSize: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.applicationId = ret.application ? ret.application.toString() : undefined;
        ret.studentId = ret.student ? ret.student.toString() : undefined;
        ret.type = ret.offerType || "Conditional";
        ret.offerType = ret.offerType || "Conditional";
        ret.conditionsDeadline = ret.deadline;
        ret.depositDeadline = ret.deadline;
        delete ret.__v;
        return ret;
      },
    },
  }
);

OfferSchema.index({ agencyId: 1, student: 1 });
OfferSchema.index({ agencyId: 1, acceptanceStatus: 1 });

export const Offer = mongoose.model<IOffer>("Offer", OfferSchema);
