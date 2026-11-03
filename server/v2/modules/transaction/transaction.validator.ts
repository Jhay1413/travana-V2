import { z } from "zod";
import { QUOTE_STATUS_MAP } from "./quote-status-map";

const DEAL_PRIORITIES = ["low", "medium", "high"] as const;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(
    (value) => {
      // The regex above accepts calendar-impossible dates (e.g. 2026-02-31),
      // which Date silently rolls forward (2026-03-03) instead of rejecting.
      // Round-trip through Date.UTC and compare the formatted result back
      // against the input to catch that.
      const [year, month, day] = value.split("-").map(Number);
      const ms = Date.UTC(year, month - 1, day);
      return new Date(ms).toISOString().slice(0, 10) === value;
    },
    { message: "Invalid calendar date" },
  );

// Same shape Postgres accepts for a uuid column (hyphenated), without insisting on an RFC version digit.
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEAD_SOURCES = ["SHOP", "FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE_ENQUIRY"] as const;
// The form's dropdown labels, plus the short forms older quotes and bookings stored ("Private", "Shared").
const TRANSFER_TYPE_LABELS = ["private transfer", "shared transfer", "private", "shared", "seaplane", "speedboat", "self-drive", "none"];

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const uuidField = z.preprocess(emptyToUndefined, z.string().uuid("must be a valid id").optional());
const leadSourceField = z.preprocess(emptyToUndefined, z.enum(LEAD_SOURCES, { errorMap: () => ({ message: `lead_source must be one of: ${LEAD_SOURCES.join(", ")}` }) }).optional());
const numeric = z
  .union([z.number().finite(), z.string().trim().regex(/^-?\d+(\.\d+)?$/, "must be a number")])
  .nullable()
  .optional();
const arrayOfObjects = z.array(z.record(z.unknown())).optional();
// A date column: yyyy-MM-dd must be a real calendar day (2026-02-30 is not); other shapes only need to parse.
const travelDate = z
  .string()
  .refine((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? dateOnly.safeParse(v).success : v.trim() === "" || !Number.isNaN(new Date(v).getTime())), {
    message: "travel_date is not a valid date",
  })
  .optional();

const dealChildShape = {
  holiday_type_id: uuidField,
  travel_date: travelDate,
  transfer_type: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v.trim() === "" || TRANSFER_TYPE_LABELS.includes(v.trim().toLowerCase()), { message: "Invalid transfer_type" }),
  lead_source: leadSourceField,
  sales_price: numeric,
  package_commission: numeric,
  discounts: numeric,
  service_charge: numeric,
  price_per_person: numeric,
  wallet_credit: numeric,
  childAges: z.array(z.union([z.number().int().min(0), z.string().regex(/^\d+$/, "childAges must be whole numbers")])).optional(),
  transfers: arrayOfObjects,
  carHires: arrayOfObjects,
  attractionTickets: arrayOfObjects,
  loungePasses: arrayOfObjects,
  airportParkings: arrayOfObjects,
  extraAccommodations: arrayOfObjects,
};

const noIdKeys = (label: string) => (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
  for (const key of ["id", "transaction_id"]) {
    if (key in value) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} ${key} cannot be set` });
  }
};

const quoteChildSchema = z
  .object({
    ...dealChildShape,
    quote_status: z
      .string()
      .nullable()
      .optional()
      .refine((v) => v == null || v === "" || Object.prototype.hasOwnProperty.call(QUOTE_STATUS_MAP, v), { message: "Invalid quote_status" }),
  })
  .passthrough()
  .superRefine(noIdKeys("quote"));

const bookingChildSchema = z.object(dealChildShape).passthrough().superRefine(noIdKeys("booking"));

const dealEnvelopeSchema = z
  .object({
    client_id: uuidField,
    // Missing or blank defaults to the caller in the service; anything given must be text.
    user_id: z.string().nullable().optional(),
    lead_source: leadSourceField,
    priority: z.preprocess(emptyToUndefined, z.enum(DEAL_PRIORITIES).optional()),
    quote: quoteChildSchema.optional(),
    booking: bookingChildSchema.optional(),
  })
  .passthrough();

/**
 * POST /api/v2/transactions. The body is either plain JSON or a multipart form whose `data`
 * field carries the JSON (quote/booking with images), so the payload is resolved the same way
 * the controller does. Only the rule the database already enforces is checked here: an enquiry
 * needs a holiday type (enquiry_table.holiday_type_id is NOT NULL). Quote and booking keep their
 * own checks in the controller.
 */
export const createTransactionValidator = z.object({
  body: z.record(z.unknown()).superRefine((body, ctx) => {
    let payload: Record<string, unknown> = body;
    if (body.data) {
      if (typeof body.data !== "string") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data must be a JSON string" });
        return;
      }
      try {
        const parsed: unknown = JSON.parse(body.data);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
        payload = parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data must be valid JSON" });
        return;
      }
    }

    const shape = dealEnvelopeSchema.safeParse(payload);
    if (!shape.success) {
      for (const issue of shape.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${issue.path.join(".") || "body"}: ${issue.message}` });
      }
      return;
    }

    const enquiry = payload.enquiry;
    if (!enquiry) return;
    if (typeof enquiry !== "object" || Array.isArray(enquiry)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "enquiry must be an object" });
      return;
    }
    const holidayTypeId = (enquiry as Record<string, unknown>).holiday_type_id;
    if (typeof holidayTypeId !== "string" || !UUID_LIKE.test(holidayTypeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enquiry requires a holiday_type_id" });
    }
  }),
});

export const updatePriorityValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid transaction id") }),
  body: z.object({
    priority: z.enum(DEAL_PRIORITIES),
  }),
});

export const setFutureDealValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid transaction id") }),
  body: z.object({
    future_deal_date: dateOnly.nullable().refine(
      (value) => {
        if (value === null) return true;
        // Compare as calendar dates in UTC (matching the client, which derives
        // its min date from toISOString()) so "today" is never "future" and
        // the server doesn't disagree with the browser's local timezone.
        const now = new Date();
        const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const [year, month, day] = value.split("-").map(Number);
        const candidateUtc = Date.UTC(year, month - 1, day);
        return candidateUtc > todayUtc;
      },
      { message: "future_deal_date must be a future date" },
    ),
  }),
});

export const setLostValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid transaction id") }),
  body: z.object({
    lost: z.boolean(),
  }),
});

// `sort` drives the Agent Dashboard's Pipeline Live "Latest"/"Oldest"/"Oldest
// Activity" views — other pre-existing query params (page, limit, agentId,
// quoteStatus) are still parsed manually in the controller and are left
// unvalidated here.
const PIPELINE_SORTS = [
  "newest",
  "oldest",
  "oldest-activity",
  "latest_activity",
  "value_desc",
  "profit_desc",
  "name_asc",
  "quiet_first",
] as const;

const PIPELINE_QUICK = ["due_today", "no_task", "quiet_7"] as const;

const prioritiesCsv = z
  .string()
  .regex(/^(low|medium|high)(,(low|medium|high))*$/, "priority must be a comma list of low, medium, high");

const uuidCsv = z
  .string()
  .refine(
    (value) => {
      const ids = value.split(",");
      return ids.length <= 50 && ids.every((id) => z.string().uuid().safeParse(id).success);
    },
    { message: "tourOperatorId must be a comma list of up to 50 uuids" },
  );

// Empty is allowed (`?search=`); the controller treats it as absent.
const searchTerm = z.string().trim().max(100);

export const listPipelineByStatusValidator = z.object({
  params: z.object({ status: z.string() }),
  query: z.object({
    sort: z.enum(PIPELINE_SORTS).optional(),
    branchId: z.string().uuid("Invalid branchId").optional(),
    agentId: z.string().optional(),
    search: searchTerm.optional(),
    priority: prioritiesCsv.optional(),
    tourOperatorId: uuidCsv.optional(),
    quick: z.enum(PIPELINE_QUICK).optional(),
  }),
});

export const pipelineCountsValidator = z.object({
  query: z.object({
    branchId: z.string().uuid("Invalid branchId").optional(),
    agentId: z.string().optional(),
    search: searchTerm.optional(),
    priority: prioritiesCsv.optional(),
    tourOperatorId: uuidCsv.optional(),
  }),
});

export type PipelineCountsQuery = z.infer<typeof pipelineCountsValidator>["query"];

// The `validate()` middleware only checks req.query against this schema —
// it doesn't reassign req.query with the parsed result — so the controller
// still reads the raw query object; this type lets it do so against the
// validator's own inferred shape instead of re-deriving the enum by hand.
export type ListPipelineByStatusQuery = z.infer<typeof listPipelineByStatusValidator>["query"];
