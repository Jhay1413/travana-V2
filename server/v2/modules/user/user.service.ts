import { userRepository } from "./user.repository";
import { AppError } from "../../utils/error-handler";
import type { User, InsertUser } from "./user.types";

export const userService = {
  async listUsers(): Promise<User[]> {
    return await userRepository.findAll();
  },

  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  },

  async createUser(userData: InsertUser): Promise<User> {
    const user = await userRepository.create(userData);
    return user;
  },

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const user = await userRepository.update(id, data);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  },

  async deleteUser(id: string): Promise<void> {
    await userRepository.remove(id);
  },
};
