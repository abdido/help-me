import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { userService } from '@/services/user.service';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { UserRole } from '@helpdesk/shared';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const roleBadge: Record<string, 'blue' | 'orange' | 'gray'> = {
  ADMIN: 'orange',
  AGENT: 'blue',
  USER: 'blue',
  CUSTOMER: 'gray',
};

export function UserListPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: UserRole.CUSTOMER as string,
    isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: () => userService.getUsers({ role: roleFilter || undefined, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      userService.createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        role: form.role as UserRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      userService.updateUser(editingUser.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role as UserRole,
        isActive: form.isActive,
        password: form.password || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ firstName: '', lastName: '', email: '', password: '', role: UserRole.CUSTOMER, isActive: true });
    setModalOpen(true);
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="AGENT">Agent</option>
          <option value="USER">Internal User</option>
          <option value="CUSTOMER">Customer</option>
        </select>
        <div className="ml-auto">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Spinner size="lg" className="mt-20" />
      ) : !data?.data?.length ? (
        <EmptyState message="No users found" />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="px-5 py-3 font-medium text-gray-600">Email</th>
                <th className="px-5 py-3 font-medium text-gray-600">Role</th>
                <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3 font-medium text-gray-600">Created</th>
                <th className="px-5 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <Badge variant={roleBadge[u.role] || 'gray'}>{u.role}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={u.isActive ? 'green' : 'red'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {format(new Date(u.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={update('firstName')} required />
            <Input label="Last Name" value={form.lastName} onChange={update('lastName')} required />
          </div>
          {!editingUser && (
            <>
              <Input label="Email" type="email" value={form.email} onChange={update('email')} required />
              <Input label="Password" type="password" value={form.password} onChange={update('password')} required />
            </>
          )}
          {editingUser && (
            <Input
              label="Replace Password (leave blank to keep current)"
              type="password"
              value={form.password}
              onChange={update('password')}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
            />
          )}
          <Select
            label="Role"
            value={form.role}
            onChange={update('role')}
            options={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'AGENT', label: 'Agent' },
              { value: 'USER', label: 'Internal User' },
              { value: 'CUSTOMER', label: 'Customer' },
            ]}
          />
          {editingUser && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Account active
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
