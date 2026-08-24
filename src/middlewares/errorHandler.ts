import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/appError";
import { sendError } from "../utils/apiResponse";
import { env } from "../config/env";

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors: any[] = err.errors || [];

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation Error";
    errors = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }

  // Handle Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    errors = [{ path: err.path, message }];
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue ? err.keyValue[field] : "";
    message = `Duplicate value '${value}' entered for ${field}. Please use another value.`;
    errors = [{ field, message }];
  }

  // Handle Mongoose ValidationError
  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = "Database Validation Error";
    errors = Object.values(err.errors).map((val: any) => ({
      path: val.path,
      message: val.message,
    }));
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please authenticate.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired. Please log in again.";
  }

  // Log non-operational / unexpected errors in development or production
  if (!err.isOperational && !(err instanceof ZodError)) {
    console.error("💥 UNHANDLED ERROR:", err);
  }

  // Hide internal server error details in production if not operational
  if (env.nodeEnv === "production" && !err.isOperational && !(err instanceof ZodError)) {
    message = "An unexpected error occurred. Please try again later.";
    errors = [];
  }

  sendError(res, message, statusCode, errors);
};
