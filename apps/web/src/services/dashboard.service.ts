import api from './api';
import type { DashboardData } from '@helpdesk/shared';

export const dashboardService = {
  getDashboardData: async (page = 1): Promise<DashboardData> => {
    const res = await api.get<{ data: DashboardData }>('/dashboard/stats', { params: { page } });
    return res.data.data;
  },
};
