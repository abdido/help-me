import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import { sendPasswordResetEmail } from '../../lib/mail';
import { config } from '../../config';
import { UserRole } from '@prisma/helpdesk-password-client';
import { UnauthorizedError, ConflictError } from '../../utils/errors';

interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  credentialVersion: string;
  sessionId: string;
}

const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class AuthService {
  private static tokenPayload(user: { id: string; email: string; role: UserRole; passwordHash: string }, sessionId: string): TokenPayload {
    return { userId: user.id, email: user.email, role: user.role, credentialVersion: this.credentialVersion(user.passwordHash), sessionId };
  }

  private static async startSession(user: { id: string; email: string; role: UserRole; passwordHash: string }) {
    const sessionId = randomUUID();
    const payload = this.tokenPayload(user, sessionId);
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = jwt.sign({ ...payload, tokenType: 'refresh' }, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiry as SignOptions['expiresIn'],
      jwtid: randomUUID(),
    });
    const { exp } = this.verifyToken(refreshToken, 'refresh');
    await prisma.$transaction([
      prisma.authSession.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } }),
      prisma.authSession.create({
        data: { id: sessionId, userId: user.id, refreshHash: hashRefreshToken(refreshToken), expiresAt: new Date(exp * 1000) },
      }),
    ]);
    return { accessToken, refreshToken };
  }

  static credentialVersion(passwordHash: string): string {
    return createHmac('sha256', config.jwt.secret).update(passwordHash).digest('hex');
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) return;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetLink = `${config.passwordResetUrl}?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      console.error('Password reset email could not be delivered:', error instanceof Error ? error.message : 'Unknown SMTP error');
    }
  }

  static async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true } });
    if (!record || record.expiresAt <= new Date()) throw new UnauthorizedError('This password reset link is invalid or expired');

    const passwordHash = await this.hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.deleteMany({
        where: { id: record.id, tokenHash, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw new UnauthorizedError('This password reset link is invalid or expired');
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    });
  }

  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, tokenType: 'access' }, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry as SignOptions['expiresIn'],
    });
  }

  static verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): TokenPayload & { exp: number } {
    try {
      const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || payload.tokenType !== tokenType ||
          typeof payload.userId !== 'string' || typeof payload.credentialVersion !== 'string' ||
          typeof payload.sessionId !== 'string' || typeof payload.exp !== 'number') {
        throw new Error('Invalid token type');
      }
      return payload as TokenPayload & { exp: number };
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  static async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await this.hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: UserRole.CUSTOMER,
      },
    });

    const tokens = await this.startSession(user);

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...tokens };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.startSession(user);

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...tokens };
  }

  static async refresh(refreshToken: string) {
    const payload = this.verifyToken(refreshToken, 'refresh');
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive || payload.credentialVersion !== this.credentialVersion(user.passwordHash)) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const newPayload = this.tokenPayload(user, payload.sessionId);
    const accessToken = this.generateAccessToken(newPayload);
    const nextRefreshToken = jwt.sign({ ...newPayload, exp: payload.exp, tokenType: 'refresh' }, config.jwt.secret, {
      jwtid: randomUUID(),
    });
    const updated = await prisma.authSession.updateMany({
      where: {
        id: payload.sessionId,
        userId: user.id,
        refreshHash: hashRefreshToken(refreshToken),
        expiresAt: { gt: new Date() },
      },
      data: { refreshHash: hashRefreshToken(nextRefreshToken) },
    });
    if (updated.count !== 1) throw new UnauthorizedError('Session expired or refresh token already used');

    return { accessToken, refreshToken: nextRefreshToken };
  }

  static async logout(refreshToken: string) {
    // A refresh may have rotated this token while the browser was signing out.
    // A signed token from the same session may revoke it, but only the latest can renew it.
    const payload = this.verifyToken(refreshToken, 'refresh');
    await prisma.authSession.deleteMany({ where: { id: payload.sessionId, userId: payload.userId } });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
