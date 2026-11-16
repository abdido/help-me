import api from './api';
import type {
  Ticket,
  CreateTicketDto,
  UpdateTicketDto,
  TicketFilters,
  TicketComment,
  CreateCommentDto,
  PaginatedResponse,
} from '@helpdesk/shared';

export const ticketService = {
  getTickets: async (filters?: TicketFilters): Promise<PaginatedResponse<Ticket>> => {
    const res = await api.get<PaginatedResponse<Ticket>>('/tickets', { params: filters });
    return res.data;
  },

  getTicket: async (id: string): Promise<Ticket> => {
    const res = await api.get<{ data: Ticket }>(`/tickets/${id}`);
    return res.data.data;
  },

  createTicket: async (data: CreateTicketDto): Promise<Ticket> => {
    const res = await api.post<{ data: Ticket }>('/tickets', data);
    return res.data.data;
  },

  updateTicket: async (id: string, data: UpdateTicketDto): Promise<Ticket> => {
    const res = await api.patch<{ data: Ticket }>(`/tickets/${id}`, data);
    return res.data.data;
  },

  assignTicket: async (id: string, assigneeId: string): Promise<Ticket> => {
    const res = await api.patch<{ data: Ticket }>(`/tickets/${id}/assign`, { assigneeId });
    return res.data.data;
  },

  claimTicket: async (id: string): Promise<Ticket> => {
    const res = await api.post<{ data: Ticket }>(`/tickets/${id}/claim`);
    return res.data.data;
  },

  getComments: async (id: string): Promise<TicketComment[]> => {
    const res = await api.get<{ data: TicketComment[] }>(`/tickets/${id}/comments`);
    return res.data.data;
  },

  addComment: async (id: string, data: CreateCommentDto): Promise<TicketComment> => {
    const res = await api.post<{ data: TicketComment }>(`/tickets/${id}/comments`, data);
    return res.data.data;
  },
};
