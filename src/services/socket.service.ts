import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { env } from "../config/env";
import { Message } from "../models/Message";
import { Student } from "../models/Student";
import { User } from "../models/User";
import { emailService } from "./email.service";
import { canUserAccessStudentPrivateData } from "../utils/studentAccess";

let io: Server | null = null;
const onlineUsers = new Map<string, { socketId: string; role: string; agencyId: string; name?: string }>();

// Tracking last email notification timestamp per student for chat (counselor -> student)
const lastChatEmailTimestamps = new Map<string, number>();

export const initSocketServer = (httpServer: HttpServer): Server => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    ...env.corsOrigin.split(",").map((o) => o.trim()),
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(new Error(`Origin '${origin}' not allowed by Socket.IO CORS`));
        }
      },
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (token && token.startsWith("Bearer ")) {
        token = token.slice(7);
      }

      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie.split(";");
        for (const cookie of cookies) {
          const [name, val] = cookie.trim().split("=");
          if (name === "accessToken" || name === "abroadpath_auth_token") {
            token = decodeURIComponent(val);
            break;
          }
        }
      }

      if (!token) {
        return next(new Error("Authentication token required for Socket.IO"));
      }

      const decoded = verifyAccessToken(token);
      (socket as any).user = decoded;
      next();
    } catch (err: any) {
      next(new Error(`Socket authentication failed: ${err.message}`));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const user = (socket as any).user;
    if (!user) return;

    onlineUsers.set(user.userId, {
      socketId: socket.id,
      role: user.role,
      agencyId: user.agencyId,
      name: user.name,
    });

    // Join tenant agency room & personal user room
    if (user.agencyId) {
      socket.join(`agency_${user.agencyId}`);
    }
    socket.join(`user_${user.userId}`);

    // If student, automatically join personal student chat room
    if (user.role === "STUDENT" && user.agencyId) {
      try {
        const studentProfile = await Student.findOne({
          agencyId: user.agencyId,
          $or: [{ user: user.userId }, { email: user.email }],
        });
        if (studentProfile) {
          socket.join(`student_chat_${studentProfile._id.toString()}`);
        }
      } catch (e) {
        // ignore
      }
    }

    // Broadcast online status to agency room
    if (user.agencyId) {
      socket.to(`agency_${user.agencyId}`).emit("user_online_status", {
        userId: user.userId,
        online: true,
      });
    }

    // Event: Join a specific student chat room
    socket.on("join_chat", async (payload: { studentId?: string } = {}) => {
      try {
        let targetStudentId = payload?.studentId;

        if (user.role === "STUDENT") {
          const studentProfile = await Student.findOne({
            agencyId: user.agencyId,
            $or: [{ user: user.userId }, { email: user.email }],
          });
          if (!studentProfile) {
            socket.emit("error", { message: "Student profile not found" });
            return;
          }
          targetStudentId = studentProfile._id.toString();
        } else if (user.role === "COUNSELOR") {
          if (!targetStudentId) {
            socket.emit("error", { message: "studentId is required to join chat" });
            return;
          }
          const studentProfile = await Student.findOne({ _id: targetStudentId, agencyId: user.agencyId });
          if (!studentProfile) {
            socket.emit("error", { message: "Student profile not found in agency" });
            return;
          }
          if (!canUserAccessStudentPrivateData(user, studentProfile)) {
            socket.emit("error", { message: "Access denied. You are not assigned to this student." });
            return;
          }
        } else if (user.role === "AGENCY_ADMIN" || user.role === "PLATFORM_SUPER_ADMIN") {
          if (!targetStudentId) return;
        }

        if (targetStudentId) {
          socket.join(`student_chat_${targetStudentId}`);
          socket.emit("joined_chat", { studentId: targetStudentId });
        }
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // Event: Send chat message
    socket.on(
      "send_message",
      async ({
        studentId,
        text,
        attachment,
      }: {
        studentId?: string;
        text?: string;
        attachment?: { name: string; size: string; type: string; fileUrl?: string; url?: string };
      }) => {
        try {
          if (!text && !attachment) return;

          let targetStudentId = studentId;
          let studentProfile = null;

          if (user.role === "STUDENT") {
            studentProfile = await Student.findOne({
              agencyId: user.agencyId,
              $or: [{ user: user.userId }, { email: user.email }],
            });
            if (!studentProfile) {
              socket.emit("error", { message: "Student record not found for user" });
              return;
            }
            targetStudentId = studentProfile._id.toString();
          } else if (user.role === "COUNSELOR") {
            if (!targetStudentId) {
              socket.emit("error", { message: "Student ID required" });
              return;
            }
            studentProfile = await Student.findOne({ _id: targetStudentId, agencyId: user.agencyId });
            if (!studentProfile) {
              socket.emit("error", { message: "Student not found in agency" });
              return;
            }
            if (!canUserAccessStudentPrivateData(user, studentProfile)) {
              socket.emit("error", { message: "Access denied. You are not assigned to this student." });
              return;
            }
          } else if (user.role === "AGENCY_ADMIN" || user.role === "PLATFORM_SUPER_ADMIN") {
            // Admin is in monitor mode per requirement
            socket.emit("error", { message: "Admin is in monitor mode and cannot send messages." });
            return;
          }

          if (!targetStudentId || !studentProfile) {
            socket.emit("error", { message: "Invalid chat target" });
            return;
          }

          const senderUser = await User.findById(user.userId);
          const senderRoleType = user.role === "STUDENT" ? "student" : "counselor";

          // Normalize attachment URL
          const normalizedAttachment = attachment
            ? {
                name: attachment.name,
                size: attachment.size || "Unknown",
                type: attachment.type || "Document",
                fileUrl: attachment.fileUrl || attachment.url || "",
              }
            : undefined;

          // 1. Create message in DB
          const messageDoc = new Message({
            agencyId: user.agencyId,
            sender: user.userId,
            senderName: senderUser?.name || user.name || "User",
            senderRole: senderRoleType,
            senderAvatar:
              senderUser?.avatar ||
              (user.role === "STUDENT"
                ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"),
            student: studentProfile._id,
            text: text || (normalizedAttachment ? `Sent attachment: ${normalizedAttachment.name}` : ""),
            attachment: normalizedAttachment,
            read: false,
          });
          await messageDoc.save();

          // 2. Emit to room (emit both 'new_message' and 'receive_message' for 100% compatibility)
          io?.to(`student_chat_${targetStudentId}`).emit("new_message", messageDoc);
          io?.to(`student_chat_${targetStudentId}`).emit("receive_message", messageDoc);

          // 3. If Counselor -> Student: Check 24-hr email notification rule
          if (user.role === "COUNSELOR" && studentProfile.email) {
            const lastSent = lastChatEmailTimestamps.get(targetStudentId) || 0;
            const now = Date.now();
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

            if (now - lastSent > TWENTY_FOUR_HOURS) {
              lastChatEmailTimestamps.set(targetStudentId, now);
              emailService
                .sendNotificationEmail({
                  to: studentProfile.email,
                  name: studentProfile.name,
                  title: `New Message from Counselor ${senderUser?.name || ""}`,
                  message: `Your counselor ${senderUser?.name || "Counselor"} sent you a message: "${text ? text.slice(0, 100) : "Attachment sent"}"`,
                  actionUrl: `${env.clientUrl}/student/chat`,
                  actionText: "Open Student Portal Chat",
                })
                .catch((e) => console.error("Error sending chat email notification:", e));
            }
          }

          // 4. If Student's first message ever: Send automatic counselor wait message
          if (user.role === "STUDENT") {
            const previousMsgCount = await Message.countDocuments({
              agencyId: user.agencyId,
              student: studentProfile._id,
              senderRole: "student",
            });

            if (previousMsgCount <= 1) {
              // Create auto system reply
              const autoReply = new Message({
                agencyId: user.agencyId,
                sender: user.userId,
                senderName: "Admissions Desk",
                senderRole: "system",
                student: studentProfile._id,
                text: "Please wait, our counselor will message you shortly.",
                read: false,
              });
              await autoReply.save();
              setTimeout(() => {
                io?.to(`student_chat_${targetStudentId}`).emit("new_message", autoReply);
                io?.to(`student_chat_${targetStudentId}`).emit("receive_message", autoReply);
              }, 800);
            }
          }
        } catch (err: any) {
          socket.emit("error", { message: err.message });
        }
      }
    );

    // Event: Mark messages as seen/read
    socket.on("mark_seen", async (payload: { studentId?: string } = {}) => {
      try {
        let targetStudentId = payload?.studentId;

        if (user.role === "STUDENT") {
          const studentProfile = await Student.findOne({
            agencyId: user.agencyId,
            $or: [{ user: user.userId }, { email: user.email }],
          });
          if (studentProfile) {
            targetStudentId = studentProfile._id.toString();
          }
        }

        if (!targetStudentId) return;

        await Message.updateMany(
          { agencyId: user.agencyId, student: targetStudentId, read: false, sender: { $ne: user.userId } },
          { $set: { read: true } }
        );

        io?.to(`student_chat_${targetStudentId}`).emit("messages_seen", {
          studentId: targetStudentId,
          readerId: user.userId,
        });
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // Event: Delete message
    socket.on("delete_message", async ({ messageId, studentId }: { messageId: string; studentId?: string }) => {
      try {
        if (!messageId) return;
        const msg = await Message.findOne({ _id: messageId, agencyId: user.agencyId });
        if (!msg) return;

        if (
          msg.sender.toString() !== user.userId &&
          user.role !== "AGENCY_ADMIN" &&
          user.role !== "PLATFORM_SUPER_ADMIN"
        ) {
          socket.emit("error", { message: "Unauthorized to delete this message" });
          return;
        }

        msg.isDeleted = true;
        msg.text = "This message was deleted.";
        msg.attachment = undefined;
        await msg.save();

        const targetRoom = studentId || msg.student?.toString();
        if (targetRoom) {
          io?.to(`student_chat_${targetRoom}`).emit("message_deleted", {
            messageId,
            studentId: targetRoom,
          });
        }
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    // Event: Typing indicator
    socket.on("typing", async (payload: { studentId?: string; isTyping?: boolean; userName?: string } = {}) => {
      try {
        let targetStudentId = payload?.studentId;
        if (user.role === "STUDENT" && !targetStudentId) {
          const studentProfile = await Student.findOne({
            agencyId: user.agencyId,
            $or: [{ user: user.userId }, { email: user.email }],
          });
          if (studentProfile) {
            targetStudentId = studentProfile._id.toString();
          }
        }

        if (!targetStudentId) return;

        const isTyping = payload.isTyping !== undefined ? payload.isTyping : true;
        const senderName = payload.userName || user.name || (user.role === "STUDENT" ? "Student" : "Counselor");

        socket.to(`student_chat_${targetStudentId}`).emit("user_typing", {
          userId: user.userId,
          userName: senderName,
          studentId: targetStudentId,
          isTyping,
        });

        if (!isTyping) {
          socket.to(`student_chat_${targetStudentId}`).emit("user_stop_typing", {
            studentId: targetStudentId,
          });
        }
      } catch (err: any) {
        // ignore
      }
    });

    // Event: Stop typing indicator
    socket.on("stop_typing", async (payload: { studentId?: string } = {}) => {
      try {
        let targetStudentId = payload?.studentId;
        if (user.role === "STUDENT" && !targetStudentId) {
          const studentProfile = await Student.findOne({
            agencyId: user.agencyId,
            $or: [{ user: user.userId }, { email: user.email }],
          });
          if (studentProfile) {
            targetStudentId = studentProfile._id.toString();
          }
        }

        if (!targetStudentId) return;

        socket.to(`student_chat_${targetStudentId}`).emit("user_typing", {
          userId: user.userId,
          studentId: targetStudentId,
          isTyping: false,
        });
        socket.to(`student_chat_${targetStudentId}`).emit("user_stop_typing", {
          studentId: targetStudentId,
        });
      } catch (err: any) {
        // ignore
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      onlineUsers.delete(user.userId);
      if (user.agencyId) {
        socket.to(`agency_${user.agencyId}`).emit("user_online_status", {
          userId: user.userId,
          online: false,
        });
      }
    });
  });

  return io;
};

export const getIO = (): Server | null => io;

// Real-Time Notification Emitter Helpers
export const emitNotificationToUser = async (userId: string, notification: any): Promise<void> => {
  if (!io) return;
  io.to(`user_${userId}`).emit("new_notification", notification);
};

export const emitNotificationToAgency = async (agencyId: string, notification: any): Promise<void> => {
  if (!io) return;
  io.to(`agency_${agencyId}`).emit("new_notification", notification);
};

