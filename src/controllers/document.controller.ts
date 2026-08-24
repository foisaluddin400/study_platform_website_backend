import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { DocumentModel } from "../models/Document";
import { Student } from "../models/Student";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";
import { notificationService } from "../services/notification.service";

export const getDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, status, studentId, search } = req.query;

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

    if (category && category !== "All") {
      filter.category = category;
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [{ name: searchRegex }, { studentName: searchRegex }, { fileName: searchRegex }];
    }

    const documents = await DocumentModel.find(filter)
      .populate("student", "name email avatar")
      .sort({ createdAt: -1 });

    sendSuccess(res, "Documents retrieved", documents);
  } catch (error) {
    next(error);
  }
};

export const getMyDocuments = async (
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

    const documents = await DocumentModel.find({
      agencyId: req.user?.agencyId,
      student: student._id,
    }).sort({ createdAt: -1 });

    sendSuccess(res, "My documents", documents);
  } catch (error) {
    next(error);
  }
};

export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      return next(new AppError("Please select a file to upload.", 400));
    }

    const { name, category, studentId, requiredForCountry } = req.body;

    let targetStudentId = studentId;
    let targetStudentName = req.body.studentName || "Student";

    if (req.user?.role === "STUDENT") {
      const student = await Student.findOne({
        agencyId: req.user.agencyId,
        $or: [{ user: req.user.userId }, { email: req.user.email }],
      });
      if (student) {
        targetStudentId = student._id.toString();
        targetStudentName = student.name;
      }
    } else if (targetStudentId) {
      const student = await Student.findOne({
        _id: targetStudentId,
        agencyId: req.user?.agencyId,
      });
      if (student) {
        if (!canUserAccessStudentPrivateData(req.user, student)) {
          return next(new AppError("Access denied. You are not assigned to this student.", 403));
        }
        targetStudentName = student.name;
      } else {
        return next(new AppError("Student not found.", 404));
      }
    }

    const formattedSize =
      req.file.size > 1024 * 1024
        ? `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(req.file.size / 1024)} KB`;

    const newDoc = new DocumentModel({
      agencyId: req.user?.agencyId,
      student: targetStudentId || req.user?.userId,
      studentName: targetStudentName,
      uploadedBy: req.user?.userId,
      name: name || req.file.originalname,
      fileName: req.file.filename,
      storagePath: req.file.path,
      fileUrl: `/api/v1/documents/stream/${req.file.filename}`,
      fileSize: formattedSize,
      fileType: path.extname(req.file.originalname).replace(".", "").toUpperCase(),
      category: category || "Other",
      status: "Under Review",
      requiredForCountry: requiredForCountry ? JSON.parse(requiredForCountry) : ["United Kingdom"],
    });

    await newDoc.save();

    // If uploaded by student, notify counselors and admins
    if (req.user?.role === "STUDENT" && targetStudentId && req.user?.agencyId) {
      notificationService.sendToCounselorsAndAdmins(targetStudentId, req.user.agencyId, {
        title: `New Document: ${newDoc.name}`,
        message: `${targetStudentName} uploaded "${newDoc.name}" for review.`,
        type: "document",
        link: "/dashboard/documents",
      }).catch((e) => console.error("Error sending document upload notification:", e));
    }

    sendSuccess(res, "Document uploaded successfully.", newDoc, 201);
  } catch (error) {
    next(error);
  }
};

export const reviewDocumentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, reviewNotes } = req.body;

    const existingDoc = await DocumentModel.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingDoc) {
      return next(new AppError("Document not found.", 404));
    }

    if (existingDoc.student) {
      const student = await Student.findById(existingDoc.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const doc = await DocumentModel.findByIdAndUpdate(
      existingDoc._id,
      {
        ...(status && { status }),
        reviewNotes: reviewNotes || "",
        reviewer: req.user?.name || "Officer",
      },
      { new: true }
    );

    // Notify student about document verification/revision status
    if (existingDoc.student && status && req.user?.agencyId) {
      notificationService.sendToStudent(existingDoc.student, req.user.agencyId, {
        title: `Document ${status}: ${existingDoc.name}`,
        message: `Your document "${existingDoc.name}" has been marked as ${status}${reviewNotes ? ` (${reviewNotes})` : ""}.`,
        type: "document",
        link: "/student/documents",
      }).catch((e) => console.error("Error sending document status notification:", e));
    }

    sendSuccess(res, `Document status updated to '${doc?.status}'`, doc);
  } catch (error) {
    next(error);
  }
};

export const getDocumentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doc = await DocumentModel.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    }).populate("student", "name email avatar");

    if (!doc) {
      return next(new AppError("Document not found.", 404));
    }

    if (doc.student) {
      const student = await Student.findById(doc.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    sendSuccess(res, "Document details", doc);
  } catch (error) {
    next(error);
  }
};

export const streamDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doc = await DocumentModel.findOne({
      $or: [{ fileName: req.params.filename }, { _id: mongoose.isValidObjectId(req.params.filename) ? req.params.filename : undefined }],
      agencyId: req.user?.agencyId,
    });

    if (!doc) {
      return next(new AppError("Document not found.", 404));
    }

    if (doc.student) {
      const student = await Student.findById(doc.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    if (!fs.existsSync(doc.storagePath)) {
      // If sample seed file doesn't exist on disk, stream a valid fallback PDF response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${doc?.name || "document.pdf"}"`);
      res.send(Buffer.from("%PDF-1.4\n%Demo PDF Document Content\n%%EOF"));
      return;
    }

    const mimeMap: Record<string, string> = {
      PDF: "application/pdf",
      JPG: "image/jpeg",
      JPEG: "image/jpeg",
      PNG: "image/png",
      DOC: "application/msword",
      DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const contentType = mimeMap[doc.fileType?.toUpperCase()] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${doc.name}"`);
    fs.createReadStream(doc.storagePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const downloadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doc = await DocumentModel.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!doc) {
      return next(new AppError("Document record not found.", 404));
    }

    if (doc.student) {
      const student = await Student.findById(doc.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    if (!fs.existsSync(doc.storagePath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${doc.name}"`);
      res.send(Buffer.from("%PDF-1.4\n%Demo PDF Document Content\n%%EOF"));
      return;
    }

    res.download(doc.storagePath, doc.name);
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingDoc = await DocumentModel.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingDoc) {
      return next(new AppError("Document not found.", 404));
    }

    if (existingDoc.student) {
      const student = await Student.findById(existingDoc.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    await DocumentModel.findByIdAndDelete(existingDoc._id);

    if (existingDoc.storagePath && fs.existsSync(existingDoc.storagePath)) {
      try {
        fs.unlinkSync(existingDoc.storagePath);
      } catch (err) {
        console.warn("Could not delete physical file on disk:", err);
      }
    }

    sendSuccess(res, "Document deleted successfully.");
  } catch (error) {
    next(error);
  }
};
