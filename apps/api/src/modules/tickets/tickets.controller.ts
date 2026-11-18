import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { Prisma, TicketStatus, TicketPriority, TicketSource, UserRole } from '@prisma/helpdesk-password-client';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { parsePagination } from '../../utils/pagination';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';
import { createNotifications, getStaffNotificationRecipients } from '../notifications/notifications.service';
import { z } from 'zod';
import { getAgentTeamId, isRequesterRole, ticketAccessScope } from './ticket-access';

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.MEDIUM),
  categoryId: z.string().uuid().optional(),
  source: z.nativeEnum(TicketSource).optional().default(TicketSource.WEB),
});

const updateTicketSchema = z.object({
  subject: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

const createCommentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().optional().default(false),
});

async function ensureTicketVisible(user: NonNullable<Request['user']>, ticket: { id: string; requesterId: string; assigneeId: string | null; categoryId: string | null }, db: Prisma.TransactionClient = prisma) {
  if (user.role === UserRole.ADMIN) return;
  if (isRequesterRole(user.role)) {
    if (ticket.requesterId !== user.userId) throw new ForbiddenError('You can only view your own tickets');
    return;
  }
  const visible = await db.ticket.findFirst({
    where: { id: ticket.id, ...ticketAccessScope(user) },
    select: { id: true },
  });
  if (visible) return;
  throw new ForbiddenError('You do not have access to this ticket');
}

function ensureTicketClaimedByAgent(user: NonNullable<Request['user']>, ticket: { assigneeId: string | null }) {
  if (user.role === UserRole.AGENT && ticket.assigneeId !== user.userId) {
    throw new ForbiddenError('Take this ticket before updating it or replying');
  }
}

async function lockTicket(tx: Prisma.TransactionClient, id: string) {
  // Serialize ticket writes so authorization sees the current assignee.
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM tickets WHERE id = ${id} FOR UPDATE`;
  if (!locked.length) throw new NotFoundError('Ticket');
}

export class TicketsController {
  static async list(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query as any);
    const { status, priority, assigneeId, categoryId, search, sortBy, sortOrder } = req.query;

    const where: any = {};

    where.AND = [ticketAccessScope(req.user!)];

    if (status && Object.values(TicketStatus).includes(status as TicketStatus)) {
      where.status = status;
    }
    if (priority && Object.values(TicketPriority).includes(priority as TicketPriority)) {
      where.priority = priority;
    }
    if (assigneeId) where.assigneeId = assigneeId;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      const searchClause = { OR: [
        { subject: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { ticketNumber: { contains: search as string, mode: 'insensitive' } },
      ] };
      where.AND = [...(where.AND || []), searchClause];
    }

    const orderBy: any = {};
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'ticketNumber'];
    const field = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    orderBy[field] = sortOrder === 'asc' ? 'asc' : 'desc';
    const visibleComments = isRequesterRole(req.user!.role) ? { isInternal: false } : {};

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          category: { select: { id: true, name: true } },
          _count: { select: { comments: { where: visibleComments } } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    sendPaginated(res, tickets, total, page, limit);
  }

  static async getById(req: Request, res: Response) {
    const visibleComments = isRequesterRole(req.user!.role) ? { isInternal: false } : {};
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
        category: true,
        comments: {
          where: visibleComments,
          include: {
            author: {
              select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            changedBy: {
              select: { id: true, email: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { comments: { where: visibleComments } } },
      },
    });

    if (!ticket) throw new NotFoundError('Ticket');

    await ensureTicketVisible(req.user!, ticket);

    sendSuccess(res, ticket);
  }

  static async create(req: Request, res: Response) {
    const data = createTicketSchema.parse(req.body);
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) throw new BadRequestError('Category does not exist');
    }
    const ticket = await prisma.$transaction(async (tx) => {
      // Serialize number allocation across API processes until commit.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1847201)`;
      const [counter] = await tx.$queryRaw<{ next: string }[]>`
        SELECT (COALESCE(MAX(substring(ticket_number from '^TK-([0-9]+)$')::bigint), 0) + 1)::text AS next FROM tickets
      `;
      const ticketNumber = `TK-${counter.next.padStart(4, '0')}`;
      const created = await tx.ticket.create({
        data: {
          ticketNumber,
          history: { create: { changedById: req.user!.userId, fieldName: 'created', newValue: ticketNumber } },
          subject: data.subject,
          description: data.description,
          priority: data.priority,
          source: data.source,
          requesterId: req.user!.userId,
          categoryId: data.categoryId,
          assigneeId: null,
        },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          category: { select: { id: true, name: true, teamId: true } },
        },
      });
      const recipients = await getStaffNotificationRecipients(tx, null, req.user!.userId, created.category?.teamId);
      await createNotifications(tx, recipients, created.id, 'Tiket baru perlu ditinjau', `${ticketNumber} - ${created.subject}`);
      return created;
    });

    sendSuccess(res, ticket, 201, 'Ticket created');
  }

  static async update(req: Request, res: Response) {
    const data = updateTicketSchema.parse(req.body);
    const ticket = await prisma.$transaction(async (tx) => {
      await lockTicket(tx, req.params.id);
      const existing = await tx.ticket.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Ticket');
      await ensureTicketVisible(req.user!, existing, tx);
      ensureTicketClaimedByAgent(req.user!, existing);

      const actingTeamId = req.user!.role === UserRole.AGENT ? await getAgentTeamId(req.user!.userId, tx) : null;

      if (data.assigneeId) {
        const assignee = await tx.user.findUnique({ where: { id: data.assigneeId }, select: { role: true, isActive: true } });
        if (!assignee || !assignee.isActive || (assignee.role !== UserRole.AGENT && assignee.role !== UserRole.ADMIN)) {
          throw new BadRequestError('Assignee must be an active agent or admin');
        }
      }
      if (data.categoryId) {
        const category = await tx.category.findUnique({ where: { id: data.categoryId }, select: { id: true, teamId: true } });
        if (!category) throw new BadRequestError('Category does not exist');
        if (req.user!.role === UserRole.AGENT && category.teamId !== actingTeamId) {
          throw new ForbiddenError('You can only route tickets to categories in your team');
        }
      }
      if (req.user!.role === UserRole.AGENT && data.assigneeId) {
        const assignee = await tx.user.findUnique({ where: { id: data.assigneeId }, select: { role: true, isActive: true, teamId: true } });
        if (!assignee || !assignee.isActive || assignee.role !== UserRole.AGENT || assignee.teamId !== actingTeamId) {
          throw new BadRequestError('You can only assign tickets to active agents in your team');
        }
      }

      if (data.assigneeId === null && (data.status ?? existing.status) === TicketStatus.IN_PROGRESS) {
        data.status = TicketStatus.OPEN;
      }

      // Track changes for history
      const changes: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];
      const updateData: any = {};

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && (existing as any)[key] !== value) {
          changes.push({
            fieldName: key,
            oldValue: (existing as any)[key]?.toString() ?? null,
            newValue: value?.toString() ?? null,
          });
          updateData[key] = value;
        }
      }

      if (changes.length === 0) return existing;

      const ticket = await tx.ticket.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          category: true,
          _count: { select: { comments: true } },
        },
      });
      await tx.ticketHistory.createMany({
        data: changes.map((change) => ({ ...change, ticketId: ticket.id, changedById: req.user!.userId })),
      });

      const changedFields = changes.map((change) => change.fieldName).join(', ');
      await createNotifications(
        tx,
        [existing.requesterId],
        ticket.id,
        'Tiket diperbarui',
        `${ticket.ticketNumber} — ${changedFields}`,
      );
      if (data.assigneeId && data.assigneeId !== existing.assigneeId) {
        await createNotifications(
          tx,
          [data.assigneeId],
          ticket.id,
          'Tiket ditugaskan kepada Anda',
          `${ticket.ticketNumber} — ${ticket.subject}`,
        );
      }

      const enteredQueue = !ticket.assigneeId && ticket.status === TicketStatus.OPEN &&
        (existing.assigneeId || existing.status !== TicketStatus.OPEN || existing.categoryId !== ticket.categoryId);
      if (enteredQueue) {
        const recipients = await getStaffNotificationRecipients(tx, null, req.user!.userId, ticket.category?.teamId);
        await createNotifications(tx, recipients, ticket.id, 'Tiket kembali ke antrean', `${ticket.ticketNumber} - ${ticket.subject}`);
      }
      return ticket;
    });
    sendSuccess(res, ticket, 200, 'Ticket updated');
  }

  static async addComment(req: Request, res: Response) {
    const data = createCommentSchema.parse(req.body);
    const comment = await prisma.$transaction(async (tx) => {
      await lockTicket(tx, req.params.id);
      const ticket = await tx.ticket.findUnique({
        where: { id: req.params.id },
        include: { category: { select: { teamId: true } } },
      });
      if (!ticket) throw new NotFoundError('Ticket');
      await ensureTicketVisible(req.user!, ticket, tx);
      ensureTicketClaimedByAgent(req.user!, ticket);

      // Only AGENT/ADMIN can create internal comments
      if (data.isInternal && isRequesterRole(req.user!.role)) {
        throw new ForbiddenError('Customers cannot create internal comments');
      }

      // Customers can only comment on their own tickets
      const comment = await tx.ticketComment.create({
        data: {
          ticketId: req.params.id,
          authorId: req.user!.userId,
          body: data.body,
          isInternal: data.isInternal,
        },
        include: {
          author: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
        },
      });

      if (isRequesterRole(req.user!.role)) {
        const recipients = await getStaffNotificationRecipients(tx, ticket.assigneeId, req.user!.userId, ticket.category?.teamId);
        await createNotifications(
          tx,
          recipients,
          ticket.id,
          'Balasan customer baru',
          `${ticket.ticketNumber} — ${ticket.subject}`,
        );
      } else if (data.isInternal) {
        const recipients = await getStaffNotificationRecipients(tx, ticket.assigneeId, req.user!.userId, ticket.category?.teamId);
        await createNotifications(
          tx,
          recipients,
          ticket.id,
          'Catatan internal baru',
          `${ticket.ticketNumber} — ${ticket.subject}`,
        );
      } else {
        await createNotifications(
          tx,
          [ticket.requesterId],
          ticket.id,
          'Balasan baru pada tiket Anda',
          `${ticket.ticketNumber} — ${ticket.subject}`,
        );
      }
      return comment;
    });
    sendSuccess(res, comment, 201, 'Comment added');
  }

  static async getComments(req: Request, res: Response) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { category: { select: { teamId: true } } },
    });
    if (!ticket) throw new NotFoundError('Ticket');
    await ensureTicketVisible(req.user!, ticket);

    const where: any = { ticketId: req.params.id };
    // Filter out internal comments for customers
    if (isRequesterRole(req.user!.role)) {
      where.isInternal = false;
    }

    const comments = await prisma.ticketComment.findMany({
      where,
      include: {
        author: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    sendSuccess(res, comments);
  }

  static async assign(req: Request, res: Response) {
    const { assigneeId } = z.object({ assigneeId: z.string().uuid() }).parse(req.body);

    // Keep assignments on the same transaction and permission path as edits.
    req.body = { assigneeId };
    await TicketsController.update(req, res);
  }

  static async claim(req: Request, res: Response) {
    if (req.user!.role !== UserRole.AGENT) throw new ForbiddenError('Only agents can take tickets');
    const ticket = await prisma.$transaction(async (tx) => {
      await lockTicket(tx, req.params.id);
      const teamId = await getAgentTeamId(req.user!.userId, tx);
      if (!teamId) throw new BadRequestError('Join an agent team before taking tickets');
      const previous = await tx.ticket.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true } });
      const claimed = await tx.ticket.updateMany({
        where: {
          id: req.params.id,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          assigneeId: null,
          category: { is: { teamId } },
        },
        data: { assigneeId: req.user!.userId, status: TicketStatus.IN_PROGRESS },
      });
      if (claimed.count === 0) {
        throw new BadRequestError('This ticket is no longer available in your team queue');
      }

      await tx.ticketHistory.createMany({
        data: [
          { ticketId: req.params.id, changedById: req.user!.userId, fieldName: 'assigneeId', oldValue: null, newValue: req.user!.userId },
          ...(previous.status === TicketStatus.OPEN ? [{ ticketId: req.params.id, changedById: req.user!.userId, fieldName: 'status', oldValue: TicketStatus.OPEN, newValue: TicketStatus.IN_PROGRESS }] : []),
        ],
      });

      const updated = await tx.ticket.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
          requester: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
          assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
          category: true,
        },
      });
      await createNotifications(tx, [updated.requesterId], updated.id, 'Tiket sedang ditangani',
        `${updated.ticketNumber} - tiket telah diambil oleh agen.`);
      return updated;
    });
    sendSuccess(res, ticket, 200, 'Ticket taken');
  }
}
