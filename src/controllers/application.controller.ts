import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Application } from "../models/Application";
import { Student } from "../models/Student";
import { University } from "../models/University";
import { Course } from "../models/Course";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";

export const getApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, studentId, counselorId, search } = req.query;

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (req.user?.role === "STUDENT") {
      const student = await Student.findOne({
        agencyId: req.user.agencyId,
        $or: [{ user: req.user.userId }, { email: req.user.email }],
      });
      if (student) {
        filter.student = student._id;
      }
    } else if (studentId) {
      if (req.user?.role === "COUNSELOR") {
        const student = await Student.findOne({ _id: String(studentId), agencyId: req.user.agencyId });
        if (!student || !canUserAccessStudentPrivateData(req.user, student)) {
          return next(new AppError("Access denied. You are not assigned to this student.", 403));
        }
      }
      filter.student = studentId;
    } else if (req.user?.role === "COUNSELOR") {
      const assignedStudents = await Student.find({
        agencyId: req.user.agencyId,
        $or: [
          { assignedCounselor: req.user.userId },
          { assignedCounselors: req.user.userId },
        ],
      }).select("_id");
      const assignedStudentIds = assignedStudents.map((s) => s._id);
      filter.$or = [
        { counselor: req.user.userId },
        { student: { $in: assignedStudentIds } },
      ];
    }

    if (counselorId) {
      filter.counselor = counselorId;
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { studentName: searchRegex },
        { universityName: searchRegex },
        { courseName: searchRegex },
        { trackingNumber: searchRegex },
      ];
    }

    const applications = await Application.find(filter)
      .populate("counselor", "name email roleTitle avatar")
      .sort({ updatedAt: -1 });

    sendSuccess(res, "Applications retrieved", applications);
  } catch (error) {
    next(error);
  }
};

export const getMyApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const student = await Student.findOne({
      agencyId: req.user?.agencyId,
      $or: [{ user: req.user?.userId }, { email: req.user?.email }],
    });

    if (!student) {
      return next(new AppError("Student profile not found.", 404));
    }

    const applications = await Application.find({
      agencyId: req.user?.agencyId,
      student: student._id,
    }).sort({ updatedAt: -1 });

    sendSuccess(res, "My applications", applications);
  } catch (error) {
    next(error);
  }
};

export const getApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    })
      .populate("student")
      .populate("university")
      .populate("course")
      .populate("counselor", "name email roleTitle avatar");

    if (!application) {
      return next(new AppError("Application not found.", 404));
    }

    const student = await Student.findById(application.student);
    if (!canUserAccessStudentPrivateData(req.user, student) && application.counselor?.toString() !== req.user?.userId) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    sendSuccess(res, "Application details", application);
  } catch (error) {
    next(error);
  }
};

export const createApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { studentId, universityId, courseId, intake, notes, counselorId } = req.body;

    let student = null;
    let university = null;
    let course = null;

    if (req.user?.role === "STUDENT") {
      student = await Student.findOne({
        agencyId: req.user.agencyId,
        $or: [{ user: req.user.userId }, { email: req.user.email }],
      });
    } else if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      student = await Student.findOne({ _id: studentId, agencyId: req.user?.agencyId });
    } else if (studentId) {
      student = await Student.findById(studentId);
    }

    if (!student) {
      student = await Student.findOne({ agencyId: req.user?.agencyId });
    }

    if (!student) {
      return next(new AppError("Please select a valid registered student applicant.", 400));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    if (universityId && mongoose.Types.ObjectId.isValid(universityId)) {
      university =
        (await University.findOne({ _id: universityId, agencyId: req.user?.agencyId })) ||
        (await University.findById(universityId));
    } else if (universityId) {
      university = await University.findOne({
        agencyId: req.user?.agencyId,
        name: new RegExp(String(universityId).trim(), "i"),
      });
    }

    if (!university) {
      university = await University.findOne({ agencyId: req.user?.agencyId });
    }

    if (!university) {
      return next(new AppError("Selected target university could not be found.", 400));
    }

    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      course =
        (await Course.findOne({ _id: courseId, agencyId: req.user?.agencyId })) ||
        (await Course.findById(courseId));
    }

    let resolvedCourseName =
      req.body.courseName ||
      req.body.degreeProgram ||
      req.body.title ||
      (course ? course.courseName : "Undergraduate / Postgraduate Degree");

    const resolvedStudyLevel =
      req.body.studyLevel ||
      (course ? course.studyLevel : student ? student.targetDegree || "Master's" : "Master's");

    if (!course && university) {
      // Find course by name or matching university
      course = await Course.findOne({
        agencyId: req.user?.agencyId,
        university: university._id,
        courseName: new RegExp(resolvedCourseName.trim(), "i"),
      });

      if (!course) {
        course = await Course.findOne({
          agencyId: req.user?.agencyId,
          university: university._id,
        });
      }

      if (!course) {
        course = await Course.findOne({ agencyId: req.user?.agencyId });
      }

      // If no course exists in the database, automatically create one so the Course ObjectId constraint is fulfilled
      if (!course) {
        course = new Course({
          agencyId: req.user?.agencyId,
          university: university._id,
          universityName: university.name,
          courseName: resolvedCourseName,
          country: req.body.country || university.country,
          studyLevel: resolvedStudyLevel,
          subjectArea: "Higher Education",
          duration: "1 - 2 Years",
          tuitionFee: university.avgTuition
            ? parseInt(university.avgTuition.replace(/[^0-9]/g, ""), 10) || 18000
            : 18000,
          currency: university.currency || "GBP",
          ieltsRequirement: "6.5 overall (min 6.0 in all bands)",
          gpaRequirement: "3.0 / 4.0 or equivalent",
          intakes: university.intakes || ["September 2027", "January 2028"],
          deadline: "Rolling Admissions",
          description: `Degree program in ${resolvedCourseName} at ${university.name}.`,
          careerOutcomes: ["Industry Specialist", "Professional Consultant"],
        });
        await course.save();
      }
    }

    if (!course) {
      return next(new AppError("Could not resolve or initialize degree program course.", 400));
    }

    const application = new Application({
      agencyId: req.user?.agencyId,
      student: student._id,
      studentName: student.name,
      studentAvatar: student.avatar,
      studentEmail: student.email,
      university: university._id,
      universityName: university.name,
      universityLogo: university.logo,
      course: course._id,
      courseName: resolvedCourseName,
      country: req.body.country || university.country,
      intake: intake || student.intake || "September 2027",
      studyLevel: resolvedStudyLevel,
      applicationFee: university.applicationFee || 0,
      currency: university.currency || "GBP",
      status: req.body.status || "Ready to Apply",
      counselor: counselorId || student.assignedCounselor || req.user?.userId,
      notes: notes || "",
      timeline: [
        {
          title: "Application Initialized",
          date: new Date().toISOString().split("T")[0],
          completed: true,
          description: "Application record created in student portal.",
        },
      ],
    });

    await application.save();

    student.currentStage = "Application";
    student.applicationStatus = "Ready to Apply";
    student.journeyProgress = Math.max(student.journeyProgress || 0, 50);
    await student.save();

    sendSuccess(res, "Application created successfully", application, 201);
  } catch (error) {
    next(error);
  }
};

export const updateApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingApp = await Application.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingApp) {
      return next(new AppError("Application not found.", 404));
    }

    const student = await Student.findById(existingApp.student);
    if (!canUserAccessStudentPrivateData(req.user, student) && existingApp.counselor?.toString() !== req.user?.userId) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    const application = await Application.findByIdAndUpdate(
      existingApp._id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!application) {
      return next(new AppError("Application not found.", 404));
    }

    if (req.body.status) {
      await Student.findOneAndUpdate(
        { _id: application.student, agencyId: req.user?.agencyId },
        { applicationStatus: req.body.status }
      );
    }

    sendSuccess(res, "Application updated successfully", application);
  } catch (error) {
    next(error);
  }
};

export const deleteApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingApp = await Application.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingApp) {
      return next(new AppError("Application not found.", 404));
    }

    const student = await Student.findById(existingApp.student);
    if (!canUserAccessStudentPrivateData(req.user, student) && existingApp.counselor?.toString() !== req.user?.userId) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    await Application.findByIdAndDelete(existingApp._id);

    sendSuccess(res, "Application deleted successfully.");
  } catch (error) {
    next(error);
  }
};
