/**
 * Popover de Conta, Preferências de Tema e Diagnóstico de Sessão no Rodapé da Sidebar.
 * Desacopla os seletores de Tema Minimalista (Cinza, Ad Lucem, Moss, Terminal) da listagem principal,
 * liberando espaço vertical para os 6 módulos e operando tanto em 280px quanto em Rail Mode (68px).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronUp,
  Cloud,
  KeyRound,
  LogOut,
  UserPlus,
  Globe,
} from 'lucide-react';
import type { GoogleUserSession } from '../types/polyglot';
import type { SoftUIThemePreset } from '../types';
import { SOFT_UI_PRESETS } from '../config/tokens';
import { EXTERNAL_LINKS } from '../config/constants';
import {
  getActiveSession,
  signOutGoogle,
  subscribeAuthChanges,
} from '../services/authService';
import { persistBrowserState, readBrowserState } from '../services/polyglotClient';
import { GoogleIcon } from './GoogleIcon';

export interface UserSessionPopoverProps {
  isCollapsed?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme?: () => void;
  activePreset: SoftUIThemePreset;
  onSelectPreset?: (preset: SoftUIThemePreset) => void;
  onOpenAuthModal: () => void;
  onSelectArchitecture?: () => void;
}

interface HealthSummary {
  status: string;
  modelTts: string;
  storage: string;
  geminiKeyConfigured: boolean;
}

export const UserSessionPopover: React.FC<UserSessionPopoverProps> = ({
  isCollapsed = false,
  theme,
  onToggleTheme,
  activePreset,
  onSelectPreset,
  onOpenAuthModal,
  onSelectArchitecture,
}) => {
  const [session, setSession] = useState<GoogleUserSession>(() => getActiveSession());
  const [isOpen, setIsOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [preferredLang, setPreferredLang] = useState<'en' | 'it' | 'ja'>(() => {
    const saved = readBrowserState('mytts_preferred_target_lang');
    return saved === 'it' || saved === 'ja' ? saved : 'en';
  });
  const [health, setHealth] = useState<HealthSummary>({
    status: 'online',
    modelTts: 'gemini-3.8-flash-tts',
    storage: 'firestore',
    geminiKeyConfigured: true,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return subscribeAuthChanges((next) => {
      setSession(next);
      setConfirmSignOut(false);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<HealthSummary> | null) => {
        if (!active || !data) return;
        setHealth({
          status: data.status || 'online',
          modelTts: data.modelTts || 'gemini-3.8-flash-tts',
          storage: data.storage || 'firestore',
          geminiKeyConfigured: data.geminiKeyConfigured !== false,
        });
      })
      .catch(() => {
        // mantém resumo padrão
      });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setConfirmSignOut(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setConfirmSignOut(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [isOpen]);

  const handleSelectTargetLang = (lang: 'en' | 'it' | 'ja') => {
    setPreferredLang(lang);
    persistBrowserState('mytts_preferred_target_lang', lang);
  };

  const handleConfirmSignOut = () => {
    if (!confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    signOutGoogle();
    setConfirmSignOut(false);
    setIsOpen(false);
  };

  const initials = session.isGoogleAuthenticated
    ? (session.name || session.email || 'MD')
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'VS';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Popover Flutuante de Conta e Preferências */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Preferências de Conta, Sincronização e Temas"
          className={`fixed lg:absolute bottom-16 z-50 w-72 rounded-2xl card-matte p-3.5 shadow-2xl border border-slate-700/80 space-y-3 ${
            isCollapsed ? 'left-3 lg:left-[74px] lg:bottom-2' : 'left-3 right-3 lg:left-0 lg:bottom-16'
          }`}
        >
          {/* 1. Cabeçalho da Conta & Status Cloud southamerica-east1 */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800/80">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-primary font-display truncate">
                  {session.name}
                </span>
                {session.isGoogleAuthenticated && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="text-[11px] font-mono text-secondary truncate">
                {session.isGoogleAuthenticated
                  ? session.email
                  : `Workspace Local (${session.uid})`}
              </p>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 inline-flex items-center gap-1 ${
                session.isGoogleAuthenticated
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              <Cloud className="w-3 h-3" />
              <span>{session.isGoogleAuthenticated ? 'Sync Ativo' : 'Local'}</span>
            </span>
          </div>

          {/* 2. Status do Motor TTS & Região GCP */}
          <div className="p-2.5 rounded-xl surface-inset space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-secondary flex items-center gap-1 font-medium">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Motor Neural TTS:</span>
              </span>
              <span className="font-mono font-bold text-emerald-300 truncate">
                {health.modelTts}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Região &amp; Banco:</span>
              <span className="font-mono text-primary">
                southamerica-east1 · {health.storage === 'firestore' ? 'Firestore' : 'Local JSON'}
              </span>
            </div>
          </div>

          {/* 3. Idioma Alvo Rápido */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold flex items-center gap-1">
                <Globe className="w-3 h-3 text-amber-400" />
                <span>Idioma Alvo Preferencial</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-300">
                {preferredLang.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl surface-inset">
              {(
                [
                  { id: 'en', label: 'EN · Inglês' },
                  { id: 'it', label: 'IT · Italiano' },
                  { id: 'ja', label: 'JA · Japonês' },
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleSelectTargetLang(lang.id)}
                  className={`btn-compact-touch py-1 px-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                    preferredLang === lang.id
                      ? 'card-matte-active text-primary'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Seletor de Tema Minimalista (Cinza, Ad Lucem, Moss, Terminal) */}
          {onSelectPreset && (
            <div
              role="radiogroup"
              aria-label="Selecionar Preset de Tema Minimalista"
              className="p-2 rounded-xl surface-inset space-y-1.5"
            >
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-semibold">
                  Tema Minimalista
                </span>
                <span className="text-[10px] font-mono font-bold text-primary">
                  {SOFT_UI_PRESETS[activePreset].label}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(SOFT_UI_PRESETS) as SoftUIThemePreset[]).map((presetKey) => {
                  const presetObj = SOFT_UI_PRESETS[presetKey];
                  const isSelected = activePreset === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onSelectPreset(presetKey)}
                      className={`btn-compact-touch min-h-[36px] px-1 py-1 rounded-lg text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer btn-anti-squish ${
                        isSelected
                          ? 'card-matte-active text-primary font-bold'
                          : 'text-secondary hover:text-primary'
                      }`}
                      title={`Aplicar tema ${presetObj.label}`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/25 shadow-xs shrink-0"
                        style={{ backgroundColor: presetObj.canvas }}
                      />
                      <span className="truncate max-w-full">{presetObj.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alternador Binário Modo Claro Moderno (AD LUCEM) / Cinza Studio */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-compact-touch w-full min-h-[36px] px-3 py-1.5 rounded-xl btn-matte-dark flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <GoogleIcon
                  name={theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  size={16}
                  className="text-amber-400"
                />
                <span className="font-sans font-bold">
                  {theme === 'dark' ? 'Modo Claro Moderno' : 'Modo Cinza Studio'}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-secondary">
                {theme === 'dark' ? 'Ad Lucem' : 'Cinza'}
              </span>
            </button>
          )}

          {/* 5. Ações de Conta / Login e Links de Governança */}
          <div className="pt-1 border-t border-slate-800/80 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuthModal();
                }}
                className="flex-1 btn-matte btn-matte-amber min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{session.isGoogleAuthenticated ? 'Trocar Conta' : 'Entrar com Google'}</span>
              </button>

              {session.isGoogleAuthenticated && (
                <button
                  type="button"
                  onClick={handleConfirmSignOut}
                  className={`btn-compact-touch min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    confirmSignOut
                      ? 'bg-rose-600 text-white border border-rose-400'
                      : 'btn-matte-dark text-secondary hover:text-rose-300'
                  }`}
                  title={confirmSignOut ? 'Clique novamente para confirmar saída' : 'Encerrar sessão Google'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{confirmSignOut ? 'Confirmar' : 'Sair'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-secondary px-1 pt-1">
              {onSelectArchitecture && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onSelectArchitecture();
                  }}
                  className="hover:text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <GoogleIcon name="terminal" size={14} />
                  <span>Arquitetura</span>
                </button>
              )}
              <a
                href={EXTERNAL_LINKS.GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary inline-flex items-center gap-1"
              >
                <GoogleIcon name="code" size={14} />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Card Gatilho no Rodapé da Sidebar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={
          isCollapsed
            ? `${session.name} (${session.email || 'Modo Local'}) — Preferências e Tema`
            : 'Abrir menu de conta, sincronização e temas'
        }
        className={`rail-tooltip-host w-full rounded-2xl card-matte transition-all cursor-pointer flex items-center ${
          isCollapsed ? 'justify-center p-2' : 'justify-between gap-2 px-3 py-2'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {session.picture ? (
              <img
                src={session.picture}
                alt={session.name}
                className="w-8 h-8 rounded-full border border-amber-500/40 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs flex items-center justify-center shadow-sm">
                {initials}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                session.isGoogleAuthenticated ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>

          {!isCollapsed && (
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-primary truncate">{session.name}</span>
                {session.isGoogleAuthenticated && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="text-[10px] font-mono text-secondary truncate">
                {session.isGoogleAuthenticated
                  ? session.email
                  : `Modo Local · ${SOFT_UI_PRESETS[activePreset].label.split(' ')[0]}`}
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <ChevronUp
            className={`w-4 h-4 text-secondary transition-transform shrink-0 ${
              isOpen ? 'rotate-180 text-amber-400' : ''
            }`}
          />
        )}

        {isCollapsed && (
          <span className="rail-tooltip px-2.5 py-1.5 rounded-xl card-matte text-xs font-bold text-primary shadow-xl">
            {session.name} · Conta &amp; Temas
          </span>
        )}
      </button>
    </div>
  );
};
