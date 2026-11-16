import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { format } from 'date-fns';
import type { TicketStatus, TicketPriority } from '@helpdesk/shared';

const statusBadge: Record<string, { variant: 'blue' | 'green' | 'yellow' | 'orange' | 'gray'; label: string }> = {
  OPEN: { variant: 'blue', label: 'Open' },
  IN_PROGRESS: { variant: 'yellow', label: 'In Progress' },
  PENDING: { variant: 'orange', label: 'Pending' },
  RESOLVED: { variant: 'green', label: 'Resolved' },
  CLOSED: { variant: 'gray', label: 'Closed' },
};

const priorityBadge: Record<string, { variant: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray'; label: string }> = {
  LOW: { variant: 'gray', label: 'Low' },
  MEDIUM: { variant: 'blue', label: 'Medium' },
  HIGH: { variant: 'orange', label: 'High' },
  URGENT: { variant: 'red', label: 'Urgent' },
};

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-400',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [recentPage, setRecentPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', recentPage],
    queryFn: () => dashboardService.getDashboardData(recentPage),
  });

  useEffect(() => {
    if (data && recentPage > data.recentTicketsMeta.totalPages) {
      setRecentPage(data.recentTicketsMeta.totalPages);
    }
  }, [data, recentPage]);

  if (isLoading) {
    return <Spinner size="lg" className="mt-20" />;
  }

  if (!data) return null;

  const stats = [
    { label: 'Total Tickets', value: data.stats.totalTickets, icon: Ticket, color: 'bg-blue-500' },
    { label: 'Open', value: data.stats.openTickets, icon: AlertCircle, color: 'bg-blue-500' },
    { label: 'In Progress', value: data.stats.inProgressTickets, icon: Clock, color: 'bg-yellow-500' },
    { label: 'Resolved', value: data.stats.resolvedTickets, icon: CheckCircle2, color: 'bg-green-500' },
  ];

  const maxPriority = Math.max(...(data.byPriority?.map((p) => p.count) || [1]), 1);
  const maxCategory = Math.max(...(data.byCategory?.map((c) => c.count) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`rounded-lg p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tickets by Priority */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Tickets by Priority</h3>
          <div className="space-y-3">
            {data.byPriority?.map((item) => (
              <div key={item.priority} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600">{item.priority}</span>
                <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${priorityColors[item.priority] || 'bg-gray-400'}`}
                    style={{ width: `${(item.count / maxPriority) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium text-gray-900">
                  {item.count}
                </span>
              </div>
            ))}
            {(!data.byPriority || data.byPriority.length === 0) && (
              <p className="text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </div>

        {/* Tickets by Category */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Tickets by Category</h3>
          <div className="space-y-3">
            {data.byCategory?.map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <span className="w-28 truncate text-sm text-gray-600">{item.category}</span>
                <div className="flex-1 h-6 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(item.count / maxCategory) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium text-gray-900">
                  {item.count}
                </span>
              </div>
            ))}
            {(!data.byCategory || data.byCategory.length === 0) && (
              <p className="text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tickets table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Recent Tickets</h3>
          {data.recentTicketsMeta.total > data.recentTicketsMeta.limit && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {recentPage} / {data.recentTicketsMeta.totalPages}
              </span>
              <button
                type="button"
                aria-label="Previous tickets"
                disabled={recentPage <= 1}
                onClick={() => setRecentPage((page) => Math.max(1, page - 1))}
                className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next tickets"
                disabled={recentPage >= data.recentTicketsMeta.totalPages}
                onClick={() => setRecentPage((page) => Math.min(data.recentTicketsMeta.totalPages, page + 1))}
                className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 font-medium text-gray-600">#</th>
                <th className="px-5 py-3 font-medium text-gray-600">Subject</th>
                <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3 font-medium text-gray-600">Priority</th>
                <th className="px-5 py-3 font-medium text-gray-600">Requester</th>
                <th className="px-5 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentTickets?.map((ticket) => {
                const sb = statusBadge[ticket.status as string] || statusBadge.OPEN;
                const pb = priorityBadge[ticket.priority as string] || priorityBadge.MEDIUM;
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{ticket.ticketNumber}</td>
                    <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{ticket.subject}</td>
                    <td className="px-5 py-3">
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={pb.variant}>{pb.label}</Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {ticket.requester
                        ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                );
              })}
              {(!data.recentTickets || data.recentTickets.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                    No open, in-progress, or pending tickets
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
