import { useState, useEffect, useCallback } from 'react';
import { persistBrowserState, readBrowserState } from '../services/polyglotClient';
import { SOFT_UI_PRESETS, normalizeThemePreset } from '../config/tokens';
import type { SoftUIThemePreset } from '../types';

export interface ThemeManagerState {
  activePreset: SoftUIThemePreset;
  theme: 'dark' | 'light';
  handleSelectPreset: (nextPreset: SoftUIThemePreset) => void;
  handleToggleBinaryTheme: () => void;
}

export function useThemeManager(): ThemeManagerState {
  const [activePreset, setActivePreset] = useState<SoftUIThemePreset>(() => {
    const savedPreset = readBrowserState('mytts_preset');
    if (savedPreset) {
      return normalizeThemePreset(savedPreset);
    }
    const savedTheme = readBrowserState('mytts_theme');
    return savedTheme === 'light' ? 'slate' : 'obsidian';
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = readBrowserState('mytts_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    const savedPreset = readBrowserState('mytts_preset');
    return normalizeThemePreset(savedPreset) === 'slate' ? 'light' : 'dark';
  });

  const handleSelectPreset = useCallback((nextPreset: SoftUIThemePreset): void => {
    const normalized = normalizeThemePreset(nextPreset);
    setActivePreset(normalized);
    setTheme(SOFT_UI_PRESETS[normalized].mode);
  }, []);

  const handleToggleBinaryTheme = useCallback((): void => {
    setTheme((prevTheme) => {
      if (prevTheme === 'dark') {
        setActivePreset('slate');
        return 'light';
      }
      setActivePreset('obsidian');
      return 'dark';
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-preset', activePreset);
    document.body.setAttribute('data-preset', activePreset);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    const metaColor = document.querySelector('meta[name="color-scheme"]');
    if (metaColor) {
      metaColor.setAttribute('content', theme);
    }
    persistBrowserState('mytts_theme', theme);
    persistBrowserState('mytts_preset', activePreset);
  }, [theme, activePreset]);

  useEffect(() => {
    const syncThemeFromStorage = () => {
      const savedPreset = readBrowserState('mytts_preset');
      const savedTheme = readBrowserState('mytts_theme');
      if (savedPreset) {
        const normalizedPreset = normalizeThemePreset(savedPreset);
        setActivePreset(normalizedPreset);
        setTheme(SOFT_UI_PRESETS[normalizedPreset].mode);
        return;
      }

      if (savedTheme === 'light' || savedTheme === 'dark') {
        const mappedPreset = savedTheme === 'light' ? 'slate' : 'obsidian';
        setActivePreset(mappedPreset);
        setTheme(SOFT_UI_PRESETS[mappedPreset].mode);
      } else {
        const fallbackPreset = normalizeThemePreset(null);
        setActivePreset(fallbackPreset);
        setTheme(SOFT_UI_PRESETS[fallbackPreset].mode);
      }
    };

    window.addEventListener('storage', syncThemeFromStorage);
    window.addEventListener('mytts-theme-change', syncThemeFromStorage);
    window.addEventListener('mytts-theme-changed', syncThemeFromStorage);
    return () => {
      window.removeEventListener('storage', syncThemeFromStorage);
      window.removeEventListener('mytts-theme-change', syncThemeFromStorage);
      window.removeEventListener('mytts-theme-changed', syncThemeFromStorage);
    };
  }, []);

  return {
    activePreset,
    theme,
    handleSelectPreset,
    handleToggleBinaryTheme,
  };
}
