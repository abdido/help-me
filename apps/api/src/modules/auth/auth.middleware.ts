import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/helpdesk-password-client';
import { AuthService } from './auth.service';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const payload = AuthService.verifyToken(token);
  req.user = payload;
  next();
}

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
