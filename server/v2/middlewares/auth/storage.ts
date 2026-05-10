import { type User, type UpsertUser } from "@shared/schema";
import { userRepository } from "../../modules/user/user.repository";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
}

class AuthStorage implements IAuthStorage {
  getUser(id: string): Promise<User | undefined> {
    return userRepository.findById(id);
  }

  getUserByEmail(email: string): Promise<User | undefined> {
    return userRepository.findByEmail(email);
  }

  getUserByResetToken(token: string): Promise<User | undefined> {
    return userRepository.findByResetToken(token);
  }

  upsertUser(userData: UpsertUser): Promise<User> {
    return userRepository.upsertByIdOrEmail(userData);
  }

  updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    return userRepository.updatePartial(id, data);
  }
}

export const authStorage = new AuthStorage();
