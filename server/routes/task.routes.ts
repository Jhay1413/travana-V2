import { Router } from "express";
import { taskController } from "../controllers/task.controller";

const router = Router();

router.get("/all", taskController.listAll);
router.get("/", taskController.listByEntity);
router.get("/user", taskController.listByUser);
router.post("/", taskController.create);
router.put("/:id/toggle", taskController.toggleComplete);
router.delete("/:id", taskController.remove);

export default router;
