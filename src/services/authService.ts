/**
 * Serviço de Autenticação Google (Google Identity Services + Persistência de Sessão).
 * Sincroniza automaticamente a Conta Google ativa com o cabeçalho X-User-Id para
 * histórico de conversas e chunks no Firestore / armazenamento local.
 */
import type { GoogleUserSession } from '../types/polyglot';

const SESSION_STORAGE_KEY = 'mytts_google_session_v1';
const LEGACY_USER_ID_KEY = 'fastchunks_user_id';

type AuthListener = (session: GoogleUserSession) => void;
const listeners = new Set<AuthListener>();

function createDefaultGuestSession(): GoogleUserSession {
  let existingId = 'guest_local';
  try {
    const savedId = localStorage.getItem(LEGACY_USER_ID_KEY);
    if (savedId && savedId.trim()) {
      existingId = savedId.trim();
    } else {
      existingId = `usr_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(LEGACY_USER_ID_KEY, existingId);
    }
  } catch {
    // fallback silencioso
  }

  return {
    uid: existingId,
    name: 'Visitante (Não conectado)',
    email: '',
    isGoogleAuthenticated: false,
  };
}

export function getActiveSession(): GoogleUserSession {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
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
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(LEGACY_USER_ID_KEY, session.uid);
  } catch {
    // fallback
  }
  listeners.forEach((fn) => fn(session));
  return session;
}

export function signOutGoogle(): GoogleUserSession {
  const guest = createDefaultGuestSession();
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
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
 * Decodifica um JWT ID Token retornado pelo Google Identity Services no cliente
 * e valida com o backend (/api/auth/google).
 */
export async function authenticateWithGoogleCredential(credentialJwt: string): Promise<GoogleUserSession> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
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
 * Login rápido por conta Google (e-mail @gmail.com ou Google Workspace)
 * para uso familiar imediato quando o popup OAuth não estiver configurado no domínio local.
 */
export async function signInWithGoogleEmailDirect(
  emailInput: string,
  displayNameInput?: string
): Promise<GoogleUserSession> {
  const cleanEmail = emailInput.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail Google válido.');
  }

  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: cleanEmail,
      name: displayNameInput?.trim() || cleanEmail.split('@')[0],
    }),
  });

  if (!res.ok) {
    throw new Error('Não foi possível autenticar a conta Google.');
  }

  const data = (await res.json()) as { user: GoogleUserSession };
  return setActiveSession(data.user);
}

export function getAuthHeaders(): Record<string, string> {
  const session = getActiveSession();
  const headers: Record<string, string> = {
    'X-User-Id': session.uid,
  };
  if (session.email) {
    headers['X-User-Email'] = session.email;
  }
  if (session.idToken) {
    headers['Authorization'] = `Bearer ${session.idToken}`;
  }
  return headers;
}
