import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { authService } from '@/services/auth.service';

export function PasswordRecovery({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['password-recovery'],
    queryFn: authService.getPasswordRecovery,
    retry: false,
  });

  if (data?.emailEnabled) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Lupa kata sandi?</h1>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          Hubungi Call Center atau admin Helpdesk untuk mengatur ulang kata sandi.
        </p>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-blue-600 hover:text-blue-500">
          Kembali ke halaman masuk
        </Link>
      </div>
    </main>
  );
}
