import React from 'react';
import { Layers, MapPin, CheckCircle2 } from 'lucide-react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';
import { AssemblyLineCode } from '../../types/manufacturing';

interface AssemblyLineToggleProps {
  className?: string;
  compact?: boolean;
}

export const AssemblyLineToggle: React.FC<AssemblyLineToggleProps> = ({ className = '', compact = false }) => {
  const { selectedAssemblyLine, setSelectedAssemblyLine } = useMaterialFlow();

  const lines: { code: AssemblyLineCode; label: string; subLabel: string; badgeColor: string }[] = [
    {
      code: '1VCON100',
      label: '1VCON100',
      subLabel: 'Assembly Line 100',
      badgeColor: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
    },
    {
      code: '1VCON200',
      label: '1VCON200',
      subLabel: 'Assembly Line 200',
      badgeColor: 'border-cyan-500 text-cyan-400 bg-cyan-500/10',
    },
    {
      code: '1VCON300',
      label: '1VCON300',
      subLabel: 'Assembly Line 300',
      badgeColor: 'border-purple-500 text-purple-400 bg-purple-500/10',
    },
    {
      code: 'ALL',
      label: 'ALL LINES',
      subLabel: 'All 3 Assembly Lines',
      badgeColor: 'border-amber-500 text-amber-400 bg-amber-500/10',
    },
  ];

  if (compact) {
    return (
      <div className={`flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 ${className}`}>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold px-2 flex items-center gap-1">
          <Layers className="w-3 h-3 text-cyan-400" />
          <span>LOCATION:</span>
        </span>
        <div className="flex items-center gap-1 font-mono text-xs">
          {lines.map((l) => {
            const isSelected = selectedAssemblyLine === l.code;
            return (
              <button
                key={`compact-${l.code}`}
                onClick={() => setSelectedAssemblyLine(l.code)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{l.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
              <span>Assembly Line Location Choice</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-500/30 rounded font-mono">LIVE SWITCH</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Filter stores dispatching & conveyor line feeding metrics by Assembly Line Location
            </p>
          </div>
        </div>
      </div>

      {/* Assembly Line Toggle Button Group */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {lines.map((l) => {
          const isSelected = selectedAssemblyLine === l.code;
          return (
            <button
              key={l.code}
              onClick={() => setSelectedAssemblyLine(l.code)}
              className={`relative p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-50 dark:bg-slate-900 border-emerald-500 text-slate-900 dark:text-white shadow-lg shadow-emerald-100/40 dark:shadow-emerald-950/40 ring-2 ring-emerald-500/20'
                  : 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span
                  className={`text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded border ${l.badgeColor}`}
                >
                  {l.code}
                </span>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-in zoom-in-50" />
                )}
              </div>

              <div>
                <strong className={`text-xs font-bold block font-mono ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                  {l.label}
                </strong>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">{l.subLabel}</span>
              </div>

              {isSelected && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
