import { Router } from "express";
import multer from "multer";
import { hrController } from "./hr.controller";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";

const ALLOWED_DOC_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const docUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

const hrRoles = requireOrgRole(["branch_manager", "org_admin", "platform_admin"]);
// Self-service: every authenticated org member can view + request leave on their own record.
const selfRoles = requireOrgRole(["agent", "homeworker", "referral_agent", "branch_manager", "org_admin", "platform_admin"]);

// Self-service endpoints — must come BEFORE the dynamic /:userId routes so
// "me" isn't matched as a userId.
router.get("/me",         selfRoles, hrController.getMe);
router.post("/me/leave",  selfRoles, hrController.requestMyLeave);

router.get("/employees", hrRoles, hrController.list);
router.get("/employees/:userId", hrRoles, hrController.get);
router.get("/reminders", hrRoles, hrController.reminders);

router.post("/employees", hrRoles, hrController.invite);
router.patch("/employees/:userId", hrRoles, hrController.update);

router.post("/employees/:userId/leave", hrRoles, hrController.requestLeave);
router.post("/employees/:userId/leave/:leaveId/approve", hrRoles, hrController.approveLeave);
router.post("/employees/:userId/leave/:leaveId/reject", hrRoles, hrController.rejectLeave);

router.post("/employees/:userId/notes", hrRoles, hrController.addNote);
router.post("/employees/:userId/documents", hrRoles, hrController.addDocument);
router.post(
  "/employees/:userId/documents/upload",
  hrRoles,
  docUpload.single("file"),
  hrController.uploadDocumentFile,
);
router.get("/employees/:userId/documents/:docId/download", hrRoles, hrController.downloadDocument);
router.delete("/employees/:userId/documents/:docId", hrRoles, hrController.deleteDocument);

export default router;
