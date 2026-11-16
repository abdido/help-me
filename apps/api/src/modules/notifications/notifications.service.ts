import { UserRole } from '@prisma/helpdesk-password-client';
import prisma from '../../lib/prisma';

export async function createNotifications(
  userIds: string[],
  ticketId: string,
  title: string,
  message: string,
) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return;

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({ userId, ticketId, title, message })),
  });
}

export async function getStaffNotificationRecipients(
  assigneeId: string | null,
  excludedUserId?: string,
  teamId?: string | null,
) {
  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { in: [UserRole.ADMIN, UserRole.AGENT] } },
    select: { id: true, role: true, teamId: true },
  });

  return staff
    .filter((user) => !excludedUserId || user.id !== excludedUserId)
    .filter((user) => user.role === UserRole.ADMIN || (
      assigneeId ? user.id === assigneeId : teamId ? user.role === UserRole.AGENT && user.teamId === teamId : user.role === UserRole.AGENT
    ))
    .map((user) => user.id);
}

