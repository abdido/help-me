import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketService } from '@/services/ticket.service';
import { userService } from '@/services/user.service';
import { categoryService } from '@/services/category.service';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { UserRole, TicketStatus, TicketPriority } from '@helpdesk/shared';
import { format } from 'date-fns';
import { MessageSquare, Lock } from 'lucide-react';
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

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAgentOrAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.AGENT;
  const isAdmin = user?.role === UserRole.ADMIN;

  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketService.getTicket(id!),
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => ticketService.getComments(id!),
    enabled: !!id,
  });

  const { data: agents } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => userService.getUsers({ role: 'AGENT', limit: 100 }),
    enabled: isAdmin,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.getCategories,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => ticketService.updateTicket(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Ticket updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Update failed');
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => ticketService.addComment(id!, { body: commentBody, isInternal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setCommentBody('');
      setIsInternal(false);
      toast.success('Comment added');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add comment');
    },
  });

  const claimMutation = useMutation({
    mutationFn: () => ticketService.claimTicket(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Ticket taken and moved to In Progress');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Ticket is no longer available'),
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    commentMutation.mutate();
  };

  if (isLoading) return <Spinner size="lg" className="mt-20" />;
  if (!ticket) return null;

  const sb = statusBadge[ticket.status] || statusBadge.OPEN;
  const pb = priorityBadge[ticket.priority] || priorityBadge.MEDIUM;
  const canManageTicket = isAdmin || (user?.role === UserRole.AGENT && ticket.assigneeId === user.id);

  // Combine agents list: include admins too
  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...(agents?.data?.map((u) => ({
      value: u.id,
      label: `${u.firstName} ${u.lastName}`,
    })) || []),
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Main content (left) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">{ticket.ticketNumber}</h2>
            <Badge variant={sb.variant}>{sb.label}</Badge>
            <Badge variant={pb.variant}>{pb.label}</Badge>
            {user?.role === UserRole.AGENT && !ticket.assigneeId &&
              (ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.IN_PROGRESS) && (
              <Button size="sm" loading={claimMutation.isPending} onClick={() => claimMutation.mutate()}>
                Take Ticket
              </Button>
            )}
          </div>
          <h3 className="mt-2 text-lg text-gray-800">{ticket.subject}</h3>
        </div>

        {/* Description */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">Description</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Comments */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
            </h4>
          </div>
          <div className="divide-y divide-gray-100">
            {comments?.map((comment) => {
              // Skip internal comments for non-agent/admin users
              if (comment.isInternal && !isAgentOrAdmin) return null;
              const isOwnComment = comment.authorId === user?.id;
              return (
                <div
                  key={comment.id}
                  className={`p-5 ${comment.isInternal ? 'bg-amber-50 border-l-4 border-amber-400' : ''}`}
                >
                  {comment.isInternal && (
                    <div className="mb-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                      <Lock className="h-3 w-3" />
                      Internal Note
                    </div>
                  )}
                  <div className={`flex w-full items-start gap-3 ${isOwnComment ? 'flex-row-reverse justify-start text-right' : ''}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${isOwnComment ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                      {comment.author?.firstName?.[0]}
                      {comment.author?.lastName?.[0]}
                    </div>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${isOwnComment ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <div className="mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {comment.author
                            ? `${comment.author.firstName} ${comment.author.lastName}`
                            : 'Unknown'}
                          {isOwnComment && <span className="ml-2 text-xs font-normal text-emerald-700">You</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!comments || comments.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-gray-500">No comments yet</div>
            )}
          </div>

          {/* Add comment */}
          <div className="border-t border-gray-200 p-5">
            {user?.role === UserRole.AGENT && !canManageTicket ? (
              <p className="text-sm text-gray-500">Take this ticket to join the conversation.</p>
            ) : <form onSubmit={handleCommentSubmit} className="space-y-3">
              <textarea
                rows={3}
                placeholder="Write a comment..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex items-center justify-between">
                {isAgentOrAdmin && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Internal note
                  </label>
                )}
                {!isAgentOrAdmin && <span />}
                <Button type="submit" size="sm" loading={commentMutation.isPending}>
                  Add Comment
                </Button>
              </div>
            </form>}
          </div>
        </div>
      </div>

      {/* Sidebar (right) */}
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            {canManageTicket ? (
              <select
                value={ticket.status}
                onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(TicketStatus).map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <Badge variant={sb.variant}>{sb.label}</Badge>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
            {canManageTicket ? (
              <select
                value={ticket.priority}
                onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(TicketPriority).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <Badge variant={pb.variant}>{pb.label}</Badge>
            )}
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
            {isAdmin ? (
              <select
                value={ticket.assigneeId || ''}
                onChange={(e) =>
                  updateMutation.mutate({ assigneeId: e.target.value || null })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assigneeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-700">
                {ticket.assignee
                  ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                  : 'Unassigned'}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            {isAdmin ? (
              <select
                value={ticket.categoryId || ''}
                onChange={(e) =>
                  updateMutation.mutate({ categoryId: e.target.value || null })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-700">{ticket.category?.name || 'None'}</p>
            )}
          </div>

          {/* Dates */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Created</label>
            <p className="text-sm text-gray-700">
              {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Updated</label>
            <p className="text-sm text-gray-700">
              {format(new Date(ticket.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
          </div>

          {/* Requester */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Requester</label>
            <p className="text-sm text-gray-700">
              {ticket.requester
                ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
