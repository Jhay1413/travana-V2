import { Router } from "express";
import { userController } from "./user.controller";
import { userProfileController } from "./user-profile.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createUserValidator, updateUserValidator, userIdParamsValidator } from "./user.validator";
import { isAuthenticated } from "../../middlewares/auth";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const router = Router();

router.get("/", userController.listUsers);
router.get("/:id", userController.getUserById);
router.post("/", requireOrgRole(["platform_admin"]), validate(createUserValidator), userController.createUser);
router.patch("/:id", validate(updateUserValidator), userController.updateUser);
// Never hard-deletes: admins get a 409 pointing at Teams & Roles > Remove.
router.delete("/:id", requireOrgRole(["org_admin", "platform_admin"]), validate(userIdParamsValidator), userController.deleteUser);

// User profile routes (combined from userProfile.routes.ts)
router.use(isAuthenticated);

router.get("/profiles/me", userProfileController.getMine);
router.get("/profiles/:userId", userProfileController.getByUserId);
router.put("/profiles/me", userProfileController.saveMine);

export default router;
