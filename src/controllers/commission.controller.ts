import { Request, Response, NextFunction } from "express";
import { Commission } from "../models/Commission";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";

export const getCommissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, counselorName, search } = req.query;

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (status && status !== "All") {
      filter.status = status;
    }

    if (counselorName && counselorName !== "All") {
      filter.counselorName = counselorName;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { studentName: searchRegex },
        { universityName: searchRegex },
        { applicationId: searchRegex },
        { counselorName: searchRegex },
      ];
    }

    const commissions = await Commission.find(filter).sort({ createdAt: -1 });
    sendSuccess(res, "Commissions ledger retrieved", commissions);
  } catch (error) {
    next(error);
  }
};

export const updateCommission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, receivedCommission, payoutDate } = req.body;
    const commission = await Commission.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      {
        ...(status && { status }),
        ...(receivedCommission !== undefined && { receivedCommission }),
        ...(payoutDate && { payoutDate }),
      },
      { new: true }
    );

    if (!commission) {
      return next(new AppError("Commission record not found.", 404));
    }

    sendSuccess(res, "Commission status updated successfully", commission);
  } catch (error) {
    next(error);
  }
};
