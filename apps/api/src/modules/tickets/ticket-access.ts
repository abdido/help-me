import { Prisma, UserRole } from '@prisma/helpdesk-password-client';
import prisma from '../../lib/prisma';

type Actor = NonNullable<Express.Request['user']>;

export function isRequesterRole(role: UserRole) {
  return role === UserRole.CUSTOMER || role === UserRole.USER;
}

export async function getAgentTeamId(userId: string, db: Prisma.TransactionClient = prisma) {
  const agent = await db.user.findFirst({
    where: { id: userId, role: UserRole.AGENT, isActive: true },
    select: { teamId: true },
  });
  return agent?.teamId ?? null;
}

export function ticketAccessScope(actor: Actor): Prisma.TicketWhereInput {
  if (actor.role === UserRole.ADMIN) return {};
  if (isRequesterRole(actor.role)) return { requesterId: actor.userId };

  return {
    OR: [
      { assigneeId: actor.userId },
      { category: { is: { team: { is: { agents: { some: { id: actor.userId, role: UserRole.AGENT, isActive: true } } } } } } },
    ],
  };
}
