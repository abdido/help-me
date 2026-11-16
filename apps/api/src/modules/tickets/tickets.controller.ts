import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { TicketStatus, TicketPriority, TicketSource, UserRole } from '@prisma/helpdesk-password-client';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { parsePagination } from '../../utils/pagination';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';
import { createNotifications, getStaffNotificationRecipients } from '../notifications/notifications.service';
import { z } from 'zod';

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

async function generateTicketNumber(): Promise<string> {
  const last = await prisma.ticket.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { ticketNumber: true },
  });

  if (!last) return 'TK-0001';

  const lastNum = parseInt(last.ticketNumber.split('-')[1], 10);
  return `TK-${String(lastNum + 1).padStart(4, '0')}`;
}

function isRequesterRole(role: UserRole): boolean {
  return role === UserRole.CUSTOMER || role === UserRole.USER;
}

async function getAgentTeamId(userId: string): Promise<string | null> {
  const agent = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true, role: true, isActive: true },
  });
  return agent?.isActive && agent.role === UserRole.AGENT ? agent.teamId : null;
}

async function ensureTicketVisible(user: NonNullable<Request['user']>, ticket: { id: string; requesterId: string; assigneeId: string | null; categoryId: string | null }) {
  if (user.role === UserRole.ADMIN) return;
  if (isRequesterRole(user.role)) {
    if (ticket.requesterId !== user.userId) throw new ForbiddenError('You can only view your own tickets');
    return;
  }
  if (user.role === UserRole.AGENT) {
    if (ticket.assigneeId === user.userId) return;
    const teamId = await getAgentTeamId(user.userId);
    if (teamId && ticket.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: ticket.categoryId }, select: { teamId: true } });
      if (category?.teamId === teamId) return;
    }
  }
  throw new ForbiddenError('You do not have access to this ticket');
}

function ensureTicketClaimedByAgent(user: NonNullable<Request['user']>, ticket: { assigneeId: string | null }) {
  if (user.role === UserRole.AGENT && ticket.assigneeId !== user.userId) {
    throw new ForbiddenError('Take this ticket before updating it or replying');
  }
}

export class TicketsController {
  static async list(req: Request, res: Response) {
    const { page, limit, skip } = parsePagination(req.query as any);
    const { status, priority, assigneeId, categoryId, search, sortBy, sortOrder } = req.query;

    const where: any = {};

    // Requesters only see their own tickets; agents see their team's queue and tickets assigned to them.
    if (isRequesterRole(req.user!.role)) {
      where.requesterId = req.user!.userId;
    } else if (req.user!.role === UserRole.AGENT) {
      const teamId = await getAgentTeamId(req.user!.userId);
      const teamScope: any[] = [{ assigneeId: req.user!.userId }];
      if (teamId) teamScope.push({ category: { is: { teamId } } });
      where.AND = [{ OR: teamScope }];
    }

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
          _count: { select: { comments: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    sendPaginated(res, tickets, total, page, limit);
  }

  static async getById(req: Request, res: Response) {
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
        _count: { select: { comments: true } },
      },
    });

    if (!ticket) throw new NotFoundError('Ticket');

    await ensureTicketVisible(req.user!, ticket);

    // Filter out internal comments for customers
    if (isRequesterRole(req.user!.role)) {
      ticket.comments = ticket.comments.filter((c) => !c.isInternal);
    }

    sendSuccess(res, ticket);
  }

  static async create(req: Request, res: Response) {
    const data = createTicketSchema.parse(req.body);
    let teamId: string | null = null;
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true, teamId: true },
      });
      if (!category) throw new BadRequestError('Category does not exist');
      teamId = category.teamId;
    }
    const ticketNumber = await generateTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
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

    // Create history entry for ticket creation
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: req.user!.userId,
        fieldName: 'created',
        newValue: ticketNumber,
      },
    });

    const staffRecipients = await getStaffNotificationRecipients(null, req.user!.userId, teamId);
    await createNotifications(
      staffRecipients,
      ticket.id,
      'Tiket baru perlu ditinjau',
      `${ticketNumber} — ${ticket.subject}`,
    );

    sendSuccess(res, ticket, 201, 'Ticket created');
  }

  static async update(req: Request, res: Response) {
    const data = updateTicketSchema.parse(req.body);
    const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError('Ticket');
    await ensureTicketVisible(req.user!, existing);
    ensureTicketClaimedByAgent(req.user!, existing);

    const actingTeamId = req.user!.role === UserRole.AGENT ? await getAgentTeamId(req.user!.userId) : null;

    if (data.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { role: true, isActive: true } });
      if (!assignee || !assignee.isActive || (assignee.role !== UserRole.AGENT && assignee.role !== UserRole.ADMIN)) {
        throw new BadRequestError('Assignee must be an active agent or admin');
      }
    }
    if (data.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true, teamId: true } });
      if (!category) throw new BadRequestError('Category does not exist');
      if (req.user!.role === UserRole.AGENT && category.teamId !== actingTeamId) {
        throw new ForbiddenError('You can only route tickets to categories in your team');
      }
    }
    if (req.user!.role === UserRole.AGENT && data.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId }, select: { role: true, isActive: true, teamId: true } });
      if (!assignee || !assignee.isActive || assignee.role !== UserRole.AGENT || assignee.teamId !== actingTeamId) {
        throw new BadRequestError('You can only assign tickets to active agents in your team');
      }
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

    if (Object.keys(updateData).length === 0) {
      sendSuccess(res, existing, 200, 'No changes');
      return;
    }

    const [ticket] = await prisma.$transaction([
      prisma.ticket.update({
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
      }),
      ...changes.map((change) =>
        prisma.ticketHistory.create({
          data: {
            ticketId: req.params.id,
            changedById: req.user!.userId,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
          },
        }),
      ),
    ]);

    const changedFields = changes.map((change) => change.fieldName).join(', ');
    await createNotifications(
      [existing.requesterId],
      ticket.id,
      'Tiket diperbarui',
      `${ticket.ticketNumber} — ${changedFields}`,
    );
    if (data.assigneeId && data.assigneeId !== existing.assigneeId) {
      await createNotifications(
        [data.assigneeId],
        ticket.id,
        'Tiket ditugaskan kepada Anda',
        `${ticket.ticketNumber} — ${ticket.subject}`,
      );
    }

    sendSuccess(res, ticket, 200, 'Ticket updated');
  }

  static async addComment(req: Request, res: Response) {
    const data = createCommentSchema.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { category: { select: { teamId: true } } },
    });
    if (!ticket) throw new NotFoundError('Ticket');
    await ensureTicketVisible(req.user!, ticket);
    ensureTicketClaimedByAgent(req.user!, ticket);

    // Only AGENT/ADMIN can create internal comments
    if (data.isInternal && isRequesterRole(req.user!.role)) {
      throw new ForbiddenError('Customers cannot create internal comments');
    }

    // Customers can only comment on their own tickets
    const comment = await prisma.ticketComment.create({
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
      const recipients = await getStaffNotificationRecipients(ticket.assigneeId, req.user!.userId, ticket.category?.teamId);
      await createNotifications(
        recipients,
        ticket.id,
        'Balasan customer baru',
        `${ticket.ticketNumber} — ${ticket.subject}`,
      );
    } else if (data.isInternal) {
      const recipients = await getStaffNotificationRecipients(ticket.assigneeId, req.user!.userId, ticket.category?.teamId);
      await createNotifications(
        recipients,
        ticket.id,
        'Catatan internal baru',
        `${ticket.ticketNumber} — ${ticket.subject}`,
      );
    } else {
      await createNotifications(
        [ticket.requesterId],
        ticket.id,
        'Balasan baru pada tiket Anda',
        `${ticket.ticketNumber} — ${ticket.subject}`,
      );
    }

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

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) throw new NotFoundError('Ticket');
    await ensureTicketVisible(req.user!, ticket);
    ensureTicketClaimedByAgent(req.user!, ticket);

    // Verify assignee is an agent or admin
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || !assignee.isActive || (assignee.role !== UserRole.AGENT && assignee.role !== UserRole.ADMIN)) {
      throw new BadRequestError('Assignee must be an agent or admin');
    }
    if (req.user!.role === UserRole.AGENT) {
      const teamId = await getAgentTeamId(req.user!.userId);
      if (assignee.role !== UserRole.AGENT || assignee.teamId !== teamId) {
        throw new BadRequestError('You can only assign tickets to active agents in your team');
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: req.params.id },
        data: { assigneeId },
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          category: true,
        },
      }),
      prisma.ticketHistory.create({
        data: {
          ticketId: req.params.id,
          changedById: req.user!.userId,
          fieldName: 'assigneeId',
          oldValue: ticket.assigneeId,
          newValue: assigneeId,
        },
      }),
    ]);

    if (ticket.assigneeId !== assigneeId) {
      await createNotifications(
        [ticket.requesterId],
        ticket.id,
        'Tiket ditugaskan',
        `${ticket.ticketNumber} — tiket ditugaskan ke agen penanganan.`,
      );
      if (assigneeId !== req.user!.userId) {
        await createNotifications(
          [assigneeId],
          ticket.id,
          'Tiket baru ditugaskan kepada Anda',
          `${ticket.ticketNumber} — ${ticket.subject}`,
        );
      }
    }

    sendSuccess(res, updated, 200, 'Ticket assigned');
  }

  static async claim(req: Request, res: Response) {
    if (req.user!.role !== UserRole.AGENT) throw new ForbiddenError('Only agents can take tickets');
    const teamId = await getAgentTeamId(req.user!.userId);
    if (!teamId) throw new BadRequestError('Join an agent team before taking tickets');

    const ticket = await prisma.$transaction(async (tx) => {
      const claimed = await tx.ticket.updateMany({
        where: {
          id: req.params.id,
          status: TicketStatus.OPEN,
          assigneeId: null,
          category: { is: { teamId } },
        },
        data: { assigneeId: req.user!.userId, status: TicketStatus.IN_PROGRESS },
      });
      if (claimed.count === 0) {
        const exists = await tx.ticket.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!exists) throw new NotFoundError('Ticket');
        throw new BadRequestError('This ticket is no longer available in your team queue');
      }

      await tx.ticketHistory.createMany({
        data: [
          { ticketId: req.params.id, changedById: req.user!.userId, fieldName: 'assigneeId', oldValue: null, newValue: req.user!.userId },
          { ticketId: req.params.id, changedById: req.user!.userId, fieldName: 'status', oldValue: TicketStatus.OPEN, newValue: TicketStatus.IN_PROGRESS },
        ],
      });

      return tx.ticket.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
          requester: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
          assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
          category: true,
        },
      });
    });

    await createNotifications(
      [ticket.requesterId],
      ticket.id,
      'Tiket sedang ditangani',
      `${ticket.ticketNumber} — tiket telah diambil oleh agen.`,
    );
    sendSuccess(res, ticket, 200, 'Ticket taken');
  }
}
