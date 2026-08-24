import mongoose, { Document, Schema } from "mongoose";

export interface IUniversity extends Document {
  agencyId: mongoose.Types.ObjectId;
  name: string;
  logo: string;
  country: string;
  city: string;
  website: string;
  ranking: string;
  agentStatus: "Direct Partner" | "Aggregator Agreement" | "Sub-Agent" | "Pending Contract";
  activeCoursesCount: number;
  applicationFee: number;
  currency: string;
  status: "Active" | "Inactive";
  overview: string;
  requirementsSummary: string;
  avgTuition: string;
  degrees: string[];
  intakes: string[];
  scholarshipsSummary: string;
  commissionRate: string;
  createdAt: Date;
  updatedAt: Date;
}

const UniversitySchema = new Schema<IUniversity>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    name: { type: String, required: true, trim: true },
    logo: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1562774053-701939374585?w=100&auto=format&fit=crop&q=80",
    },
    country: { type: String, required: true },
    city: { type: String, required: true },
    website: { type: String, required: true },
    ranking: { type: String, default: "Top Tier" },
    agentStatus: {
      type: String,
      enum: ["Direct Partner", "Aggregator Agreement", "Sub-Agent", "Pending Contract"],
      default: "Direct Partner",
    },
    activeCoursesCount: { type: Number, default: 0 },
    applicationFee: { type: Number, default: 0 },
    currency: { type: String, default: "GBP" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    overview: { type: String, default: "" },
    requirementsSummary: { type: String, default: "" },
    avgTuition: { type: String, default: "£20,000 - £30,000 / year" },
    degrees: [{ type: String }],
    intakes: [{ type: String }],
    scholarshipsSummary: { type: String, default: "Available for eligible international applicants." },
    commissionRate: { type: String, default: "10% of Year 1 Tuition" },
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

UniversitySchema.index({ agencyId: 1, country: 1 });
UniversitySchema.index({ agencyId: 1, name: 1 });

export const University = mongoose.model<IUniversity>("University", UniversitySchema);
