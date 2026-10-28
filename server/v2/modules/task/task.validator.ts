import { z } from "zod";
import { TASK_PRIORITIES } from "@shared/schema";

// Only `priority` is checked here; the controller still parses the rest of the
// body against the insert schema, so other fields pass through untouched.
const priorityBody = z
  .object({ priority: z.enum(TASK_PRIORITIES, { message: "Invalid task priority" }).optional() })
  .passthrough();

export const createTaskSchema = z.object({ body: priorityBody });
// Update accepts only the editable fields; anything else (entity, org, branch,
// completedAt...) is rejected rather than silently dropped.
const updateBody = z
  .object({
    title: z.string().max(200).optional(),
    description: z.string().nullable().optional(),
    dueDate: z
      .union([z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid due date"), z.date()])
      .nullable()
      .optional(),
    userId: z.string().nullable().optional(),
    completed: z.boolean().optional(),
    priority: z.enum(TASK_PRIORITIES, { message: "Invalid task priority" }).optional(),
  })
  .strict();

export const updateTaskSchema = z.object({ body: updateBody });

export const forClientParamsSchema = z.object({ clientId: z.string().uuid("Invalid client id") });
export const listForClientSchema = z.object({ params: forClientParamsSchema });
