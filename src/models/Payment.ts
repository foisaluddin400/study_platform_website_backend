import mongoose, { Document, Schema } from "mongoose";

export type PaymentStatus = "Paid" | "Partial" | "Due" | "Overdue";

export interface IPayment extends Document {
  agencyId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  student: mongoose.Types.ObjectId;
  studentName: string;
  type: string;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  paymentMethod?: "Bank Transfer" | "Credit Card" | "Stripe Portal" | "Cash / Desk";
  transactionRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    invoiceNumber: {
      type: String,
      required: true,
      default: () => `INV-2027-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentName: { type: String, required: true },
    type: {
      type: String,
      default: "Consultancy Fee",
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    dueDate: { type: String, required: true },
    paidDate: { type: String },
    status: {
      type: String,
      enum: ["Paid", "Partial", "Due", "Overdue"],
      default: "Due",
    },
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "Credit Card", "Stripe Portal", "Cash / Desk"],
      default: "Bank Transfer",
    },
    transactionRef: { type: String },
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

PaymentSchema.index({ agencyId: 1, status: 1 });
PaymentSchema.index({ agencyId: 1, student: 1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
