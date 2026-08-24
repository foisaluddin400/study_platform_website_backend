import { Request, Response, NextFunction } from "express";
import { VisaCase } from "../models/VisaCase";
import { Student } from "../models/Student";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";
import { notificationService } from "../services/notification.service";

export const getVisaCases = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, country, studentId, search } = req.query;

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
      filter.student = { $in: assignedStudentIds };
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (country && country !== "All") {
      filter.country = country;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { studentName: searchRegex },
        { institutionName: searchRegex },
        { country: searchRegex },
        { casOrCoeNumber: searchRegex },
      ];
    }

    const visaCases = await VisaCase.find(filter).sort({ updatedAt: -1 });
    sendSuccess(res, "Visa cases retrieved", visaCases);
  } catch (error) {
    next(error);
  }
};

export const getMyVisaCase = async (
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

    const visaCase = await VisaCase.findOne({
      agencyId: req.user?.agencyId,
      student: student._id,
    });

    sendSuccess(res, "My visa case", visaCase);
  } catch (error) {
    next(error);
  }
};

export const getVisaCaseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const visaCase = await VisaCase.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    }).populate("student");

    if (!visaCase) {
      return next(new AppError("Visa case not found.", 404));
    }

    if (visaCase.student) {
      const student = await Student.findById(visaCase.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    sendSuccess(res, "Visa case details", visaCase);
  } catch (error) {
    next(error);
  }
};

export const createVisaCase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      studentId,
      country,
      targetIntake,
      institutionName,
      visaType,
      casOrCoeNumber,
      casNumber,
      biometricsDate,
      submissionDate,
      decisionDate,
      notes,
      counselorName,
      featuredDocuments,
      featured,
    } = req.body;

    const student = await Student.findOne({
      _id: studentId,
      agencyId: req.user?.agencyId,
    });

    if (!student) {
      return next(new AppError("Student not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    const defaultFeaturedDocs: Array<{ id: string; name: string; description?: string; status: "Pending" | "Submitted" | "Approved"; required: boolean }> = [
      { id: "fd-1", name: "Valid International Passport & Bio Page", status: "Submitted", required: true },
      { id: "fd-2", name: "Official CAS / COE / Unconditional Offer Letter", status: "Submitted", required: true },
      { id: "fd-3", name: "28-Day Bank Solvency Statement & Financial Affidavit", status: "Pending", required: true },
      { id: "fd-4", name: "TB Medical Clearance Certificate", status: "Pending", required: true },
      { id: "fd-5", name: "Police Clearance & Academic Attestations", status: "Pending", required: false },
    ];

    const initialFeaturedDocs = (featuredDocuments || featured || []).length > 0
      ? (featuredDocuments || featured).map((d: any, idx: number) => ({
          id: d.id || `fd-${idx + 1}`,
          name: d.name || `Required Document ${idx + 1}`,
          description: d.description || "",
          status: d.status || "Pending",
          required: d.required !== undefined ? Boolean(d.required) : true,
        }))
      : defaultFeaturedDocs;

    const visaCase = new VisaCase({
      agencyId: req.user?.agencyId,
      student: student._id,
      studentName: student.name,
      studentAvatar: student.avatar,
      country: country || student.preferredCountries[0] || "United Kingdom",
      targetIntake: targetIntake || student.intake || "September 2027",
      institutionName: institutionName || "University Partner",
      visaType: visaType || "Student Visa (Subclass 500 / Tier 4 / Study Permit)",
      casOrCoeNumber: casOrCoeNumber || casNumber || `CAS-${Math.floor(100000 + Math.random() * 900000)}`,
      biometricsDate: biometricsDate || "",
      submissionDate: submissionDate || "",
      decisionDate: decisionDate || "",
      counselorName: counselorName || req.user?.name || "Visa Specialist",
      status: "Document Preparation",
      checklist: [
        { id: "v1", item: "Valid International Passport (min 6 months validity)", completed: true, required: true },
        { id: "v2", item: "Unconditional Offer / CAS / COE Statement", completed: true, required: true },
        { id: "v3", item: "28-Day Bank Solvency & Financial Affidavit", completed: false, required: true },
        { id: "v4", item: "TB Medical Clearance & Biometrics Slot", completed: false, required: true },
        { id: "v5", item: "Police Clearance Certificate", completed: false, required: false },
      ],
      featuredDocuments: initialFeaturedDocs,
      timeline: [
        { stage: "Document Audit", date: new Date().toISOString().split("T")[0], status: "done", notes: "Initial financial and identity papers verified." },
        { stage: "Visa Application Submission", date: "Pending", status: "current", notes: "Ready once bank statement matures." },
        { stage: "Biometrics Appointment", date: "Pending", status: "upcoming" },
        { stage: "Embassy Decision", date: "Pending", status: "upcoming" },
      ],
      notes: notes || "Student has £28k in designated sponsor account.",
    });

    await visaCase.save();

    student.currentStage = "Visa";
    student.visaStatus = "Document Preparation";
    student.journeyProgress = Math.max(student.journeyProgress, 85);
    await student.save();

    // Notify student about visa case initialization
    if (req.user?.agencyId) {
      notificationService.sendToStudent(student._id, req.user.agencyId, {
        title: `Visa Case Opened: ${visaCase.country}`,
        message: `Your visa compliance file has been opened for ${visaCase.country} (${visaCase.institutionName}).`,
        type: "visa",
        link: "/student/visa",
      }).catch((e) => console.error("Error sending visa creation notification:", e));
    }

    sendSuccess(res, "Visa case created successfully", visaCase, 201);
  } catch (error) {
    next(error);
  }
};

export const updateVisaCase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingCase = await VisaCase.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingCase) {
      return next(new AppError("Visa case not found.", 404));
    }

    if (existingCase.student) {
      const student = await Student.findById(existingCase.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const updates: Record<string, any> = { ...req.body };
    if (req.body.casNumber && !req.body.casOrCoeNumber) {
      updates.casOrCoeNumber = req.body.casNumber;
    }

    // Handle featured documents formatting and status synchronization
    let docs = req.body.featuredDocuments || req.body.featured || existingCase.featuredDocuments || [];
    if (Array.isArray(docs)) {
      docs = docs.map((d: any, idx: number) => ({
        id: d.id || `fd-${idx + 1}`,
        name: d.name || `Required Document ${idx + 1}`,
        description: d.description || "",
        status: d.status || "Pending",
        required: d.required !== undefined ? Boolean(d.required) : true,
      }));
    }

    // Synchronize document statuses with overall Visa File Status if status changed
    const targetStatus = req.body.status || existingCase.status;
    if (targetStatus === "Submitted" || targetStatus === "Biometrics" || targetStatus === "Under Review") {
      // If submitted to embassy, advance any pending documents to submitted unless explicitly approved
      docs = docs.map((d: any) => {
        if (d.status === "Pending") {
          return { ...d, status: "Submitted" };
        }
        return d;
      });
    } else if (targetStatus === "Approved") {
      // If visa is approved, mark all checklist featured documents as approved
      docs = docs.map((d: any) => ({ ...d, status: "Approved" }));
    }

    updates.featuredDocuments = docs;

    const visaCase = await VisaCase.findByIdAndUpdate(
      existingCase._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (req.body.status && visaCase) {
      await Student.findOneAndUpdate(
        { _id: visaCase.student, agencyId: req.user?.agencyId },
        { visaStatus: req.body.status }
      );
    }

    // Notify student about visa case update / status change
    if (existingCase.student && visaCase && req.user?.agencyId) {
      notificationService.sendToStudent(existingCase.student, req.user.agencyId, {
        title: `Visa Update: ${visaCase.status}`,
        message: `Your ${visaCase.country} visa case has been updated. Status: ${visaCase.status}.`,
        type: "visa",
        link: "/student/visa",
      }).catch((e) => console.error("Error sending visa update notification:", e));
    }

    sendSuccess(res, "Visa case updated successfully", visaCase);
  } catch (error) {
    next(error);
  }
};

export const deleteVisaCase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingCase = await VisaCase.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingCase) {
      return next(new AppError("Visa case not found.", 404));
    }

    if (existingCase.student) {
      const student = await Student.findById(existingCase.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    await VisaCase.findByIdAndDelete(existingCase._id);

    sendSuccess(res, "Visa case deleted successfully.");
  } catch (error) {
    next(error);
  }
};
