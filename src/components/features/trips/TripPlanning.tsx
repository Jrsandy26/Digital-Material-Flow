import React from 'react';
import { Truck, Clock, Calendar, ChevronRight, User, Repeat, Sparkles, BookOpen, X } from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculatePartMetrics, getMilkRunGroups, filterPartsByLine, filterInventoryByLine } from '../../../utils/calculations';
import { AssemblyLineToggle } from '../../common/AssemblyLineToggle';
import { MilkRunTestCaseDoc } from './MilkRunTestCaseDoc';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const TripPlanningView: React.FC = () => {
  const { parts, routes, operators, productionPlan, modeConfigs, inventoryStates, selectedAssemblyLine } = useMaterialFlow();
  const [deliveryMode, setDeliveryMode] = React.useState<'milkrun' | 'standard'>('milkrun');
  const [showTestCaseDoc, setShowTestCaseDoc] = React.useState(false);

  const filteredParts = React.useMemo(() => {
    return filterPartsByLine(parts, selectedAssemblyLine);
  }, [parts, selectedAssemblyLine]);

  const filteredInventoryStates = React.useMemo(() => {
    return filterInventoryByLine(inventoryStates, parts, selectedAssemblyLine);
  }, [inventoryStates, parts, selectedAssemblyLine]);

  // Calculate Milk Run Groups
  const milkRunGroups = getMilkRunGroups(filteredParts, productionPlan, modeConfigs, filteredInventoryStates);

  // Precompute precise milk-run group metrics based on combined part demands
  const milkRunGroupsWithMetrics = React.useMemo(() => {
    return milkRunGroups.map((group) => {
      const mode = group.transportMode || 'Jumbo Trolley';
      const config = modeConfigs[mode] || { carryingCapacityTrolleys: 3 };
      const carryingCapacity = config.carryingCapacityTrolleys || 3;

      if (group.tripsHr !== undefined) {
        let totalTrolleyDemandPerHour = 0;
        let totalNetShiftTrolleysReq = 0;

        group.parts.forEach((p) => {
          const metrics = calculatePartMetrics(p.part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs);
          totalTrolleyDemandPerHour += metrics.trolleyDemandPerHour;
          totalNetShiftTrolleysReq += metrics.netShiftTrolleysReq;
        });

        return {
          ...group,
          carryingCapacity,
          totalTrolleyDemandPerHour,
          totalNetShiftTrolleysReq,
          tripsHr: group.tripsHr,
          tripsShift: group.tripsShift ?? Math.max(1, group.tripsHr * 8),
          tripsDay: group.tripsDay ?? Math.max(1, (group.tripsShift ?? (group.tripsHr * 8)) * 2),
          freqMins: group.freqMins ?? Number((480 / Math.max(1, group.tripsShift ?? (group.tripsHr * 8))).toFixed(1)),
        };
      }

      let totalTrolleyDemandPerHour = 0;
      let totalNetShiftTrolleysReq = 0;

      group.parts.forEach((p) => {
        const metrics = calculatePartMetrics(p.part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs);
        totalTrolleyDemandPerHour += metrics.trolleyDemandPerHour;
        totalNetShiftTrolleysReq += metrics.netShiftTrolleysReq;
      });

      const tripsHr = Math.ceil(totalTrolleyDemandPerHour / carryingCapacity);
      const tripsShift = Math.ceil(totalNetShiftTrolleysReq / carryingCapacity);
      const tripsDay = tripsShift * 2;
      const freqMins = Number((480 / Math.max(1, tripsShift)).toFixed(1));

      return {
        ...group,
        carryingCapacity,
        totalTrolleyDemandPerHour,
        totalNetShiftTrolleysReq,
        tripsHr: Math.max(1, tripsHr),
        tripsShift: Math.max(1, tripsShift),
        tripsDay: Math.max(1, tripsDay),
        freqMins,
      };
    });
  }, [milkRunGroups, modeConfigs, productionPlan]);

  const totalMilkRunShiftTrips = milkRunGroupsWithMetrics.reduce((acc, g) => acc + g.tripsShift, 0);

  // Calculate totals based on selected delivery mode
  let totalHourlyTrips = 0;
  let totalShiftTrips = 0;

  if (deliveryMode === 'milkrun') {
    totalHourlyTrips = milkRunGroupsWithMetrics.reduce((acc, g) => acc + g.tripsHr, 0);
    totalShiftTrips = totalMilkRunShiftTrips;
  } else {
    totalHourlyTrips = filteredParts.reduce((acc, part) => {
      const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs);
      return acc + metrics.tripsRequiredPerHour;
    }, 0);

    totalShiftTrips = filteredParts.reduce((acc, part) => {
      const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs);
      return acc + metrics.tripsRequiredPerShift;
    }, 0);
  }

  const totalDailyTrips = totalShiftTrips * 2;

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="trip-planning-view" className="space-y-6 font-mono">
      
      {/* Header & Production Baseline Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="truncate">Material Trip Planning & Frequency Matrix</span>
            <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400 shrink-0">
              ({selectedAssemblyLine === 'ALL' ? 'ALL LINES' : selectedAssemblyLine})
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Shift delivery trips per hour, 8-hour shift, and 16-hour daily total based on {productionPlan.taktTimeSeconds}s takt time & store-to-line distances
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shrink-0 self-start xl:self-auto">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Shift Vehicle Target</span>
            <span className="text-amber-600 dark:text-amber-400 font-extrabold text-sm">{productionPlan.shiftPlanVehicles.toLocaleString()} Units/Shift</span>
          </div>
          <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Operating Takt Time</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{productionPlan.taktTimeSeconds}s / vehicle</span>
          </div>
          <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Daily Production Target</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">{(productionPlan.shiftPlanVehicles * 2).toLocaleString()} Units (2 Shifts)</span>
          </div>
        </div>
      </div>

      <AssemblyLineToggle />

      {/* Optimization Mode Interactive Toggle */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-slate-900 dark:text-white block">Delivery Planning Optimization Mode</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toggle between co-loaded milk-runs (TVS Lean Standard) and traditional isolated part delivery</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowTestCaseDoc(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Milk Run Test Case & Calculation Report</span>
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setDeliveryMode('milkrun')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                deliveryMode === 'milkrun'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grouped Milk-Run Mode (Optimized)
            </button>
            <button
              onClick={() => setDeliveryMode('standard')}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                deliveryMode === 'standard'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Standard Part-wise (Isolated)
            </button>
          </div>
        </div>
      </div>

      {/* Optimization Recommendation Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 flex items-center gap-3.5 text-xs text-slate-800 dark:text-slate-100">
        <Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 animate-pulse" />
        <div>
          <span className="font-bold text-blue-900 dark:text-white block uppercase tracking-wider">TVS Lean Logistics Recommendation</span>
          <span className="text-slate-600 dark:text-slate-300">
            You can reduce total shift trips from <strong className="text-blue-600 dark:text-blue-300">{parts.reduce((acc, part) => acc + calculatePartMetrics(part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs).tripsRequiredPerShift, 0)}</strong> to <strong className="text-emerald-600 dark:text-emerald-400">{totalMilkRunShiftTrips}</strong> trips (-{Math.round((((parts.reduce((acc, part) => acc + calculatePartMetrics(part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs).tripsRequiredPerShift, 0)) - totalMilkRunShiftTrips) / Math.max(1, parts.reduce((acc, part) => acc + calculatePartMetrics(part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs).tripsRequiredPerShift, 0))) * 100)}% congestion) by grouping materials onto Jumbo Trolleys. Go to the <strong className="text-cyan-600">Operator Roster</strong> tab to toggle Milk-Run co-loading live.
          </span>
        </div>
      </div>

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <span className="text-slate-550 dark:text-slate-400 text-[10px] uppercase font-bold block">Trips / Hour (Total)</span>
          <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-1">{totalHourlyTrips} Trips/Hr</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Hourly fleet dispatch frequency</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <span className="text-slate-550 dark:text-slate-400 text-[10px] uppercase font-bold block">Trips / Shift (8 Hours)</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalShiftTrips} Trips/Shift</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Based on {productionPlan.shiftPlanVehicles.toLocaleString()} units/shift demand</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <span className="text-slate-550 dark:text-slate-400 text-[10px] uppercase font-bold block">Trips / Day (16 Hours)</span>
          <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">{totalDailyTrips} Trips/Day</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Total 2 shifts daily operation</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
          <span className="text-slate-550 dark:text-slate-400 text-[10px] uppercase font-bold block">Mode Carrying Capacity</span>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1">
            <span className="text-amber-600 dark:text-amber-400">Jumbo/BOV: 3 Trolleys</span> | <span className="text-blue-600 dark:text-blue-400">Manual: 1 Trolley</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Capacity per transit trip</span>
        </div>
      </div>

      {/* Trip Matrix Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl overflow-x-auto">
        <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3">Part Number & Desc</th>
              <th className="px-4 py-3 text-center">Store → Line POC</th>
              <th className="px-4 py-3 text-center">Transport Mode & Cap</th>
              <th className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">Trolley Demand / Hr</th>
              <th className="px-4 py-3 text-right text-pink-600 dark:text-pink-400">Trolley Coverage</th>
              <th className="px-4 py-3 text-right text-cyan-600 dark:text-cyan-400 font-bold">Trips / Hr</th>
              <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-extrabold">Trips / Shift (8H)</th>
              <th className="px-4 py-3 text-right text-purple-600 dark:text-purple-400 font-extrabold">Trips / Day (16H)</th>
              <th className="px-4 py-3">Assigned Route</th>
              <th className="px-4 py-3">Assigned Operator</th>
              <th className="px-4 py-3 text-right">Cycle Time</th>
              <th className="px-4 py-3 text-right">Delivery Freq</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
            {parts.map((part, idx) => {
              const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles || 129, productionPlan.shiftPlanVehicles || 1000, modeConfigs);
              const assignedRoute = routes.find((r) => r.partsCarried.includes(part.partNo)) || routes[0];
              const assignedOp = operators.find((o) => o.id === assignedRoute.assignedOperatorId) || operators[0];

              // In milk-run co-loading mode, look up this part's consolidated group properties
              const group = deliveryMode === 'milkrun' 
                ? milkRunGroupsWithMetrics.find((g) => g.parts.some((p) => p.part.partNo === part.partNo))
                : null;

              // Derive display trip values (either optimized milkrun group metrics or standard individual metrics)
              const tripsHr = group ? group.tripsHr : metrics.tripsRequiredPerHour;
              const tripsShift = group ? group.tripsShift : metrics.tripsRequiredPerShift;
              const tripsDay = group ? group.tripsDay : metrics.tripsRequiredPerDay;
              const cycleTime = group ? group.cycleTimeMin : metrics.cycleTimeMin;
              const freqMins = group ? group.freqMins : metrics.deliveryFrequencyMins;
              const routeLabel = group ? group.groupId : assignedRoute.routeId;

              return (
                <tr key={`${part.partNo}-${part.pocPoint}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">{part.partNo}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[160px] block">{part.description}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-slate-900 dark:text-white font-bold block">{part.storeLocation || 'Store'} → {part.pocPoint}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Dist: {part.loadedDistanceMeters}m</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-300 font-bold block text-[11px]">
                      {part.transportMode}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 block">
                      Cap: {metrics.carryingCapacity} {metrics.carryingCapacity === 1 ? 'trolley' : 'trolleys'} ({part.binCapacity} qty/trolley)
                    </span>
                  </td>
                  
                  {/* Trolley Demand Per Hour */}
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-300 font-bold text-sm bg-amber-500/5 dark:bg-amber-950/5">
                    {metrics.trolleyDemandPerHour.toFixed(2)} trolleys/hr
                    <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                      ({metrics.hourlyConsumption} parts/hr)
                    </span>
                  </td>

                  {/* Trolley Coverage Time */}
                  <td className="px-4 py-3 text-right text-pink-700 dark:text-pink-300 font-bold text-sm bg-pink-500/5 dark:bg-pink-950/5">
                    {metrics.trolleyCoverageTimeMin.toFixed(1)} mins
                    <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                      (per {part.binCapacity} qty trolley)
                    </span>
                  </td>

                  {/* Trips / Hour */}
                  <td className="px-4 py-3 text-right text-cyan-600 dark:text-cyan-300 font-extrabold text-sm">
                    {tripsHr} {tripsHr === 1 ? 'trip/hr' : 'trips/hr'}
                    {group ? (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5 uppercase tracking-wide">
                        [Co-loaded]
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-normal font-sans block mt-0.5">
                        ({metrics.trolleyDemandPerHour.toFixed(0)} bins / {metrics.carryingCapacity} cap)
                      </span>
                    )}
                  </td>

                  {/* Trips / Shift */}
                  <td className="px-4 py-3 text-right bg-emerald-100/20 dark:bg-emerald-950/20">
                    <span className="text-emerald-600 dark:text-emerald-300 font-black text-sm block">{tripsShift} trips/shift</span>
                    {!group && metrics.grossTripsRequiredPerShift > metrics.tripsRequiredPerShift && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal line-through block">
                        ({metrics.grossTripsRequiredPerShift} gross)
                      </span>
                    )}
                    {group && (
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-normal block mt-0.5">
                        Group Run: {group.groupId}
                      </span>
                    )}
                  </td>

                  {/* Trips / Day */}
                  <td className="px-4 py-3 text-right bg-purple-100/20 dark:bg-purple-950/20">
                    <span className="text-purple-600 dark:text-purple-300 font-black text-sm block">{tripsDay} trips/day</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block">(2 shifts x 8h)</span>
                  </td>

                  {/* Assigned Route */}
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    <span className="font-bold">{routeLabel}</span>
                    {group && (
                      <span className="text-[9px] text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {group.parts.length} parts assigned
                      </span>
                    )}
                  </td>

                  {/* Assigned Operator */}
                  <td className="px-4 py-3 font-sans text-indigo-600 dark:text-indigo-300 font-semibold">{assignedOp.name}</td>
                  
                  {/* Cycle Time */}
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-bold">
                    {cycleTime.toFixed(2)} min
                    {group && (
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-normal block mt-0.5">
                        Max group route CT
                      </span>
                    )}
                  </td>

                  {/* Delivery Freq */}
                  <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-300 font-bold">Every {freqMins}m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Milk Run Test Case & Calculation Report Modal */}
      {showTestCaseDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-6xl my-8">
            <MilkRunTestCaseDoc onClose={() => setShowTestCaseDoc(false)} />
          </div>
        </div>
      )}

    </div>
  );
};
