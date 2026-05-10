import { Router } from "express";
import { userController } from "./user.controller";
import { userProfileController } from "./user-profile.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createUserValidator, updateUserValidator } from "./user.validator";
import { isAuthenticated } from "../../middlewares/auth";

const router = Router();

router.get("/", userController.listUsers);
router.get("/:id", userController.getUserById);
router.post("/", validate(createUserValidator), userController.createUser);
router.patch("/:id", validate(updateUserValidator), userController.updateUser);
router.delete("/:id", userController.deleteUser);

// User profile routes (combined from userProfile.routes.ts)
router.use(isAuthenticated);

router.get("/profiles/me", userProfileController.getMine);
router.get("/profiles/:userId", userProfileController.getByUserId);
router.put("/profiles/me", userProfileController.saveMine);

export default router;
