import { Request, Response, NextFunction } from "express";
import { Message } from "../models/Message";
import { Student } from "../models/Student";
import { User } from "../models/User";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/appError";
import { getIO } from "../services/socket.service";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";

export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { studentId } = req.query;

    let targetStudentId = studentId;
    if (req.user?.role === "STUDENT") {
      const student = await Student.findOne({
        agencyId: req.user.agencyId,
        $or: [{ user: req.user.userId }, { email: req.user.email }],
      });
      if (student) {
        targetStudentId = student._id.toString();
      }
    }

    if (targetStudentId) {
      const student = await Student.findOne({
        _id: String(targetStudentId),
        agencyId: req.user?.agencyId,
      });
      if (!student || !canUserAccessStudentPrivateData(req.user, student)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }
    }

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (targetStudentId) {
      filter.student = targetStudentId;
    }

    const messages = await Message.find(filter).sort({ createdAt: 1 });
    sendSuccess(res, "Messages retrieved", messages);
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { text, studentId, attachment } = req.body;

    let targetStudentId = studentId;
    if (req.user?.role === "STUDENT") {
      const student = await Student.findOne({
        agencyId: req.user.agencyId,
        $or: [{ user: req.user.userId }, { email: req.user.email }],
      });
      if (student) {
        targetStudentId = student._id.toString();
      }
    }

    if (!targetStudentId) {
      return next(new AppError("Student ID is required.", 400));
    }

    const targetStudent = await Student.findOne({
      _id: targetStudentId,
      agencyId: req.user?.agencyId,
    });

    if (!targetStudent || !canUserAccessStudentPrivateData(req.user, targetStudent)) {
      return next(new AppError("Access denied. You are not assigned to this student.", 403));
    }

    const senderUser = await User.findById(req.user?.userId);

    const message = new Message({
      agencyId: req.user?.agencyId,
      sender: req.user?.userId,
      senderName: senderUser?.name || req.user?.name || "User",
      senderRole: req.user?.role === "STUDENT" ? "student" : "counselor",
      senderAvatar:
        senderUser?.avatar ||
        (req.user?.role === "STUDENT"
          ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
          : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"),
      student: targetStudentId,
      text: text || req.body.message || (attachment ? `Sent attachment: ${attachment.name}` : ""),
      attachment,
    });

    await message.save();

    // Broadcast over Socket.IO if connected
    const io = getIO();
    if (io && targetStudentId) {
      io.to(`student_chat_${targetStudentId}`).emit("new_message", message);
      io.to(`student_chat_${targetStudentId}`).emit("receive_message", message);
    }

    sendSuccess(res, "Message sent successfully", message, 201);
  } catch (error) {
    next(error);
  }
};

export const markMessagesSeen = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { studentId } = req.body;
    let targetStudentId = studentId;
    if (req.user?.role === "STUDENT") {
      const student = await Student.findOne({
        agencyId: req.user.agencyId,
        $or: [{ user: req.user.userId }, { email: req.user.email }],
      });
      if (student) {
        targetStudentId = student._id.toString();
      }
    }

    if (targetStudentId) {
      const targetStudent = await Student.findOne({
        _id: targetStudentId,
        agencyId: req.user?.agencyId,
      });

      if (!targetStudent || !canUserAccessStudentPrivateData(req.user, targetStudent)) {
        return next(new AppError("Access denied. You are not assigned to this student.", 403));
      }

      await Message.updateMany(
        {
          agencyId: req.user?.agencyId,
          student: targetStudentId,
          read: false,
          sender: { $ne: req.user?.userId },
        },
        { $set: { read: true } }
      );

      const io = getIO();
      if (io) {
        io.to(`student_chat_${targetStudentId}`).emit("messages_seen", {
          studentId: targetStudentId,
          readerId: req.user?.userId,
        });
      }
    }

    sendSuccess(res, "Messages marked as read");
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const msg = await Message.findOne({ _id: id, agencyId: req.user?.agencyId });
    if (!msg) {
      return next(new AppError("Message not found", 404));
    }

    if (
      msg.sender.toString() !== req.user?.userId &&
      req.user?.role !== "AGENCY_ADMIN" &&
      req.user?.role !== "PLATFORM_SUPER_ADMIN"
    ) {
      return next(new AppError("Unauthorized to delete this message", 403));
    }

    msg.isDeleted = true;
    msg.text = "This message was deleted.";
    msg.attachment = undefined;
    await msg.save();

    const io = getIO();
    if (io) {
      const room = `student_chat_${msg.student?.toString()}`;
      io.to(room).emit("message_deleted", {
        messageId: msg._id.toString(),
        studentId: msg.student?.toString(),
      });
    }

    sendSuccess(res, "Message deleted successfully", msg);
  } catch (error) {
    next(error);
  }
};

export const getChatConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
      isDeleted: { $ne: true },
    };

    if (req.user?.role === "COUNSELOR") {
      filter.$or = [
        { assignedCounselor: req.user.userId },
        { assignedCounselors: req.user.userId },
      ];
    }

    const students = await Student.find(filter)
      .populate("assignedCounselor", "name email roleTitle avatar")
      .sort({ updatedAt: -1 });

    const conversations = await Promise.all(
      students.map(async (st) => {
        const lastMsg = await Message.findOne({
          agencyId: req.user?.agencyId,
          student: st._id,
        }).sort({ createdAt: -1 });

        const unreadCount = await Message.countDocuments({
          agencyId: req.user?.agencyId,
          student: st._id,
          read: false,
          sender: { $ne: req.user?.userId },
        });

        const targetCountry =
          st.preferredCountries && st.preferredCountries.length > 0
            ? st.preferredCountries[0]
            : "Global";

        return {
          id: st._id.toString(),
          studentId: st._id.toString(),
          name: st.name,
          studentName: st.name,
          email: st.email,
          avatar:
            st.avatar ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          studentAvatar:
            st.avatar ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          preferredCourse: st.preferredCourse,
          targetDegree: st.targetDegree || "Degree Applicant",
          targetCountry: targetCountry,
          preferredCountries: st.preferredCountries,
          assignedCounselor: st.assignedCounselor,
          assignedCounselors: st.assignedCounselors,
          lastMessage: lastMsg
            ? lastMsg.isDeleted
              ? "This message was deleted."
              : lastMsg.text
            : "No messages yet",
          lastMessageTime: lastMsg
            ? lastMsg.createdAt
              ? lastMsg.createdAt.toISOString()
              : lastMsg.timestamp
            : "",
          unreadCount,
        };
      })
    );

    sendSuccess(res, "Chat conversations list", conversations);
  } catch (error) {
    next(error);
  }
};

