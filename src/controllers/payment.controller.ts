import { Request, Response, NextFunction } from "express";
import { Payment } from "../models/Payment";
import { Student } from "../models/Student";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";

export const getPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, type, studentId, search } = req.query;

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

    if (type && type !== "All") {
      filter.type = type;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [{ invoiceNumber: searchRegex }, { studentName: searchRegex }, { type: searchRegex }];
    }

    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    sendSuccess(res, "Payments retrieved", payments);
  } catch (error) {
    next(error);
  }
};

export const getMyPayments = async (
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

    const payments = await Payment.find({
      agencyId: req.user?.agencyId,
      student: student._id,
    }).sort({ createdAt: -1 });

    sendSuccess(res, "My payments", payments);
  } catch (error) {
    next(error);
  }
};

export const createPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { studentId, type, amount, currency, dueDate, status, paymentMethod, transactionRef } =
      req.body;

    const student = await Student.findOne({ _id: studentId, agencyId: req.user?.agencyId });
    if (!student) {
      return next(new AppError("Student not found.", 404));
    }

    if (!canUserAccessStudentPrivateData(req.user, student)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    const payment = new Payment({
      agencyId: req.user?.agencyId,
      student: student._id,
      studentName: student.name,
      type: type || "Consultancy Fee",
      amount,
      currency: currency || "USD",
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: status || "Due",
      paymentMethod,
      transactionRef,
      paidDate: status === "Paid" ? new Date().toISOString().split("T")[0] : undefined,
    });

    await payment.save();
    sendSuccess(res, "Payment invoice created successfully", payment, 201);
  } catch (error) {
    next(error);
  }
};

export const updatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingPayment = await Payment.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingPayment) {
      return next(new AppError("Payment record not found.", 404));
    }

    if (existingPayment.student) {
      const student = await Student.findById(existingPayment.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const { status, paidDate, paymentMethod, transactionRef, type, amount, dueDate, currency } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      existingPayment._id,
      {
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(transactionRef && { transactionRef }),
        ...(type && { type }),
        ...(amount !== undefined && { amount }),
        ...(dueDate && { dueDate }),
        ...(currency && { currency }),
        paidDate: status === "Paid" ? paidDate || new Date().toISOString().split("T")[0] : undefined,
      },
      { new: true, runValidators: true }
    );

    sendSuccess(res, "Payment updated successfully", payment);
  } catch (error) {
    next(error);
  }
};

export const deletePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingPayment = await Payment.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingPayment) {
      return next(new AppError("Payment not found.", 404));
    }

    if (existingPayment.student) {
      const student = await Student.findById(existingPayment.student);
      if (!canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    await Payment.findByIdAndDelete(existingPayment._id);

    sendSuccess(res, "Payment deleted successfully.");
  } catch (error) {
    next(error);
  }
};
