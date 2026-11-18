import React from 'react';
import { PedagogicalSettings, ThemeMode } from '../../types/shadowreader';
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_PRESETS,
  FONT_SCALE_STEP,
  clampFontScale,
  describeFontScale
} from '../../utils/settingsUi';
import { SettingsSection } from './SettingsPrimitives';

interface SettingsAppearancePanelProps {
  settings: PedagogicalSettings;
  onUpdateSettings: (partial: Partial<PedagogicalSettings>) => void;
  onShowToast: (msg: string) => void;
}

const THEME_OPTIONS: { id: ThemeMode; label: string; swatch: string }[] = [
  { id: 'dark', label: '🌙 Escuro', swatch: '#0b111e' },
  { id: 'light', label: '☀️ Claro', swatch: '#f1f5f9' },
  { id: 'sepia', label: '📜 Sépia', swatch: '#f4ecd8' },
  { id: 'forest', label: '🌲 Floresta', swatch: '#071712' },
  { id: 'ocean', label: '🌊 Oceano', swatch: '#061524' },
  { id: 'amethyst', label: '🔮 Ametista', swatch: '#130b24' }
];

/**
 * Tab 5 — purely visual preferences. Kept apart from "Regras" so changing the
 * theme never requires scrolling past speed sliders.
 */
export const SettingsAppearancePanel: React.FC<SettingsAppearancePanelProps> = ({
  settings,
  onUpdateSettings,
  onShowToast
}) => {
  const activeFontScale = clampFontScale(settings.fontSizeScale ?? 110);
  const fontScaleLabel = describeFontScale(activeFontScale);

  const handleFontScaleChange = (nextScale: number, silentToast: boolean = false) => {
    const clamped = clampFontScale(nextScale);
    if (clamped === activeFontScale) return;
    onUpdateSettings({ fontSizeScale: clamped });
    if (!silentToast) {
      onShowToast(`🔤 Tamanho do texto ajustado para ${clamped}%`);
    }
  };

  return (
    <div className="space-y-3">
      <SettingsSection
        title="Tema de leitura"
        icon="🎨"
        hint="Cores de fundo e do texto em todas as telas do app."
      >
        <div
          role="radiogroup"
          aria-label="Tema visual"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5"
        >
          {THEME_OPTIONS.map(option => {
            const active = settings.themeMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                id={`cfgTheme_${option.id}`}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  onUpdateSettings({ themeMode: option.id });
                  onShowToast(`Tema alterado para: ${option.label}`);
                }}
                className={`min-h-[44px] px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  active
                    ? 'bg-brand-500/20 border-brand-500 text-brand-300 ring-1 ring-brand-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-brand-400/50'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-3 h-3 rounded-full border border-slate-600 shrink-0"
                  style={{ backgroundColor: option.swatch }}
                />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        id="cfgGlobalFontSizeBox"
        title="Tamanho do texto"
        icon="🔤"
        hint="Escala frases, traduções, botões, dicionário e menus em todo o app."
        aside={
          <span
            id="cfgFontScaleDisplay"
            className="font-mono text-[11px] font-bold text-brand-300 bg-brand-500/15 px-2 py-1 rounded-md border border-brand-500/30 tabular-nums whitespace-nowrap"
          >
            {activeFontScale}% ({fontScaleLabel})
          </span>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {FONT_SCALE_PRESETS.map((preset, idx) => {
            const isActive = activeFontScale === preset.value;
            return (
              <button
                key={preset.value}
                id={`btnFontScale_${preset.value}`}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleFontScaleChange(preset.value)}
                className={`min-h-[40px] px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  idx === FONT_SCALE_PRESETS.length - 1 ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  isActive
                    ? 'bg-brand-600 text-white border-brand-400 shadow-xs'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-brand-400/50 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            id="btnFontScaleMinus"
            type="button"
            disabled={activeFontScale <= FONT_SCALE_MIN}
            onClick={() => handleFontScaleChange(activeFontScale - FONT_SCALE_STEP)}
            title="Diminuir tamanho do texto em 5%"
            aria-label="Diminuir tamanho do texto"
            className="min-w-[44px] min-h-[40px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
          >
            A-
          </button>
          <input
            type="range"
            id="cfgFontSizeSlider"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={FONT_SCALE_STEP}
            value={activeFontScale}
            aria-label="Tamanho do texto de todo o app"
            aria-valuetext={`${activeFontScale}%`}
            onChange={event => handleFontScaleChange(parseInt(event.target.value, 10), true)}
            className="flex-1 h-2 accent-brand-500 cursor-pointer"
          />
          <button
            id="btnFontScalePlus"
            type="button"
            disabled={activeFontScale >= FONT_SCALE_MAX}
            onClick={() => handleFontScaleChange(activeFontScale + FONT_SCALE_STEP)}
            title="Aumentar tamanho do texto em 5%"
            aria-label="Aumentar tamanho do texto"
            className="min-w-[44px] min-h-[40px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-35 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
          >
            A+
          </button>
        </div>
      </SettingsSection>

      <div className="text-[10px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 leading-snug">
        <strong className="text-slate-200">Atalhos do teclado:</strong> Espaço (iniciar/parar
        treino) · R (ouvir inglês) · T (ouvir português) · M (falar).
      </div>
    </div>
  );
};
