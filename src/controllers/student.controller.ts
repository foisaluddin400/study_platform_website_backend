import { Request, Response, NextFunction } from "express";
import { Student } from "../models/Student";
import { Application } from "../models/Application";
import { Offer } from "../models/Offer";
import { DocumentModel } from "../models/Document";
import { VisaCase } from "../models/VisaCase";
import { Agency } from "../models/Agency";
import { User } from "../models/User";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { emailService } from "../services/email.service";
import { env } from "../config/env";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";

const safeJsonParse = (val: any) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

export const getStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stage, country, search, counselorId, status } = req.query;

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
      isDeleted: { $ne: true },
    };

    if (status === "blocked") {
      filter.isBlocked = true;
    } else if (status === "unblocked") {
      filter.isBlocked = { $ne: true };
    }

    if (stage && stage !== "All") {
      filter.currentStage = stage;
    }

    if (country && country !== "All") {
      filter.preferredCountries = country;
    }

    if (counselorId) {
      filter.$or = [
        { assignedCounselor: counselorId },
        { assignedCounselors: counselorId },
      ];
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { preferredCourse: searchRegex },
        ],
      });
    }

    const students = await Student.find(filter)
      .populate("assignedCounselor", "name email roleTitle avatar")
      .populate("assignedCounselors", "name email roleTitle avatar")
      .sort({ updatedAt: -1 });

    sendSuccess(res, "Students retrieved successfully", students);
  } catch (error) {
    next(error);
  }
};

export const getStudentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query: Record<string, any> = {
      _id: req.params.id,
      agencyId: req.user?.agencyId,
      isDeleted: { $ne: true },
    };

    const student = await Student.findOne(query)
      .populate("assignedCounselor", "name email roleTitle avatar")
      .populate("assignedCounselors", "name email roleTitle avatar");

    if (!student) {
      return next(new AppError("Student profile not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    sendSuccess(res, "Student profile details", student);
  } catch (error) {
    next(error);
  }
};

export const getStudentMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let student = await Student.findOne({
      agencyId: req.user?.agencyId,
      $or: [{ user: req.user?.userId }, { email: req.user?.email }],
    }).populate("assignedCounselor", "name email roleTitle avatar");

    if (!student) {
      // Fallback: search by email
      student = await Student.findOne({ email: req.user?.email }).populate(
        "assignedCounselor",
        "name email roleTitle avatar"
      );
    }

    if (!student) {
      return next(new AppError("Student profile not found.", 404));
    }

    sendSuccess(res, "My student profile", student);
  } catch (error) {
    next(error);
  }
};

export const getStudentDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let student = await Student.findOne({
      agencyId: req.user?.agencyId,
      $or: [{ user: req.user?.userId }, { email: req.user?.email }],
    }).populate("assignedCounselor", "name email roleTitle avatar");

    if (!student) {
      student = await Student.findOne({ email: req.user?.email }).populate(
        "assignedCounselor",
        "name email roleTitle avatar"
      );
    }

    if (!student) {
      return next(new AppError("Student profile not found.", 404));
    }

    const [applications, offers, documents, visaCase] = await Promise.all([
      Application.find({ agencyId: student.agencyId, student: student._id }),
      Offer.find({ agencyId: student.agencyId, student: student._id }),
      DocumentModel.find({ agencyId: student.agencyId, student: student._id }),
      VisaCase.findOne({ agencyId: student.agencyId, student: student._id }),
    ]);

    sendSuccess(res, "Student dashboard summary", {
      student,
      applications,
      offers,
      documents,
      visaCase,
    });
  } catch (error) {
    next(error);
  }
};

export const createStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentPassword = req.body.password || "StudentPass123!";

    if (studentPassword.length < 6) {
      return next(new AppError("Password must be at least 6 characters long.", 400));
    }

    let studentUser = null;

    if (req.body.email) {
      studentUser = await User.findOne({ email: req.body.email.toLowerCase() });
      if (!studentUser) {
        studentUser = new User({
          name: req.body.name,
          email: req.body.email.toLowerCase(),
          password: studentPassword,
          role: "STUDENT",
          roleTitle: "Student Applicant",
          agencyId: req.user?.agencyId,
          phone: req.body.phone,
          avatar:
            req.body.avatar ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        });
        await studentUser.save();
      }
    }

    // Resolve assigned counselors - only users with COUNSELOR role can be assigned
    const parsedAssignedCounselors = safeJsonParse(req.body.assignedCounselors);
    let rawCounselorIds: string[] = [];
    if (Array.isArray(parsedAssignedCounselors)) {
      rawCounselorIds = parsedAssignedCounselors.map((c: any) => c?.toString()).filter(Boolean);
    } else if (req.body.assignedCounselorId) {
      rawCounselorIds = [req.body.assignedCounselorId.toString()];
    } else if (req.user?.role === "COUNSELOR") {
      rawCounselorIds = [req.user.userId];
    }

    // Verify all assigned counselors belong to agency and have COUNSELOR role (exclude ADMIN)
    let validCounselorIds: string[] = [];
    if (rawCounselorIds.length > 0) {
      const counselorUsers = await User.find({
        _id: { $in: rawCounselorIds },
        agencyId: req.user?.agencyId,
        role: "COUNSELOR",
      });
      validCounselorIds = counselorUsers.map((u) => u._id.toString());
    }

    const student = new Student({
      ...req.body,
      academicHistory: safeJsonParse(req.body.academicHistory),
      englishProficiency: safeJsonParse(req.body.englishProficiency),
      sponsorDetails: safeJsonParse(req.body.sponsorDetails),
      preferredCountries: safeJsonParse(req.body.preferredCountries),
      agencyId: req.user?.agencyId,
      user: studentUser?._id,
      assignedCounselor: validCounselorIds[0] || undefined,
      assignedCounselors: validCounselorIds,
      isBlocked: false,
      isDeleted: false,
    });

    await student.save();
    const populated: any = await Student.findById(student._id)
      .populate("assignedCounselor", "name email roleTitle avatar")
      .populate("assignedCounselors", "name email roleTitle avatar");

    // Fetch agency details for email branding
    const agency = req.user?.agencyId ? await Agency.findById(req.user.agencyId) : null;
    const agencyName = agency?.name || "AbroadPath Partner Consultancy";
    const counselor = populated?.assignedCounselor;

    // Send onboarding welcome email to student if email is provided
    if (student.email && student.email.includes("@")) {
      console.log(`📧 [Student Created] Dispatching welcome onboarding email to student: ${student.email}`);
      
      emailService
        .sendStudentWelcomeEmail({
          to: student.email.trim(),
          name: student.name,
          agencyName,
          counselorName: counselor?.name,
          counselorEmail: counselor?.email,
          preferredCourse: student.preferredCourse,
          preferredCountries: student.preferredCountries,
          targetDegree: student.targetDegree,
          intake: student.intake,
          loginPassword: studentPassword,
          portalUrl: `${env.clientUrl}/login`,
        })
        .then((result) => {
          if (result.success) {
            console.log(`✅ [Student Welcome Email] Sent successfully to ${student.email} | MessageId: ${result.messageId}`);
          } else {
            console.error(`❌ [Student Welcome Email Error] Failed to send email to ${student.email}:`, result.error);
          }
        })
        .catch((err) => {
          console.error(`💥 [Student Welcome Email Exception] Unexpected error sending to ${student.email}:`, err);
        });
    } else {
      console.warn(`⚠️ [Student Created] No valid email provided for student ${student.name} (ID: ${student._id}). Skipping email.`);
    }

    sendSuccess(res, "Student created successfully", populated, 201);
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetStudentId = req.params.id === "me" ? undefined : req.params.id;

    let existingStudent = null;
    if (req.user?.role === "STUDENT" || req.params.id === "me") {
      existingStudent = await Student.findOne({
        agencyId: req.user?.agencyId,
        isDeleted: { $ne: true },
        $or: [{ user: req.user?.userId }, { email: req.user?.email }],
      });
    } else if (targetStudentId) {
      existingStudent = await Student.findOne({
        _id: targetStudentId,
        agencyId: req.user?.agencyId,
        isDeleted: { $ne: true },
      });
    }

    if (!existingStudent) {
      return next(new AppError("Student not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, existingStudent)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    // Protect email and password from being overridden in normal student edit
    const updateData = { ...req.body };
    delete updateData.email;
    delete updateData.password;
    delete updateData.agencyId;

    if (req.file) {
      updateData.avatar = `/uploads/${req.user?.agencyId || "general"}/${req.file.filename}`;
    }

    if (updateData.academicHistory !== undefined) {
      updateData.academicHistory = safeJsonParse(updateData.academicHistory);
    }
    if (updateData.englishProficiency !== undefined) {
      updateData.englishProficiency = safeJsonParse(updateData.englishProficiency);
    }
    if (updateData.sponsorDetails !== undefined) {
      updateData.sponsorDetails = safeJsonParse(updateData.sponsorDetails);
    }
    if (updateData.preferredCountries !== undefined) {
      updateData.preferredCountries = safeJsonParse(updateData.preferredCountries);
    }
    if (updateData.assignedCounselors !== undefined) {
      updateData.assignedCounselors = safeJsonParse(updateData.assignedCounselors);
    }

    if (req.user?.role === "STUDENT") {
      delete updateData.assignedCounselor;
      delete updateData.assignedCounselors;
      delete updateData.assignedCounselorId;
      delete updateData.isBlocked;
      delete updateData.isDeleted;
    } else {
      if (updateData.assignedCounselors !== undefined || updateData.assignedCounselorId !== undefined) {
        let rawCounselorIds: string[] = [];
        if (Array.isArray(updateData.assignedCounselors)) {
          rawCounselorIds = updateData.assignedCounselors.map((c: any) => c?.toString()).filter(Boolean);
        } else if (updateData.assignedCounselorId) {
          rawCounselorIds = [updateData.assignedCounselorId.toString()];
        }

        let validCounselorIds: string[] = [];
        if (rawCounselorIds.length > 0) {
          const counselorUsers = await User.find({
            _id: { $in: rawCounselorIds },
            agencyId: req.user?.agencyId,
            role: "COUNSELOR",
          });
          validCounselorIds = counselorUsers.map((u) => u._id.toString());
        }

        updateData.assignedCounselors = validCounselorIds;
        updateData.assignedCounselor = validCounselorIds[0] || null;
      }
    }

    const student = await Student.findByIdAndUpdate(existingStudent._id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("assignedCounselor", "name email roleTitle avatar")
      .populate("assignedCounselors", "name email roleTitle avatar");

    // Also synchronize avatar and name to linked User record if exists
    if (student && student.user && (updateData.avatar || updateData.name || updateData.phone)) {
      await User.findByIdAndUpdate(student.user, {
        ...(updateData.avatar && { avatar: updateData.avatar }),
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.phone && { phone: updateData.phone }),
      });
    }

    sendSuccess(res, "Student updated successfully", student);
  } catch (error) {
    next(error);
  }
};

export const blockStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const student = await Student.findOne({ _id: req.params.id, agencyId: req.user?.agencyId });

    if (!student) {
      return next(new AppError("Student not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    student.isBlocked = true;
    await student.save();

    // Also block user account if exists
    if (student.user) {
      await User.findByIdAndUpdate(student.user, { isBlocked: true });
    }

    sendSuccess(res, "Student account blocked successfully.", student);
  } catch (error) {
    next(error);
  }
};

export const unblockStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const student = await Student.findOne({ _id: req.params.id, agencyId: req.user?.agencyId });

    if (!student) {
      return next(new AppError("Student not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    student.isBlocked = false;
    await student.save();

    // Also unblock user account if exists
    if (student.user) {
      await User.findByIdAndUpdate(student.user, { isBlocked: false });
    }

    sendSuccess(res, "Student account unblocked successfully.", student);
  } catch (error) {
    next(error);
  }
};

export const deleteStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const student = await Student.findOne({ _id: req.params.id, agencyId: req.user?.agencyId });

    if (!student) {
      return next(new AppError("Student not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    student.isDeleted = true;
    student.isBlocked = true;
    await student.save();

    // Deactivate / delete user credentials to prevent future login
    if (student.user) {
      await User.findByIdAndUpdate(student.user, { isActive: false, isBlocked: true });
    }

    sendSuccess(res, "Student deleted successfully.");
  } catch (error) {
    next(error);
  }
};
