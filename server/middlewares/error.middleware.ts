import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../utils/error-handler";

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_UNEXPECTED_FILE: "Too many files uploaded at once. Please upload up to 50 images at a time.",
      LIMIT_FILE_SIZE: "One or more files exceed the maximum allowed size.",
      LIMIT_FILE_COUNT: "Too many files uploaded.",
      LIMIT_PART_COUNT: "Upload payload too large.",
      LIMIT_FIELD_COUNT: "Too many form fields.",
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || `Upload error: ${err.message}`,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
