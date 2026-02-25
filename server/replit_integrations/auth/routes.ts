import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { getUserId } from "../../utils/get-user-id";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const foundUser = await authStorage.getUserByEmail(email);
      if (!foundUser || !foundUser.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, foundUser.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (foundUser.banned) {
        return res.status(403).json({ message: "Account is banned" });
      }

      req.login({ userId: foundUser.id, authType: "password" }, (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        const { password: _, ...safeUser } = foundUser;
        return res.json(safeUser);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const foundUser = await authStorage.getUser(userId);
      if (!foundUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = foundUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { oldPassword, newPassword, confirmPassword } = req.body;

      if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All password fields are required" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "New passwords do not match" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const foundUser = await authStorage.getUser(userId);
      if (!foundUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!foundUser.password) {
        return res.status(400).json({ message: "No password set for this account. Use OAuth login." });
      }

      const validOld = await bcrypt.compare(oldPassword, foundUser.password);
      if (!validOld) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await authStorage.updateUser(userId, { password: hashed });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.patch("/api/auth/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { phoneNumber, email } = req.body;
      const updateData: Record<string, any> = {};

      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (email !== undefined) updateData.email = email;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updated = await authStorage.updateUser(userId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  const avatarUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), "public", "avatars");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, `avatar-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
    },
  });

  app.post("/api/auth/avatar", isAuthenticated, avatarUpload.single("avatar"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const avatarUrl = `/avatars/${req.file.filename}`;

      const updated = await authStorage.updateUser(userId, { image: avatarUrl });
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...safeUser } = updated;
      res.json({ ...safeUser, avatar: avatarUrl });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });
}
