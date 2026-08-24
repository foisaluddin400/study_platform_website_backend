import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { User, IUser, UserRole } from "../models/User";
import { Agency } from "../models/Agency";
import { Subscription } from "../models/Subscription";
import { AppError } from "../utils/appError";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        agencyId?: string;
        role: UserRole;
        email: string;
        name: string;
        branch?: string;
      };
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError("Authentication credentials required. Please log in.", 401));
    }

    const decoded = verifyAccessToken(token);

    const currentUser = await User.findById(decoded.userId);
    if (!currentUser || !currentUser.isActive) {
      return next(new AppError("The user belonging to this token is no longer active.", 401));
    }

    if (currentUser.isBlocked) {
      return next(new AppError("Your account has been suspended or blocked. Please contact your administrator.", 403));
    }

    if (currentUser.role !== "PLATFORM_SUPER_ADMIN" && currentUser.agencyId) {
      const agency = await Agency.findById(currentUser.agencyId);
      if (!agency || !agency.isActive) {
        return next(new AppError("The agency account is currently inactive. Please contact support.", 403));
      }
    }

    req.user = {
      userId: currentUser._id.toString(),
      agencyId: currentUser.agencyId ? currentUser.agencyId.toString() : undefined,
      role: currentUser.role,
      email: currentUser.email,
      name: currentUser.name,
      branch: currentUser.branch,
    };

    next();
  } catch (error: any) {
    next(new AppError("Invalid or expired session. Please log in again.", 401));
  }
};

export const restrictTo = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have the required permissions to perform this action.", 403)
      );
    }
    next();
  };
};

export const checkSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError("Unauthorized.", 401));
    }

    if (req.user.role === "PLATFORM_SUPER_ADMIN" || !req.user.agencyId) {
      return next();
    }

    const subscription = await Subscription.findOne({ agencyId: req.user.agencyId });
    if (!subscription) {
      return next(new AppError("No workspace access record found for this agency.", 403));
    }

    if (subscription.status === "PENDING_ACTIVATION") {
      return next(
        new AppError(
          "Free Lifetime Access has not been activated yet. Please activate your Free Lifetime Access to enter the workspace.",
          403
        )
      );
    }

    if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      return next(
        new AppError(
          "Agency workspace access is currently inactive. Please contact support or reactivate your free plan.",
          403
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
