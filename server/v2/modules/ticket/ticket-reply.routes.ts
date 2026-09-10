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

const router = Router();

router.use(isAuthenticated, orgBranchScope);

router.get('/ticket/:ticketId', ticketReplyController.listByTicketId);
router.post('/ticket/:ticketId', validate(createTicketReplyValidator), ticketReplyController.createReply);
router.post('/:id/like', validate(ticketReplyIdValidator), ticketReplyController.toggleLike);
router.put('/:id', validate(updateTicketReplyValidator), ticketReplyController.updateReply);
router.delete('/:id', validate(ticketReplyIdValidator), ticketReplyController.deleteReply);

export default router;
