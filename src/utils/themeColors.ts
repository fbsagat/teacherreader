import { ThemeMode } from '../types/shadowreader';

/**
 * Browser chrome color (`<meta name="theme-color">`) per reading theme.
 * Mirrors the `--color-slate-900` values in `index.css`.
 */
export const THEME_BAR_COLORS: Record<ThemeMode, string> = {
  dark: '#0b111e',
  light: '#f1f5f9',
  sepia: '#efe5ce',
  forest: '#071a14',
  ocean: '#071626',
  amethyst: '#140c24'
};

export function getThemeBarColor(theme: ThemeMode | string | undefined): string {
  return THEME_BAR_COLORS[(theme || 'dark') as ThemeMode] || THEME_BAR_COLORS.dark;
}
