import { Request, Response, NextFunction } from "express";
import { Course } from "../models/Course";
import { University } from "../models/University";
import { AppError } from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";
import { seedInitialAgencyCatalog } from "../utils/initialCatalog";

export const getCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { country, studyLevel, subject, universityId, intake, search } = req.query;

    if (req.user?.agencyId) {
      await seedInitialAgencyCatalog(req.user.agencyId as any);
    }

    const filter: Record<string, any> = {
      agencyId: req.user?.agencyId,
    };

    if (country && country !== "All") {
      filter.country = country;
    }

    if (studyLevel && studyLevel !== "All") {
      filter.studyLevel = studyLevel;
    }

    if (subject && subject !== "All") {
      filter.subjectArea = subject;
    }

    if (universityId && universityId !== "All") {
      filter.university = universityId;
    }

    if (intake && intake !== "All") {
      filter.intakes = intake;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { courseName: searchRegex },
        { universityName: searchRegex },
        { subjectArea: searchRegex },
      ];
    }

    const courses = await Course.find(filter).sort({ courseName: 1 });
    sendSuccess(res, "Courses retrieved", courses);
  } catch (error) {
    next(error);
  }
};

export const getCourseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    }).populate("university");

    if (!course) {
      return next(new AppError("Course not found.", 404));
    }

    sendSuccess(res, "Course details", course);
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const university = await University.findOne({
      _id: req.body.universityId,
      agencyId: req.user?.agencyId,
    });

    if (!university) {
      return next(new AppError("University not found in your agency catalog.", 404));
    }

    const course = new Course({
      ...req.body,
      agencyId: req.user?.agencyId,
      university: university._id,
      universityName: university.name,
      universityLogo: university.logo,
      country: university.country,
    });

    await course.save();

    university.activeCoursesCount += 1;
    await university.save();

    sendSuccess(res, "Course created successfully", course, 201);
  } catch (error) {
    next(error);
  }
};

export const updateCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, agencyId: req.user?.agencyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!course) {
      return next(new AppError("Course not found.", 404));
    }

    sendSuccess(res, "Course updated successfully", course);
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const course = await Course.findOneAndDelete({
      _id: req.params.id,
      agencyId: req.user?.agencyId,
    });

    if (!course) {
      return next(new AppError("Course not found.", 404));
    }

    await University.findOneAndUpdate(
      { _id: course.university, agencyId: req.user?.agencyId },
      { $inc: { activeCoursesCount: -1 } }
    );

    sendSuccess(res, "Course deleted successfully.");
  } catch (error) {
    next(error);
  }
};
