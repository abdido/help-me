import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      toast.success('Password reset successfully. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'This reset link is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-5xl">🎧</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Set a new password</h1>
          <p className="mt-1 text-gray-600">Choose a password with at least 8 characters.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {!token ? (
            <p className="text-sm text-red-600">The reset link is missing its token.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} required />
              <Input label="Confirm new password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={72} required />
              <Button type="submit" loading={loading} className="w-full">Reset password</Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm text-gray-600">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
