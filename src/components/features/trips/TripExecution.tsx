import React, { useState } from 'react';
import { PlaySquare, CheckCircle2, Clock, Truck, ArrowRight, ShieldCheck, AlertCircle, ScanLine } from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { TripPlan, TripStatus } from '../../../types/manufacturing';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const TripExecutionView: React.FC = () => {
  const { trips, updateTripStep, parts, operators } = useMaterialFlow();
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const activeTrip = trips.find((t) => t.id === selectedTripId) || trips[0];
  const part = activeTrip ? parts.find((p) => p.partNo === activeTrip.partNo) : null;

  const stepsList = [
    { num: 1, title: 'Accept Route', desc: 'Accept trip assignment & route plan' },
    { num: 2, title: 'Pick Material from Store', desc: 'Verify store bin & part barcode scan' },
    { num: 3, title: 'Load Trolley', desc: 'Secure parts onto BOV / Jumbo Trolley' },
    { num: 4, title: 'Deliver to POC', desc: 'Transport material to assembly station' },
    { num: 5, title: 'Confirm Delivery', desc: 'Unload & update POC stock ledger' },
    { num: 6, title: 'Collect Empty Trolley', desc: 'Retrieve empty bin from POC buffer' },
    { num: 7, title: 'Return to Store', desc: 'Drive back along assigned return path' },
    { num: 8, title: 'Complete Trip', desc: 'Log cycle time & ready for next trip' },
  ];

  const filteredTrips = trips.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="trip-execution-view" className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PlaySquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            MHF Mobile/Tablet Step-by-Step Trip Execution Interface
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            8-Step operator execution wizard for material picking, transport, POC delivery, and empty return
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Filter Trips:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="Started">Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Delivered">Delivered</option>
            <option value="Completed">Completed</option>
            <option value="Delayed">Delayed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Trips Queue List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span>Trips Dispatch Queue ({filteredTrips.length})</span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">MHF Terminal</span>
          </h3>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {filteredTrips.map((t) => {
              const isSelected = t.id === activeTrip?.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTripId(t.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white shadow'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-300">{t.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === 'Completed'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                          : t.status === 'Delayed'
                          ? 'bg-rose-50 dark:bg-rose-500/30 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-500/40 animate-pulse'
                          : 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="mt-2 font-bold text-slate-900 dark:text-white">{t.partNo}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Operator: <strong className="text-slate-700 dark:text-slate-200">{t.assignedOperatorName}</strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>ETA: {t.estimatedArrivalPoc}</span>
                    <span>Step {t.currentStep}/8</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: 8-Step Active Workflow Panel */}
        {activeTrip && (
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            
            {/* Active Trip Banner */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30">
                    {activeTrip.id}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-base">{part?.description || activeTrip.partNo}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                  <span>Transport: <strong className="text-slate-900 dark:text-white">{activeTrip.transportMode}</strong></span>
                  <span>•</span>
                  <span>Operator: <strong className="text-indigo-600 dark:text-indigo-300">{activeTrip.assignedOperatorName}</strong></span>
                  <span>•</span>
                  <span>Load: <strong className="text-cyan-600 dark:text-cyan-300">{activeTrip.totalUnits} Units</strong></span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400">Current Execution Step</div>
                <div className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">Step {activeTrip.currentStep} of 8</div>
              </div>
            </div>

            {/* 8-Step Interactive Execution Wizard */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase font-mono">Operator Workflow Sequence</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stepsList.map((st) => {
                  const isDone = activeTrip.currentStep > st.num;
                  const isCurrent = activeTrip.currentStep === st.num;

                  return (
                    <div
                      key={st.num}
                      onClick={() => updateTripStep(activeTrip.id, st.num)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isCurrent
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-slate-900 dark:text-white shadow-md'
                          : isDone
                          ? 'bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400'
                          : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800/60 text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isDone
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40'
                            : isCurrent
                            ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 animate-pulse font-extrabold'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : st.num}
                      </div>

                      <div>
                        <div className="font-bold text-xs flex items-center gap-2">
                          <span className={isCurrent ? 'text-emerald-700 dark:text-emerald-300' : isDone ? 'text-slate-800 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
                            Step {st.num}: {st.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{st.desc}</p>

                        {isCurrent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTripStep(activeTrip.id, st.num + 1);
                            }}
                            className="mt-2.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer transition-colors"
                          >
                            <span>Complete Step {st.num}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
