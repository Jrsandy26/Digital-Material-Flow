import React, { useMemo } from 'react';
import {
  Boxes,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  Truck,
  Sparkles,
  Info
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { sortPocStations } from '../../../utils/pocSorter';
import { filterInventoryByLine, getPartLineCode, getPocSpaceTrolleysMax } from '../../../utils/calculations';
import { AssemblyLineToggle } from '../../common/AssemblyLineToggle';

import { RealTimeInventoryState } from '../../../types/manufacturing';
import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const RealTimeInventoryView: React.FC = () => {
  const { inventoryStates, parts, selectedAssemblyLine, advanceShift, trips, modeConfigs, productionPlan } = useMaterialFlow();

  const sortedInventoryStates = useMemo(() => {
    const sorted = sortPocStations<RealTimeInventoryState>(inventoryStates);
    return filterInventoryByLine(sorted, parts, selectedAssemblyLine);
  }, [inventoryStates, parts, selectedAssemblyLine]);

  // Aggregate high-level stats
  const stats = useMemo(() => {
    let totalCurrentUnits = 0;
    let totalOpeningUnits = 0;
    let totalDeliveredUnits = 0;
    let totalConsumedUnits = 0;
    let restockTriggeredCount = 0;
    let criticalLowCount = 0;

    sortedInventoryStates.forEach((state) => {
      totalCurrentUnits += state.currentStockUnits;
      totalOpeningUnits += state.openingStockUnits;
      totalDeliveredUnits += state.deliveredQuantityUnits;
      totalConsumedUnits += state.consumedQuantityUnits;
      if (state.currentStockUnits <= (state.safetyStockUnits || 10)) {
        criticalLowCount++;
      } else if (state.currentStockUnits <= (state.reorderPointUnits || 20)) {
        restockTriggeredCount++;
      }
    });

    return {
      totalCurrentUnits,
      totalOpeningUnits,
      totalDeliveredUnits,
      totalConsumedUnits,
      restockTriggeredCount,
      criticalLowCount,
    };
  }, [sortedInventoryStates]);

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="realtime-inventory-view" className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Real-Time POC Inventory & Kanban Restock Ledger
            <span className="text-xs font-mono font-normal px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {selectedAssemblyLine === 'ALL' ? 'ALL ASSEMBLY LINES' : selectedAssemblyLine}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Live Point-of-Consumption (POC) inventory tracking with automated Kanban restock triggers, 2-trolley line footprint constraints, and shift carryover optimization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={advanceShift}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Advance Shift Carryover (Shift 1 → Shift 2)</span>
          </button>
        </div>
      </div>

      {/* Lean Principles Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Active Stock</span>
            <Boxes className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {stats.totalCurrentUnits.toLocaleString()} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Opening: {stats.totalOpeningUnits.toLocaleString()} u | Delivered: +{stats.totalDeliveredUnits.toLocaleString()} u
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Restock Requests Active</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {stats.restockTriggeredCount} <span className="text-xs font-sans text-slate-400 font-normal">stations</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Stock ≤ Reorder Point (ROP)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Critical Low Stock</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {stats.criticalLowCount} <span className="text-xs font-sans text-slate-400 font-normal">stations</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Stock ≤ Min Safety Stock (SS)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">POC Line Constraint</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            Max 2 <span className="text-xs font-sans text-slate-400 font-normal">Trolleys / POC</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            1 Active + 1 Buffer (2m station gap)
          </p>
        </div>
      </div>

      {/* Lean Rules Explanation Card */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-emerald-50/70 dark:from-indigo-950/30 dark:via-slate-900/50 dark:to-emerald-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-300">
          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Lean Material Flow Engineering Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-600 dark:text-slate-300">
          <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-semibold text-slate-900 dark:text-white block">1. Initial Available Material & Carryover</span>
            Opening stock at 07:00 AM reduces the net replenishment requirement (<span className="font-mono text-indigo-600 dark:text-indigo-400">Net = Gross - Initial</span>) and provides initial line coverage before the first replenishment trip is dispatched.
          </div>
          <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-semibold text-slate-900 dark:text-white block">2. POC Space Constraint (Max 2 Trolleys)</span>
            Point of Consumption (POC) stations strictly hold a maximum of 2 trolleys (1 in-use + 1 staging buffer) with a 2-meter physical gap between adjacent conveyor line stations to prevent congestion.
          </div>
          <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="font-semibold text-slate-900 dark:text-white block">3. Automated Kanban Restock Trigger</span>
            When active stock drops below Reorder Point (<span className="font-mono text-amber-600 dark:text-amber-400">Stock ≤ ROP</span>) or Safety Stock (<span className="font-mono text-rose-600 dark:text-rose-400">Stock ≤ SS</span>), an automated restock request is generated for supermarket kitting.
          </div>
        </div>
      </div>

      <AssemblyLineToggle />

      {/* Inventory Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl overflow-x-auto">
        <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 font-mono uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-3.5 py-3">POC Point</th>
              <th className="px-3 py-3">Line</th>
              <th className="px-3 py-3">Part No</th>
              <th className="px-3.5 py-3">Description</th>
              <th className="px-3 py-3 text-right text-slate-500 dark:text-slate-400">Opening Stock</th>
              <th className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400">+ Delivered</th>
              <th className="px-3 py-3 text-right text-amber-600 dark:text-amber-400">- Consumed</th>
              <th className="px-3.5 py-3 text-right text-slate-900 dark:text-white font-bold bg-slate-200/60 dark:bg-slate-950/80">= Active Stock</th>
              <th className="px-3 py-3 text-center text-indigo-600 dark:text-indigo-400">Safety / ROP</th>
              <th className="px-3 py-3 text-center">POC Trolleys</th>
              <th className="px-3 py-3 text-center">Kanban Restock Trigger</th>
              <th className="px-3 py-3 text-right">Coverage</th>
              <th className="px-3 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
            {sortedInventoryStates.map((state, idx) => {
              const part = parts.find((p) => p.partNo === state.partNo);
              const lineCode = getPartLineCode(part, state.pocPoint);
              const binCap = part?.binCapacity || 50;
              const currentTrolleys = (state.currentStockUnits / binCap).toFixed(1);
              const maxPocTrolleys = getPocSpaceTrolleysMax(part);

              const hourlyDemand = (productionPlan?.hourlyPlanVehicles || 129) * (part?.usagePerVehicle || 1);
              const safetyStock = state.safetyStockUnits || Math.ceil((part?.minSafetyCoverageHours || 0.25) * hourlyDemand);
              const reorderPoint = state.reorderPointUnits || Math.ceil(safetyStock * 1.8);

              // Check if in transit
              const activeTrip = trips.find(
                (t) => t.partNo === state.partNo && (t.status === 'Started' || t.status === 'In Progress')
              );

              const isCritical = state.currentStockUnits <= safetyStock;
              const isRestockNeeded = state.currentStockUnits <= reorderPoint;

              return (
                <tr key={`${state.pocPoint}-${state.partNo}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-3.5 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {state.pocPoint}
                  </td>
                  <td className="px-3 py-3 font-bold text-cyan-600 dark:text-cyan-400">{lineCode}</td>
                  <td className="px-3 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                    <div>{state.partNo}</div>
                    <span className="text-[10px] font-sans font-semibold text-amber-600 dark:text-amber-400">
                      {part?.usagePerVehicle || 1} / veh
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 font-sans max-w-[160px]">
                    <div className="truncate font-medium">{part?.description}</div>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                        part?.binOrTrolley === 'Carton'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60'
                          : part?.binOrTrolley === 'Bin'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60'
                          : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700/60'
                      }`}
                      title={part?.binOrTrolley === 'Carton' ? 'Pre-packed in carton box' : part?.binOrTrolley === 'Bin' ? 'Stored in bin on platform trolley' : 'Pre-loaded in dedicated trolley'}
                    >
                      {part?.binOrTrolley === 'Carton' ? 'Carton' : part?.binOrTrolley === 'Bin' ? 'Bin' : 'Trolley'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-500 dark:text-slate-400 font-bold">{state.openingStockUnits} u</td>
                  <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">+{state.deliveredQuantityUnits}</td>
                  <td className="px-3 py-3 text-right text-amber-600 dark:text-amber-400 font-bold">-{state.consumedQuantityUnits}</td>
                  <td className="px-3.5 py-3 text-right text-slate-900 dark:text-white font-extrabold text-sm bg-slate-100 dark:bg-slate-950/80">
                    {state.currentStockUnits} u
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      SS: <strong className="text-rose-600 dark:text-rose-400">{safetyStock}</strong> | ROP: <strong className="text-amber-600 dark:text-amber-400">{reorderPoint}</strong>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      Number(currentTrolleys) > maxPocTrolleys
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {currentTrolleys} / {maxPocTrolleys} tr
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {activeTrip ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 animate-pulse">
                        <Truck className="w-3 h-3" />
                        In Transit (Step {activeTrip.currentStep}/8)
                      </span>
                    ) : isCritical ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-500/30 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-500/50 animate-bounce">
                        <ShieldAlert className="w-3 h-3 text-rose-500" />
                        Restock Request (CRITICAL)
                      </span>
                    ) : isRestockNeeded ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Restock Triggered (&lt; ROP)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Buffer Normal
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-900 dark:text-white font-bold">{state.coverageHours}h</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      state.riskLevel === 'Green'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                        : state.riskLevel === 'Yellow'
                        ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                        : 'bg-rose-50 dark:bg-rose-500/30 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-500/50'
                    }`}>
                      {state.riskLevel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
