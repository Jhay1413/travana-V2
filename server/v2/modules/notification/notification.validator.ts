import { z } from "zod";
import { insertNotificationSchema } from "@shared/schema";

export const createNotificationValidator = z.object({
  body: insertNotificationSchema,
});

export const updateNotificationValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertNotificationSchema.partial(),
});

export const listNotificationsValidator = z.object({
  query: z.object({
    userId: z.string(),
  }),
});
