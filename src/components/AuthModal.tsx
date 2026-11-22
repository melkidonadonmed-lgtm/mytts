/**
 * Unified Login, Session Management, and Cloud Sync Modal (Cinza Studio / Ad Lucem).
 * Uses native <dialog closedby="any"> + showModal() with coordinate fallback (modern-web-guidance)
 * and Zero-Trust Google Identity Services (GSI) ID Token authentication.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Database,
  LogOut,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { GoogleUserSession } from '../types/polyglot';
import { useNativeDialog } from '../utils/nativeDialog';
import {
  authenticateWithGoogleCredential,
  fetchGoogleAuthConfig,
  getActiveSession,
  signOutGoogle,
  subscribeAuthChanges,
} from '../services/authService';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const gsiContainerRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<GoogleUserSession>(() => getActiveSession());
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAuthChanges((next) => {
      setSession(next);
    });
  }, []);

  // Synchronize native <dialog>.showModal() with feature-detected closedby light-dismiss fallback
  useNativeDialog(dialogRef, isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsConfigLoaded(false);
    void fetchGoogleAuthConfig().then((data) => {
      if (!active) return;
      setGoogleClientId(data?.googleClientId?.trim() || '');
      setIsConfigLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !googleClientId) return;
    const initGsi = () => {
      if (!window.google?.accounts?.id || !gsiContainerRef.current) return;
      gsiContainerRef.current.replaceChildren();
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
      className="m-auto w-full max-w-md rounded-3xl card-matte p-0 text-primary shadow-2xl border border-[var(--border-subtle)] bg-transparent backdrop:bg-slate-950/80"
    >
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full surface-inset-pill text-secondary border border-[var(--border-subtle)] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              <span>Sessão &amp; Sincronização Cloud</span>
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
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-secondary hover:text-primary hover:bg-slate-800/60 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sessão Google Ativa */}
        {session.isGoogleAuthenticated && (
          <div className="p-3.5 rounded-2xl card-matte-active border border-[var(--border-control)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{session.name}</span>
              </div>
              <p className="text-[11px] font-mono text-secondary truncate mt-0.5">{session.email}</p>
            </div>
            <button
              type="button"
              onClick={handleUseGuestWorkspace}
              className="min-h-11 px-3 rounded-xl btn-matte-dark text-xs font-bold text-secondary hover:text-primary inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        )}

        {/* Autenticação Oficial Google Identity Services (Zero-Trust ID Token) */}
        <div className="space-y-2.5 p-4 rounded-2xl surface-inset border border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Autenticação Verificada via Google OAuth</span>
          </div>

          {googleClientId ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div ref={gsiContainerRef} className="flex justify-center min-h-11 overflow-hidden" />
              {isSubmitting && (
                <p className="text-[11px] font-mono text-amber-300">Validando credencial Google...</p>
              )}
            </div>
          ) : isConfigLoaded ? (
            <div className="p-3 rounded-xl surface-flat border border-[var(--border-control)] text-xs text-secondary space-y-1">
              <p className="font-bold text-primary">Login Google OAuth não configurado neste servidor</p>
              <p className="text-[11px] leading-relaxed">
                Defina <code className="font-mono text-primary">GOOGLE_CLIENT_ID</code> no ambiente do servidor para habilitar o botão oficial Google Identity Services. Enquanto isso, utilize o Modo Local abaixo.
              </p>
            </div>
          ) : (
            <p className="text-[11px] font-mono text-secondary py-2 text-center">
              Verificando configuração OAuth...
            </p>
          )}

          {errorMsg && (
            <p
              role="alert"
              className="text-[11px] text-rose-300 surface-flat border border-[var(--border-control)] px-2.5 py-1.5 rounded-lg"
            >
              {errorMsg}
            </p>
          )}
        </div>

        {/* Opção de Workspace Local / Visitante + Indicador Explícito de Persistência */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-2">
          <button
            type="button"
            onClick={handleUseGuestWorkspace}
            className="w-full min-h-11 px-3 py-2 rounded-xl btn-matte-dark text-xs font-semibold text-secondary hover:text-primary flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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
              <span>Cookie HttpOnly assinado</span>
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );
};
