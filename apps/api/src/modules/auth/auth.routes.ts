import { NextFunction, Request, Response, Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from './auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();
const passwordResetRequests = new Map<string, { startedAt: number; count: number }>();

function limitPasswordResetRequests(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (passwordResetRequests.size > 1000) {
    for (const [ip, window] of passwordResetRequests) {
      if (now - window.startedAt >= 15 * 60 * 1000) passwordResetRequests.delete(ip);
    }
  }
  const current = passwordResetRequests.get(key);
  if (!current || now - current.startedAt >= 15 * 60 * 1000) {
    passwordResetRequests.set(key, { startedAt: now, count: 1 });
  } else if (current.count >= 5) {
    res.status(429).json({ success: false, message: 'Too many password reset requests. Try again later.' });
    return;
  } else {
    current.count += 1;
  }
  next();
}

router.post('/register', asyncHandler(AuthController.register));
router.post('/login', asyncHandler(AuthController.login));
router.post('/refresh', asyncHandler(AuthController.refresh));
router.post('/forgot-password', limitPasswordResetRequests, asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', asyncHandler(AuthController.resetPassword));
router.get('/me', authenticate, asyncHandler(AuthController.me));

export default router;
