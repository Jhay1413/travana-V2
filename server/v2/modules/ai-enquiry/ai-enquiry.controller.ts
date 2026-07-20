import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { aiEnquiryService } from "./ai-enquiry.service";

export const aiEnquiryController = {
  // POST /api/v2/ai-enquiry/from-conversation  { transcript }
  fromConversation: asyncHandler(async (req: Request, res: Response) => {
    const { transcript } = req.body as { transcript: string };
    const intent = await aiEnquiryService.fromTranscript(transcript, getScope(req).orgId);
    return successResponse(res, intent, "Enquiry drafted from conversation");
  }),
};
