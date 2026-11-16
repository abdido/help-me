import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

export class NotificationsController {
  static async list(req: Request, res: Response) {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
    });
    sendSuccess(res, notifications);
  }

  static async unreadCount(req: Request, res: Response) {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, readAt: null },
    });
    sendSuccess(res, { count });
  }

  static async markRead(req: Request, res: Response) {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const notification = await prisma.notification.findFirst({
        where: { id: req.params.id, userId: req.user!.userId },
        select: { id: true },
      });
      if (!notification) throw new NotFoundError('Notification');
    }
    sendSuccess(res, null, 200, 'Notification marked as read');
  }

  static async markAllRead(req: Request, res: Response) {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    sendSuccess(res, null, 200, 'All notifications marked as read');
  }
}
