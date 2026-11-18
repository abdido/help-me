import { Prisma, UserRole } from '@prisma/helpdesk-password-client';

export async function createNotifications(
  tx: Prisma.TransactionClient,
  userIds: string[],
  ticketId: string,
  title: string,
  message: string,
) {
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return;

  await tx.notification.createMany({
    data: uniqueUserIds.map((userId) => ({ userId, ticketId, title, message })),
  });
}

export async function getStaffNotificationRecipients(
  tx: Prisma.TransactionClient,
  assigneeId: string | null,
  excludedUserId?: string,
  teamId?: string | null,
) {
  const staff = await tx.user.findMany({
    where: {
      isActive: true,
      id: excludedUserId ? { not: excludedUserId } : undefined,
      OR: [
        { role: UserRole.ADMIN },
        ...(assigneeId ? [{ role: UserRole.AGENT, id: assigneeId }] : []),
        ...(!assigneeId && teamId ? [{ role: UserRole.AGENT, teamId }] : []),
      ],
    },
    select: { id: true },
  });
  return staff.map((user) => user.id);
}
