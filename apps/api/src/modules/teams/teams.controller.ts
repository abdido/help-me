import { Request, Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/helpdesk-password-client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

const teamSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

const agentsSchema = z.object({
  agentIds: z.array(z.string().uuid()).max(500),
});

const teamInclude = {
  agents: {
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, teamId: true },
    orderBy: { firstName: 'asc' as const },
  },
  categories: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } },
  _count: { select: { agents: true, categories: true } },
};

export class TeamsController {
  static async list(_req: Request, res: Response) {
    const teams = await prisma.team.findMany({ include: teamInclude, orderBy: { name: 'asc' } });
    sendSuccess(res, teams);
  }

  static async create(req: Request, res: Response) {
    const data = teamSchema.parse(req.body);
    const team = await prisma.team.create({ data, include: teamInclude });
    sendSuccess(res, team, 201, 'Team created');
  }

  static async update(req: Request, res: Response) {
    const data = teamSchema.partial().parse(req.body);
    const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError('Team');
    const team = await prisma.team.update({ where: { id: req.params.id }, data, include: teamInclude });
    sendSuccess(res, team, 200, 'Team updated');
  }

  static async setAgents(req: Request, res: Response) {
    const { agentIds } = agentsSchema.parse(req.body);
    const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!team) throw new NotFoundError('Team');

    const uniqueAgentIds = [...new Set(agentIds)];
    if (uniqueAgentIds.length) {
      const validAgents = await prisma.user.count({
        where: { id: { in: uniqueAgentIds }, role: UserRole.AGENT, isActive: true },
      });
      if (validAgents !== uniqueAgentIds.length) {
        throw new BadRequestError('Only active agents can be added to a team');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (uniqueAgentIds.length) {
        await tx.user.updateMany({
          where: { teamId: req.params.id, id: { notIn: uniqueAgentIds } },
          data: { teamId: null },
        });
        await tx.user.updateMany({ where: { id: { in: uniqueAgentIds } }, data: { teamId: req.params.id } });
      } else {
        await tx.user.updateMany({ where: { teamId: req.params.id }, data: { teamId: null } });
      }
      return tx.team.findUniqueOrThrow({ where: { id: req.params.id }, include: teamInclude });
    });

    sendSuccess(res, updated, 200, 'Team agents updated');
  }

  static async delete(req: Request, res: Response) {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { agents: true, categories: true } } },
    });
    if (!team) throw new NotFoundError('Team');
    if (team._count.agents || team._count.categories) {
      throw new BadRequestError('Remove the team agents and category assignments before deleting this team');
    }
    await prisma.team.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 200, 'Team deleted');
  }
}
