// ============================================================
// @helpdesk/shared — Shared Types & Interfaces
// ============================================================

// ---- Enums ----

export enum UserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  CUSTOMER = 'CUSTOMER',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketSource {
  WEB = 'WEB',
  EMAIL = 'EMAIL',
  CHAT = 'CHAT',
  API = 'API',
}

// ---- User Types ----

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
  avatarUrl?: string | null;
}

// ---- Auth Types ----

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// ---- Ticket Types ----

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  requesterId: string;
  assigneeId?: string | null;
  categoryId?: string | null;
  requester?: User;
  assignee?: User | null;
  category?: Category | null;
  comments?: TicketComment[];
  _count?: { comments: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketDto {
  subject: string;
  description: string;
  priority: TicketPriority;
  categoryId?: string;
  source?: TicketSource;
}

export interface UpdateTicketDto {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
  categoryId?: string | null;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---- Comment Types ----

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  author?: User;
  createdAt: string;
}

export interface CreateCommentDto {
  body: string;
  isInternal?: boolean;
}

// ---- Category Types ----

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  _count?: { tickets: number };
  children?: Category[];
  createdAt: string;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

// ---- Dashboard Types ----

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  pendingTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  avgResponseTime?: number; // in minutes
  todayTickets: number;
  unassignedTickets: number;
}

export interface TicketsByPriority {
  priority: TicketPriority;
  count: number;
}

export interface TicketsByCategory {
  category: string;
  count: number;
}

export interface TicketTrend {
  date: string;
  created: number;
  resolved: number;
}

export interface DashboardData {
  stats: DashboardStats;
  byPriority: TicketsByPriority[];
  byCategory: TicketsByCategory[];
  recentTickets: Ticket[];
  trends: TicketTrend[];
}

// ---- Pagination ----

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ---- API Response ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}
