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
    label: 'Tactile Matte',
    mode: 'dark',
    canvas: '#0A0C10',
    flat: '#13161F',
    raised: '#191D29',
    inset: '#06070A',
    contrast: '#1E2330',
    textPrimary: '#F3F5F8',
    textSecondary: '#9BA3B0',
    accentPoint: '#35acd8',
    accentSecondary: '#D97706',
    accentEmerald: '#10B981',
  },
  slate: {
    id: 'slate',
    label: 'Steadfast Stainless',
    mode: 'light',
    canvas: '#E4E9EF',
    flat: '#EEF2F6',
    raised: '#F5F7FA',
    inset: '#D5DCE4',
    contrast: '#11161F',
    textPrimary: '#11161F',
    textSecondary: '#4A5565',
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
