import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/error-handler";
import { sendsevenWebhookService } from "./sendseven-webhook.service";

export const sendsevenWebhookController = {
  // POST /api/v2/sendseven-webhook/:orgId  (public — called by SendSeven)
  // Verifies the signature over the raw body, records the delivery, then acks.
  receive: asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId as string | undefined;
    if (!orgId) throw new AppError("Missing orgId", 400);

    // Endpoint-verification handshake: SendSeven sends X-Sendseven-Event: verification
    // (no signature) when the webhook is created. We must return 200 for the endpoint
    // to become verified/active. Echo a challenge if one is present.
    if (req.header("X-Sendseven-Event") === "verification") {
      const bodyStr = (req.rawBody as Buffer | undefined)?.toString("utf8") ?? "";
      console.log(`[sendseven-webhook] verification ping org=${orgId} body=${bodyStr.slice(0, 300)}`);
      let payload: unknown = { ok: true };
      try {
        const parsed = JSON.parse(bodyStr) as Record<string, unknown>;
        const challenge = parsed.challenge ?? parsed.token ?? parsed.verification_token;
        payload = challenge !== undefined ? { challenge } : parsed;
      } catch {
        /* non-JSON body — a 200 is enough */
      }
      res.status(200).json(payload);
      return;
    }

    const event = await sendsevenWebhookService.receive(
      orgId,
      req.rawBody as Buffer | undefined,
      req.header("X-Sendseven-Signature"),
      req.header("X-Sendseven-Timestamp"),
    );

    // Ack fast (SendSeven requires 2xx within 30s), THEN process — the AI reply
    // can take longer than the ack window. Fire-and-forget; errors are logged.
    res.status(200).json({ ok: true });
    if (event) {
      void sendsevenWebhookService.process(orgId, event).catch((err) => {
        console.error("[sendseven-webhook] processing failed:", err instanceof Error ? err.message : err);
      });
    }
  }),
};
