import mongoose from "mongoose";
import { Notification, INotification } from "../models/Notification";
import { Student } from "../models/Student";
import { User } from "../models/User";
import { emitNotificationToUser } from "./socket.service";

export interface CreateNotificationParams {
  agencyId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "offer" | "document" | "visa" | "task" | "appointment" | "payment" | "general" | "lead";
  link?: string;
}

export const notificationService = {
  /**
   * Send a targeted notification to a single user
   */
  sendToUser: async (params: CreateNotificationParams): Promise<INotification> => {
    const notif = new Notification({
      agencyId: params.agencyId,
      user: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
      isRead: false,
    });
    await notif.save();

    // Emit real-time socket event to the user's private socket room
    await emitNotificationToUser(params.userId.toString(), notif.toJSON());
    return notif;
  },

  /**
   * Send a notification to a student by their student record ID
   */
  sendToStudent: async (
    studentId: string | mongoose.Types.ObjectId,
    agencyId: string | mongoose.Types.ObjectId,
    payload: {
      title: string;
      message: string;
      type: "offer" | "document" | "visa" | "task" | "appointment" | "payment" | "general" | "lead";
      link?: string;
    }
  ): Promise<INotification | null> => {
    try {
      const student = await Student.findOne({ _id: studentId, agencyId });
      if (!student) return null;

      let targetUserId: string | undefined = student.user?.toString();
      if (!targetUserId && student.email) {
        const studentUser = await User.findOne({ agencyId, email: student.email, role: "STUDENT" });
        if (studentUser) {
          targetUserId = studentUser._id.toString();
        }
      }

      if (!targetUserId) return null;

      return await notificationService.sendToUser({
        agencyId,
        userId: targetUserId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        link: payload.link,
      });
    } catch (err) {
      console.error("Failed to send notification to student:", err);
      return null;
    }
  },

  /**
   * Send a notification to assigned counselors and agency admins for a student
   */
  sendToCounselorsAndAdmins: async (
    studentId: string | mongoose.Types.ObjectId,
    agencyId: string | mongoose.Types.ObjectId,
    payload: {
      title: string;
      message: string;
      type: "offer" | "document" | "visa" | "task" | "appointment" | "payment" | "general" | "lead";
      link?: string;
    }
  ): Promise<void> => {
    try {
      const student = await Student.findOne({ _id: studentId, agencyId });
      const targetUserIds = new Set<string>();

      // Add assigned counselors
      if (student?.assignedCounselor) {
        targetUserIds.add(student.assignedCounselor.toString());
      }
      if (student?.assignedCounselors && Array.isArray(student.assignedCounselors)) {
        student.assignedCounselors.forEach((c) => targetUserIds.add(c.toString()));
      }

      // Add agency admins
      const admins = await User.find({ agencyId, role: "AGENCY_ADMIN" }).select("_id");
      admins.forEach((admin) => targetUserIds.add(admin._id.toString()));

      // Dispatch to each staff user
      for (const userId of Array.from(targetUserIds)) {
        await notificationService.sendToUser({
          agencyId,
          userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          link: payload.link,
        });
      }
    } catch (err) {
      console.error("Failed to send notification to counselors/admins:", err);
    }
  },

  /**
   * Send a notification to staff roles (e.g. all admins and counselors in an agency)
   */
  sendToStaff: async (
    agencyId: string | mongoose.Types.ObjectId,
    payload: {
      title: string;
      message: string;
      type: "offer" | "document" | "visa" | "task" | "appointment" | "payment" | "general" | "lead";
      link?: string;
    }
  ): Promise<void> => {
    try {
      const staffUsers = await User.find({
        agencyId,
        role: { $in: ["AGENCY_ADMIN", "COUNSELOR"] },
      }).select("_id");

      for (const user of staffUsers) {
        await notificationService.sendToUser({
          agencyId,
          userId: user._id.toString(),
          title: payload.title,
          message: payload.message,
          type: payload.type,
          link: payload.link,
        });
      }
    } catch (err) {
      console.error("Failed to send notification to staff:", err);
    }
  },
};
