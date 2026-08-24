import mongoose, { Document, Schema } from "mongoose";

export type CommissionStatus = "Expected" | "Received" | "Paid";

export interface ICommission extends Document {
  agencyId: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  studentName: string;
  universityName: string;
  applicationId: string;
  country: string;
  intake: string;
  tuitionFee: number;
  expectedCommission: number;
  receivedCommission: number;
  agencySharePercentage: number;
  counselorSharePercentage: number;
  counselorName: string;
  status: CommissionStatus;
  payoutDate?: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommissionSchema = new Schema<ICommission>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String, required: true },
    universityName: { type: String, required: true },
    applicationId: { type: String, required: true },
    country: { type: String, required: true },
    intake: { type: String, required: true },
    tuitionFee: { type: Number, required: true },
    expectedCommission: { type: Number, required: true },
    receivedCommission: { type: Number, default: 0 },
    agencySharePercentage: { type: Number, default: 70 },
    counselorSharePercentage: { type: Number, default: 30 },
    counselorName: { type: String, required: true },
    status: { type: String, enum: ["Expected", "Received", "Paid"], default: "Expected" },
    payoutDate: { type: String },
    currency: { type: String, default: "GBP" },
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

CommissionSchema.index({ agencyId: 1, status: 1 });

export const Commission = mongoose.model<ICommission>("Commission", CommissionSchema);
