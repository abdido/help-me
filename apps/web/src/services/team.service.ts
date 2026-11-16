import api from './api';
import type { Team } from '@helpdesk/shared';

export const teamService = {
  getTeams: async (): Promise<Team[]> => {
    const res = await api.get<{ data: Team[] }>('/teams');
    return res.data.data;
  },

  createTeam: async (data: { name: string; description?: string | null }): Promise<Team> => {
    const res = await api.post<{ data: Team }>('/teams', data);
    return res.data.data;
  },

  updateTeam: async (id: string, data: { name: string; description?: string | null }): Promise<Team> => {
    const res = await api.patch<{ data: Team }>(`/teams/${id}`, data);
    return res.data.data;
  },

  setAgents: async (id: string, agentIds: string[]): Promise<Team> => {
    const res = await api.put<{ data: Team }>(`/teams/${id}/agents`, { agentIds });
    return res.data.data;
  },

  deleteTeam: async (id: string): Promise<void> => {
    await api.delete(`/teams/${id}`);
  },
};
