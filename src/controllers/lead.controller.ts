import { Request, Response, NextFunction } from "express";
import { Lead } from "../models/Lead";
import { Student } from "../models/Student";
import { Agency } from "../models/Agency";
import { User } from "../models/User";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { emailService } from "../services/email.service";
import { env } from "../config/env";

export const getLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, country, search, counselorId, studyLevel } = req.query;

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (status && status !== "All") {
      filter.status = status;
    }

    if (country && country !== "All") {
      filter.countryInterest = country;
    }

    if (studyLevel && studyLevel !== "All") {
      filter.studyLevel = studyLevel;
    }

    if (counselorId) {
      filter.assignedCounselor = counselorId;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { preferredCourse: searchRegex },
      ];
    }

    const leads = await Lead.find(filter)
      .populate("assignedCounselor", "name email roleTitle avatar")
      .sort({ createdAt: -1 });

    sendSuccess(res, "Leads retrieved successfully", leads);
  } catch (error) {
    next(error);
  }
};

export const getLeadById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    }).populate("assignedCounselor", "name email roleTitle avatar");

    if (!lead) {
      return next(new AppError("Lead not found.", 404));
    }

    sendSuccess(res, "Lead details", lead);
  } catch (error) {
    next(error);
  }
};

export const createLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      studyLevel,
      countryInterest,
      preferredCourse,
      intake,
      assignedCounselorId,
      leadSource,
      gpa,
      ieltsScore,
      notes,
    } = req.body;

    const lead = new Lead({
      agencyId: req.user?.agencyId,
      name,
      email,
      phone,
      studyLevel: studyLevel || "Master's",
      countryInterest: Array.isArray(countryInterest)
        ? countryInterest
        : [countryInterest || "United Kingdom"],
      preferredCourse: preferredCourse || "General Engineering / Business",
      intake: intake || "September 2027",
      assignedCounselor: assignedCounselorId || req.user?.userId,
      leadSource: leadSource || "Website Form",
      gpa: gpa || "3.5 / 4.0",
      ieltsScore: ieltsScore || "6.5",
      notes: notes
        ? [
            {
              id: `note-${Date.now()}`,
              author: req.user?.name || "Counselor",
              date: new Date().toISOString().replace("T", " ").substring(0, 16),
              text: notes,
            },
          ]
        : [],
      timeline: [
        {
          id: `tl-${Date.now()}`,
          title: "Lead Created",
          description: `Direct entry via ${leadSource || "Website Form"}`,
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          type: "status_change",
        },
      ],
    });

    await lead.save();
    const populated = await Lead.findById(lead._id).populate(
      "assignedCounselor",
      "name email roleTitle avatar"
    );

    sendSuccess(res, "Lead created successfully", populated, 201);
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      req.body,
      { new: true, runValidators: true }
    ).populate("assignedCounselor", "name email roleTitle avatar");

    if (!lead) {
      return next(new AppError("Lead not found.", 404));
    }

    sendSuccess(res, "Lead updated successfully", lead);
  } catch (error) {
    next(error);
  }
};

export const convertLeadToStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!lead) {
      return next(new AppError("Lead not found.", 404));
    }

    const studentPassword = "StudentPass123!";
    let studentUser = null;

    if (lead.email) {
      studentUser = await User.findOne({ email: lead.email.toLowerCase() });
      if (!studentUser) {
        studentUser = new User({
          name: lead.name,
          email: lead.email.toLowerCase(),
          password: studentPassword,
          role: "STUDENT",
          roleTitle: "Student Applicant",
          agencyId: req.user?.agencyId,
          phone: lead.phone,
          avatar:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        });
        await studentUser.save();
      }
    }

    const student = new Student({
      agencyId: req.user?.agencyId,
      user: studentUser?._id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      targetDegree: lead.studyLevel !== "Foundation" ? lead.studyLevel : "Bachelor's",
      preferredCountries: lead.countryInterest,
      preferredCourse: lead.preferredCourse,
      intake: lead.intake,
      assignedCounselor: lead.assignedCounselor,
      currentStage: "Counselling",
      journeyProgress: 25,
      academicHistory: [
        {
          degree: lead.studyLevel === "Master's" ? "Bachelor of Science" : "Higher Secondary Certificate",
          institution: "Previous Academic Institution",
          passingYear: 2025,
          gpa: lead.gpa || "3.5 / 4.0",
          country: "International",
        },
      ],
      englishProficiency: {
        testType: "IELTS",
        overallScore: lead.ieltsScore || "6.5",
        testDate: "2026-05-15",
      },
    });

    await student.save();

    lead.status = "Converted";
    lead.timeline.push({
      id: `tl-${Date.now()}`,
      title: "Converted to Active Student",
      description: `Lead profile converted to student record ID: ${student._id}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      type: "status_change",
    });
    await lead.save();

    // Fetch agency details for email branding
    const agency = req.user?.agencyId ? await Agency.findById(req.user.agencyId) : null;
    const agencyName = agency?.name || "AbroadPath Partner Consultancy";

    // Send onboarding welcome email to converted student if email is provided
    if (student.email && student.email.includes("@")) {
      console.log(`📧 [Lead Converted] Dispatching welcome onboarding email to student: ${student.email}`);
      
      emailService
        .sendStudentWelcomeEmail({
          to: student.email.trim(),
          name: student.name,
          agencyName,
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
    }

    sendSuccess(res, "Lead converted to student successfully", {
      lead,
      student,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findOneAndDelete({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!lead) {
      return next(new AppError("Lead not found.", 404));
    }

    sendSuccess(res, "Lead deleted successfully.");
  } catch (error) {
    next(error);
  }
};
