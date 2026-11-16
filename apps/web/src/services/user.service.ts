import api from './api';
import type {
  User,
  CreateUserDto,
  UpdateUserDto,
  PaginatedResponse,
} from '@helpdesk/shared';

export const userService = {
  getUsers: async (filters?: { role?: string; page?: number; limit?: number }): Promise<PaginatedResponse<User>> => {
    const res = await api.get<PaginatedResponse<User>>('/users', { params: filters });
    return res.data;
  },

  getUser: async (id: string): Promise<User> => {
    const res = await api.get<{ data: User }>(`/users/${id}`);
    return res.data.data;
  },

  createUser: async (data: CreateUserDto): Promise<User> => {
    const res = await api.post<{ data: User }>('/users', data);
    return res.data.data;
  },

  updateUser: async (id: string, data: UpdateUserDto): Promise<User> => {
    const res = await api.patch<{ data: User }>(`/users/${id}`, data);
    return res.data.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
