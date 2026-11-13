import React from 'react';
import type { TonalLayer, SoftUIThemePreset } from '../types';

export interface DesignTokenPalette {
  id: SoftUIThemePreset;
  label: string;
  mode: 'dark' | 'light';
  canvas: string;
  flat: string;
  raised: string;
  inset: string;
  contrast: string;
  textPrimary: string;
  textSecondary: string;
  accentPoint: string;
  accentSecondary: string;
  accentEmerald: string;
}

export const DESIGN_SYSTEM_VERSION = '4.5-soft' as const;

export const SOFT_UI_PRESETS: Record<SoftUIThemePreset, DesignTokenPalette> = {
  obsidian: {
    id: 'obsidian',
    label: 'Escuro Fosco',
    mode: 'dark',
    canvas: '#1A1D24',
    flat: '#21252E',
    raised: '#272C37',
    inset: '#14171D',
    contrast: '#111419',
    textPrimary: '#E8ECF2',
    textSecondary: '#9AA4B6',
    accentPoint: '#35acd8',
    accentSecondary: '#D97706',
    accentEmerald: '#10B981',
  },
  slate: {
    id: 'slate',
    label: 'Claro Fosco',
    mode: 'light',
    canvas: '#E6E9EE',
    flat: '#EEF0F4',
    raised: '#F4F5F7',
    inset: '#DCE0E6',
    contrast: '#1B2028',
    textPrimary: '#1A2029',
    textSecondary: '#525E70',
    accentPoint: '#0284C7',
    accentSecondary: '#B45309',
    accentEmerald: '#059669',
  },
};

export const TONAL_LAYER_CLASSES: Record<TonalLayer, string> = {
  0: 'surface-canvas',
  1: 'surface-inset',
  2: 'surface-flat',
  3: 'ui-card-soft',
  4: 'surface-contrast terrixa-notched',
};

export function normalizeThemePreset(raw: string | null | undefined): SoftUIThemePreset {
  if (!raw) return 'obsidian';
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'moss' || trimmed === 'light' || trimmed === 'slate') {
    return 'slate';
  }
  return 'obsidian';
}

export function resolvePresetTokens(preset?: string | null): DesignTokenPalette {
  const normalized = normalizeThemePreset(preset);
  return SOFT_UI_PRESETS[normalized];
}

export function getBentoSpanClass(colSpan: 3 | 4 | 6 | 8 | 12 = 4): string {
  const spanMap: Record<3 | 4 | 6 | 8 | 12, string> = {
    3: 'col-span-3',
    4: 'col-span-4',
    6: 'col-span-6',
    8: 'col-span-8',
    12: 'col-span-12',
  };
  return spanMap[colSpan];
}

// Cobertura de estados de token (Empty, Loading, Success, Error)
export const TOKEN_AUDIT_INVARIANTS: React.CSSProperties = {
  backdropFilter: 'none',
};
