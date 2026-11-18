import axios, { type InternalAxiosRequestConfig } from 'axios';
import { readSession, updateSessionTokens, useAuthStore } from '@/stores/auth.store';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

type SessionRequest = InternalAxiosRequestConfig & {
  sessionId?: string;
  sentToken?: string;
  retried?: boolean;
};

const sessionChanged = () => new axios.CanceledError('Session changed');

api.interceptors.request.use((request: SessionRequest) => {
  const session = readSession();
  if (useAuthStore.getState().sessionId !== session?.id) throw sessionChanged();
  if (request.retried && request.sessionId !== session?.id) throw sessionChanged();
  request.sessionId = session?.id;
  request.sentToken = session?.accessToken;
  if (session) request.headers.Authorization = `Bearer ${session.accessToken}`;
  else request.headers.delete('Authorization');
  return request;
});

let refreshInFlight: { sessionId: string; promise: Promise<void> } | undefined;

function ensureFreshSession(sessionId: string, sentToken?: string) {
  if (refreshInFlight?.sessionId === sessionId) return refreshInFlight.promise;

  const renew = async () => {
    const session = readSession();
    if (session?.id !== sessionId) throw sessionChanged();
    if (session.accessToken !== sentToken) return;

    try {
      const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken: session.refreshToken });
      if (!updateSessionTokens(sessionId, data.data)) throw sessionChanged();
    } catch (error) {
      if (!navigator.locks && axios.isAxiosError(error) && error.response?.status === 401) {
        // On origins without Web Locks, allow the winning tab to publish its rotation.
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      const latest = readSession();
      if (latest?.id !== sessionId) throw sessionChanged();
      if (latest.refreshToken !== session.refreshToken) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) useAuthStore.getState().clearSession();
      throw error;
    }
  };

  const rotation = async () => {
    if (navigator.locks) await navigator.locks.request('helpdesk-session-refresh', renew);
    else await renew();
  };
  const promise = rotation()
    .finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = undefined;
    });
  refreshInFlight = { sessionId, promise };
  return promise;
}

api.interceptors.response.use(
  (response) => {
    const request = response.config as SessionRequest;
    if (request.sessionId !== readSession()?.id) throw sessionChanged();
    return response;
  },
  async (error) => {
    const request = error.config as SessionRequest | undefined;
    if (!request) throw error;
    if (request.sessionId !== readSession()?.id) throw sessionChanged();

    if (error.response?.status !== 401 || !request.sessionId || request.retried ||
        (request.url?.startsWith('/auth/') && request.url !== '/auth/me')) {
      throw error;
    }
    await ensureFreshSession(request.sessionId, request.sentToken);
    request.retried = true;
    return api(request);
  },
);

export default api;
