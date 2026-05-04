import React, { useState, useRef, useEffect } from 'react';
import {
  DateRangeKey,
  DateRangeState,
  CustomDateRange,
  DATE_RANGE_LABELS,
} from '@/utils/dateUtils';

interface DateRangeSelectorProps {
  value: DateRangeState;
  onChange: (range: DateRangeState) => void;
}

const QUICK_OPTIONS: DateRangeKey[] = ['today', '7d', '30d', 'month', 'year', 'custom'];

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (key: DateRangeKey) => {
    if (key !== 'custom') {
      onChange({ key });
      setOpen(false);
    } else {
      onChange({ key: 'custom' });
      // Keep open to show date pickers
    }
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return;
    const custom: CustomDateRange = {
      startDate: new Date(customStart),
      endDate: new Date(customEnd),
    };
    onChange({ key: 'custom', custom });
    setOpen(false);
  };

  const label =
    value.key === 'custom' && value.custom
      ? `${new Date(value.custom.startDate).toLocaleDateString('pt-BR')} – ${new Date(value.custom.endDate).toLocaleDateString('pt-BR')}`
      : DATE_RANGE_LABELS[value.key];

  return (
    <div ref={ref} className="relative inline-block text-left z-30">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#161B22] border border-slate-700 text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all text-sm font-bold shadow-sm"
      >
        <span className="material-symbols-outlined text-[16px] text-emerald-400">calendar_month</span>
        {label}
        <span
          className={`material-symbols-outlined text-[14px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[#161B22] border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-1.5">
            {QUICK_OPTIONS.map((key) => (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                  value.key === key
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] opacity-70">
                  {key === 'today'
                    ? 'today'
                    : key === '7d' || key === '30d'
                    ? 'date_range'
                    : key === 'month'
                    ? 'calendar_view_month'
                    : key === 'year'
                    ? 'calendar_today'
                    : 'tune'}
                </span>
                {DATE_RANGE_LABELS[key]}
                {value.key === key && (
                  <span className="material-symbols-outlined text-[14px] ml-auto text-emerald-400">check</span>
                )}
              </button>
            ))}
          </div>

          {/* Custom date pickers */}
          {value.key === 'custom' && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-800 space-y-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Período personalizado</p>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block mb-1">De</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide block mb-1">Até</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-[#0E1117] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black py-2.5 rounded-xl transition-colors"
              >
                Aplicar período
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;
