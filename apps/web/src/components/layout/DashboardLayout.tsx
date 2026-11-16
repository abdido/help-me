import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Ticket,
  FolderTree,
  Users,
  LogOut,
  Bell,
  Menu,
  X,
  Check,
  UsersRound,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { notificationService } from '@/services/notification.service';
import type { TicketNotification } from '@helpdesk/shared';
import { UserRole } from '@helpdesk/shared';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/categories', label: 'Categories', icon: FolderTree, adminOnly: true },
  { to: '/teams', label: 'Agent Teams', icon: UsersRound, adminOnly: true },
  { to: '/users', label: 'Users', icon: Users, adminOnly: true },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tickets': 'Tickets',
  '/tickets/new': 'New Ticket',
  '/categories': 'Categories',
  '/teams': 'Agent Teams',
  '/users': 'Users',
};

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 15_000,
  });
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: notificationService.getNotifications,
    enabled: notificationsOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: (_, notificationId) => {
      queryClient.setQueryData<TicketNotification[]>(['notifications', 'list'], (current) =>
        current?.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<TicketNotification[]>(['notifications', 'list'], (current) =>
        current?.map((notification) => ({ ...notification, readAt })),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const openNotification = async (notification: TicketNotification) => {
    if (!notification.readAt) {
      try {
        await markReadMutation.mutateAsync(notification.id);
      } catch {
        // Keep navigation available even if marking the notification fails.
      }
    }
    setNotificationsOpen(false);
    if (notification.ticket) navigate(`/tickets/${notification.ticket.id}`);
  };

  const pageTitle =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/tickets/') ? 'Ticket Detail' : 'Helpdesk');

  const isAdmin = user?.role === UserRole.ADMIN;

  const toggleTheme = () => {
    const nextIsDark = !isDarkMode;
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.classList.toggle('dark', nextIsDark);
    window.setTimeout(() => root.classList.remove('theme-transition'), 280);
    localStorage.setItem('helpdesk-theme', nextIsDark ? 'dark' : 'light');
    setIsDarkMode(nextIsDark);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-700">
          <span className="text-2xl">🎧</span>
          <span className="text-lg font-bold text-white">Helpdesk</span>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.to === '/tickets' && unreadCount > 0 && (
                  <span
                    aria-label={`${unreadCount} unread ticket notifications`}
                    className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-slate-400">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6">
          <button
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={isDarkMode}
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {isDarkMode
                ? <Moon key="dark-mode" className="theme-toggle-icon h-5 w-5" />
                : <Sun key="light-mode" className="theme-toggle-icon h-5 w-5" />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={notificationsOpen}
                className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllReadMutation.mutate()}
                        disabled={markAllReadMutation.isPending}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-500">Loading notifications…</p>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet</p>
                    ) : notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => void openNotification(notification)}
                        className={clsx(
                          'flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50',
                          !notification.readAt && 'bg-red-50/50',
                        )}
                      >
                        <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', notification.readAt ? 'bg-transparent' : 'bg-red-600')} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900">{notification.title}</span>
                            <span className="shrink-0 text-[10px] text-gray-400">
                              {format(new Date(notification.createdAt), 'MMM d, HH:mm')}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs text-gray-600">{notification.message}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 sm:block">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
