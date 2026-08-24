import mongoose, { Document, Schema } from "mongoose";

export interface ILeadNote {
  id: string;
  author: string;
  date: string;
  text: string;
}

export interface ILeadTimeline {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "status_change" | "call" | "email" | "meeting" | "note";
}

export interface ILead extends Document {
  agencyId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  countryInterest: string[];
  studyLevel: "Bachelor's" | "Master's" | "Doctorate" | "Diploma" | "Foundation";
  preferredCourse: string;
  intake: string;
  assignedCounselor?: mongoose.Types.ObjectId;
  status: "New" | "Contacted" | "Counselling" | "Interested" | "Documents Pending" | "Converted" | "Lost";
  leadSource: "Website Form" | "Walk-in" | "Facebook Ad" | "Referral" | "Education Expo" | "WhatsApp";
  lastContactDate?: string;
  gpa?: string;
  ieltsScore?: string;
  notes: ILeadNote[];
  timeline: ILeadTimeline[];
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    avatar: { type: String, trim: true },
    countryInterest: [{ type: String }],
    studyLevel: {
      type: String,
      enum: ["Bachelor's", "Master's", "Doctorate", "Diploma", "Foundation"],
      default: "Master's",
    },
    preferredCourse: { type: String, default: "General Studies" },
    intake: { type: String, required: true },
    assignedCounselor: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Counselling",
        "Interested",
        "Documents Pending",
        "Converted",
        "Lost",
      ],
      default: "New",
    },
    leadSource: {
      type: String,
      enum: [
        "Website Form",
        "Walk-in",
        "Facebook Ad",
        "Referral",
        "Education Expo",
        "WhatsApp",
      ],
      default: "Website Form",
    },
    lastContactDate: { type: String },
    gpa: { type: String },
    ieltsScore: { type: String },
    notes: [
      {
        id: { type: String, required: true },
        author: { type: String, required: true },
        date: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    timeline: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        timestamp: { type: String, required: true },
        type: {
          type: String,
          enum: ["status_change", "call", "email", "meeting", "note"],
          default: "status_change",
        },
      },
    ],
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
        delete ret.__v;
        return ret;
      },
    },
  }
);

LeadSchema.index({ agencyId: 1, status: 1 });
LeadSchema.index({ agencyId: 1, email: 1 });
LeadSchema.index({ agencyId: 1, assignedCounselor: 1 });

export const Lead = mongoose.model<ILead>("Lead", LeadSchema);
