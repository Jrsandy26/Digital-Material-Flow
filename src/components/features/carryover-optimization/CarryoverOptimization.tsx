import React, { useState, useMemo } from 'react';
import { Clock, Calculator, ShieldCheck, Download, Layers, ArrowRight, Zap, RefreshCw, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculateHourlyAndShiftCarryover, CarryoverOptimizationResult } from '../../../utils/calculations';
import { exportMaterialFlowExcel } from '../../../utils/excelParser';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const CarryoverOptimizationView: React.FC = () => {
  const { parts, modeConfigs, productionPlan } = useMaterialFlow();
  const [taktTimeInput, setTaktTimeInput] = useState<number>(27.9);
  const [selectedPartNo, setSelectedPartNo] = useState<string>(parts[0]?.partNo || '');

  // Calculate Carryover Optimization for all parts based on selected Takt Time (27.9s default)
  const carryoverResults: CarryoverOptimizationResult[] = useMemo(() => {
    return parts.map((part) => calculateHourlyAndShiftCarryover(part, taktTimeInput, modeConfigs));
  }, [parts, taktTimeInput, modeConfigs]);

  // Selected part for deep-dive hourly analysis
  const activeResult = useMemo(() => {
    return carryoverResults.find((r) => r.partNo === selectedPartNo) || carryoverResults[0];
  }, [carryoverResults, selectedPartNo]);

  // Aggregate plant metrics
  const totalDailyTripsSaved = useMemo(() => {
    return carryoverResults.reduce((sum, r) => sum + r.totalDailyTripsSaved, 0);
  }, [carryoverResults]);

  const totalShiftTripsSaved = useMemo(() => {
    return carryoverResults.reduce((sum, r) => sum + r.totalShiftTripsSaved, 0);
  }, [carryoverResults]);

  const activePart = parts.find((p) => p.partNo === selectedPartNo) || parts[0];

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="carryover-optimization-view" className="space-y-6 text-slate-900 dark:text-white">
      {/* Top Banner & Control Tower Bar */}
      <div className="bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-indigo-950/80 dark:to-slate-900 border border-slate-200 dark:border-indigo-500/30 rounded-2xl p-5 shadow-sm dark:shadow-2xl space-y-4 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-400/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Carryover Stock Optimization Engine
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 font-mono">
                  TAKT-BASED 2-SHIFT MODEL
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                Calculates hourly consumption and 2-shift carryover stock buffers starting at 07:00 AM (post Shift 2 ending) to optimize net trips and line-feeding efficiency.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportMaterialFlowExcel(parts, productionPlan, `Carryover_Optimization_Takt_${taktTimeInput}s.xlsx`, modeConfigs)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-lg border border-blue-400/30"
            >
              <Download className="w-4 h-4" />
              <span>Export Optimization Report</span>
            </button>
          </div>
        </div>

        {/* Takt Time & Shift Rate Calculator Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-indigo-800/40">
          {/* Target Takt Time Input */}
          <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-indigo-500/40 rounded-xl p-3 space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Target Takt Time (Seconds)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="0.1"
                min="10"
                max="120"
                value={taktTimeInput}
                onChange={(e) => setTaktTimeInput(Math.max(1, Number(e.target.value)))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-indigo-500/50 rounded-lg px-3 py-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-black text-base focus:outline-none focus:border-emerald-400"
              />
              <div className="flex gap-1">
                {[27.9, 25.0, 30.0].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTaktTimeInput(t)}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${
                      taktTimeInput === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hourly Vehicle Production Rate (VPH) */}
          <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Vehicles Per Hour (VPH)</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {(3600 / taktTimeInput).toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">vph</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Calculated via 3,600s / {taktTimeInput}s Takt</span>
          </div>

          {/* Shift 8-Hour Target Plan */}
          <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">8-Hour Shift Vehicle Target</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-black text-cyan-600 dark:text-cyan-300 font-mono">
                {Math.round((3600 / taktTimeInput) * 8)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">vehicles / shift</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Shift 1: 07:00 AM - 15:00 PM</span>
          </div>

          {/* 16-Hour 2-Shift Plant Target */}
          <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">16-Hour (2-Shift) Target</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-black text-purple-600 dark:text-purple-300 font-mono">
                {Math.round((3600 / taktTimeInput) * 16)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">vehicles / day</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Shift 1 (07:00) + Shift 2 (15:30)</span>
          </div>
        </div>
      </div>

      {/* KPI Optimization Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg space-y-1 transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Shift 1 Trips Saved
            <TrendingDown className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {totalShiftTripsSaved} Trips
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Absorbed by Shift 2 carryover stock at 07:00 AM
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg space-y-1 transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            16-Hour Daily Trips Saved
            <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-300 font-mono">
            {totalDailyTripsSaved} Trips / Day
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Optimized across both 2 operating shifts
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg space-y-1 transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Active Takt Baseline
            <Clock className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-300 font-mono">
            {taktTimeInput}s Takt
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            = {(3600 / taktTimeInput).toFixed(1)} Vehicles / Hr
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-cyan-100 dark:border-cyan-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg space-y-1 transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Line Zero Stoppage Shield
            <ShieldCheck className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          </span>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-300 font-mono">
            100% Protected
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Continuous buffer coverage &gt; 0.5 Hrs
          </p>
        </div>
      </div>

      {/* Part Selection & Detailed Deep-Dive Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              Part Level Carryover Simulation & 2-Shift Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a part to analyze its hourly stock depletion, delivery trigger points, and shift-to-shift carryover
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select Part Master:</label>
            <select
              value={selectedPartNo}
              onChange={(e) => setSelectedPartNo(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
            >
              {parts.map((p, idx) => (
                <option key={`${p.partNo}-${p.pocPoint}-${idx}`} value={p.partNo}>
                  {p.partNo} - {(p.description || '').slice(0, 24)} (Cap: {p.binCapacity})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Part Summary Banner */}
        {activeResult && (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-indigo-500/30 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Part Number</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{activeResult.partNo}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Usage / Vehicle</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeResult.usagePerVehicle} unit(s)</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Bin / Trolley Capacity</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-300">{activeResult.binCapacity} units</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Transport Mode</span>
              <span className="font-bold text-purple-600 dark:text-purple-300">{activeResult.transportMode}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Hourly Demand (@{taktTimeInput}s)</span>
              <span className="font-bold text-amber-600 dark:text-amber-300">{activeResult.hourlyConsumptionUnits} units/hr</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Shift 2 Carryover Stock</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-300">
                {activeResult.initialCarryoverTrolleys} trolleys ({activeResult.initialCarryoverUnits} u)
              </span>
            </div>
          </div>
        )}

        {/* 3-Shift Carryover Matrix Cards */}
        {activeResult && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              2-Shift Closed-Loop Carryover Flow (Shift 1 → Shift 2 → Shift 1)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeResult.shiftSimulation.map((shift, idx) => {
                const isShift1 = idx === 0;
                return (
                  <div
                    key={shift.shiftName}
                    className={`p-4 rounded-xl border space-y-3 relative transition-all ${
                      isShift1
                        ? 'bg-gradient-to-b from-blue-50/50 to-white dark:from-blue-950/40 dark:to-slate-950 border-blue-200 dark:border-blue-500/50 shadow-sm dark:shadow-md'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <Clock className={`w-3.5 h-3.5 ${isShift1 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400'}`} />
                        {shift.shiftName}
                      </span>
                      {shift.tripsSaved > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                          {shift.tripsSaved} Trip Saved
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Opening Carryover Stock:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-300">
                          {shift.openingCarryoverTrolleys} trolleys ({shift.openingCarryoverUnits} u)
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Gross Shift Demand:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {shift.grossShiftDemandUnits} u ({shift.grossTripsRequired} trips)
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <span>Net Replenishment Needed:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-300">
                          {shift.netReplenishmentNeededUnits} u
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Optimized Net Trips:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {shift.netTripsRequired} trips
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-700 dark:text-slate-300 pt-1.5 border-t border-slate-200 dark:border-slate-800 font-bold bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg">
                        <span>Closing Carryover to Next Shift:</span>
                        <span className="text-cyan-600 dark:text-cyan-300">
                          {shift.endingCarryoverTrolleys} trolleys ({shift.endingCarryoverUnits} u)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hourly Carryover Simulation Schedule Table (07:00 AM to 15:00 PM) */}
        {activeResult && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              Hour-by-Hour Carryover Stock Depletion & Delivery Simulation (Shift 1: 07:00 AM - 15:00 PM)
            </h4>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl transition-colors">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Hour Window</th>
                    <th className="px-3 py-2.5 text-center">Opening Stock (Carryover)</th>
                    <th className="px-3 py-2.5 text-center">Consumption (@{taktTimeInput}s Takt)</th>
                    <th className="px-3 py-2.5 text-center">Replenishment Trips</th>
                    <th className="px-3 py-2.5 text-center">Delivered Qty</th>
                    <th className="px-3 py-2.5 text-center">Ending Carryover Stock</th>
                    <th className="px-3 py-2.5 text-center">POC Space Limit</th>
                    <th className="px-3 py-2.5 text-center">Buffer Coverage</th>
                    <th className="px-3 py-2.5 text-center">Risk Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                  {activeResult.hourlySimulation.map((step) => {
                    const isRiskGreen = step.riskLevel === 'Green';
                    const isRiskYellow = step.riskLevel === 'Yellow';

                    return (
                      <tr key={step.hourIndex} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          {step.timeRange}
                        </td>

                        <td className="px-3 py-2 text-center text-indigo-600 dark:text-indigo-300 font-bold">
                          {step.openingStockTrolleys} trolleys ({step.openingStockUnits} u)
                        </td>

                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300 font-bold">
                          {step.hourlyConsumptionUnits} units
                        </td>

                        <td className="px-3 py-2 text-center">
                          {step.replenishmentTripsTriggered > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 font-bold">
                              + {step.replenishmentTripsTriggered} Trip(s)
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px]">0 Trips (Carried Over)</span>
                          )}
                        </td>

                        <td className="px-3 py-2 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                          {step.replenishmentDeliveredUnits > 0 ? `+${step.replenishmentDeliveredUnits} u` : '0 u'}
                        </td>

                        <td className="px-3 py-2 text-center text-cyan-600 dark:text-cyan-300 font-bold">
                          {step.endingStockTrolleys} trolleys ({step.endingStockUnits} u)
                        </td>

                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 border ${
                            step.pocSpaceViolation 
                              ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' 
                              : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}>
                            Max {step.pocSpaceTrolleysMax}T {step.pocSpaceViolation ? '(Violation ⚠️)' : '(OK ✓)'}
                          </span>
                        </td>

                        <td className="px-3 py-2 text-center font-bold">
                          <span className={isRiskGreen ? 'text-emerald-600 dark:text-emerald-400' : isRiskYellow ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                            {step.coverageHours} Hours
                          </span>
                        </td>

                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                              isRiskGreen
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                                : isRiskYellow
                                ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40'
                                : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {step.riskLevel} Buffer
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Plant-Wide Carryover Stock Optimization Master Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Plant-Wide Carryover Optimization Master Ledger (Takt: {taktTimeInput}s)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive list of all parts showing Shift 2 carryover stock, gross vs net trips, and daily trip savings
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Part No</th>
                <th className="px-3 py-2.5">Part Description</th>
                <th className="px-3 py-2.5 text-center">Bin Cap</th>
                <th className="px-3 py-2.5 text-center">Hourly Consumption (@{taktTimeInput}s)</th>
                <th className="px-3 py-2.5 text-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border-x border-indigo-100 dark:border-indigo-500/30">Shift 2 Carryover</th>
                <th className="px-3 py-2.5 text-center">Gross Trips</th>
                <th className="px-3 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">Optimized Net Trips</th>
                <th className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-300">Shift 1 Saved</th>
                <th className="px-3 py-2.5 text-center font-bold text-cyan-600 dark:text-cyan-300">16-Hr Daily Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {carryoverResults.map((res, idx) => {
                const isSelected = res.partNo === selectedPartNo;
                return (
                  <tr
                    key={`${res.partNo}-${idx}`}
                    onClick={() => setSelectedPartNo(res.partNo)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/50 border-l-2 border-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{res.partNo}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-sans truncate max-w-[180px]">
                      {res.partDescription}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{res.binCapacity} u</td>
                    <td className="px-3 py-2 text-center text-amber-600 dark:text-amber-300 font-bold">
                      {res.hourlyConsumptionUnits} u/hr
                    </td>

                    <td className="px-3 py-2 text-center font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50/20 dark:bg-indigo-950/20 border-x border-indigo-100 dark:border-indigo-500/30">
                      {res.initialCarryoverTrolleys} trolleys ({res.initialCarryoverUnits} u)
                    </td>

                    <td className="px-3 py-2 text-center text-slate-400 line-through">
                      {res.shiftSimulation[0].grossTripsRequired} trips
                    </td>

                    <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20">
                      {res.shiftSimulation[0].netTripsRequired} trips
                    </td>

                    <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-300">
                      {res.shiftSimulation[0].tripsSaved > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200">
                          - {res.shiftSimulation[0].tripsSaved} trip(s)
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">0</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-center font-bold text-cyan-600 dark:text-cyan-300">
                      {res.totalDailyTripsSaved > 0 ? (
                        <span className="px-2.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-200">
                          - {res.totalDailyTripsSaved} trips/day
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
