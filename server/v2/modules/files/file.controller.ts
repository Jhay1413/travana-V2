import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { presignImageKey } from "../../utils/image-storage";

export const fileController = {
  /**
   * Serve a gallery image by its S3 key.
   * GET /api/v2/files/img?key=<s3key>
   *
   * Public (unguessable random key) so it works for both authenticated app
   * pages and same-origin public quote pages. Redirects to a short-lived
   * presigned S3 URL so bandwidth is offloaded to S3.
   */
  serveImage: asyncHandler(async (req: Request, res: Response) => {
    const key = req.query.key as string | undefined;
    if (!key) {
      return res.status(400).json({ success: false, message: "key query parameter is required" });
    }
    const url = await presignImageKey(key);
    return res.redirect(302, url);
  }),
};
