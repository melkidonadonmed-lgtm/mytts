import React from 'react';

export type TonalLayer = 0 | 1 | 2 | 3 | 4;

export type ComponentFSMState = 'idle' | 'loading' | 'error' | 'pressed';

export type SoftUIThemePreset = 'slate' | 'moss' | 'sapphire' | 'obsidian';

export interface AuditTelemetryResult {
  a11yScore: number;
  fsmScore: number;
  tokenScore: number;
  secScore: number;
  weightedTotal: number;
  zeroCobaltVerified: boolean;
  zeroGlassmorphismVerified: boolean;
}

export interface SoftCardProps {
  title: string;
  badgeText?: string;
  colSpan?: 3 | 4 | 6 | 8 | 12;
  layer?: TonalLayer;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export * from './chunks';
export * from './debate';
export * from './polyglot';
export * from './voices';
