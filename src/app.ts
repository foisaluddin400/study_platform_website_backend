import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import path from "path";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { sendSuccess } from "./utils/apiResponse";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { errorHandler } from "./middlewares/errorHandler";

// Route Imports
import authRoutes from "./routes/auth.routes";
import agencyRoutes from "./routes/agency.routes";
import userRoutes from "./routes/user.routes";
import leadRoutes from "./routes/lead.routes";
import studentRoutes from "./routes/student.routes";
import documentRoutes from "./routes/document.routes";
import universityRoutes from "./routes/university.routes";
import courseRoutes from "./routes/course.routes";
import applicationRoutes from "./routes/application.routes";
import offerRoutes from "./routes/offer.routes";
import visaCaseRoutes from "./routes/visaCase.routes";
import taskRoutes from "./routes/task.routes";
import appointmentRoutes from "./routes/appointment.routes";
import paymentRoutes from "./routes/payment.routes";
import commissionRoutes from "./routes/commission.routes";
import messageRoutes from "./routes/message.routes";
import notificationRoutes from "./routes/notification.routes";
import analyticsRoutes from "./routes/analytics.routes";
import subscriptionRoutes from "./routes/subscription.routes";

const app: Express = express();

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  ...env.corsOrigin.split(",").map((o) => o.trim()),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body Parsing
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// Static File Serving for Uploaded Assets (Logos, Avatars, Documents)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Database Connection Middleware (Guarantees active MongoDB Atlas connection on Vercel serverless functions)
app.use(async (_req: Request, _res: Response, next: import("express").NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("❌ MongoDB connection error in request middleware:", error);
    next(error);
  }
});

// Health Check Endpoints
const getHealthStatus = () => {
  const dbStateMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbStateMap[dbState] || "unknown";

  return {
    status: dbStatus === "connected" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: env.nodeEnv,
    database: {
      status: dbStatus,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
    },
  };
};

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Study Abroad API is running",
    data: getHealthStatus(),
  });
});

app.get("/health", (_req: Request, res: Response) => {
  const health = getHealthStatus();
  sendSuccess(res, "Service health status", health, health.status === "ok" ? 200 : 503);
});

app.get("/api/v1/health", (_req: Request, res: Response) => {
  const health = getHealthStatus();
  sendSuccess(res, "Study Abroad Platform API v1 is operational", health, health.status === "ok" ? 200 : 503);
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/agencies", agencyRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/leads", leadRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/universities", universityRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/offers", offerRoutes);
app.use("/api/v1/visa-cases", visaCaseRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/commissions", commissionRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
