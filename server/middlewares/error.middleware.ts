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

  // body-parser errors carry the raw request text on `err.body` (a malformed sign-in body holds the PIN): never log the error object.
  const parseType = (err as { type?: unknown }).type;
  if (parseType === "entity.parse.failed" || parseType === "entity.too.large") {
    console.warn(`[http] request body rejected: ${String(parseType)}`);
    return res.status(parseType === "entity.too.large" ? 413 : 400).json({
      success: false,
      message: "The request could not be read",
      error: "The request could not be read",
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
