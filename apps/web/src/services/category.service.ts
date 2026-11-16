import api from './api';
import type { Category, CreateCategoryDto } from '@helpdesk/shared';

export const categoryService = {
  getCategories: async (): Promise<Category[]> => {
    const res = await api.get<{ data: Category[] }>('/categories');
    return res.data.data;
  },

  createCategory: async (data: CreateCategoryDto): Promise<Category> => {
    const res = await api.post<{ data: Category }>('/categories', data);
    return res.data.data;
  },

  updateCategory: async (id: string, data: Partial<CreateCategoryDto>): Promise<Category> => {
    const res = await api.patch<{ data: Category }>(`/categories/${id}`, data);
    return res.data.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};
