import React from 'react';
import { OccurrenceInfo } from '../../utils/cardSequenceEdits';

export interface OrderedListItem {
  /** Card/step type, used for the `data-*` hooks. */
  type: string;
  icon: string;
  label: string;
  occurrence: OccurrenceInfo;
}

export interface OrderedListEditorProps {
  containerId: string;
  items: OrderedListItem[];
  /** `data-*` attribute names used by tooling/tests, e.g. `data-step-card`. */
  dataAttr: string;
  indexAttr: string;
  minItems: number;
  /** Noun used in titles/labels ("etapa" or "card"). */
  itemNoun: string;
  occurrenceUnit: string;
  formatOrdinal: (index: number) => string;
  buttonIds: {
    up: string;
    down: string;
    repeat: string;
    remove: string;
  };
  maxHeightClass?: string;
  onMove: (index: number, delta: -1 | 1) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
}

/**
 * Ordered list with move/repeat/remove controls, shared by the study steps and
 * the visual cards editors. Both lists had duplicated ~70-line blocks before.
 */
export const OrderedListEditor: React.FC<OrderedListEditorProps> = ({
  containerId,
  items,
  dataAttr,
  indexAttr,
  minItems,
  itemNoun,
  occurrenceUnit,
  formatOrdinal,
  buttonIds,
  maxHeightClass = 'max-h-44',
  onMove,
  onDuplicate,
  onRemove
}) => {
  const canRemove = items.length > Math.max(1, minItems);

  return (
    <div
      id={containerId}
      className={`space-y-1.5 overflow-y-auto pr-0.5 ${maxHeightClass}`}
    >
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;
        return (
          <div
            key={`${item.type}-${idx}`}
            {...{ [dataAttr]: item.type, [indexAttr]: idx }}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="min-w-[22px] px-1 h-5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                {formatOrdinal(idx)}
              </span>
              <span className="text-sm shrink-0" aria-hidden="true">
                {item.icon}
              </span>
              <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[11px] text-slate-100 truncate">
                  {item.label}
                </span>
                {item.occurrence.isRepeated && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold shrink-0">
                    🔁 {item.occurrence.occurrence}ª {occurrenceUnit}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                id={`${buttonIds.up}_${idx}`}
                type="button"
                disabled={isFirst}
                onClick={() => onMove(idx, -1)}
                title={`Mover esta ${itemNoun} para antes`}
                aria-label={`Mover esta ${itemNoun} para antes`}
                className="min-w-[30px] min-h-[30px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                ↑
              </button>
              <button
                id={`${buttonIds.down}_${idx}`}
                type="button"
                disabled={isLast}
                onClick={() => onMove(idx, 1)}
                title={`Mover esta ${itemNoun} para depois`}
                aria-label={`Mover esta ${itemNoun} para depois`}
                className="min-w-[30px] min-h-[30px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                ↓
              </button>
              <button
                id={`${buttonIds.repeat}_${idx}`}
                type="button"
                onClick={() => onDuplicate(idx)}
                title={`Repetir / duplicar esta ${itemNoun} logo em seguida`}
                aria-label={`Repetir esta ${itemNoun} logo em seguida`}
                className="min-w-[30px] min-h-[30px] px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[10px] font-bold cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <span aria-hidden="true">🔁</span>
                <span className="hidden sm:inline">Repetir</span>
              </button>
              <button
                id={`${buttonIds.remove}_${idx}`}
                type="button"
                disabled={!canRemove}
                onClick={() => onRemove(idx)}
                title={
                  canRemove
                    ? `Remover esta ${itemNoun} da lista`
                    : `Mantenha pelo menos ${Math.max(1, minItems)} ${itemNoun}`
                }
                aria-label={`Remover esta ${itemNoun} da lista`}
                className="min-w-[30px] min-h-[30px] px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-30 text-rose-300 text-[10px] font-bold cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
