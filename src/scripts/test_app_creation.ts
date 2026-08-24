import mongoose from "mongoose";
import { env } from "../config/env";
import { Agency } from "../models/Agency";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { University } from "../models/University";
import { Course } from "../models/Course";
import { signAccessToken } from "../utils/jwt";

const run = async () => {
  await mongoose.connect(env.mongoUri);
  const agency = await Agency.findOne();
  if (!agency) {
    console.error("No agency found");
    process.exit(1);
  }

  const user = await User.findOne({ agencyId: agency._id, role: "AGENCY_ADMIN" });
  let student = await Student.findOne({ agencyId: agency._id });
  let uni = await University.findOne({ agencyId: agency._id });
  let course = await Course.findOne({ agencyId: agency._id });

  if (!uni) {
    uni = new University({
      agencyId: agency._id,
      name: "University of Manchester",
      country: "United Kingdom",
      city: "Manchester",
      status: "Active",
    });
    await uni.save();
  }

  if (!course) {
    course = new Course({
      agencyId: agency._id,
      university: uni._id,
      universityName: uni.name,
      courseName: "MSc Advanced Computer Science & AI",
      country: "United Kingdom",
      studyLevel: "Master's",
      subjectArea: "Computer Science",
      tuitionFee: 30000,
    });
    await course.save();
  }

  if (!student) {
    student = new Student({
      agencyId: agency._id,
      name: "Tariq Student Demo",
      email: "tariq.test@gmail.com",
      status: "Active",
    });
    await student.save();
  }

  const token = signAccessToken({
    userId: user?._id.toString() || "",
    agencyId: agency._id.toString(),
    role: user?.role || "AGENCY_ADMIN",
  });

  const response = await fetch("http://localhost:5000/api/v1/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      studentId: student._id.toString(),
      universityId: uni._id.toString(),
      courseId: "course-002",
      intake: "September 2027",
      notes: "Test application creation verification with mock ID",
    }),
  });

  const data: any = await response.json();
  if (!response.ok) {
    console.error("API error:", data);
    process.exit(1);
  }

  console.log("✅ Application created successfully with mock ID course-002! ID:", data.data.id, "| Course:", data.data.courseName);
  process.exit(0);
};

run().catch((err: any) => {
  console.error("Error creating test application:", err);
  process.exit(1);
});
