import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Application } from "../models/Application";
import { Agency } from "../models/Agency";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { emailService } from "../services/email.service";
import { env } from "../config/env";

export const getTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await User.find({
      agencyId: req.user?.agencyId,
      role: { $in: ["AGENCY_ADMIN", "COUNSELOR"] },
    });

    const teamWithMetrics = await Promise.all(
      users.map(async (u) => {
        const assignedStudentsCount = await Student.countDocuments({
          agencyId: req.user?.agencyId,
          $or: [
            { assignedCounselor: u._id },
            { assignedCounselors: u._id },
          ],
        });

        const activeApplicationsCount = await Application.countDocuments({
          agencyId: req.user?.agencyId,
          counselor: u._id,
        });

        return {
          id: u._id.toString(),
          name: u.name,
          email: u.email,
          role: u.roleTitle || (u.role === "AGENCY_ADMIN" ? "Admin / Director" : "Senior Counselor"),
          userRole: u.role,
          avatar:
            u.avatar ||
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
          branch: u.branch || "London HQ",
          assignedStudentsCount,
          activeApplicationsCount,
          conversionRate: "85%",
          status: u.isActive ? "Active" : "Inactive",
          joinedDate: u.createdAt.toISOString().split("T")[0],
          phone: u.phone || "+44 20 7946 0912",
        };
      })
    );

    sendSuccess(res, "Team members retrieved", teamWithMetrics);
  } catch (error) {
    next(error);
  }
};

export const inviteTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, role, roleTitle, branch, phone, password } = req.body;

    if (!name || !email) {
      return next(new AppError("Name and email are required.", 400));
    }

    if (!password || password.length < 6) {
      return next(new AppError("Password is required and must be at least 6 characters.", 400));
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return next(new AppError("Account already exists with this email.", 409));
    }

    const tempPassword = password;
    const assignedRole = role === "admin" || role === "AGENCY_ADMIN" ? "AGENCY_ADMIN" : "COUNSELOR";
    const assignedRoleTitle = roleTitle || (assignedRole === "AGENCY_ADMIN" ? "Agency Admin" : "Senior Counselor");

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: tempPassword,
      role: assignedRole,
      roleTitle: assignedRoleTitle,
      agencyId: req.user?.agencyId,
      branch: branch || "London HQ",
      phone: phone || "+44 20 7946 0843",
      avatar:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    });

    await newUser.save();

    // Fetch agency details for the invitation email
    const agency = req.user?.agencyId ? await Agency.findById(req.user.agencyId) : null;
    const agencyName = agency?.name || "AbroadPath Partner Agency";
    const inviterName = req.user?.name || "Your Agency Administrator";

    // Asynchronously dispatch invitation email
    emailService
      .sendTeamInviteEmail({
        to: newUser.email,
        name: newUser.name,
        inviterName,
        agencyName,
        role: assignedRoleTitle,
        tempPassword,
        loginUrl: `${env.clientUrl}/login`,
      })
      .catch((err) => {
        console.error("Failed to send team invitation email:", err);
      });

    sendSuccess(res, "Staff member invited successfully.", newUser, 201);
  } catch (error) {
    next(error);
  }
};

export const updateTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, roleTitle, branch, phone, avatar } = req.body;
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      {
        ...(name && { name }),
        ...(roleTitle && { roleTitle }),
        ...(branch && { branch }),
        ...(phone && { phone }),
        ...(avatar && { avatar }),
      },
      { new: true }
    );

    if (!user) {
      return next(new AppError("Team member not found.", 404));
    }

    sendSuccess(res, "Team member updated successfully.", user);
  } catch (error) {
    next(error);
  }
};

export const blockTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.params.id === req.user?.userId) {
      return next(new AppError("You cannot block your own Administrator account.", 400));
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      { isBlocked: true },
      { new: true }
    );

    if (!user) {
      return next(new AppError("Team member not found.", 404));
    }

    sendSuccess(res, "Team member blocked successfully.", user);
  } catch (error) {
    next(error);
  }
};

export const unblockTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      { isBlocked: false },
      { new: true }
    );

    if (!user) {
      return next(new AppError("Team member not found.", 404));
    }

    sendSuccess(res, "Team member unblocked successfully.", user);
  } catch (error) {
    next(error);
  }
};

export const deleteTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.params.id === req.user?.userId) {
      return next(new AppError("You cannot delete your own Administrator account.", 400));
    }

    const user = await User.findOneAndDelete({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!user) {
      return next(new AppError("Team member not found.", 404));
    }

    sendSuccess(res, "Team member deleted successfully.");
  } catch (error) {
    next(error);
  }
};
