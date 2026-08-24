import mongoose, { Document, Schema } from "mongoose";

export interface ICourse extends Document {
  agencyId: mongoose.Types.ObjectId;
  university: mongoose.Types.ObjectId;
  universityName: string;
  universityLogo?: string;
  courseName: string;
  country: string;
  studyLevel: string;
  subjectArea: string;
  duration: string;
  tuitionFee: number;
  currency: string;
  ieltsRequirement: string;
  gpaRequirement: string;
  intakes: string[];
  deadline: string;
  scholarshipAvailable: boolean;
  scholarshipDetails?: string;
  description: string;
  careerOutcomes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    university: { type: Schema.Types.ObjectId, ref: "University", required: true, index: true },
    universityName: { type: String, required: true },
    universityLogo: { type: String },
    courseName: { type: String, required: true, trim: true },
    country: { type: String, required: true },
    studyLevel: {
      type: String,
      enum: [
        "Bachelor's",
        "Master's",
        "Doctorate",
        "Diploma",
        "Foundation",
        "Bachelor's Degree",
        "Master's Degree",
        "Doctorate / PhD",
        "Postgraduate Diploma",
        "Foundation Program",
      ],
      required: true,
    },

    subjectArea: { type: String, required: true },
    duration: { type: String, default: "1 Year Full-Time" },
    tuitionFee: { type: Number, required: true },
    currency: { type: String, default: "GBP" },
    ieltsRequirement: { type: String, default: "6.5 overall (min 6.0 each band)" },
    gpaRequirement: { type: String, default: "3.0 / 4.0 or UK 2:1" },
    intakes: [{ type: String }],
    deadline: { type: String, default: "July 31, 2027" },
    scholarshipAvailable: { type: Boolean, default: false },
    scholarshipDetails: { type: String },
    description: { type: String, default: "" },
    careerOutcomes: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id?.toString();
        ret.universityId = ret.university ? ret.university.toString() : undefined;
        delete ret.__v;
        return ret;
      },
    },
  }
);

CourseSchema.index({ agencyId: 1, country: 1, studyLevel: 1 });
CourseSchema.index({ agencyId: 1, university: 1 });
CourseSchema.index({ agencyId: 1, courseName: "text", subjectArea: "text" });

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
