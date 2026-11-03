import { Router } from 'express';
import { requireOrgRole } from '../../middlewares/auth/require-org-role';
import { noResponseLog } from '../../middlewares/no-response-log';
import { validate } from '../../middlewares/validation.middleware';
import { OPERATOR_OPTION_ROLES, OPERATOR_READER_ROLES, OPERATOR_WRITER_ROLES } from './tour-operator-access';
import { tourOperatorController } from './tour-operator.controller';
import {
  catalogueValidator,
  createValidator,
  importValidator,
  linkParamValidator,
  listValidator,
  patchValidator,
} from './tour-operator.validator';

const router = Router();

// Responses here can carry operator logins: keep them out of the request log.
router.use(noResponseLog);
// The service re-checks role and organisation on each call (fail closed).
// Every staff role except social media managers / referral agents may read the page data;
// social media managers get ONLY the credential-free dropdown options (GET /).
const readers = requireOrgRole(OPERATOR_READER_ROLES);

const writers = requireOrgRole(OPERATOR_WRITER_ROLES);

// Literal paths first so "manage", "catalogue", "export" and "import" are never read as a :linkId.
router.get('/', requireOrgRole(OPERATOR_OPTION_ROLES), validate(listValidator), tourOperatorController.listOptions);
router.get('/manage', readers, validate(listValidator), tourOperatorController.listManage);
router.get('/catalogue', readers, validate(catalogueValidator), tourOperatorController.searchCatalogue);
router.get('/export', readers, tourOperatorController.exportCsv);
router.post('/import/preview', readers, writers, validate(importValidator), tourOperatorController.previewImport);
router.post('/import', readers, writers, validate(importValidator), tourOperatorController.applyImport);
router.post('/', readers, writers, validate(createValidator), tourOperatorController.create);
router.get('/:linkId/password', readers, validate(linkParamValidator), tourOperatorController.revealPassword);
router.patch('/:linkId', readers, writers, validate(patchValidator), tourOperatorController.update);
router.delete('/:linkId', readers, writers, validate(linkParamValidator), tourOperatorController.remove);

export default router;
