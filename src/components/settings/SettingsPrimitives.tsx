import React from 'react';

/**
 * Small, reusable building blocks for the Settings modal.
 *
 * They exist to remove the copy-pasted markup that made the old modal ~2.1k
 * lines and to give every section the same anatomy (title → short hint →
 * control), which is what makes the menu scannable.
 */

export interface SettingsSectionProps {
  id?: string;
  title: string;
  hint?: string;
  icon?: string;
  badge?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  title,
  hint,
  icon,
  badge,
  aside,
  className = '',
  children
}) => (
  <section
    id={id}
    className={`bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5 ${className}`}
  >
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 className="font-bold text-slate-100 text-[11px] uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
          {icon && <span aria-hidden="true">{icon}</span>}
          <span>{title}</span>
          {badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono font-bold normal-case">
              {badge}
            </span>
          )}
        </h4>
        {hint && (
          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{hint}</p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
    <div className="space-y-2">{children}</div>
  </section>
);

export type SettingsToggleTone = 'brand' | 'emerald' | 'amber' | 'rose';

const TOGGLE_ACTIVE_CLASS: Record<SettingsToggleTone, string> = {
  brand: 'bg-brand-600 border-brand-400',
  emerald: 'bg-emerald-600 border-emerald-400',
  amber: 'bg-amber-600 border-amber-400',
  rose: 'bg-rose-600 border-rose-400'
};

export interface SettingsToggleProps {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  disabledHint?: string;
  tone?: SettingsToggleTone;
}

/**
 * Accessible switch row (`role="switch"` + `aria-checked`). Replaces the
 * checkboxes whose meaning was only conveyed by color and by the paragraph
 * around them.
 */
export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  disabledHint,
  tone = 'brand'
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    title={disabled ? disabledHint : hint}
    onClick={() => onChange(!checked)}
    className={`w-full min-h-[40px] flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-lg border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed ${
      disabled
        ? 'bg-slate-900/35 border-slate-800/50 opacity-65'
        : checked
          ? 'bg-slate-900 border-slate-700'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
    }`}
  >
    <span className="min-w-0">
      <span
        className={`block text-[11px] font-semibold leading-tight ${
          disabled ? 'text-slate-400' : 'text-slate-200'
        }`}
      >
        {label}
      </span>
      {(hint || (disabled && disabledHint)) && (
        <span className="block text-[9px] text-slate-400 mt-0.5 leading-tight">
          {disabled ? disabledHint : hint}
        </span>
      )}
    </span>
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
        checked ? TOGGLE_ACTIVE_CLASS[tone] : 'bg-slate-800 border-slate-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </span>
  </button>
);

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  /** Tooltip with the detailed explanation. */
  hint?: string;
}

export interface SettingsSegmentedProps<T extends string> {
  idPrefix: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  columns?: 2 | 3 | 4;
  tone?: 'brand' | 'emerald' | 'amber' | 'purple' | 'indigo' | 'teal';
  size?: 'sm' | 'md';
}

const SEGMENTED_ACTIVE_CLASS: Record<
  NonNullable<SettingsSegmentedProps<string>['tone']>,
  string
> = {
  brand: 'bg-brand-600 text-white border-brand-400',
  emerald: 'bg-emerald-600 text-white border-emerald-400',
  amber: 'bg-amber-600 text-white border-amber-400',
  purple: 'bg-purple-600 text-white border-purple-400',
  indigo: 'bg-indigo-600 text-white border-indigo-400',
  teal: 'bg-teal-600 text-white border-teal-400'
};

const SEGMENTED_COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4'
};

/** Mutually exclusive options rendered as a segmented control. */
export function SettingsSegmented<T extends string>({
  idPrefix,
  value,
  options,
  onChange,
  columns = 3,
  tone = 'brand',
  size = 'sm'
}: SettingsSegmentedProps<T>) {
  return (
    <div role="group" className={`grid gap-1 ${SEGMENTED_COLUMNS[columns]}`}>
      {options.map(option => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            id={`${idPrefix}_${option.id}`}
            type="button"
            aria-pressed={isActive}
            title={option.hint}
            onClick={() => onChange(option.id)}
            className={`${size === 'md' ? 'min-h-[38px] py-1.5' : 'min-h-[34px] py-1'} px-2 rounded-md text-[10px] font-bold border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              isActive
                ? SEGMENTED_ACTIVE_CLASS[tone]
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SettingsSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  valueLabel: string;
  /** Semantic description shown next to the numeric value ("Rigoroso"). */
  valueHint?: string;
  hint?: string;
  accentClass?: string;
  valueClass?: string;
  valueId?: string;
}

/** Labeled range input with the live value in monospace. */
export const SettingsSlider: React.FC<SettingsSliderProps> = ({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueLabel,
  valueHint,
  hint,
  accentClass = 'accent-brand-500',
  valueClass = 'text-brand-300',
  valueId
}) => (
  <div>
    <div className="flex justify-between items-center gap-2 mb-0.5">
      <label htmlFor={id} className="text-[11px] font-medium text-slate-300">
        {label}
      </label>
      <span
        id={valueId}
        className={`font-mono text-[11px] font-bold tabular-nums whitespace-nowrap ${valueClass}`}
      >
        {valueLabel}
        {valueHint ? <span className="text-slate-400 font-normal"> ({valueHint})</span> : null}
      </span>
    </div>
    <input
      type="range"
      id={id}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-valuetext={`${valueLabel}${valueHint ? ` (${valueHint})` : ''}`}
      onChange={event => onChange(parseFloat(event.target.value))}
      className={`w-full h-1.5 cursor-pointer ${accentClass}`}
    />
    {hint && <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{hint}</p>}
  </div>
);
