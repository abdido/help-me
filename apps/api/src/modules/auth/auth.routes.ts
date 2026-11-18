import { NextFunction, Request, Response, Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from './auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { limitLogin, limitRegistration } from './auth-rate-limit';
import { config } from '../../config';
import { sendError, sendSuccess } from '../../utils/response';

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

function requireEmailPasswordReset(_req: Request, res: Response, next: NextFunction) {
  if (config.emailPasswordResetEnabled) {
    next();
    return;
  }
  sendError(res, 'Hubungi Call Center atau admin untuk mengatur ulang kata sandi.', 403);
}

router.post('/register', limitRegistration, asyncHandler(AuthController.register));
router.post('/login', limitLogin, asyncHandler(AuthController.login));
router.post('/refresh', asyncHandler(AuthController.refresh));
router.post('/logout', asyncHandler(AuthController.logout));
router.get('/password-recovery', (_req, res) => {
  sendSuccess(res, { emailEnabled: config.emailPasswordResetEnabled });
});
router.post('/forgot-password', requireEmailPasswordReset, limitPasswordResetRequests, asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', requireEmailPasswordReset, asyncHandler(AuthController.resetPassword));
router.get('/me', authenticate, asyncHandler(AuthController.me));

export default router;
