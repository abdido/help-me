import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotificationsController } from './notifications.controller';

const router = Router();

router.use(authenticate);
router.get('/', asyncHandler(NotificationsController.list));
router.get('/unread-count', asyncHandler(NotificationsController.unreadCount));
router.patch('/read-all', asyncHandler(NotificationsController.markAllRead));
router.patch('/:id/read', asyncHandler(NotificationsController.markRead));

export default router;
