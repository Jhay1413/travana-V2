import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { validate } from "../middlewares/validation.middleware";
import { createUserValidator, updateUserValidator } from "../validators/user.validator";

const router = Router();

router.get("/", userController.listUsers);
router.get("/:id", userController.getUserById);
router.post("/", validate(createUserValidator), userController.createUser);
router.patch("/:id", validate(updateUserValidator), userController.updateUser);
router.delete("/:id", userController.deleteUser);

export default router;
