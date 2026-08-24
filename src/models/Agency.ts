import mongoose, { Document, Schema } from "mongoose";

export interface IBranch {
  id: string;
  name: string;
  type: "Primary Hub" | "Regional";
  address: string;
  staffCount: number;
  activeStudents: number;
}

export interface IAgency extends Document {
  name: string;
  displayName: string;
  email: string;
  phone: string;
  address?: string;
  website?: string;
  logo?: string;
  country?: string;
  teamSize?: string;
  baseCurrency: string;
  operatingCountries: string[];
  branches: IBranch[];
  notificationsConfig: {
    offerLetterAlert: boolean;
    documentCorrectionAlert: boolean;
    biometricsReminder: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgencySchema = new Schema<IAgency>(
  {
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    website: { type: String, trim: true },
    logo: { type: String, trim: true },
    country: { type: String, default: "United Kingdom" },
    teamSize: { type: String, default: "5-15 Counselors" },
    baseCurrency: { type: String, default: "USD" },
    operatingCountries: {
      type: [String],
      default: ["United Kingdom", "Canada", "Australia", "Germany", "United States", "Malaysia"],
    },
    branches: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["Primary Hub", "Regional"], default: "Regional" },
        address: { type: String, required: true },
        staffCount: { type: Number, default: 0 },
        activeStudents: { type: Number, default: 0 },
      },
    ],
    notificationsConfig: {
      offerLetterAlert: { type: Boolean, default: true },
      documentCorrectionAlert: { type: Boolean, default: true },
      biometricsReminder: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
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

AgencySchema.index({ email: 1 });
AgencySchema.index({ isActive: 1 });

export const Agency = mongoose.model<IAgency>("Agency", AgencySchema);
