import mongoose, { Document, Schema } from "mongoose";

export interface IAcademicRecord {
  degree: string;
  institution: string;
  passingYear: number;
  gpa: string;
  country: string;
}

export interface IEnglishProficiency {
  testType: "IELTS" | "PTE" | "TOEFL" | "Duolingo" | "None";
  overallScore: string;
  reading?: string;
  writing?: string;
  listening?: string;
  speaking?: string;
  testDate: string;
}

export interface IWorkExperience {
  title: string;
  company: string;
  duration: string;
  roleSummary: string;
}

export interface ISponsorDetails {
  name: string;
  relationship: string;
  occupation: string;
  estimatedFunds: string;
  bankName: string;
}

export interface IStudent extends Document {
  agencyId: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  dateOfBirth?: string;
  nationality?: string;
  currentAddress?: string;
  passportNumber?: string;
  passportExpiry?: string;
  targetDegree: string;
  preferredCountries: string[];
  preferredCourse: string;
  intake: string;
  budgetRange?: string;
  assignedCounselor?: mongoose.Types.ObjectId;
  assignedCounselors?: mongoose.Types.ObjectId[];
  isBlocked: boolean;
  isDeleted: boolean;
  currentStage: "Lead" | "Counselling" | "Documents" | "Application" | "Offer" | "Visa" | "Enrollment";
  journeyProgress: number;
  applicationStatus: string;
  visaStatus: string;
  lastActivity: string;
  enrollmentYear: number;
  academicHistory: IAcademicRecord[];
  englishProficiency: IEnglishProficiency;
  workExperience: IWorkExperience[];
  sponsorDetails: ISponsorDetails;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    avatar: { type: String, trim: true },
    dateOfBirth: { type: String },
    nationality: { type: String, default: "International" },
    currentAddress: { type: String },
    passportNumber: { type: String },
    passportExpiry: { type: String },
    targetDegree: {
      type: String,
      default: "Master's",
    },
    preferredCountries: [{ type: String }],
    preferredCourse: { type: String, required: true },
    intake: { type: String, required: true },
    budgetRange: { type: String, default: "£20,000 - £30,000 / year" },
    assignedCounselor: { type: Schema.Types.ObjectId, ref: "User" },
    assignedCounselors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isBlocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    currentStage: {
      type: String,
      enum: ["Lead", "Counselling", "Documents", "Application", "Offer", "Visa", "Enrollment"],
      default: "Lead",
    },
    journeyProgress: { type: Number, default: 10 },
    applicationStatus: { type: String, default: "Draft" },
    visaStatus: { type: String, default: "Document Preparation" },
    lastActivity: { type: String, default: () => new Date().toISOString().split("T")[0] },
    enrollmentYear: { type: Number, default: 2027 },
    academicHistory: [
      {
        degree: { type: String, required: true },
        institution: { type: String, required: true },
        passingYear: { type: Number, required: true },
        gpa: { type: String, required: true },
        country: { type: String, required: true },
      },
    ],
    englishProficiency: {
      testType: {
        type: String,
        enum: ["IELTS", "PTE", "TOEFL", "Duolingo", "None"],
        default: "IELTS",
      },
      overallScore: { type: String, default: "N/A" },
      reading: { type: String },
      writing: { type: String },
      listening: { type: String },
      speaking: { type: String },
      testDate: { type: String, default: "N/A" },
    },
    workExperience: [
      {
        title: { type: String, required: true },
        company: { type: String, required: true },
        duration: { type: String, required: true },
        roleSummary: { type: String, required: true },
      },
    ],
    sponsorDetails: {
      name: { type: String, default: "Self / Family" },
      relationship: { type: String, default: "Self" },
      occupation: { type: String, default: "Employed" },
      estimatedFunds: { type: String, default: "£25,000" },
      bankName: { type: String, default: "Standard Chartered Bank" },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        if (ret.assignedCounselor && typeof ret.assignedCounselor === "object") {
          ret.assignedCounselorId = ret.assignedCounselor._id?.toString() || ret.assignedCounselor.id;
          ret.assignedCounselorName = ret.assignedCounselor.name;
        } else if (ret.assignedCounselor) {
          ret.assignedCounselorId = ret.assignedCounselor.toString();
        }
        if (ret.assignedCounselors && Array.isArray(ret.assignedCounselors)) {
          ret.assignedCounselorIds = ret.assignedCounselors.map((c: any) =>
            typeof c === "object" ? c._id?.toString() || c.id : c.toString()
          );
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

StudentSchema.index({ agencyId: 1, email: 1 });
StudentSchema.index({ agencyId: 1, currentStage: 1 });
StudentSchema.index({ agencyId: 1, assignedCounselor: 1 });
StudentSchema.index({ agencyId: 1, assignedCounselors: 1 });
StudentSchema.index({ agencyId: 1, isBlocked: 1 });
StudentSchema.index({ agencyId: 1, isDeleted: 1 });

export const Student = mongoose.model<IStudent>("Student", StudentSchema);
