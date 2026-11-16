import api from './api';
import type { TicketNotification } from '@helpdesk/shared';

export const notificationService = {
  getUnreadCount: async (): Promise<number> => {
    const res = await api.get<{ data: { count: number } }>('/notifications/unread-count');
    return res.data.data.count;
  },

  getNotifications: async (): Promise<TicketNotification[]> => {
    const res = await api.get<{ data: TicketNotification[] }>('/notifications');
    return res.data.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all');
  },
};
