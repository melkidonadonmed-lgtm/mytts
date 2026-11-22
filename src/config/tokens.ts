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

export const DESIGN_SYSTEM_VERSION = '8.1.0' as const;

export const SEMANTIC_SURFACE_VARS = {
  canvas: 'var(--surface-canvas)',
  inset: 'var(--surface-inset)',
  flat: 'var(--surface-flat)',
  raised: 'var(--surface-raised)',
  contrast: 'var(--surface-contrast)',
  borderControl: 'var(--border-control)',
  accentPoint: 'var(--accent-point)',
  brandAccent: 'var(--brand-accent)',
} as const;

export const SOFT_UI_PRESETS: Record<SoftUIThemePreset, DesignTokenPalette> = {
  obsidian: {
    id: 'obsidian',
    label: 'Tactile Matte',
    mode: 'dark',
    canvas: 'oklch(0.155 0.012 260)',
    flat: 'oklch(0.195 0.018 262)',
    raised: 'oklch(0.23 0.02 262)',
    inset: 'oklch(0.125 0.01 260)',
    contrast: 'oklch(0.258 0.022 262)',
    textPrimary: 'oklch(0.968 0.005 255)',
    textSecondary: 'oklch(0.735 0.018 255)',
    accentPoint: 'oklch(0.71 0.13 225)',
    accentSecondary: 'oklch(0.68 0.16 65)',
    accentEmerald: 'oklch(0.72 0.14 158)',
  },
  slate: {
    id: 'slate',
    label: 'Steadfast Stainless',
    mode: 'light',
    canvas: 'oklch(0.93 0.01 250)',
    flat: 'oklch(0.955 0.006 250)',
    raised: 'oklch(0.975 0.005 250)',
    inset: 'oklch(0.89 0.012 250)',
    contrast: 'oklch(0.19 0.02 255)',
    textPrimary: 'oklch(0.19 0.02 255)',
    textSecondary: 'oklch(0.42 0.02 255)',
    accentPoint: 'oklch(0.57 0.15 240)',
    accentSecondary: 'oklch(0.52 0.15 55)',
    accentEmerald: 'oklch(0.52 0.13 158)',
  },
};

export const TONAL_LAYER_CLASSES: Record<TonalLayer, string> = {
  0: 'surface-canvas',
  1: 'surface-inset',
  2: 'surface-flat',
  3: 'ui-card-soft',
  4: 'surface-contrast',
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
    3: 'col-span-1 md:col-span-3',
    4: 'col-span-1 md:col-span-4',
    6: 'col-span-1 md:col-span-6',
    8: 'col-span-1 md:col-span-8',
    12: 'col-span-1 md:col-span-12',
  };
  return spanMap[colSpan];
}

export const TOKEN_AUDIT_INVARIANTS: React.CSSProperties = {
  backdropFilter: 'none',
};
