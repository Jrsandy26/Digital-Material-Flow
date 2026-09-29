import React, { useEffect, useRef } from 'react';
import { Terminal, Activity, Wifi } from 'lucide-react';

interface SimulationActivityLogProps {
  logs: string[];
}

export const SimulationActivityLog: React.FC<SimulationActivityLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // The existing logs are prepended (newest at index 0).
  // For a console feel, we reverse them so newest is at the bottom.
  const displayLogs = [...logs].reverse();

  return (
    <div className="flex-1 min-h-[150px] bg-[#0a0a0c] dark:bg-black rounded-xl border border-slate-300 dark:border-slate-800 shadow-inner flex flex-col overflow-hidden font-mono">
      {/* Console Header */}
      <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-slate-700 dark:text-emerald-400" />
          <h3 className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            Simulation Activity Log
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-400/20 shadow-sm">
            <Wifi className="w-2.5 h-2.5 animate-pulse" />
            <span className="font-bold">LIVE</span>
          </div>
        </div>
      </div>
      
      {/* Console Output Body */}
      <div 
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto space-y-1 text-[10px] sm:text-[11px] custom-scrollbar"
      >
        {displayLogs.length === 0 ? (
          <div className="text-slate-500 dark:text-slate-600 italic">Waiting for system events...</div>
        ) : (
          displayLogs.map((log, idx) => {
            // Attempt to parse time from log (e.g., "[06:00:00] System Initialized")
            const match = log.match(/^\[(.*?)\]\s*(.*)$/);
            
            if (match) {
              const [_, time, message] = match;
              
              // Color coding based on keywords
              const isWarning = message.toLowerCase().includes('warning') || message.toLowerCase().includes('idle');
              const isAlert = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed');
              const isSuccess = message.toLowerCase().includes('started') || 
                                message.toLowerCase().includes('loaded') ||
                                message.toLowerCase().includes('completed') ||
                                message.toLowerCase().includes('dispatched');
              
              let textColorClass = 'text-slate-600 dark:text-slate-300';
              if (isAlert) textColorClass = 'text-red-600 dark:text-red-400 font-bold';
              else if (isWarning) textColorClass = 'text-amber-600 dark:text-amber-400';
              else if (isSuccess) textColorClass = 'text-emerald-600 dark:text-emerald-400';

              return (
                <div key={idx} className="flex items-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded transition-colors group">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    [{time}]
                  </span>
                  <span className={`break-words leading-relaxed ${textColorClass}`}>
                    <span className="text-emerald-500 dark:text-emerald-400 mr-1.5 opacity-50">❯</span>
                    {message}
                  </span>
                </div>
              );
            }

            return (
              <div key={idx} className="flex items-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1 rounded transition-colors text-slate-600 dark:text-slate-300">
                <span className="text-emerald-500 dark:text-emerald-400 mr-1 shrink-0 opacity-50">❯</span>
                <span className="break-words leading-relaxed">{log}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
