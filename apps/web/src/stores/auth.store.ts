import toast from 'react-hot-toast';
import { create } from 'zustand';
import type { User } from '@helpdesk/shared';
import { queryClient } from '../services/queryClient';
import { apiBaseUrl } from '../services/api-url';

const storageKey = 'helpdesk-session';

interface Session {
  id: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

function parseSession(value: string | null): Session | null {
  try {
    const session = JSON.parse(value ?? 'null') as Session | null;
    return session?.id && session.user?.id && session.accessToken && session.refreshToken ? session : null;
  } catch {
    return null;
  }
}

export function readSession(): Session | null {
  return parseSession(localStorage.getItem(storageKey));
}

export function updateSessionTokens(id: string, tokens: Pick<Session, 'accessToken' | 'refreshToken'>) {
  const session = readSession();
  if (session?.id !== id) return false;
  localStorage.setItem(storageKey, JSON.stringify({ ...session, ...tokens }));
  useAuthStore.getState().loadFromStorage();
  return true;
}

interface AuthState {
  sessionId: string | undefined;
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  sessionId: undefined,
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    queryClient.clear();
    localStorage.setItem(storageKey, JSON.stringify({ id, user, accessToken, refreshToken }));
    get().loadFromStorage();
  },

  clearSession: () => {
    queryClient.clear();
    localStorage.removeItem(storageKey);
    get().loadFromStorage();
  },

  logout: async () => {
    const session = readSession();
    get().clearSession();
    if (!session) return;

    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        keepalive: true,
      });
      if (!response.ok && response.status !== 401) throw new Error('Logout failed');
    } catch {
      toast.error('Signed out on this device. The server could not confirm session revocation.');
    }
  },

  loadFromStorage: () => {
    const session = readSession();
    set({
      sessionId: session?.id,
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: !!session,
    });
  },
}));

// Legacy tokens have no server session and must be discarded.
for (const key of ['accessToken', 'refreshToken', 'user']) localStorage.removeItem(key);

window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  const oldId = parseSession(event.oldValue)?.id;
  if (event.key === null || oldId !== readSession()?.id) {
    window.location.reload();
  } else {
    useAuthStore.getState().loadFromStorage();
  }
});
