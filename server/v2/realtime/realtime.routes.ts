import { Router } from "express";
import { realtimeController } from "./realtime.controller";

const router = Router();

router.get("/stream", realtimeController.stream);

export default router;
