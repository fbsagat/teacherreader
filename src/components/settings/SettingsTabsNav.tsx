import React, { useRef } from 'react';
import { SettingsTabId, SettingsTabMeta } from '../../utils/settingsUi';

interface SettingsTabsNavProps {
  tabs: SettingsTabMeta[];
  activeTab: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
  /** Optional count/badge per tab (e.g. number of steps). */
  badges?: Partial<Record<SettingsTabId, string>>;
}

/**
 * Tab bar with proper `tablist` semantics plus arrow-key navigation
 * (←/→/Home/End), which the previous buttons-only bar lacked.
 */
export const SettingsTabsNav: React.FC<SettingsTabsNavProps> = ({
  tabs,
  activeTab,
  onSelect,
  badges = {}
}) => {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const focusTabAt = (index: number) => {
    const bounded = Math.min(tabs.length - 1, Math.max(0, index));
    const target = tabs[bounded];
    if (!target) return;
    onSelect(target.id);
    buttonRefs.current[target.id]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = tabs.findIndex(tab => tab.id === activeTab);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTabAt(currentIdx + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTabAt(currentIdx - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTabAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTabAt(tabs.length - 1);
    }
  };

  return (
    <div
      id="settingsTabsNav"
      role="tablist"
      aria-label="Seções de configurações"
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800/90 mt-2.5 shrink-0"
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const badge = badges[tab.id];
        return (
          <button
            key={tab.id}
            id={tab.domId}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={tab.panelId}
            tabIndex={isActive ? 0 : -1}
            title={tab.description}
            ref={node => {
              buttonRefs.current[tab.id] = node;
            }}
            onClick={() => onSelect(tab.id)}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
            {badge && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
