import { createHash } from 'node:crypto';
import { Request } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';

const windowMs = 15 * 60 * 1000;
let nextCleanup = 0;

type Rule = { scope: string; limit: number; identifier: (req: Request) => string | undefined };

const clientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';

function limitRequests(...rules: Rule[]) {
  return asyncHandler(async (req, res, next) => {
    const now = new Date();
    if (now.getTime() >= nextCleanup) {
      nextCleanup = now.getTime() + windowMs;
      await prisma.authRateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
    }

    for (const { scope, limit, identifier } of rules) {
      const value = identifier(req);
      if (!value) continue;
      const key = createHash('sha256').update(scope + ':' + value).digest('hex');
      const accepted = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO auth_rate_limits (key, count, expires_at)
        VALUES (${key}, 1, ${new Date(now.getTime() + windowMs)})
        ON CONFLICT (key) DO UPDATE
          SET count = CASE WHEN auth_rate_limits.expires_at <= ${now} THEN 1 ELSE auth_rate_limits.count + 1 END,
              expires_at = CASE WHEN auth_rate_limits.expires_at <= ${now} THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END
          WHERE auth_rate_limits.expires_at <= ${now} OR auth_rate_limits.count < ${limit}
        RETURNING count
      `;
      if (!accepted.length) {
        res.set('Retry-After', String(windowMs / 1000));
        res.status(429).json({ success: false, message: 'Too many requests. Try again later.' });
        return;
      }
    }
    next();
  });
}

export const limitLogin = limitRequests(
  { scope: 'login-ip', limit: 60, identifier: clientIp },
  {
    scope: 'login-account',
    limit: 10,
    identifier: (req) => typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined,
  },
);

export const limitRegistration = limitRequests({ scope: 'register-ip', limit: 10, identifier: clientIp });
