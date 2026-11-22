/**
 * Serviço de Autenticação Google (Google Identity Services + Persistência de Sessão).
 * Sincroniza automaticamente a Conta Google ativa com o cabeçalho X-User-Id para
 * histórico de conversas e chunks no Firestore / armazenamento local.
 */
import type { GoogleUserSession } from '../types/polyglot';

const SESSION_STORAGE_KEY = 'mytts_google_session_v1';
const LEGACY_USER_ID_KEY = 'fastchunks_user_id';
const GUEST_UID_STORAGE_KEY = 'mytts_guest_uid_v1';
const RECENT_ACCOUNTS_KEY = 'mytts_recent_google_accounts_v1';

type AuthListener = (session: GoogleUserSession) => void;
const listeners = new Set<AuthListener>();
const memoryFallbackStorage = new Map<string, string>();

function readStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // fallback para memória
  }
  return memoryFallbackStorage.get(key) ?? null;
}

function writeStorage(key: string, value: string): void {
  memoryFallbackStorage.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // fallback silencioso
  }
}

function removeStorage(key: string): void {
  memoryFallbackStorage.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // fallback silencioso
  }
}

function generateFreshGuestUid(): string {
  return `usr_${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultGuestSession(forceNewGuestId = false): GoogleUserSession {
  let existingId = 'guest_local';
  try {
    const dedicatedGuestId = forceNewGuestId ? null : readStorage(GUEST_UID_STORAGE_KEY);
    const savedLegacyId = forceNewGuestId ? null : readStorage(LEGACY_USER_ID_KEY);
    // Preserva um guest_uid local estável sem reaproveitar uid de conta Google ("google_...")
    if (dedicatedGuestId && dedicatedGuestId.trim() && !dedicatedGuestId.trim().startsWith('google_')) {
      existingId = dedicatedGuestId.trim();
    } else if (savedLegacyId && savedLegacyId.trim() && !savedLegacyId.trim().startsWith('google_')) {
      existingId = savedLegacyId.trim();
    } else {
      existingId = generateFreshGuestUid();
    }
    writeStorage(GUEST_UID_STORAGE_KEY, existingId);
    writeStorage(LEGACY_USER_ID_KEY, existingId);
  } catch {
    existingId = generateFreshGuestUid();
  }

  return {
    uid: existingId,
    name: 'Visitante (Local)',
    email: '',
    isGoogleAuthenticated: false,
  };
}

export function getRecentGoogleAccounts(): GoogleUserSession[] {
  try {
    const raw = readStorage(RECENT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GoogleUserSession =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof (item as GoogleUserSession).uid === 'string' &&
            typeof (item as GoogleUserSession).email === 'string' &&
            (item as GoogleUserSession).email.includes('@')
        )
    );
  } catch {
    return [];
  }
}

function saveRecentGoogleAccount(session: GoogleUserSession): void {
  if (!session.isGoogleAuthenticated || !session.email) return;
  try {
    const current = getRecentGoogleAccounts().filter(
      (acc) => acc.email.toLowerCase() !== session.email.toLowerCase()
    );
    const updated = [
      {
        uid: session.uid,
        name: session.name,
        email: session.email,
        picture: session.picture,
        isGoogleAuthenticated: true,
      },
      ...current,
    ].slice(0, 5);
    writeStorage(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export function removeRecentGoogleAccount(email: string): GoogleUserSession[] {
  try {
    const next = getRecentGoogleAccounts().filter(
      (acc) => acc.email.toLowerCase() !== email.trim().toLowerCase()
    );
    writeStorage(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function getActiveSession(): GoogleUserSession {
  try {
    const raw = readStorage(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        'uid' in parsed &&
        typeof (parsed as GoogleUserSession).uid === 'string'
      ) {
        return parsed as GoogleUserSession;
      }
    }
  } catch {
    // fallback
  }
  return createDefaultGuestSession();
}

export function setActiveSession(session: GoogleUserSession): GoogleUserSession {
  try {
    writeStorage(SESSION_STORAGE_KEY, JSON.stringify(session));
    writeStorage(LEGACY_USER_ID_KEY, session.uid);
    saveRecentGoogleAccount(session);
  } catch {
    // fallback
  }
  listeners.forEach((fn) => fn(session));
  return session;
}

export function signOutGoogle(): GoogleUserSession {
  try {
    removeStorage(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch((err: unknown) => {
      console.debug(
        '[AuthService] Failed to clear server session cookie on sign out:',
        err instanceof Error ? err.message : String(err)
      );
    });
  }
  const guest = createDefaultGuestSession(false);
  listeners.forEach((fn) => fn(guest));
  return guest;
}

export function subscribeAuthChanges(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Decodes and verifies a Google Identity Services ID Token with the backend
 * (/api/auth/google), establishing a signed HttpOnly session cookie.
 */
export async function authenticateWithGoogleCredential(credentialJwt: string): Promise<GoogleUserSession> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: credentialJwt }),
  });

  if (!res.ok) {
    throw new Error('Falha ao validar credencial Google no servidor.');
  }

  const data = (await res.json()) as { user: GoogleUserSession };
  return setActiveSession(data.user);
}

/**
 * Synchronizes the active client session against the server-verified HttpOnly cookie (/api/auth/me).
 */
export async function refreshSessionFromServer(): Promise<GoogleUserSession> {
  try {
    const resp = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    if (!resp.ok) {
      return getActiveSession();
    }
    const data = (await resp.json()) as {
      authenticated?: boolean;
      user?: GoogleUserSession | null;
    };
    if (data.authenticated && data.user && typeof data.user.uid === 'string') {
      return setActiveSession(data.user);
    }
    const current = getActiveSession();
    if (current.isGoogleAuthenticated) {
      removeStorage(SESSION_STORAGE_KEY);
      const guest = createDefaultGuestSession(false);
      listeners.forEach((fn) => fn(guest));
      return guest;
    }
    return current;
  } catch (err: unknown) {
    console.debug(
      '[AuthService] Falha ao sincronizar sessão com o servidor:',
      err instanceof Error ? err.message : String(err)
    );
    return getActiveSession();
  }
}

export function getAuthHeaders(): Record<string, string> {
  const session = getActiveSession();
  const headers: Record<string, string> = {};
  // Zero-Trust: never send google_* in X-User-Id; server resolves Google identity exclusively from HttpOnly cookie.
  if (!session.isGoogleAuthenticated && session.uid && !session.uid.startsWith('google_')) {
    headers['X-User-Id'] = session.uid;
  }
  if (session.idToken) {
    headers['Authorization'] = `Bearer ${session.idToken}`;
  }
  return headers;
}

export async function fetchGoogleAuthConfig(): Promise<{ googleClientId?: string } | null> {
  try {
    const resp = await fetch('/api/auth/config', {
      credentials: 'include',
    });
    if (!resp.ok) return null;
    return (await resp.json()) as { googleClientId?: string };
  } catch (err: unknown) {
    console.debug(
      '[AuthService] Falha ao obter configuração Google OAuth:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
