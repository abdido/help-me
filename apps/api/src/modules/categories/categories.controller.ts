import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { sendSuccess } from '../../utils/response';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  teamId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export class CategoriesController {
  static async list(_req: Request, res: Response) {
    const categories = await prisma.category.findMany({
      include: {
        children: true,
        team: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    sendSuccess(res, categories);
  }

  static async create(req: Request, res: Response) {
    const data = createCategorySchema.parse(req.body);

    if (data.teamId) await validateCategoryTeam(data.teamId);

    if (data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new NotFoundError('Parent category');
    }

    const category = await prisma.category.create({
      data,
      include: {
        children: true,
        team: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
    });
    sendSuccess(res, category, 201, 'Category created');
  }

  static async update(req: Request, res: Response) {
    const data = updateCategorySchema.parse(req.body);
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError('Category');

    if (data.teamId && data.teamId !== existing.teamId) await validateCategoryTeam(data.teamId);

    if (data.parentId === req.params.id) {
      throw new BadRequestError('A category cannot be its own parent');
    }
    if (data.parentId) {
      let ancestorId: string | null = data.parentId;
      while (ancestorId) {
        if (ancestorId === req.params.id) {
          throw new BadRequestError('A category cannot be moved under one of its descendants');
        }
        const ancestor: { parentId: string | null } | null = await prisma.category.findUnique({
          where: { id: ancestorId },
          select: { parentId: true },
        });
        if (!ancestor) throw new NotFoundError('Parent category');
        ancestorId = ancestor.parentId;
      }
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
      include: {
        children: true,
        team: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
    });
    sendSuccess(res, category, 200, 'Category updated');
  }

  static async delete(req: Request, res: Response) {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tickets: true } } },
    });
    if (!category) throw new NotFoundError('Category');

    if (category._count.tickets > 0) {
      throw new BadRequestError('Cannot delete category with existing tickets');
    }

    const children = await prisma.category.count({ where: { parentId: req.params.id } });
    if (children > 0) {
      throw new BadRequestError('Cannot delete category with child categories');
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 200, 'Category deleted');
  }
}

async function validateCategoryTeam(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) throw new BadRequestError('Team does not exist');
}
