import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import crypto from "crypto";
import { User, IUser } from "../models/User";
import { Agency, IAgency } from "../models/Agency";
import { Subscription, ISubscription } from "../models/Subscription";
import { Student } from "../models/Student";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { AppError } from "../utils/appError";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { env } from "../config/env";
import { getPlanLimits } from "../utils/planLimits";
import { emailService } from "../services/email.service";
import { seedInitialAgencyCatalog } from "../utils/initialCatalog";

const registerSchema = z.object({
  agencyName: z.string().min(2, "Agency name is required"),
  country: z.string().default("United Kingdom"),
  teamSize: z.string().default("5-15 Counselors"),
  adminName: z.string().min(2, "Admin name is required"),
  adminEmail: z.string().email("Valid work email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  plan: z.string().default("LIFETIME_FREE"),
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerAgency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validated.adminEmail.toLowerCase() });
    if (existingUser) {
      return next(new AppError("Account already exists. Please login.", 409));
    }

    // 1. Create Agency
    const agency = new Agency({
      name: validated.agencyName,
      displayName: validated.agencyName,
      email: validated.adminEmail.toLowerCase(),
      phone: "+44 20 7946 0912",
      country: validated.country,
      teamSize: validated.teamSize,
      branches: [
        {
          id: "branch-001",
          name: "Main HQ",
          type: "Primary Hub",
          address: `${validated.country} Main Office`,
          staffCount: 1,
          activeStudents: 0,
        },
      ],
    });
    await agency.save();

    // 2. Create Agency Admin User
    const adminUser = new User({
      name: validated.adminName,
      email: validated.adminEmail.toLowerCase(),
      password: validated.password,
      role: "AGENCY_ADMIN",
      roleTitle: "Agency Director",
      agencyId: agency._id,
      branch: "Main HQ",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    });
    await adminUser.save();

    // 3. Create Lifetime Free Access Subscription (Pending Activation)
    const planLimits = getPlanLimits("LIFETIME_FREE");
    const subscription = new Subscription({
      agencyId: agency._id,
      plan: "LIFETIME_FREE",
      status: "PENDING_ACTIVATION",
      maxStudents: planLimits.maxStudents,
      maxCounselors: planLimits.maxCounselors,
      maxStorageMb: planLimits.maxStorageMb,
    });
    await subscription.save();

    // Seed initial partner universities and catalog courses
    await seedInitialAgencyCatalog(agency._id);

    // Generate JWT
    const token = signAccessToken({
      userId: adminUser._id.toString(),
      agencyId: agency._id.toString(),
      role: adminUser.role,
    });

    const refreshToken = signRefreshToken({
      userId: adminUser._id.toString(),
      agencyId: agency._id.toString(),
      role: adminUser.role,
    });

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(
      res,
      "Agency registered successfully. Welcome to AbroadPath OS!",
      {
        token,
        user: {
          id: adminUser._id.toString(),
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          roleTitle: adminUser.roleTitle,
          avatar: adminUser.avatar,
          agencyId: agency._id.toString(),
          agencyName: agency.name,
        },
        agency,
        subscription,
        hasActiveAccess: false,
      },
      201
    );

    // Asynchronously send welcome email without delaying HTTP response
    emailService
      .sendWelcomeEmail({
        to: adminUser.email,
        name: adminUser.name,
        role: "Agency Director",
        loginUrl: `${env.clientUrl}/login`,
      })
      .catch((err) => {
        console.error("Failed to send welcome email on agency registration:", err);
      });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email.toLowerCase() }).select("+password");
    if (!user) {
      return next(new AppError("Invalid email or password.", 401));
    }

    const isMatch = await user.comparePassword(validated.password);
    if (!isMatch) {
      return next(new AppError("Invalid email or password.", 401));
    }

    if (!user.isActive || user.isBlocked) {
      return next(new AppError("Your account has been suspended or blocked. Please contact your administrator.", 403));
    }

    if (user.role === "STUDENT") {
      const studentProfile = await Student.findOne({ user: user._id });
      if (studentProfile && (studentProfile.isBlocked || studentProfile.isDeleted)) {
        return next(new AppError("Your student account has been suspended or deleted. Please contact your counselor.", 403));
      }
    }

    let agency: IAgency | null = null;
    let subscription: ISubscription | null = null;

    if (user.agencyId) {
      agency = await Agency.findById(user.agencyId);
      if (!agency || !agency.isActive) {
        return next(new AppError("The agency associated with this account is inactive.", 403));
      }

      subscription = await Subscription.findOne({ agencyId: user.agencyId });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signAccessToken({
      userId: user._id.toString(),
      agencyId: user.agencyId ? user.agencyId.toString() : undefined,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      agencyId: user.agencyId ? user.agencyId.toString() : undefined,
      role: user.role,
    });

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const hasActiveAccess =
      user.role === "PLATFORM_SUPER_ADMIN"
        ? true
        : subscription
        ? subscription.status === "ACTIVE"
        : false;

    sendSuccess(res, "Authenticated successfully.", {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        roleTitle: user.roleTitle,
        avatar: user.avatar,
        agencyId: user.agencyId ? user.agencyId.toString() : undefined,
        agencyName: agency?.name || "GlobalEd Consulting Partners",
      },
      agency,
      subscription,
      hasActiveAccess,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError("Unauthorized.", 401));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    let agency: IAgency | null = null;
    let subscription: ISubscription | null = null;

    if (user.agencyId) {
      agency = await Agency.findById(user.agencyId);
      subscription = await Subscription.findOne({ agencyId: user.agencyId });
    }

    const hasActiveAccess =
      user.role === "PLATFORM_SUPER_ADMIN"
        ? true
        : subscription
        ? subscription.status === "ACTIVE"
        : false;

    sendSuccess(res, "Current user profile", {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        roleTitle: user.roleTitle,
        avatar: user.avatar,
        agencyId: user.agencyId ? user.agencyId.toString() : undefined,
        agencyName: agency?.name || "GlobalEd Consulting Partners",
        branch: user.branch,
        phone: user.phone,
      },
      agency,
      subscription,
      hasActiveAccess,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  sendSuccess(res, "Logged out successfully.");
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return next(new AppError("Refresh token required.", 401));
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(new AppError("Invalid session.", 401));
    }

    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      agencyId: user.agencyId ? user.agencyId.toString() : undefined,
      role: user.role,
    });

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, "Token refreshed successfully.", { token: newAccessToken });
  } catch (error) {
    next(new AppError("Invalid refresh token. Please log in again.", 401));
  }
};

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() });

    // Return success message even if user not found to prevent account enumeration
    if (!user) {
      sendSuccess(
        res,
        "If an account exists with that email, a password reset link has been sent."
      );
      return;
    }

    // Generate unhashed reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token to store in database
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${env.clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(
      user.email
    )}`;

    const emailResult = await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      token: resetToken,
      expiresInMinutes: 60,
    });

    if (!emailResult.success) {
      console.warn("⚠️ [Auth] Could not send password reset email:", emailResult.error);
    }

    sendSuccess(
      res,
      "If an account exists with that email, a password reset link has been sent."
    );
  } catch (error) {
    next(error);
  }
};

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+password");

    if (!user) {
      return next(new AppError("Invalid or expired password reset token.", 400));
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    sendSuccess(res, "Password has been reset successfully. You can now log in with your new password.");
  } catch (error) {
    next(error);
  }
};

const testEmailSchema = z.object({
  to: z.string().email("Please provide a valid destination email address"),
  customMessage: z.string().optional(),
});

export const testEmailDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { to, customMessage } = testEmailSchema.parse(req.body);

    const connectionCheck = await emailService.verifyConnection();
    if (!connectionCheck.success) {
      return next(
        new AppError(
          `SMTP Verification failed: ${connectionCheck.message}. Please check your SMTP settings in .env`,
          502
        )
      );
    }

    const result = await emailService.sendTestEmail({
      to,
      customMessage: customMessage || "Initiated via AbroadPath OS Test Email Endpoint.",
    });

    if (!result.success) {
      return next(new AppError(`Email delivery failed: ${result.error}`, 500));
    }

    sendSuccess(
      res,
      `Test email sent successfully to ${to}`,
      {
        recipient: to,
        messageId: result.messageId,
        smtpHost: env.smtpHost || env.smtpService,
        smtpPort: env.smtpPort,
      }
    );
  } catch (error) {
    next(error);
  }
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user?.userId).select("+password");

    if (!user) {
      return next(new AppError("User account not found.", 404));
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(new AppError("Current password is incorrect.", 400));
    }

    user.password = newPassword;
    await user.save();

    sendSuccess(res, "Password updated successfully.");
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone } = req.body;
    let avatar = req.body.avatar;

    if (req.file) {
      avatar = `/uploads/${req.user?.agencyId || "general"}/${req.file.filename}`;
    }

    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user?.userId,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // If user is student, also update linked student profile
    if (user.role === "STUDENT") {
      await Student.findOneAndUpdate(
        { user: user._id },
        {
          ...(name && { name }),
          ...(phone !== undefined && { phone }),
          ...(avatar !== undefined && { avatar }),
        }
      );
    }

    sendSuccess(res, "Profile updated successfully.", user);
  } catch (error) {
    next(error);
  }
};
