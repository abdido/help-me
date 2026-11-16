import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { UserRole } from '@prisma/helpdesk-password-client';
import { AuthService } from '../auth/auth.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { parsePagination } from '../../utils/pagination';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.nativeEnum(UserRole),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
  avatarUrl: z.string().nullable().optional(),
});

export class UsersController {
  static async list(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query as any);
    const roleFilter = req.query.role as UserRole | undefined;

    const where: any = {};
    if (roleFilter && Object.values(UserRole).includes(roleFilter)) {
      where.role = roleFilter;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          teamId: true,
          avatarUrl: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    sendPaginated(res, users, total, page, limit);
  }

  static async getById(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        teamId: true,
        avatarUrl: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundError('User');
    sendSuccess(res, user);
  }

  static async create(req: Request, res: Response) {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestError('Email already in use');

    const passwordHash = await AuthService.hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        teamId: true,
        avatarUrl: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    sendSuccess(res, user, 201, 'User created');
  }

  static async update(req: Request, res: Response) {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new NotFoundError('User');

    const { password, ...profileData } = data;
    const updateData: typeof profileData & { teamId?: string | null; passwordHash?: string } = { ...profileData };
    if ((profileData.role && profileData.role !== UserRole.AGENT) || profileData.isActive === false) {
      updateData.teamId = null;
    }
    if (password) updateData.passwordHash = await AuthService.hashPassword(password);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          teamId: true,
          avatarUrl: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (password) await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return updatedUser;
    });
    sendSuccess(res, updated, 200, 'User updated');
  }

  static async delete(req: Request, res: Response) {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new NotFoundError('User');

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    sendSuccess(res, null, 200, 'User deactivated');
  }
}
