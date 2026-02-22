import type { Request } from "express";

export function getUserId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  if (user.authType === "password") return user.userId || null;
  return user.claims?.sub || null;
}
