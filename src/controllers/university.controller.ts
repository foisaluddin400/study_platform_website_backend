import { Request, Response, NextFunction } from "express";
import { University } from "../models/University";
import { Course } from "../models/Course";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { seedInitialAgencyCatalog } from "../utils/initialCatalog";

export const getUniversities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { country, agentStatus, search, status } = req.query;

    if (req.user?.agencyId) {
      await seedInitialAgencyCatalog(req.user.agencyId as any);
    }

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (country && country !== "All") {
      filter.country = country;
    }

    if (agentStatus && agentStatus !== "All") {
      filter.agentStatus = agentStatus;
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [{ name: searchRegex }, { city: searchRegex }, { country: searchRegex }];
    }

    const universities = await University.find(filter).sort({ name: 1 });
    sendSuccess(res, "Universities retrieved", universities);
  } catch (error) {
    next(error);
  }
};

export const getUniversityById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const university = await University.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!university) {
      return next(new AppError("University not found.", 404));
    }

    const courses = await Course.find({
      agencyId: req.user?.agencyId,
      university: university._id,
    });

    sendSuccess(res, "University details", {
      university,
      courses,
    });
  } catch (error) {
    next(error);
  }
};

export const createUniversity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const university = new University({
      ...req.body,
      agencyId: req.user?.agencyId,
    });

    await university.save();
    sendSuccess(res, "University partner added successfully", university, 201);
  } catch (error) {
    next(error);
  }
};

export const updateUniversity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const university = await University.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!university) {
      return next(new AppError("University not found.", 404));
    }

    sendSuccess(res, "University updated successfully", university);
  } catch (error) {
    next(error);
  }
};

export const deleteUniversity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const university = await University.findOneAndDelete({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!university) {
      return next(new AppError("University not found.", 404));
    }

    await Course.deleteMany({ agencyId: req.user?.agencyId, university: university._id });
    sendSuccess(res, "University deleted successfully.");
  } catch (error) {
    next(error);
  }
};
