/**
 * Widget compacto de Login com Google (Google Identity Services + Conta Google Familiar).
 * Integrado diretamente na Sidebar sem modais desnecessários.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LogOut, CheckCircle2, Mail, ArrowRight } from 'lucide-react';
import type { GoogleUserSession } from '../types/polyglot';
import {
  getActiveSession,
  subscribeAuthChanges,
  authenticateWithGoogleCredential,
  signInWithGoogleEmailDirect,
  signOutGoogle,
} from '../services/authService';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'continue_with';
              shape?: 'rectangular' | 'pill';
              width?: number;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export interface GoogleAuthWidgetProps {
  onSessionChange?: (session: GoogleUserSession) => void;
  compact?: boolean;
}

export const GoogleAuthWidget: React.FC<GoogleAuthWidgetProps> = ({
  onSessionChange,
  compact = false,
}) => {
  const [session, setSession] = useState<GoogleUserSession>(() => getActiveSession());
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const gsiButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthChanges((next) => {
      setSession(next);
      onSessionChange?.(next);
    });
    return unsub;
  }, [onSessionChange]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { googleClientId?: string } | null) => {
        if (!active || !data?.googleClientId) return;
        setGoogleClientId(data.googleClientId);
      })
      .catch(() => {
        // Sem client_id OAuth explícito: utiliza fluxo direto por conta Google
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId || session.isGoogleAuthenticated) return;

    const existingScript = document.getElementById('google-gsi-client-script');
    const initGsi = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (response.credential) {
            try {
              setIsSubmitting(true);
              await authenticateWithGoogleCredential(response.credential);
              setShowEmailForm(false);
            } catch (err: unknown) {
              setErrorMsg(err instanceof Error ? err.message : 'Erro no login Google');
            } finally {
              setIsSubmitting(false);
            }
          }
        },
      });
      if (gsiButtonRef.current) {
        window.google.accounts.id.renderButton(gsiButtonRef.current, {
          theme: 'filled_black',
          size: 'medium',
          text: 'continue_with',
          shape: 'pill',
          width: 220,
        });
      }
    };

    if (existingScript) {
      initGsi();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);
  }, [googleClientId, session.isGoogleAuthenticated]);

  const handleDirectGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailInput.trim()) return;
    try {
      setIsSubmitting(true);
      await signInWithGoogleEmailDirect(emailInput, nameInput);
      setShowEmailForm(false);
      setEmailInput('');
      setNameInput('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao conectar conta Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    signOutGoogle();
    setShowEmailForm(false);
  };

  const initials = (session.name || session.email || 'G')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (session.isGoogleAuthenticated) {
    return (
      <div
        data-state="pressed"
        aria-busy={isSubmitting}
        className={`rounded-2xl card-matte ${
          compact ? 'px-2.5 py-1.5' : 'p-2.5'
        } flex items-center justify-between gap-2 transition-all`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {session.picture ? (
            <img
              src={session.picture}
              alt={session.name}
              className="w-7 h-7 rounded-full border border-amber-500/40 object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1" title="Conta Google sincronizada">
              <span className="text-xs font-bold text-primary truncate">{session.name}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            {!compact && (
              <p className="text-[10px] font-mono text-secondary truncate" title={session.email}>
                {session.email}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          title="Sair ou trocar de Conta Google"
          className="p-1.5 rounded-xl text-secondary hover:text-amber-400 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-state={isSubmitting ? 'loading' : 'idle'}
      aria-busy={isSubmitting}
      className={showEmailForm ? 'rounded-2xl card-matte p-3 flex flex-col gap-2' : 'flex flex-col'}
    >
      {googleClientId && <div ref={gsiButtonRef} className="flex justify-center overflow-hidden" />}

      {!showEmailForm ? (
        <button
          type="button"
          aria-expanded={showEmailForm}
          onClick={() => {
            if (googleClientId && window.google?.accounts?.id) {
              window.google.accounts.id.prompt();
            }
            setShowEmailForm(true);
          }}
          className="w-full py-2.5 px-3 rounded-xl card-matte hover:border-amber-400/50 text-primary font-bold text-xs flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          <span>Entrar com Google</span>
        </button>
      ) : (
        <form onSubmit={handleDirectGoogleSignIn} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Conta Google (Histórico)
            </span>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="text-[10px] text-secondary hover:text-primary cursor-pointer"
            >
              Cancelar
            </button>
          </div>
          <input
            id="google-auth-name"
            name="displayName"
            aria-label="Seu nome"
            autoComplete="name"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Seu nome (ex.: Melki)"
            className="w-full px-2.5 py-1.5 rounded-lg input-sunken text-xs text-primary placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <input
              id="google-auth-email"
              name="email"
              aria-label="E-mail da Conta Google"
              autoComplete="email"
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="seuemail@gmail.com"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg input-sunken text-xs text-primary placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Conectar Conta Google"
              disabled={isSubmitting || !emailInput.trim()}
              className="px-2.5 py-1.5 rounded-lg btn-matte-amber disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
              title="Conectar Conta Google"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {errorMsg && <p className="text-[10px] text-rose-400">{errorMsg}</p>}
        </form>
      )}
    </div>
  );
};
