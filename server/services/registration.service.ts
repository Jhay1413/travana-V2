import { registrationRepository } from "../repositories/registration.repository";
import { AppError } from "../utils/error-handler";
import bcrypt from "bcryptjs";
import crypto from "crypto";

interface RegisterAgentInput {
  name: string;
  email: string;
  phone: string;
  location: string;
  motivation?: string;
}

export const registrationService = {
  async registerAgent(input: RegisterAgentInput) {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await registrationRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new AppError("An account with this email already exists", 409);
    }

    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    const id = crypto.randomUUID();
    const tempPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);

    return await registrationRepository.createAgentWithProfile({
      id,
      name: input.name.trim(),
      email: normalizedEmail,
      firstName,
      lastName,
      phoneNumber: input.phone.trim(),
      role: "Agent",
      password: tempPassword,
      location: input.location.trim(),
      bio: input.motivation?.trim() || null,
    });
  },
};
