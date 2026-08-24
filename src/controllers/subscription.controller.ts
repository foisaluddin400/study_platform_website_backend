import { Request, Response, NextFunction } from "express";
import { Subscription } from "../models/Subscription";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { getPlanLimits } from "../utils/planLimits";

export const getCurrentSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let subscription = await Subscription.findOne({ agencyId: req.user?.agencyId });
    if (!subscription) {
      const planLimits = getPlanLimits("LIFETIME_FREE");
      subscription = new Subscription({
        agencyId: req.user?.agencyId,
        plan: "LIFETIME_FREE",
        status: "PENDING_ACTIVATION",
        maxStudents: planLimits.maxStudents,
        maxCounselors: planLimits.maxCounselors,
        maxStorageMb: planLimits.maxStorageMb,
      });
      await subscription.save();
    }

    sendSuccess(res, "Current agency subscription details", {
      ...subscription.toJSON(),
      hasActiveAccess: subscription.status === "ACTIVE",
    });
  } catch (error) {
    next(error);
  }
};

export const activateFreeAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.agencyId) {
      return next(new AppError("No agency associated with this account.", 400));
    }

    const planLimits = getPlanLimits("LIFETIME_FREE");

    const subscription = await Subscription.findOneAndUpdate(
      { agencyId: req.user.agencyId },
      {
        plan: "LIFETIME_FREE",
        status: "ACTIVE",
        subscriptionStart: new Date(),
        maxStudents: planLimits.maxStudents,
        maxCounselors: planLimits.maxCounselors,
        maxStorageMb: planLimits.maxStorageMb,
      },
      { new: true, upsert: true }
    );

    sendSuccess(
      res,
      "Lifetime Free Access activated successfully! Welcome to your agency workspace.",
      {
        subscription,
        hasActiveAccess: true,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const upgradeSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const planLimits = getPlanLimits("LIFETIME_FREE");

    const subscription = await Subscription.findOneAndUpdate(
      { agencyId: req.user?.agencyId },
      {
        plan: "LIFETIME_FREE",
        status: "ACTIVE",
        subscriptionStart: new Date(),
        maxStudents: planLimits.maxStudents,
        maxCounselors: planLimits.maxCounselors,
        maxStorageMb: planLimits.maxStorageMb,
      },
      { new: true, upsert: true }
    );

    sendSuccess(res, "Agency upgraded to Free Access — Lifetime", {
      subscription,
      hasActiveAccess: true,
    });
  } catch (error) {
    next(error);
  }
};
