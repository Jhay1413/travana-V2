import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { hrRepository } from "../repositories/hr.repository";
import { isAuthenticated } from "../v2/middlewares/auth/session";
import { getUserId } from "../utils/get-user-id";
import { db } from "../config/database";
import { user as userTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();
router.use(isAuthenticated);

const HR_ALLOWED_ROLES = new Set(["admin", "manager"]);

async function requireHrRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [u] = await db
      .select({ name: userTable.name, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!u) return res.status(401).json({ message: "Unauthorized" });
    const roleLower = (u.role || "").toLowerCase();
    if (!HR_ALLOWED_ROLES.has(roleLower)) {
      return res.status(403).json({ message: "Forbidden — HR access requires Admin or Manager role" });
    }
    (req as any).hrUser = { id: userId, name: u.name, role: roleLower };
    next();
  } catch (err) {
    console.error("[hr] requireHrRole failed:", err);
    res.status(500).json({ message: "Authorization check failed" });
  }
}

router.use(requireHrRole);

function formatTodayUk(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

router.get("/employees", async (_req: Request, res: Response) => {
  try {
    const rows = await hrRepository.listEmployees();
    res.json(rows);
  } catch (err) {
    console.error("[hr] listEmployees failed:", err);
    res.status(500).json({ message: "Failed to load employees" });
  }
});

router.get("/employees/:id", async (req: Request, res: Response) => {
  try {
    const row = await hrRepository.getEmployee((req.params.id as string));
    if (!row) return res.status(404).json({ message: "Employee not found" });
    res.json(row);
  } catch (err) {
    console.error("[hr] getEmployee failed:", err);
    res.status(500).json({ message: "Failed to load employee" });
  }
});

router.get("/reminders", async (_req: Request, res: Response) => {
  try {
    const rows = await hrRepository.listReminders();
    res.json(rows);
  } catch (err) {
    console.error("[hr] listReminders failed:", err);
    res.status(500).json({ message: "Failed to load reminders" });
  }
});

const leaveActionSchema = z.object({ leaveId: z.string().min(1) });

router.post("/employees/:id/leave/approve", async (req: Request, res: Response) => {
  try {
    const { leaveId } = leaveActionSchema.parse(req.body);
    const emp = await hrRepository.getEmployee((req.params.id as string));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const holidays = (emp.holidays as any[]).map((h) =>
      h.id === leaveId ? { ...h, status: "Approved" } : h,
    );
    const updated = await hrRepository.updateEmployee((req.params.id as string), { holidays } as any);
    res.json(updated);
  } catch (err) {
    console.error("[hr] approveLeave failed:", err);
    res.status(400).json({ message: "Failed to approve leave" });
  }
});

router.post("/employees/:id/leave/reject", async (req: Request, res: Response) => {
  try {
    const { leaveId } = leaveActionSchema.parse(req.body);
    const emp = await hrRepository.getEmployee((req.params.id as string));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const holidays = (emp.holidays as any[]).map((h) =>
      h.id === leaveId ? { ...h, status: "Rejected" } : h,
    );
    const updated = await hrRepository.updateEmployee((req.params.id as string), { holidays } as any);
    res.json(updated);
  } catch (err) {
    console.error("[hr] rejectLeave failed:", err);
    res.status(400).json({ message: "Failed to reject leave" });
  }
});

const addNoteSchema = z.object({ body: z.string().trim().min(1) });

router.post("/employees/:id/notes", async (req: Request, res: Response) => {
  try {
    const { body } = addNoteSchema.parse(req.body);
    const emp = await hrRepository.getEmployee((req.params.id as string));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const hrUser = (req as any).hrUser as { name: string } | undefined;
    const note = {
      id: `n-${Date.now()}`,
      author: hrUser?.name || "HR Team",
      date: formatTodayUk(),
      body,
    };
    const notes = [note, ...((emp.notes as any[]) || [])];
    const updated = await hrRepository.updateEmployee((req.params.id as string), { notes } as any);
    res.json(updated);
  } catch (err) {
    console.error("[hr] addNote failed:", err);
    res.status(400).json({ message: "Failed to add note" });
  }
});

const onboardingSchema = z.object({ itemId: z.string().min(1) });

router.post("/employees/:id/onboarding/toggle", async (req: Request, res: Response) => {
  try {
    const { itemId } = onboardingSchema.parse(req.body);
    const emp = await hrRepository.getEmployee((req.params.id as string));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const onboarding = ((emp.onboarding as any[]) || []).map((o) =>
      o.id === itemId ? { ...o, done: !o.done } : o,
    );
    const updated = await hrRepository.updateEmployee((req.params.id as string), { onboarding } as any);
    res.json(updated);
  } catch (err) {
    console.error("[hr] toggleOnboarding failed:", err);
    res.status(400).json({ message: "Failed to toggle onboarding" });
  }
});

const uploadDocSchema = z.object({ name: z.string().trim().min(1) });

router.post("/employees/:id/documents", async (req: Request, res: Response) => {
  try {
    const { name } = uploadDocSchema.parse(req.body);
    const emp = await hrRepository.getEmployee((req.params.id as string));
    if (!emp) return res.status(404).json({ message: "Employee not found" });
    const doc = {
      id: `d-${Date.now()}`,
      name,
      category: "Policies",
      status: "Uploaded",
      updated: formatTodayUk(),
    };
    const documents = [...((emp.documents as any[]) || []), doc];
    const updated = await hrRepository.updateEmployee((req.params.id as string), { documents } as any);
    res.json(updated);
  } catch (err) {
    console.error("[hr] uploadDocument failed:", err);
    res.status(400).json({ message: "Failed to upload document" });
  }
});

export default router;
