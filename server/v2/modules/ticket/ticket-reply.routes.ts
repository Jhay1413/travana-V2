import { Router } from 'express';
import { ticketReplyController } from './ticket-reply.controller';
import { isAuthenticated } from '../../middlewares/auth';
import { orgBranchScope } from '../../middlewares/org-branch-scope';
import { validate } from '../../middlewares/validation.middleware';
import { createTicketReplyValidator } from './ticket.validator';

const router = Router();

router.use(isAuthenticated, orgBranchScope);

router.get('/ticket/:ticketId', ticketReplyController.listByTicketId);
router.post('/ticket/:ticketId', validate(createTicketReplyValidator), ticketReplyController.createReply);
router.put('/:id', ticketReplyController.updateReply);
router.delete('/:id', ticketReplyController.deleteReply);

export default router;
