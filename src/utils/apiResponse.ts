import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export const sendSuccess = <T>(
  res: Response,
  message: string = "Operation successful",
  data?: T,
  statusCode: number = 200
): Response => {
  const responseBody: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  return res.status(statusCode).json(responseBody);
};

export const sendError = (
  res: Response,
  message: string = "An error occurred",
  statusCode: number = 500,
  errors: any[] = []
): Response => {
  const responseBody: ApiResponse = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(responseBody);
};
