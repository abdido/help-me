import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketService } from '@/services/ticket.service';
import { categoryService } from '@/services/category.service';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { TicketPriority } from '@helpdesk/shared';
import toast from 'react-hot-toast';

export function CreateTicketPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: TicketPriority.MEDIUM as string,
    categoryId: '',
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.getCategories,
  });

  const mutation = useMutation({
    mutationFn: () =>
      ticketService.createTicket({
        subject: form.subject,
        description: form.description,
        priority: form.priority as TicketPriority,
        categoryId: form.categoryId || undefined,
      }),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Ticket created!');
      navigate(`/tickets/${ticket.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">Create New Ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Subject"
            placeholder="Brief description of the issue"
            value={form.subject}
            onChange={update('subject')}
            required
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={5}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Provide details about the issue..."
              value={form.description}
              onChange={update('description')}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Priority"
              value={form.priority}
              onChange={update('priority')}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
            />
            <Select
              label="Category"
              value={form.categoryId}
              onChange={update('categoryId')}
              placeholder="Select category"
              options={
                categories?.map((c) => ({ value: c.id, label: c.name })) || []
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/tickets')}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create Ticket
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
