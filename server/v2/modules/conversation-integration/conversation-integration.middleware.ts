import { NextFunction, Request, Response } from "express";
import { runWithSendSevenConfig } from "../../utils/sendseven";
import { conversationIntegrationService } from "./conversation-integration.service";

// Resolves the logged-in org's SendSeven config once per request and runs the
// rest of the chain inside that tenant context, so every proxied call uses the
// correct workspace token. Requires orgBranchScope to have set req.orgId.
export async function sendSevenContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await conversationIntegrationService.resolveConfig(req.orgId);
    runWithSendSevenConfig(config, () => next());
  } catch (err) {
    next(err);
  }
}
