import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { teamService } from '@/services/team.service';
import { userService } from '@/services/user.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

export function TeamsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', agentIds: [] as string[] });

  const { data: teams, isLoading } = useQuery({ queryKey: ['teams'], queryFn: teamService.getTeams });
  const { data: agentsPage } = useQuery({
    queryKey: ['users-agents'],
    queryFn: () => userService.getUsers({ role: 'AGENT', limit: 100 }),
  });
  const agents = useMemo(() => agentsPage?.data.filter((agent) => agent.isActive) || [], [agentsPage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { name: form.name, description: form.description || null };
      const team = editingTeam
        ? await teamService.updateTeam(editingTeam.id, data)
        : await teamService.createTeam(data);
      return teamService.setAgents(team.id, form.agentIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(editingTeam ? 'Team updated' : 'Team created');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save team'),
  });

  const deleteMutation = useMutation({
    mutationFn: teamService.deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Remove agents and category assignments before deleting'),
  });

  const openCreate = () => {
    setEditingTeam(null);
    setForm({ name: '', description: '', agentIds: [] });
    setModalOpen(true);
  };

  const openEdit = (team: any) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      description: team.description || '',
      agentIds: team.agents.map((agent: { id: string }) => agent.id),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTeam(null);
  };

  const toggleAgent = (agentId: string) => {
    setForm((current) => ({
      ...current,
      agentIds: current.agentIds.includes(agentId)
        ? current.agentIds.filter((id) => id !== agentId)
        : [...current.agentIds, agentId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Group agents by the work they handle.</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Team</Button>
      </div>

      {isLoading ? <Spinner size="lg" className="mt-20" /> : !teams?.length ? (
        <EmptyState message="No teams yet" description="Create a team and add agents to it." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <section key={team.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{team.name}</h2>
                  {team.description && <p className="mt-1 text-sm text-gray-500">{team.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(team)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={`Edit ${team.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(team.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${team.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <UsersRound className="h-4 w-4" />
                {team._count?.agents ?? team.agents?.length ?? 0} agents · {team._count?.categories ?? team.categories?.length ?? 0} categories
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {team.agents?.length ? team.agents.map((agent) => (
                  <span key={agent.id} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {agent.firstName} {agent.lastName}
                  </span>
                )) : <span className="text-sm text-gray-400">No agents assigned</span>}
              </div>
              {team.categories?.length ? (
                <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  Categories: {team.categories.map((category) => category.name).join(', ')}
                </p>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editingTeam ? 'Edit Team' : 'Create Team'}>
        <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          <Input label="Team name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <Input label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Agents</legend>
            <p className="text-xs text-gray-500">An agent can belong to one team. Selecting an agent moves them from their current team.</p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {agents.length ? agents.map((agent) => {
                const otherTeam = teams?.find((team) => team.id === agent.teamId);
                return (
                  <label key={agent.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={form.agentIds.includes(agent.id)} onChange={() => toggleAgent(agent.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="flex-1">{agent.firstName} {agent.lastName}</span>
                    {otherTeam && otherTeam.id !== editingTeam?.id && <span className="text-xs text-gray-400">Currently {otherTeam.name}</span>}
                  </label>
                );
              }) : <p className="px-2 py-3 text-sm text-gray-500">No active agents available.</p>}
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editingTeam ? 'Save Changes' : 'Create Team'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
