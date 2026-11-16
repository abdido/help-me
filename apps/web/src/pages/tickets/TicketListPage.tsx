import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ticketService } from '@/services/ticket.service';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { format } from 'date-fns';
import type { TicketFilters } from '@helpdesk/shared';
import { UserRole } from '@helpdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import toast from 'react-hot-toast';

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

export function TicketListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [filters, setFilters] = useState<TicketFilters>({
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => ticketService.getTickets(filters),
  });
  const claimMutation = useMutation({
    mutationFn: ticketService.claimTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Ticket taken and moved to In Progress');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Ticket is no longer available'),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        <select
          value={filters.status || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: (e.target.value || undefined) as TicketFilters['status'],
              page: 1,
            }))
          }
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={filters.priority || ''}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              priority: (e.target.value || undefined) as TicketFilters['priority'],
              page: 1,
            }))
          }
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <div className="ml-auto">
          <Button onClick={() => navigate('/tickets/new')}>
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Spinner size="lg" className="mt-20" />
      ) : !data?.data?.length ? (
        <EmptyState message="No tickets found" description="Create your first ticket to get started." />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 font-medium text-gray-600">#</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Subject</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Priority</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Requester</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Assignee</th>
                  <th className="px-5 py-3 font-medium text-gray-600">Created</th>
                  {user?.role === UserRole.AGENT && <th className="px-5 py-3 font-medium text-gray-600">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((ticket) => {
                  const sb = statusBadge[ticket.status] || statusBadge.OPEN;
                  const pb = priorityBadge[ticket.priority] || priorityBadge.MEDIUM;
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {ticket.ticketNumber}
                      </td>
                      <td className="px-5 py-3 text-gray-700 max-w-xs truncate">
                        {ticket.subject}
                      </td>
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
                      <td className="px-5 py-3 text-gray-600">
                        {ticket.assignee
                          ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                      </td>
                      {user?.role === UserRole.AGENT && (
                        <td className="px-5 py-3" onClick={(event) => event.stopPropagation()}>
                          {ticket.status === 'OPEN' && !ticket.assigneeId ? (
                            <Button size="sm" loading={claimMutation.isPending} onClick={() => claimMutation.mutate(ticket.id)}>
                              Take Ticket
                            </Button>
                          ) : ticket.assigneeId === user.id ? (
                            <span className="text-xs font-medium text-emerald-700">Assigned to you</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.meta && (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
