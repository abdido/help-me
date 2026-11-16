import { Router } from 'express';
import { UserRole } from '@prisma/helpdesk-password-client';
import { authenticate, requireRole } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { TeamsController } from './teams.controller';

const router = Router();
router.use(authenticate, requireRole(UserRole.ADMIN));
router.get('/', asyncHandler(TeamsController.list));
router.post('/', asyncHandler(TeamsController.create));
router.patch('/:id', asyncHandler(TeamsController.update));
router.put('/:id/agents', asyncHandler(TeamsController.setAgents));
router.delete('/:id', asyncHandler(TeamsController.delete));

export default router;
