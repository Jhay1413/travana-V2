import { Router } from 'express';
import { homeworkerController } from './homeworker.controller';
import { requireAnyOrgRole, requireOrgRole } from '../../middlewares/auth/require-org-role';
import { validate } from '../../middlewares/validation.middleware';
import {
  createHomeworkerSchema,
  finaliseStatementSchema,
  myStatementQuerySchema,
  statementQuerySchema,
  homeworkerBranchParamsSchema,
  listHomeworkersSchema,
  updateHomeworkerSchema,
} from './homeworker.validator';

const router = Router();

const adminOnly = requireOrgRole(['org_admin', 'platform_admin']);

// Checks the full role union so a homeworker is recognised whatever their primary role.
const requireHomeworker = requireAnyOrgRole(['homeworker']);

router.post('/',                    adminOnly, validate(createHomeworkerSchema), homeworkerController.invite);
router.get('/',                     adminOnly, validate(listHomeworkersSchema), homeworkerController.list);
// "me" must come before /:branchId so it is not parsed as a branch id.
router.get('/me',                   requireHomeworker, homeworkerController.me);
router.get('/me/statement',         requireHomeworker, validate(myStatementQuerySchema), homeworkerController.myStatement);
router.get('/:branchId/statement',  adminOnly, validate(statementQuerySchema), homeworkerController.statement);
router.post('/:branchId/statement/finalise', adminOnly, validate(finaliseStatementSchema), homeworkerController.finaliseStatement);
router.patch('/:branchId',          adminOnly, validate(updateHomeworkerSchema), homeworkerController.update);
router.post('/:branchId/archive',   adminOnly, validate(homeworkerBranchParamsSchema), homeworkerController.archive);

export default router;
