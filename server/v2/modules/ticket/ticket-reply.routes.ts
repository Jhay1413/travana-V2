import { Router } from 'express';
import { ticketReplyController } from './ticket-reply.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { validate } from '../../middlewares/validation.middleware';
import {
  createTicketReplyValidator,
  updateTicketReplyValidator,
  ticketReplyIdValidator,
} from './ticket.validator';
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';

const router = Router();

router.use(isAuthenticated, orgBranchScope);
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.get('/ticket/:ticketId', ticketReplyController.listByTicketId);
router.post('/ticket/:ticketId', validate(createTicketReplyValidator), ticketReplyController.createReply);
router.post('/:id/like', validate(ticketReplyIdValidator), ticketReplyController.toggleLike);
router.put('/:id', validate(updateTicketReplyValidator), ticketReplyController.updateReply);
router.delete('/:id', validate(ticketReplyIdValidator), ticketReplyController.deleteReply);

export default router;
