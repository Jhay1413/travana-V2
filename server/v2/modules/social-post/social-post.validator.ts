import { z } from "zod";
import { IMAGE_ORDER_TOKEN } from "./media-order";

/** `imageOrder` arrives as a JSON string inside the multipart body. */
export const imageOrderField = z
  .string()
  .optional()
  .refine(
    (raw) => {
      if (raw === undefined || raw.trim() === "") return true;
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every((t) => typeof t === "string" && IMAGE_ORDER_TOKEN.test(t));
      } catch {
        return false;
      }
    },
    { message: "imageOrder must be a JSON array of existing:<id>, url:<n> or file:<n> entries" },
  );

// Only `imageOrder` is checked here; the controller still reads the other multipart fields itself.
const scheduleBody = z.object({ imageOrder: imageOrderField }).passthrough();

export const scheduleMediaSchema = z.object({ body: scheduleBody });
