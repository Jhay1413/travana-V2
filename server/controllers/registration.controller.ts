import { Request, Response } from "express";
import { registrationService } from "../services/registration.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  location: z.string().min(1, "Location is required"),
  motivation: z.string().optional(),
});

export const registrationController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors.map((e) => e.message).join(", "),
      });
    }

    const result = await registrationService.registerAgent(parsed.data);
    return successResponse(res, { userId: result.id }, "Registration successful", 201);
  }),
};
