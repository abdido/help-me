import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { ticketAccessScope } from '../tickets/ticket-access';

function visibleNotifications(req: Request) {
  const actor = req.user!;
  return { userId: actor.userId, ticket: { is: ticketAccessScope(actor) } };
}

export class NotificationsController {
  static async list(req: Request, res: Response) {
    const scope = visibleNotifications(req);
    const notifications = await prisma.notification.findMany({
      where: scope,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
    });
    sendSuccess(res, notifications);
  }

  static async unreadCount(req: Request, res: Response) {
    const scope = visibleNotifications(req);
    const count = await prisma.notification.count({
      where: { ...scope, readAt: null },
    });
    sendSuccess(res, { count });
  }

  static async markRead(req: Request, res: Response) {
    const scope = visibleNotifications(req);
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, ...scope, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const notification = await prisma.notification.findFirst({
        where: { id: req.params.id, ...scope },
        select: { id: true },
      });
      if (!notification) throw new NotFoundError('Notification');
    }
    sendSuccess(res, null, 200, 'Notification marked as read');
  }

  static async markAllRead(req: Request, res: Response) {
    const scope = visibleNotifications(req);
    await prisma.notification.updateMany({
      where: { ...scope, readAt: null },
      data: { readAt: new Date() },
    });
    sendSuccess(res, null, 200, 'All notifications marked as read');
  }
}
