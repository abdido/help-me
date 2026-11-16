import { Router } from 'express';
import { CategoriesController } from './categories.controller';
import { authenticate, requireRole } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '@prisma/helpdesk-password-client';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(CategoriesController.list));
router.post('/', requireRole(UserRole.ADMIN), asyncHandler(CategoriesController.create));
router.patch('/:id', requireRole(UserRole.ADMIN), asyncHandler(CategoriesController.update));
router.delete('/:id', requireRole(UserRole.ADMIN), asyncHandler(CategoriesController.delete));

export default router;
