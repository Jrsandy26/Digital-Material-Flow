import React from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  FileSpreadsheet,
  Boxes,
  HelpCircle
} from 'lucide-react';
import { ProductionPlan } from '../../../types/manufacturing';

interface SWCTDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  productionPlan: ProductionPlan;
  taktTimeSec: number;
}

export const SWCTDiagnosticModal: React.FC<SWCTDiagnosticModalProps> = ({
  isOpen,
  onClose,
  productionPlan,
  taktTimeSec
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-md shadow-blue-600/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Mizusumashi Test Case & Shopfloor Schedule Diagnostic
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                129 Vehicles/Hour | Takt: {taktTimeSec.toFixed(2)}s | 3-Trolley Jumbo Tugger | POC Tolerance: -2.0 Mins
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 text-slate-800 dark:text-slate-200 text-sm">
          
          {/* EXECUTIVE HIGHLIGHT BANNER */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-600 rounded-xl text-white shrink-0 mt-0.5">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-blue-950 dark:text-blue-200 text-sm">
                  Why does the Mizusumashi Chart show like this?
                </h4>
                <p className="text-xs text-blue-900/80 dark:text-blue-300 leading-relaxed">
                  The chart reflects the physical balance between <strong>Operator Motion Time (7.32 mins)</strong>, 
                  <strong> Line Consumption Duration (27.91 mins)</strong>, and the <strong>-2.0 min POC Arrival Tolerance</strong>. 
                  In continuous motion study, trips are packed end-to-end (14.6m). On the live shopfloor, Trip 2 is paced to depart at 
                  <strong> 22.5 mins</strong> (arriving at <strong>25.9 mins</strong>) so that line stock is replenished 
                  <em> exactly 2 minutes before Trip 1 runs out</em>, without placing more than 2 trolleys at the POC workstation.
                </p>
              </div>
            </div>
          </div>

          {/* 3 CORE SHOPFLOOR RULES BANNER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 space-y-1.5">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs">
                <Clock className="w-4 h-4 shrink-0" />
                <span>1. Tolerance: -2 Mins Rule</span>
              </div>
              <p className="text-[11px] text-red-900/80 dark:text-red-300 leading-relaxed">
                Tugger trips are scheduled with a <strong>-2.0 minute safety buffer</strong> (arriving 120 seconds before POC parts stockout) to guarantee zero line starvation.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                <Boxes className="w-4 h-4 shrink-0" />
                <span>2. POC Capacity: Max 2 Trolleys</span>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-300 leading-relaxed">
                Each POC workstation can handle a <strong>strict maximum of 2 trolleys</strong> (1 active in-use + 1 staging swap). Higher values are capped to avoid line congestion.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                <Truck className="w-4 h-4 shrink-0" />
                <span>3. Station Spacing: 2m Gap Rule</span>
              </div>
              <p className="text-[11px] text-blue-900/80 dark:text-blue-300 leading-relaxed">
                Every station has a <strong>2m gap</strong> (e.g., PL-01 → PL-02 is 2m, PL-03 → PL-13 is 20m). All transit distances and travel times are calculated based on this physical spacing.
              </p>
            </div>
          </div>

          {/* 7 QUESTIONS COMPLETE TECHNICAL TEST CASE REPORT */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Technical Verification & Standard Work Calculations
            </h4>

            {/* Q1 & Q2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Q1 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">1</span>
                  129 Vehicles: Trip Requirement
                </div>
                <div className="text-xs space-y-1.5 leading-relaxed">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Requirement: 3 Trips/Hour (18 Trips/Shift)
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Swingarm (KE090530): 129 pcs/hr ÷ 60 pcs/trolley = <strong>2.15 trolleys/hr</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Wheel (KE110470): 258 pcs/hr (usage=2) ÷ 60 pcs/trolley = <strong>4.30 trolleys/hr</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Total hourly volume = <strong>6.45 trolleys/hr</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Carrying capacity = 3 trolleys/tugger → 6.45 ÷ 3 = <strong>3 Trips/Hour</strong> (18 trips across 8 hrs).
                  </p>
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
                    <strong>Uploaded File Note:</strong> The uploaded Excel had integer overrides of 2 and 4 (total 6 trolleys = 2 trips = 120 veh). 2 trips cover 55.8 mins. Trip 3 supplies the remaining 9 vehicles to complete 129 VPH.
                  </div>
                </div>
              </div>

              {/* Q2 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">2</span>
                  Timings Breakdown (Stores ↔ POC)
                </div>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">1. Load at Store</span>
                      <strong>30s</strong> (3 × 10s)
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">2. Move to POC</span>
                      <strong>172s</strong> (239m @ 0.72s/m)
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">3. Unload at POC</span>
                      <strong>30s</strong> (3 × 10s)
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">4. Empty Pick</span>
                      <strong>30s</strong> (3 × 10s)
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">5. Return to Store</span>
                      <strong>147s</strong> (204m @ 0.72s/m)
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px]">6. Empty Drop</span>
                      <strong>30s</strong> (3 × 10s)
                    </div>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white pt-1">
                    Total Operator Cycle Time = <span className="text-blue-600 dark:text-blue-400">439s (7.32 mins)</span>
                  </div>
                  <div className="p-2 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 rounded-xl text-[10px] text-blue-800 dark:text-blue-300">
                    <strong>2m Station Spacing Rule:</strong> Stores to line base is 190m. Each station adds +2m (e.g., PL-01 = 190m, PL-03 = 194m, PL-13 = 214m). Inter-station distance: |StationA - StationB| × 2m (e.g. PL-03 ↔ PL-13 = 20m).
                  </div>
                </div>
              </div>
            </div>

            {/* Q3 & Q4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Q3 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">3</span>
                  Part Consumption Duration at POC
                </div>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Synchronized Batch Consumption: 27.91 Mins (60 Vehicles)
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Plant Takt: 3,600s ÷ 129 = <strong>27.907 seconds / vehicle</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Swingarm (1 trolley = 60 pcs): 60 × 27.91s = <strong>1,674.4s = 27.91 mins</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Wheel (2 trolleys = 60 pcs, usage=2): (60 ÷ 2) × 27.91s = <strong>1,674.4s = 27.91 mins</strong>.
                  </p>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300">
                    <strong>Perfect Harmonic Balance:</strong> Both parts deplete simultaneously at minute 27.91, proving that the 2 Wheels + 1 Swingarm grouping is balanced without material stranding.
                  </div>
                </div>
              </div>

              {/* Q4 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">4</span>
                  Next Trip Schedule & Dispatch Trigger
                </div>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Triggered by -2.0 Mins Tolerance Rule
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Trip 1 Departs: <strong>00:00</strong> → Unloads at POC: <strong>03:22 (3.37m)</strong> → Covers line until <strong>27.91m</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Trip 2 Target Arrival: 27.91m - 2.00m tolerance = <strong>25.91 mins (1,554s)</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Transit Lead Time: Pick (30s) + Travel (172s) = 202s = <strong>3.37 mins</strong>.
                  </p>
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl font-mono text-[11px] text-blue-900 dark:text-blue-200">
                    Trip 2 Dispatch Trigger = 25.91m - 3.37m = <strong>22.54 Mins (1,352 seconds)</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Q5 & Q6 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Q5 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">5</span>
                  Grouping, Requirement & Priority Scheduling
                </div>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Tugger Capacity: 3 Trolleys (100% Filled)
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Hourly demand ratio: 4.30 Wheel trolleys : 2.15 Swingarm trolleys = <strong>2 : 1</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Optimal Batch: <strong>2 Trolleys of Wheels + 1 Trolley of Swingarms = 3 Trolleys</strong>.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Priority Scheduling: As inventory drops below 10 mins coverage, priority shifts from Normal (P3) to Critical (P1), locking the dispatch trigger.
                  </p>
                </div>
              </div>

              {/* Q6 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">6</span>
                  POC Constraint Management (Max 2 Trolleys)
                </div>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Preventing Line Congestion & Space Overflow
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    • If Trip 2 departed immediately at minute 7.3, 4 trolleys would accumulate at the workstation, violating safety and floor space.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • Because Trip 2 arrives at <strong>25.91 mins</strong>, only <strong>4–5 parts</strong> remain in the active trolley.
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    • The Mizusumashi swaps the full trolley in, couples the empty trolley out, ensuring that exactly <strong>1 to 2 trolleys</strong> exist at the POC at all times.
                  </p>
                </div>
              </div>
            </div>

            {/* Q7: FULL PROCESS FLOW SUMMARY */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-[10px]">7</span>
                Complete Standard Work Sequence & Visual Timeline
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                    <span>Trip 1 (00:00 – 07:19)</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full">Full Delivery</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Loads 1 Swingarm + 2 Wheels at Store. Moves to Line POC. Unloads full trolleys. Returns to store with previous empties.
                  </p>
                  <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    Stock Coverage: 00:00 → 27:54 (60 Vehicles)
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                    <span>Trip 2 (22:32 – 29:51)</span>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-full">-2m Replenish</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Triggered at 22:32. Arrives at POC at 25:54 (2 mins before Trip 1 exhaustion). Swaps empty trolleys and returns.
                  </p>
                  <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    Stock Coverage: 25:54 → 55:48 (120 Vehicles)
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                    <span>Trip 3 (50:27 – 57:46)</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">Complete 129 Target</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Triggered at 50:27. Arrives at 53:48 (2 mins before Trip 2 exhaustion). Covers remaining 9 vehicles in Hour 1 and extends into Hour 2.
                  </p>
                  <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    Stock Coverage: 53:48 → 83:42 (180 Vehicles)
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close Diagnostic
          </button>
        </div>
      </div>
    </div>
  );
};
