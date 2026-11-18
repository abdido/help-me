import api from './api';
import type { LoginDto, RegisterDto, AuthResponse, User } from '@helpdesk/shared';

export const authService = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const res = await api.post<{ data: AuthResponse }>('/auth/login', data);
    return res.data.data;
  },

  register: async (data: RegisterDto): Promise<AuthResponse> => {
    const res = await api.post<{ data: AuthResponse }>('/auth/register', data);
    return res.data.data;
  },

  getMe: async (): Promise<User> => {
    const res = await api.get<{ data: User }>('/auth/me');
    return res.data.data;
  },

  getPasswordRecovery: async (): Promise<{ emailEnabled: boolean }> => {
    const res = await api.get<{ data: { emailEnabled: boolean } }>('/auth/password-recovery');
    return res.data.data;
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, password: string): Promise<void> => {
    await api.post('/auth/reset-password', { token, password });
  },

};
