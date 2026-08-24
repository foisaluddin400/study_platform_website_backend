import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  next(new AppError(`Resource not found on this server: ${req.method} ${req.originalUrl}`, 404));
};
