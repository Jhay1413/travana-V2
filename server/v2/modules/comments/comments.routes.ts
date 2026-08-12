import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { commentsController as c } from "./comments.controller";
import { privateReplyValidator, triageCommentValidator } from "./comments.validator";

const router = Router();

// Static paths before the /:commentId param, or "posts"/"capabilities" would
// be swallowed as comment ids.
router.get("/", c.list);
router.get("/capabilities", c.capabilities);
router.get("/posts", c.listPosts);
router.get("/posts/:postId/comments", c.listPostComments);
router.get("/:commentId", c.getById);
router.patch("/:commentId", validate(triageCommentValidator), c.triage);
router.post("/:commentId/private-reply", validate(privateReplyValidator), c.privateReply);

export default router;
