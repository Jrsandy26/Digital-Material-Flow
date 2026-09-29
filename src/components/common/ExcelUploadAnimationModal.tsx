import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Cpu, Layers, Boxes, Sparkles } from 'lucide-react';

interface ExcelUploadAnimationModalProps {
  isOpen: boolean;
  fileName: string;
  parsedCount?: number;
  errorMessage?: string | null;
  onClose: () => void;
}

export const ExcelUploadAnimationModal: React.FC<ExcelUploadAnimationModalProps> = ({
  isOpen,
  fileName,
  parsedCount,
  errorMessage,
  onClose,
}) => {
  const [step, setStep] = useState<number>(1);
  const [progress, setProgress] = useState<number>(10);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setProgress(10);
      return;
    }

    if (errorMessage) {
      return;
    }

    // Progress animation sequence
    const t1 = setTimeout(() => {
      setStep(2);
      setProgress(40);
    }, 600);

    const t2 = setTimeout(() => {
      setStep(3);
      setProgress(75);
    }, 1300);

    const t3 = setTimeout(() => {
      setStep(4);
      setProgress(100);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen, errorMessage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden font-sans">
        
        {/* Glow background accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          
          {/* Header */}
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 relative">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400 animate-pulse" />
              {progress < 100 && !errorMessage && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <span>Excel Material Flow Processing</span>
                {progress === 100 && !errorMessage && (
                  <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />
                )}
              </h3>
              <p className="text-xs text-slate-400 truncate font-mono mt-0.5">{fileName || 'Material_Master.xlsx'}</p>
            </div>
          </div>

          {/* Error View */}
          {errorMessage ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 space-y-2 text-xs">
              <div className="flex items-center space-x-2 font-bold text-rose-400 font-mono">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>Upload Failed</span>
              </div>
              <p className="font-mono text-slate-300">{errorMessage}</p>
              <button
                onClick={onClose}
                className="mt-2 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer font-mono"
              >
                Close & Retry
              </button>
            </div>
          ) : (
            <>
              {/* Animated Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Processing Pipeline</span>
                  <span className="text-emerald-400 font-bold">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-300 rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Animated Step Breakdown */}
              <div className="space-y-2.5 text-xs font-mono pt-1">
                <div className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                  step >= 1 ? 'bg-slate-950 border-emerald-500/40 text-white' : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step > 1 ? 'bg-emerald-500 text-slate-950' : step === 1 ? 'bg-emerald-500/20 text-emerald-400 animate-spin' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {step > 1 ? '✓' : '1'}
                  </div>
                  <span className={step >= 1 ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                    Reading Excel workbook sheet & headers
                  </span>
                </div>

                <div className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                  step >= 2 ? 'bg-slate-950 border-emerald-500/40 text-white' : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step > 2 ? 'bg-emerald-500 text-slate-950' : step === 2 ? 'bg-emerald-500/20 text-emerald-400 animate-spin' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {step > 2 ? '✓' : '2'}
                  </div>
                  <span className={step >= 2 ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                    Extracting Part Numbers, Bin Capacities & Store Locations
                  </span>
                </div>

                <div className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                  step >= 3 ? 'bg-slate-950 border-emerald-500/40 text-white' : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step > 3 ? 'bg-emerald-500 text-slate-950' : step === 3 ? 'bg-emerald-500/20 text-emerald-400 animate-spin' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {step > 3 ? '✓' : '3'}
                  </div>
                  <span className={step >= 3 ? 'text-slate-200 font-medium' : 'text-slate-500'}>
                    Ordering Pre-Line (PL-49 → PL-01) & Main Line (ML-01 → ML-50) POC Stations
                  </span>
                </div>

                <div className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                  step >= 4 ? 'bg-slate-950 border-emerald-500/40 text-white' : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    progress === 100 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {progress === 100 ? '✓' : '4'}
                  </div>
                  <span className={step >= 4 ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                    Synchronizing Live Factory Control Tower & Takt Schedules
                  </span>
                </div>
              </div>

              {/* Completion Summary Card */}
              {progress === 100 && (
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs font-mono">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Import Successfully Completed!</span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono">
                    Successfully parsed <strong>{parsedCount || 0} active component records</strong>. Central Stores and Assembly Conveyor layouts updated.
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg font-mono cursor-pointer"
                  >
                    View Updated Control Tower
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
