import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not request a password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-5xl">🎧</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Forgot password?</h1>
          <p className="mt-1 text-gray-600">Enter the email address connected to your account.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {submitted ? (
            <p role="status" className="text-sm leading-6 text-gray-700">
              If an active account exists and email delivery is configured, a reset link will be sent. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
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
