import React from 'react';
import type { TurnEmotion } from '../../types/debate';

export interface EmotionMeta {
  label: string;
  ptLabel: string;
  bg: string;
  text: string;
  border: string;
  icon: string;
}

export const EMOTIONS_MAP: Record<TurnEmotion | string, EmotionMeta> = {
  thoughtful: {
    label: 'Thoughtful',
    ptLabel: 'Reflexivo',
    bg: 'bg-white/[0.04]',
    text: 'text-slate-300',
    border: 'border-white/[0.08]',
    icon: '~',
  },
  inquisitive: {
    label: 'Inquisitive',
    ptLabel: 'Inquisitivo',
    bg: 'bg-white/[0.04]',
    text: 'text-slate-300',
    border: 'border-white/[0.08]',
    icon: '?',
  },
  skeptical: {
    label: 'Skeptical',
    ptLabel: 'Cético',
    bg: 'bg-white/[0.04]',
    text: 'text-slate-300',
    border: 'border-white/[0.08]',
    icon: '!',
  },
  ironic: {
    label: 'Ironic',
    ptLabel: 'Irônico',
    bg: 'surface-inset-pill',
    text: 'text-[var(--brand-accent)]',
    border: 'border-[var(--border-subtle)]',
    icon: '≠',
  },
  passionate: {
    label: 'Passionate',
    ptLabel: 'Apaixonado',
    bg: 'surface-inset-pill',
    text: 'text-[var(--brand-accent)]',
    border: 'border-[var(--border-subtle)]',
    icon: '+',
  },
  resolute: {
    label: 'Resolute',
    ptLabel: 'Resoluto',
    bg: 'bg-white/[0.04]',
    text: 'text-slate-300',
    border: 'border-white/[0.08]',
    icon: '→',
  },
};

export function resolveEmotionMeta(emotionKey: string): EmotionMeta {
  return (
    EMOTIONS_MAP[emotionKey] || {
      label: emotionKey,
      ptLabel: emotionKey,
      bg: 'bg-slate-800',
      text: 'text-slate-300',
      border: 'border-slate-700',
      icon: '•',
    }
  );
}

export function resolveSpeakerAccent(speakerColor?: string): string {
  return speakerColor && speakerColor.trim().length > 0
    ? speakerColor
    : 'var(--brand-accent)';
}

export function formatAudioTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function renderProsodicText(text?: string): React.ReactNode {
  if (!text) return 'Aguardando inicialização do debate...';
  const parts = text.split(/(<[^>]+>|\|[^|]+\||—|\.\.\.)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return (
        <span
          key={i}
          className="text-[11px] font-mono px-1.5 py-0.5 rounded surface-inset-pill text-[var(--brand-accent)] border border-[var(--border-subtle)] mx-0.5 inline-block"
          title="Marcador vocal neural"
        >
          {part}
        </span>
      );
    }
    if (part.startsWith('|') && part.endsWith('|')) {
      return (
        <span
          key={i}
          className="text-[11px] font-mono px-1.5 py-0.5 rounded surface-inset-pill text-[var(--accent-point)] border border-[var(--border-subtle)] mx-0.5 inline-block"
          title="Escuta ativa (backchanneling)"
        >
          {part}
        </span>
      );
    }
    if (part === '—' || part === '...') {
      return (
        <span key={i} className="text-amber-400 font-bold mx-0.5">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Falha ao converter Blob em base64.'));
    reader.readAsDataURL(blob);
  });
}
