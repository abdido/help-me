import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/helpdesk-password-client';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthService } from './auth.service';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const payload = AuthService.verifyToken(token);
  const session = await prisma.authSession.findFirst({
    where: { id: payload.sessionId, userId: payload.userId, expiresAt: { gt: new Date() } },
    select: { user: { select: { id: true, email: true, role: true, isActive: true, passwordHash: true } } },
  });
  const user = session?.user;
  if (!user || !user.isActive || payload.credentialVersion !== AuthService.credentialVersion(user.passwordHash)) {
    throw new UnauthorizedError('Session expired or account inactive');
  }
  req.user = { userId: user.id, email: user.email, role: user.role };
  next();
});

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}
