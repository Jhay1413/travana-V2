import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { knowledgeBaseController as c } from "./knowledge-base.controller";
import { createKnowledgeValidator, updateKnowledgeValidator, idParamValidator } from "./knowledge-base.validator";

const router = Router();

router.use(requireOrgRole(["org_admin", "platform_admin"]));

router.get("/", c.list);
router.post("/", validate(createKnowledgeValidator), c.create);
router.put("/:id", validate(updateKnowledgeValidator), c.update);
router.delete("/:id", validate(idParamValidator), c.remove);

export default router;
