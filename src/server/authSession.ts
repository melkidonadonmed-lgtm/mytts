/**
 * Zero-Trust Google OAuth ID Token verification and HMAC-SHA256 signed HttpOnly session cookies.
 * Prevents X-User-Id spoofing for Google identities while allowing isolated guest workspaces.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleUserSession } from '../types/polyglot';
import { sanitizeUserId, USER_ID_PATTERN } from './audioContainer';

export const SESSION_COOKIE_NAME = 'mytts_session';
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;
export const GOOGLE_AUTH_REQUIRED_ERROR = 'Sessão Google autenticada obrigatória.';

const EPHEMERAL_DEV_SECRET = randomBytes(32).toString('hex');
const ALLOWED_GUEST_PATTERN = /^(usr_[a-zA-Z0-9_-]{1,60}|guest_[a-zA-Z0-9_-]{1,58}|anonymous-user)$/;

interface SignedSessionPayload {
  uid: string;
  name: string;
  email: string;
  picture?: string;
  isGoogleAuthenticated: true;
  iat: number;
  exp: number;
}

export type GoogleVerifyResult =
  | { ok: true; user: GoogleUserSession }
  | { ok: false; status: 401; error: string };

export type ResolvedUserResult =
  | { ok: true; userId: string; session: GoogleUserSession | null; isAuthenticated: boolean }
  | { ok: false; status: 401; error: string };

function getSessionSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  return configured && configured.length > 0 ? configured : EPHEMERAL_DEV_SECRET;
}

function getExpectedGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

export function deriveCanonicalGoogleUid(params: {
  sub: string;
  email?: string;
  emailVerified?: boolean;
}): string {
  const canonicalEmail = params.emailVerified === true && params.email ? params.email.trim().toLowerCase() : '';
  const rawSlug = canonicalEmail
    ? canonicalEmail.replace(/[^a-z0-9]/g, '_').slice(0, 56)
    : String(params.sub).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56);
  return sanitizeUserId(`google_${rawSlug}`);
}

export async function verifyGoogleIdToken(
  idToken: string,
  oauthClient?: Pick<OAuth2Client, 'verifyIdToken'>
): Promise<GoogleVerifyResult> {
  const expectedClientId = getExpectedGoogleClientId();
  if (!expectedClientId) {
    return {
      ok: false,
      status: 401,
      error: 'Autenticação Google não configurada no servidor (GOOGLE_CLIENT_ID ausente).',
    };
  }

  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    return { ok: false, status: 401, error: 'Token Google inválido ou malformado.' };
  }

  try {
    const client = oauthClient ?? new OAuth2Client(expectedClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: expectedClientId,
    });
    const payload = ticket.getPayload();
    if (
      !payload ||
      !payload.sub ||
      (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com')
    ) {
      return { ok: false, status: 401, error: 'Emissor ou identidade do token Google inválido.' };
    }

    const safeUid = deriveCanonicalGoogleUid({
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
    });
    const canonicalEmail = (payload.email || '').trim().toLowerCase();
    const user: GoogleUserSession = {
      uid: safeUid,
      name: payload.name || canonicalEmail.split('@')[0] || 'Usuário Google',
      email: canonicalEmail,
      picture: payload.picture,
      isGoogleAuthenticated: true,
    };
    return { ok: true, user };
  } catch {
    return { ok: false, status: 401, error: 'Assinatura ou validade do token Google recusada.' };
  }
}

export function signSessionToken(
  user: GoogleUserSession,
  ttlSeconds: number = SESSION_MAX_AGE_SEC
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SignedSessionPayload = {
    uid: user.uid,
    name: user.name,
    email: user.email,
    ...(user.picture ? { picture: user.picture } : {}),
    isGoogleAuthenticated: true,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): GoogleUserSession | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  const providedBuf = Buffer.from(providedSig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as Partial<SignedSessionPayload>;
    if (
      typeof parsed.uid !== 'string' ||
      !parsed.uid.startsWith('google_') ||
      !USER_ID_PATTERN.test(parsed.uid) ||
      parsed.isGoogleAuthenticated !== true ||
      typeof parsed.exp !== 'number' ||
      parsed.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return {
      uid: parsed.uid,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Usuário Google',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      picture: typeof parsed.picture === 'string' ? parsed.picture : undefined,
      isGoogleAuthenticated: true,
    };
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key) {
      result[key] = val;
    }
  }
  return result;
}

export function getVerifiedSessionFromRequest(req: Pick<Request, 'headers'>): GoogleUserSession | null {
  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined;
  const cookies = parseCookieHeader(cookieHeader);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

export function setSessionCookie(res: Response, user: GoogleUserSession): string {
  const token = signSessionToken(user);
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  const cookieValue = `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}${secureFlag}`;
  res.append('Set-Cookie', cookieValue);
  return token;
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  const cookieValue = `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`;
  res.append('Set-Cookie', cookieValue);
}

export function resolveRequestUserId(req: Pick<Request, 'headers'>): ResolvedUserResult {
  const verifiedSession = getVerifiedSessionFromRequest(req);
  if (verifiedSession) {
    return {
      ok: true,
      userId: verifiedSession.uid,
      session: verifiedSession,
      isAuthenticated: true,
    };
  }

  const rawHeader = req.headers['x-user-id'];
  const headerValue = typeof rawHeader === 'string' ? rawHeader.trim() : '';
  if (!headerValue) {
    return {
      ok: true,
      userId: 'guest_local',
      session: null,
      isAuthenticated: false,
    };
  }

  if (/^google[_:-]/i.test(headerValue) || !ALLOWED_GUEST_PATTERN.test(headerValue)) {
    return {
      ok: false,
      status: 401,
      error: GOOGLE_AUTH_REQUIRED_ERROR,
    };
  }

  return {
    ok: true,
    userId: sanitizeUserId(headerValue),
    session: null,
    isAuthenticated: false,
  };
}
