import { Request, Response, NextFunction } from "express";
import { Appointment } from "../models/Appointment";
import { Student } from "../models/Student";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";
import { notificationService } from "../services/notification.service";

export const getAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, type, studentId, date } = req.query;

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

    if (status && status !== "All") {
      filter.status = status;
    }

    if (type && type !== "All") {
      filter.type = type;
    }

    if (date) {
      filter.date = date;
    }

    const appointments = await Appointment.find(filter).sort({ date: 1, time: 1 });
    sendSuccess(res, "Appointments retrieved", appointments);
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, studentId, studentName, counselorName, date, time, duration, type, location, notes } =
      req.body;

    let targetStudentName = studentName;
    let targetAvatar: string | undefined;

    if (studentId) {
      const student = await Student.findOne({ _id: studentId, agencyId: req.user?.agencyId });
      if (student) {
        if (!canUserAccessStudentPrivateData(req.user, student)) {
          return next(new AppError("Access denied. You are not assigned to this student.", 403));
        }
        targetStudentName = student.name;
        targetAvatar = student.avatar;
      }
    }

    const appointment = new Appointment({
      agencyId: req.user?.agencyId,
      title: title || `${type || "Counselling"} Session`,
      student: studentId,
      studentName: targetStudentName || "Student Applicant",
      studentAvatar: targetAvatar,
      counselorName: counselorName || req.user?.name || "Senior Counselor",
      counselor: req.user?.userId,
      date,
      time,
      duration: duration || "45 mins",
      type: type || "Counselling",
      location: location || "Zoom Video Call",
      status: "Scheduled",
      notes,
    });

    await appointment.save();

    // Notify student about appointment
    if (studentId && req.user?.agencyId) {
      notificationService.sendToStudent(studentId, req.user.agencyId, {
        title: "Consultation Session Scheduled",
        message: `Your ${appointment.type} appointment with ${appointment.counselorName} is confirmed for ${appointment.date} at ${appointment.time}.`,
        type: "appointment",
        link: "/student/profile",
      }).catch((e) => console.error("Error sending appointment notification:", e));
    }

    sendSuccess(res, "Appointment scheduled successfully", appointment, 201);
  } catch (error) {
    next(error);
  }
};

export const updateAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingApp = await Appointment.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingApp) {
      return next(new AppError("Appointment not found.", 404));
    }

    if (existingApp.student) {
      const student = await Student.findById(existingApp.student);
      if (!canUserAccessStudentPrivateData(req.user, student) && existingApp.counselor?.toString() !== req.user?.userId) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const appointment = await Appointment.findByIdAndUpdate(
      existingApp._id,
      req.body,
      { new: true, runValidators: true }
    );

    // Notify student about update
    if (existingApp.student && appointment && req.user?.agencyId) {
      notificationService.sendToStudent(existingApp.student, req.user.agencyId, {
        title: `Appointment Update: ${appointment.status}`,
        message: `Your appointment for ${appointment.date} at ${appointment.time} has been updated (${appointment.status}).`,
        type: "appointment",
        link: "/student/profile",
      }).catch((e) => console.error("Error sending appointment update notification:", e));
    }

    sendSuccess(res, "Appointment updated successfully", appointment);
  } catch (error) {
    next(error);
  }
};

export const deleteAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existingApp = await Appointment.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!existingApp) {
      return next(new AppError("Appointment not found.", 404));
    }

    if (existingApp.student) {
      const student = await Student.findById(existingApp.student);
      if (!canUserAccessStudentPrivateData(req.user, student) && existingApp.counselor?.toString() !== req.user?.userId) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    await Appointment.findByIdAndDelete(existingApp._id);

    sendSuccess(res, "Appointment cancelled/deleted successfully.");
  } catch (error) {
    next(error);
  }
};
