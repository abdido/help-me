import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../auth/auth.middleware';
import { requireRole } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '@prisma/helpdesk-password-client';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/', asyncHandler(UsersController.list));
router.get('/:id', asyncHandler(UsersController.getById));
router.post('/', asyncHandler(UsersController.create));
router.patch('/:id', asyncHandler(UsersController.update));
router.delete('/:id', asyncHandler(UsersController.delete));

export default router;
