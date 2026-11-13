/**
 * Modal Unificado de Login, Gestão de Sessão e Sincronização Cloud (Cinza Studio / Ad Lucem).
 * Segue as diretrizes nativas <dialog closedby="any"> + showModal() com fallback de coordenadas (modern-web-guidance).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { GoogleUserSession } from '../types/polyglot';
import {
  authenticateWithGoogleCredential,
  getActiveSession,
  getRecentGoogleAccounts,
  removeRecentGoogleAccount,
  signInWithGoogleEmailDirect,
  signOutGoogle,
  subscribeAuthChanges,
} from '../services/authService';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const gsiContainerRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<GoogleUserSession>(() => getActiveSession());
  const [recentAccounts, setRecentAccounts] = useState<GoogleUserSession[]>(() =>
    getRecentGoogleAccounts()
  );
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAuthChanges((next) => {
      setSession(next);
      setRecentAccounts(getRecentGoogleAccounts());
    });
  }, []);

  // Sincronização declarativa com <dialog>.showModal() e fallback light-dismiss por retângulo
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        dialog.close();
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('click', handleBackdropClick);
    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { googleClientId?: string } | null) => {
        if (!active || !data?.googleClientId) return;
        setGoogleClientId(data.googleClientId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !googleClientId) return;
    const initGsi = () => {
      if (!window.google?.accounts?.id || !gsiContainerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) return;
          try {
            setIsSubmitting(true);
            setErrorMsg(null);
            await authenticateWithGoogleCredential(response.credential);
            onClose();
          } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'Falha na autenticação Google.');
          } finally {
            setIsSubmitting(false);
          }
        },
      });
      window.google.accounts.id.renderButton(gsiContainerRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 280,
      });
    };

    const existing = document.getElementById('google-gsi-client-script');
    if (existing) {
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
  }, [isOpen, googleClientId, onClose]);

  const handleDirectEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailInput.trim()) return;
    try {
      setIsSubmitting(true);
      await signInWithGoogleEmailDirect(emailInput, nameInput);
      setEmailInput('');
      setNameInput('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao conectar conta Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSavedAccount = async (acc: GoogleUserSession) => {
    setErrorMsg(null);
    try {
      setIsSubmitting(true);
      await signInWithGoogleEmailDirect(acc.email, acc.name);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao reconectar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseGuestWorkspace = () => {
    if (session.isGoogleAuthenticated) {
      signOutGoogle();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby="auth-modal-title"
      className="m-auto w-full max-w-md rounded-3xl card-matte p-0 text-primary shadow-2xl border border-slate-700/80 bg-transparent backdrop:bg-black/75"
    >
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              Sessão &amp; Sincronização Cloud
            </span>
            <h2 id="auth-modal-title" className="text-lg font-extrabold text-primary font-display mt-1.5">
              Conectar ao MyTTS Studio
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Sincronize seu histórico, chunks e baralhos de flashcards em São Paulo (southamerica-east1).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de autenticação"
            className="btn-compact-touch p-1.5 rounded-xl text-secondary hover:text-primary hover:bg-slate-800/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Botão Oficial Google OAuth 1-Clique (quando GOOGLE_CLIENT_ID configurado) */}
        {googleClientId && (
          <div ref={gsiContainerRef} className="flex justify-center py-1 overflow-hidden" />
        )}

        {/* Contas Google Salvas no Dispositivo (Reconexão 1-Clique) */}
        {recentAccounts.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
              Contas Google Salvas (1-Clique)
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {recentAccounts.map((acc) => {
                const isCurrent =
                  session.isGoogleAuthenticated &&
                  session.email.toLowerCase() === acc.email.toLowerCase();
                const accInitials = (acc.name || acc.email || 'G')
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={acc.email}
                    className={`flex items-center justify-between gap-2 p-2 rounded-xl transition-colors ${
                      isCurrent
                        ? 'card-matte-active'
                        : 'surface-inset hover:border-amber-400/40'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSelectSavedAccount(acc)}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <span className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {accInitials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-primary flex items-center gap-1 truncate">
                          <span>{acc.name}</span>
                          {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </span>
                        <span className="text-[10px] font-mono text-secondary block truncate">
                          {acc.email}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentAccounts(removeRecentGoogleAccount(acc.email))}
                      aria-label={`Remover atalho de ${acc.email}`}
                      className="p-1 rounded-lg text-secondary hover:text-rose-400 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Formulário de Conexão Direta por Conta Google */}
        <form onSubmit={handleDirectEmailSubmit} className="space-y-2.5 p-3.5 rounded-2xl surface-inset">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Conectar Conta Google (@gmail.com / Workspace)</span>
          </div>

          <input
            id="auth-modal-email"
            name="googleEmail"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="seu.email@gmail.com"
            className="w-full px-3 py-2 rounded-xl input-sunken text-xs text-primary placeholder:text-slate-400"
          />

          <input
            id="auth-modal-name"
            name="googleDisplayName"
            type="text"
            autoComplete="name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Seu nome (ex.: Melki Donadon)"
            className="w-full px-3 py-2 rounded-xl input-sunken text-xs text-primary placeholder:text-slate-400"
          />

          {errorMsg && (
            <p className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !emailInput.trim()}
            className="w-full min-h-[40px] rounded-xl btn-matte btn-matte-amber text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Sincronizando...' : 'Entrar e Sincronizar Dados'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Opção de Workspace Local / Visitante + Indicador Explícito de Persistência */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleUseGuestWorkspace}
            className="w-full min-h-[38px] px-3 py-2 rounded-xl btn-matte-dark text-xs font-semibold text-secondary hover:text-primary flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Continuar em Modo Local (Offline / Guest Workspace)</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10">IndexedDB</span>
          </button>

          <div className="flex items-center justify-between text-[10px] font-mono text-secondary px-1">
            <span className="inline-flex items-center gap-1">
              <Cloud className="w-3 h-3 text-emerald-400" />
              <span>Cloud: Firestore (southamerica-east1)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>Migração automática no login</span>
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );
};
