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
    label: 'Cinza Studio',
    mode: 'dark',
    canvas: '#57545d',
    flat: '#49464f',
    raised: '#635f6a',
    inset: '#3e3b44',
    contrast: '#232127',
    textPrimary: '#F7F6F9',
    textSecondary: '#DFDDE4',
    accentPoint: '#35acd8',
    accentSecondary: '#D97706',
    accentEmerald: '#10B981',
  },
  slate: {
    id: 'slate',
    label: 'Ad Lucem',
    mode: 'light',
    canvas: '#F3F3F5',
    flat: '#E6E6EA',
    raised: '#FFFFFF',
    inset: '#E8E8EE',
    contrast: '#18181C',
    textPrimary: '#111115',
    textSecondary: '#3F3F46',
    accentPoint: '#0284C7',
    accentSecondary: '#1E6091',
    accentEmerald: '#059669',
  },
  moss: {
    id: 'moss',
    label: 'Moss',
    mode: 'light',
    canvas: '#F4F3EC',
    flat: '#ECEAE0',
    raised: '#F8F7F2',
    inset: '#E8E5DC',
    contrast: '#1A2E22',
    textPrimary: '#1E293B',
    textSecondary: '#57635B',
    accentPoint: '#174930',
    accentSecondary: '#059669',
    accentEmerald: '#059669',
  },
  sapphire: {
    id: 'sapphire',
    label: 'Terminal IBM',
    mode: 'dark',
    canvas: '#070709',
    flat: '#101014',
    raised: '#18181E',
    inset: '#050507',
    contrast: '#1D1D24',
    textPrimary: '#F4F4F6',
    textSecondary: '#B4B4BE',
    accentPoint: '#35acd8',
    accentSecondary: '#0284C7',
    accentEmerald: '#10B981',
  },
};

export const TONAL_LAYER_CLASSES: Record<TonalLayer, string> = {
  0: 'surface-canvas',
  1: 'surface-inset',
  2: 'surface-flat',
  3: 'ui-card-soft',
  4: 'surface-contrast terrixa-notched',
};

export function resolvePresetTokens(preset: SoftUIThemePreset = 'obsidian'): DesignTokenPalette {
  return SOFT_UI_PRESETS[preset] ?? SOFT_UI_PRESETS.obsidian;
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
