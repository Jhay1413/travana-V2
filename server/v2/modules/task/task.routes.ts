import { Router } from "express";
import { taskController } from "./task.controller";
import { validate } from '../../middlewares/validation.middleware';
import { createTaskSchema, updateTaskSchema } from './task.validator';
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';

const router = Router();
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.get("/all", taskController.listAll);
router.get("/all-extended", taskController.listAllExtended);
router.get("/", taskController.listByEntity);
router.get("/user", taskController.listByUser);
router.post("/", validate(createTaskSchema), taskController.create);
router.put("/:id/toggle", taskController.toggleComplete);
router.put("/:id", validate(updateTaskSchema), taskController.update);
router.delete("/:id", taskController.remove);

export default router;
