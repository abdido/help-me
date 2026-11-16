import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get('/stats', asyncHandler(DashboardController.getStats));

export default router;
