import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Offer, IOfferCondition } from "../models/Offer";
import { Student } from "../models/Student";
import { Application } from "../models/Application";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";
import { notificationService } from "../services/notification.service";

export const getOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { offerType, acceptanceStatus, studentId, search } = req.query;

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

    if (offerType && offerType !== "All") {
      filter.offerType = offerType;
    }

    if (acceptanceStatus && acceptanceStatus !== "All") {
      filter.acceptanceStatus = acceptanceStatus;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { studentName: searchRegex },
        { universityName: searchRegex },
        { courseName: searchRegex },
      ];
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 });
    sendSuccess(res, "Offers retrieved", offers);
  } catch (error) {
    next(error);
  }
};

export const getMyOffers = async (
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

    const offers = await Offer.find({
      agencyId: req.user?.agencyId,
      student: student._id,
    }).sort({ createdAt: -1 });

    sendSuccess(res, "My offers", offers);
  } catch (error) {
    next(error);
  }
};

export const getOfferById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await Offer.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!offer) {
      return next(new AppError("Offer not found.", 404));
    }

    if (offer.student) {
      const student = await Student.findById(offer.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    sendSuccess(res, "Offer details", offer);
  } catch (error) {
    next(error);
  }
};

const parseConditionsInput = (conditionsInput: any): IOfferCondition[] => {
  if (!conditionsInput) {
    return [
      { id: "c1", text: "Submit final official academic transcript", fulfilled: false },
      { id: "c2", text: "Provide IELTS certificate (min 6.5 overall)", fulfilled: true },
    ];
  }

  if (Array.isArray(conditionsInput)) {
    return conditionsInput.map((c, idx) => {
      if (typeof c === "string") {
        return { id: `c-${idx + 1}`, text: c, fulfilled: false };
      }
      return {
        id: c.id || `c-${idx + 1}`,
        text: c.text || "",
        fulfilled: Boolean(c.fulfilled),
      };
    });
  }

  if (typeof conditionsInput === "string") {
    try {
      const parsed = JSON.parse(conditionsInput);
      if (Array.isArray(parsed)) {
        return parseConditionsInput(parsed);
      }
    } catch {
      // plain text conditions summary
    }

    const lines = conditionsInput
      .split(/\r?\n|;/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      return lines.map((text, idx) => ({
        id: `c-${idx + 1}`,
        text,
        fulfilled: false,
      }));
    }
  }

  return [
    { id: "c1", text: "Submit final official academic transcript", fulfilled: false },
  ];
};

export const createOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      applicationId,
      offerType,
      type,
      deadline,
      conditionsDeadline,
      depositDeadline,
      tuitionFee,
      depositAmount,
      conditions,
      conditionsSummary,
      offerLetterUrl,
    } = req.body;

    const application = await Application.findOne({
      _id: applicationId,
      agencyId: req.user?.agencyId,
    });

    if (!application) {
      return next(new AppError("Application not found.", 404));
    }

    const student = await Student.findOne({
      _id: application.student,
      agencyId: req.user?.agencyId,
    });

    if (student && !canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    const resolvedOfferType = (offerType || type || "Conditional") === "Unconditional" ? "Unconditional" : "Conditional";
    const resolvedDeadline = deadline || conditionsDeadline || depositDeadline || "2027-10-15";
    const resolvedTuition = tuitionFee !== undefined ? Number(tuitionFee) : 25000;
    const resolvedDeposit = depositAmount !== undefined ? Number(depositAmount) : 2000;
    const parsedConditions = parseConditionsInput(conditions || conditionsSummary);

    let savedLetterUrl = offerLetterUrl || "";
    let offerLetterFileName: string | undefined;
    let offerLetterStoragePath: string | undefined;
    let offerLetterMimeType: string | undefined;
    let offerLetterSize: string | undefined;

    if (req.file) {
      offerLetterFileName = req.file.filename;
      offerLetterStoragePath = req.file.path;
      offerLetterMimeType = req.file.mimetype;
      offerLetterSize = `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`;
      savedLetterUrl = `/api/v1/offers/stream/${req.file.filename}`;
    }

    if (!savedLetterUrl) {
      savedLetterUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    }

    const offer = new Offer({
      agencyId: req.user?.agencyId,
      application: application._id,
      student: application.student,
      studentName: application.studentName,
      studentAvatar: application.studentAvatar,
      universityName: application.universityName,
      universityLogo: application.universityLogo,
      courseName: application.courseName,
      country: application.country,
      intake: application.intake,
      offerType: resolvedOfferType,
      offerDate: new Date().toISOString().split("T")[0],
      deadline: resolvedDeadline,
      tuitionFee: resolvedTuition,
      currency: application.currency || "GBP",
      depositAmount: resolvedDeposit,
      depositPaid: false,
      conditions: parsedConditions,
      acceptanceStatus: "Pending",
      offerLetterUrl: savedLetterUrl,
      offerLetterFileName,
      offerLetterStoragePath,
      offerLetterMimeType,
      offerLetterSize,
    });

    await offer.save();

    application.status = resolvedOfferType === "Unconditional" ? "Unconditional Offer" : "Conditional Offer";
    await application.save();

    if (student) {
      student.currentStage = "Offer";
      student.journeyProgress = Math.max(student.journeyProgress, 70);
      await student.save();
    }

    // Send real-time notification to student
    if (req.user?.agencyId) {
      notificationService.sendToStudent(application.student, req.user.agencyId, {
        title: `New Admission Offer: ${offer.universityName}`,
        message: `You have received an official ${offer.offerType || "admission"} offer for ${offer.courseName}.`,
        type: "offer",
        link: "/student/offers",
      }).catch((e) => console.error("Error sending offer notification:", e));
    }

    sendSuccess(res, "Offer created successfully", offer, 201);
  } catch (error) {
    next(error);
  }
};

export const respondToOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body; // "Accepted" | "Declined"

    if (!["Accepted", "Declined"].includes(status)) {
      return next(new AppError("Status must be either 'Accepted' or 'Declined'.", 400));
    }

    const existingOffer = await Offer.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingOffer) {
      return next(new AppError("Offer not found.", 404));
    }

    if (existingOffer.student) {
      const student = await Student.findById(existingOffer.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const offer = await Offer.findByIdAndUpdate(
      existingOffer._id,
      { acceptanceStatus: status },
      { new: true }
    );

    // Send real-time notification to counselors and admins
    if (existingOffer.student && req.user?.agencyId) {
      notificationService.sendToCounselorsAndAdmins(existingOffer.student, req.user.agencyId, {
        title: `Offer ${status}: ${existingOffer.studentName}`,
        message: `${existingOffer.studentName} has ${status.toLowerCase()} the admission offer from ${existingOffer.universityName}.`,
        type: "offer",
        link: "/dashboard/offers",
      }).catch((e) => console.error("Error sending offer response notification:", e));
    }

    sendSuccess(res, `Offer ${status.toLowerCase()} successfully`, offer);
  } catch (error) {
    next(error);
  }
};

export const updateOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingOffer = await Offer.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingOffer) {
      return next(new AppError("Offer not found.", 404));
    }

    if (existingOffer.student) {
      const student = await Student.findById(existingOffer.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const updates: Record<string, any> = {};

    // 1. Offer Type
    if (req.body.offerType || req.body.type) {
      const t = req.body.offerType || req.body.type;
      updates.offerType = t === "Unconditional" ? "Unconditional" : "Conditional";
    }

    // 2. Deadline
    if (req.body.deadline || req.body.conditionsDeadline || req.body.depositDeadline) {
      updates.deadline = req.body.deadline || req.body.conditionsDeadline || req.body.depositDeadline;
    }

    // 3. Tuition Fee & Deposit
    if (req.body.tuitionFee !== undefined) {
      updates.tuitionFee = Number(req.body.tuitionFee);
    }
    if (req.body.depositAmount !== undefined) {
      updates.depositAmount = Number(req.body.depositAmount);
    }
    if (req.body.depositPaid !== undefined) {
      updates.depositPaid = Boolean(req.body.depositPaid);
    }
    if (req.body.currency) {
      updates.currency = req.body.currency;
    }

    // 4. Acceptance Status
    if (req.body.acceptanceStatus) {
      updates.acceptanceStatus = req.body.acceptanceStatus;
    }

    // 5. Conditions
    if (req.body.conditions !== undefined || req.body.conditionsSummary !== undefined) {
      updates.conditions = parseConditionsInput(req.body.conditions || req.body.conditionsSummary);
    }

    // 6. Offer Letter File replacement
    if (req.file) {
      updates.offerLetterFileName = req.file.filename;
      updates.offerLetterStoragePath = req.file.path;
      updates.offerLetterMimeType = req.file.mimetype;
      updates.offerLetterSize = `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`;
      updates.offerLetterUrl = `/api/v1/offers/stream/${req.file.filename}`;
    } else if (req.body.offerLetterUrl) {
      updates.offerLetterUrl = req.body.offerLetterUrl;
    }

    const offer = await Offer.findByIdAndUpdate(
      existingOffer._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Send real-time notification to student
    if (existingOffer.student && req.user?.agencyId) {
      notificationService.sendToStudent(existingOffer.student, req.user.agencyId, {
        title: `Offer Updated: ${existingOffer.universityName}`,
        message: `Your admission offer details for ${existingOffer.courseName} have been updated.`,
        type: "offer",
        link: "/student/offers",
      }).catch((e) => console.error("Error sending offer update notification:", e));
    }

    sendSuccess(res, "Offer updated successfully", offer);
  } catch (error) {
    next(error);
  }
};

export const streamOfferLetter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filename = req.params.filename;
    const isId = mongoose.isValidObjectId(filename);

    const offer = await Offer.findOne({
      $or: [
        { offerLetterFileName: filename },
        ...(isId ? [{ _id: filename }] : []),
      ],
      agencyId: req.user?.agencyId,
    });

    if (!offer) {
      return next(new AppError("Offer letter not found.", 404));
    }

    if (offer.student) {
      const student = await Student.findById(offer.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    if (offer.offerLetterStoragePath && fs.existsSync(offer.offerLetterStoragePath)) {
      const mime = offer.offerLetterMimeType || "application/pdf";
      res.setHeader("Content-Type", mime);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${offer.offerLetterFileName || "Offer_Letter.pdf"}"`
      );
      fs.createReadStream(offer.offerLetterStoragePath).pipe(res);
      return;
    }

    // Valid fallback demo PDF if not on local disk
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${offer.universityName}_Offer_Letter.pdf"`);
    res.send(
      Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 18 Tf 50 700 Td (${offer.universityName} - ${offer.offerType} Offer) Tj 0 -30 Td (${offer.studentName} - ${offer.courseName}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF`
      )
    );
  } catch (error) {
    next(error);
  }
};

export const downloadOfferLetter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const offer = await Offer.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!offer) {
      return next(new AppError("Offer letter not found.", 404));
    }

    if (offer.student) {
      const student = await Student.findById(offer.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    if (offer.offerLetterStoragePath && fs.existsSync(offer.offerLetterStoragePath)) {
      const cleanFileName = offer.offerLetterFileName || `${offer.universityName}_Offer_Letter.pdf`;
      return res.download(offer.offerLetterStoragePath, cleanFileName);
    }

    // Fallback download
    const downloadName = `${offer.universityName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Offer_Letter.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.send(
      Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 18 Tf 50 700 Td (${offer.universityName} - ${offer.offerType} Offer) Tj 0 -30 Td (${offer.studentName} - ${offer.courseName}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF`
      )
    );
  } catch (error) {
    next(error);
  }
};

export const deleteOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingOffer = await Offer.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingOffer) {
      return next(new AppError("Offer not found.", 404));
    }

    if (existingOffer.student) {
      const student = await Student.findById(existingOffer.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    await Offer.findByIdAndDelete(existingOffer._id);

    sendSuccess(res, "Offer deleted successfully.");
  } catch (error) {
    next(error);
  }
};

