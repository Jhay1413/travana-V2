import { z } from "zod";
import { TASK_PRIORITIES } from "@shared/schema";

// Only `priority` is checked here; the controller still parses the rest of the
// body against the insert schema, so other fields pass through untouched.
const priorityBody = z
  .object({ priority: z.enum(TASK_PRIORITIES, { message: "Invalid task priority" }).optional() })
  .passthrough();

export const createTaskSchema = z.object({ body: priorityBody });
export const updateTaskSchema = z.object({ body: priorityBody });
