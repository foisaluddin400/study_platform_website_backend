import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/appError";

export const requireAgency = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !req.user.agencyId) {
    return next(new AppError("Tenant context is required for this operation.", 403));
  }
  next();
};

export const getTenantFilter = (req: Request, extraFilter: Record<string, any> = {}): Record<string, any> => {
  if (!req.user || !req.user.agencyId) {
    throw new AppError("Unauthorized tenant access.", 403);
  }

  return {
    ...extraFilter,
    agencyId: new mongoose.Types.ObjectId(req.user.agencyId),
  };
};
