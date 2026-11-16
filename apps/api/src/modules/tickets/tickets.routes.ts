import { Router } from 'express';
import { TicketsController } from './tickets.controller';
import { authenticate, requireRole } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '@prisma/helpdesk-password-client';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(TicketsController.list));
router.post('/', asyncHandler(TicketsController.create));
router.get('/:id', asyncHandler(TicketsController.getById));
router.post('/:id/claim', requireRole(UserRole.AGENT), asyncHandler(TicketsController.claim));
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.AGENT), asyncHandler(TicketsController.update));
router.post('/:id/comments', asyncHandler(TicketsController.addComment));
router.get('/:id/comments', asyncHandler(TicketsController.getComments));
router.patch('/:id/assign', requireRole(UserRole.ADMIN, UserRole.AGENT), asyncHandler(TicketsController.assign));

export default router;
