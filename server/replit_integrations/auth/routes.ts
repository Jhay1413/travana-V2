import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";

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
      let userId: string;
      if (req.user.authType === "password") {
        userId = req.user.userId;
      } else {
        userId = req.user.claims.sub;
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
}
