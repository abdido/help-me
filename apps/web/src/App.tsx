import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from '@/components/auth/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { PasswordRecovery } from '@/pages/auth/PasswordRecovery';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { TicketListPage } from '@/pages/tickets/TicketListPage';
import { TicketDetailPage } from '@/pages/tickets/TicketDetailPage';
import { CreateTicketPage } from '@/pages/tickets/CreateTicketPage';
import { UserListPage } from '@/pages/users/UserListPage';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { TeamsPage } from '@/pages/teams/TeamsPage';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<PasswordRecovery><ForgotPasswordPage /></PasswordRecovery>} />
      <Route path="/reset-password" element={<PasswordRecovery><ResetPasswordPage /></PasswordRecovery>} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketListPage />} />
          <Route path="/tickets/new" element={<CreateTicketPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />

          {/* Admin-only routes */}
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<UserListPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/teams" element={<TeamsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
