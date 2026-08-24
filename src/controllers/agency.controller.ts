import { Request, Response, NextFunction } from "express";
import { Agency } from "../models/Agency";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";

export const getAgencyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const agency = await Agency.findById(req.user?.agencyId);
    if (!agency) {
      return next(new AppError("Agency profile not found.", 404));
    }
    sendSuccess(res, "Agency profile retrieved", agency);
  } catch (error) {
    next(error);
  }
};

export const updateAgencyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, displayName, email, phone, address, website, baseCurrency, country, operatingCountries } = req.body;
    let logo = req.body.logo;

    if (req.file) {
      logo = `/uploads/${req.user?.agencyId || "general"}/${req.file.filename}`;
    }

    const agency = await Agency.findByIdAndUpdate(
      req.user?.agencyId,
      {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(website && { website }),
        ...(baseCurrency && { baseCurrency }),
        ...(logo !== undefined && { logo }),
        ...(country && { country }),
        ...(operatingCountries && { operatingCountries }),
      },
      { new: true, runValidators: true }
    );

    if (!agency) {
      return next(new AppError("Agency not found.", 404));
    }

    sendSuccess(res, "Agency settings updated successfully.", agency);
  } catch (error) {
    next(error);
  }
};

export const updateOperatingCountries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { operatingCountries } = req.body;
    if (!Array.isArray(operatingCountries)) {
      return next(new AppError("operatingCountries must be an array of country names.", 400));
    }

    const agency = await Agency.findByIdAndUpdate(
      req.user?.agencyId,
      { operatingCountries },
      { new: true }
    );

    if (!agency) {
      return next(new AppError("Agency not found.", 404));
    }

    sendSuccess(res, "Operating countries updated successfully.", agency.operatingCountries);
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const agency = await Agency.findById(req.user?.agencyId);
    sendSuccess(res, "Branches retrieved", agency?.branches || []);
  } catch (error) {
    next(error);
  }
};

export const addBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, type, address, staffCount, activeStudents } = req.body;
    const agency = await Agency.findById(req.user?.agencyId);
    if (!agency) {
      return next(new AppError("Agency not found.", 404));
    }

    const newBranch = {
      id: `branch-${Date.now()}`,
      name,
      type: type || "Regional",
      address,
      staffCount: staffCount || 0,
      activeStudents: activeStudents || 0,
    };

    agency.branches.push(newBranch as any);
    await agency.save();

    sendSuccess(res, "Branch added successfully.", agency.branches);
  } catch (error) {
    next(error);
  }
};

export const updateNotificationsConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { offerLetterAlert, documentCorrectionAlert, biometricsReminder } = req.body;
    const agency = await Agency.findByIdAndUpdate(
      req.user?.agencyId,
      {
        notificationsConfig: {
          offerLetterAlert: offerLetterAlert ?? true,
          documentCorrectionAlert: documentCorrectionAlert ?? true,
          biometricsReminder: biometricsReminder ?? true,
        },
      },
      { new: true }
    );

    sendSuccess(res, "Notification alerts configuration saved.", agency?.notificationsConfig);
  } catch (error) {
    next(error);
  }
};
