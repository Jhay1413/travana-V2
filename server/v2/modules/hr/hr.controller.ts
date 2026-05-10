import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { hrService } from './hr.service';
import { userRepository } from '../user/user.repository';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { getScope } from '../../utils/scope';

const HR_ALLOWED_ROLES = new Set(['admin', 'manager']);

export async function requireHrRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const u = await userRepository.findRoleAndNameById(userId);
    if (!u) return res.status(401).json({ message: 'Unauthorized' });
    const roleLower = (u.role || '').toLowerCase();
    if (!HR_ALLOWED_ROLES.has(roleLower)) return res.status(403).json({ message: 'Forbidden — HR access requires Admin or Manager role' });
    (req as any).hrUser = { id: userId, name: u.name, role: roleLower };
    next();
  } catch (err) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
}

function formatTodayUk(): string {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const leaveActionSchema = z.object({ leaveId: z.string().min(1) });
const addNoteSchema = z.object({ body: z.string().trim().min(1) });
const onboardingSchema = z.object({ itemId: z.string().min(1) });
const uploadDocSchema = z.object({ name: z.string().trim().min(1) });

export const hrController = {
  listEmployees: asyncHandler(async (req: Request, res: Response) => {
    const rows = await hrService.listEmployees(getScope(req));
    res.json(rows);
  }),

  getEmployee: asyncHandler(async (req: Request, res: Response) => {
    const row = await hrService.getEmployee(req.params.id as string, getScope(req));
    res.json(row);
  }),

  listReminders: asyncHandler(async (req: Request, res: Response) => {
    const rows = await hrService.listReminders(getScope(req));
    res.json(rows);
  }),

  approveLeave: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { leaveId } = leaveActionSchema.parse(req.body);
    const emp = await hrService.getEmployee(req.params.id as string, scope);
    const holidays = (emp.holidays as any[]).map((h) => h.id === leaveId ? { ...h, status: 'Approved' } : h);
    const updated = await hrService.updateEmployee(req.params.id as string, { holidays }, scope);
    res.json(updated);
  }),

  rejectLeave: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { leaveId } = leaveActionSchema.parse(req.body);
    const emp = await hrService.getEmployee(req.params.id as string, scope);
    const holidays = (emp.holidays as any[]).map((h) => h.id === leaveId ? { ...h, status: 'Rejected' } : h);
    const updated = await hrService.updateEmployee(req.params.id as string, { holidays }, scope);
    res.json(updated);
  }),

  addNote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { body } = addNoteSchema.parse(req.body);
    const emp = await hrService.getEmployee(req.params.id as string, scope);
    const hrUser = (req as any).hrUser as { name: string } | undefined;
    const note = { id: `n-${Date.now()}`, author: hrUser?.name || 'HR Team', date: formatTodayUk(), body };
    const notes = [note, ...((emp.notes as any[]) || [])];
    const updated = await hrService.updateEmployee(req.params.id as string, { notes }, scope);
    res.json(updated);
  }),

  toggleOnboarding: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { itemId } = onboardingSchema.parse(req.body);
    const emp = await hrService.getEmployee(req.params.id as string, scope);
    const onboarding = ((emp.onboarding as any[]) || []).map((o) => o.id === itemId ? { ...o, done: !o.done } : o);
    const updated = await hrService.updateEmployee(req.params.id as string, { onboarding }, scope);
    res.json(updated);
  }),

  uploadDocument: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { name } = uploadDocSchema.parse(req.body);
    const emp = await hrService.getEmployee(req.params.id as string, scope);
    const doc = { id: `d-${Date.now()}`, name, category: 'Policies', status: 'Uploaded', updated: formatTodayUk() };
    const documents = [...((emp.documents as any[]) || []), doc];
    const updated = await hrService.updateEmployee(req.params.id as string, { documents }, scope);
    res.json(updated);
  }),
};
