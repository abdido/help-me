import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { TicketStatus, TicketPriority, UserRole } from '@prisma/helpdesk-password-client';
import { sendSuccess } from '../../utils/response';

export class DashboardController {
  static async getStats(req: Request, res: Response) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isRequester = req.user?.role === UserRole.CUSTOMER || req.user?.role === UserRole.USER;
    let agentTeamId: string | null = null;
    let agentId: string | null = null;
    let scope: any = {};
    if (isRequester) {
      scope = { requesterId: req.user!.userId };
    } else if (req.user?.role === UserRole.AGENT) {
      agentId = req.user.userId;
      const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
      agentTeamId = agent?.teamId ?? null;
      const teamScope: any[] = [{ assigneeId: agentId }];
      if (agentTeamId) teamScope.push({ category: { is: { teamId: agentTeamId } } });
      scope = { OR: teamScope };
    }
    const requesterId = isRequester ? req.user!.userId : null;
    const rawPage = typeof req.query.page === 'string' ? req.query.page : '1';
    const parsedPage = Number.parseInt(rawPage, 10);
    const recentPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const recentLimit = 5;
    const recentSkip = (recentPage - 1) * recentLimit;
    const recentWhere = {
      ...scope,
      status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING] },
    };

    // Get all status counts in parallel
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      pendingTickets,
      resolvedTickets,
      closedTickets,
      todayTickets,
      unassignedTickets,
      byPriorityRaw,
      byCategoryRaw,
      recentTicketTotal,
      recentTickets,
      trendsRaw,
    ] = await Promise.all([
      prisma.ticket.count({ where: scope }),
      prisma.ticket.count({ where: { ...scope, status: TicketStatus.OPEN } }),
      prisma.ticket.count({ where: { ...scope, status: TicketStatus.IN_PROGRESS } }),
      prisma.ticket.count({ where: { ...scope, status: TicketStatus.PENDING } }),
      prisma.ticket.count({ where: { ...scope, status: TicketStatus.RESOLVED } }),
      prisma.ticket.count({ where: { ...scope, status: TicketStatus.CLOSED } }),
      prisma.ticket.count({ where: { ...scope, createdAt: { gte: todayStart } } }),
      prisma.ticket.count({ where: { ...scope, assigneeId: null } }),
      // By priority
      prisma.ticket.groupBy({
        by: ['priority'],
        _count: { id: true },
        where: scope,
      }),
      // By category
      prisma.ticket.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        where: { ...scope, categoryId: { not: null } },
      }),
      // Active tickets only; paginate in status-priority order.
      prisma.ticket.count({ where: recentWhere }),
      prisma.ticket.findMany({
        where: recentWhere,
        skip: recentSkip,
        take: recentLimit,
        // TicketStatus enum order starts OPEN, IN_PROGRESS, then PENDING.
        // TicketPriority enum descending order is URGENT, HIGH, MEDIUM, LOW.
        // Newest tickets come first when status and priority are equal.
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
          category: { select: { id: true, name: true } },
        },
      }),
      // Trends: last 7 days
      prisma.$queryRaw<{ date: Date; created: bigint; resolved: bigint }[]>`
        SELECT
          d::date as date,
          COALESCE((SELECT COUNT(*) FROM tickets t WHERE DATE(t.created_at) = d::date AND (
            (${requesterId}::text IS NOT NULL AND t.requester_id = ${requesterId}) OR
            (${requesterId}::text IS NULL AND ${agentTeamId}::text IS NULL AND ${agentId}::text IS NULL) OR
            (${agentTeamId}::text IS NOT NULL AND EXISTS (SELECT 1 FROM categories c WHERE c.id = t.category_id AND c.team_id = ${agentTeamId})) OR
            (${agentId}::text IS NOT NULL AND t.assignee_id = ${agentId})
          )), 0) as created,
          COALESCE((SELECT COUNT(*) FROM tickets t WHERE DATE(t.updated_at) = d::date AND t.status = 'RESOLVED' AND (
            (${requesterId}::text IS NOT NULL AND t.requester_id = ${requesterId}) OR
            (${requesterId}::text IS NULL AND ${agentTeamId}::text IS NULL AND ${agentId}::text IS NULL) OR
            (${agentTeamId}::text IS NOT NULL AND EXISTS (SELECT 1 FROM categories c WHERE c.id = t.category_id AND c.team_id = ${agentTeamId})) OR
            (${agentId}::text IS NOT NULL AND t.assignee_id = ${agentId})
          )), 0) as resolved
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          '1 day'::interval
        ) d
        ORDER BY d
      `,
    ]);

    // Build by-priority array
    const byPriority = Object.values(TicketPriority).map((p) => ({
      priority: p,
      count: byPriorityRaw.find((r) => r.priority === p)?._count.id ?? 0,
    }));

    // Build by-category array
    const categoryIds = byCategoryRaw.map((r) => r.categoryId!);
    const categories = categoryIds.length
      ? await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const byCategory = byCategoryRaw.map((r) => ({
      category: categoryMap.get(r.categoryId!) || 'Unknown',
      count: r._count.id,
    }));

    // Build trends array
    const trends = trendsRaw.map((t) => ({
      date: new Date(t.date).toISOString().split('T')[0],
      created: Number(t.created),
      resolved: Number(t.resolved),
    }));

    const stats = {
      totalTickets,
      openTickets,
      inProgressTickets,
      pendingTickets,
      resolvedTickets,
      closedTickets,
      todayTickets,
      unassignedTickets,
    };

    sendSuccess(res, {
      stats,
      byPriority,
      byCategory,
      recentTickets,
      recentTicketsMeta: {
        total: recentTicketTotal,
        page: recentPage,
        limit: recentLimit,
        totalPages: Math.max(1, Math.ceil(recentTicketTotal / recentLimit)),
      },
      trends,
    });
  }
}
