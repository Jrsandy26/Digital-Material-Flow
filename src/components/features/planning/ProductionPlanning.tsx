import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Gauge, Play, Pause, AlertCircle, Cpu, ShieldCheck, Download, Truck, RotateCcw, Settings2, FileSpreadsheet, FileText, Boxes, Search, Layers, ArrowUpRight, Edit2 } from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { exportMaterialFlowExcel, exportProductionPlanningData } from '../../../utils/excelParser';
import { TransportMode } from '../../../types/manufacturing';
import { DEFAULT_TRANSPORT_MODE_CONFIGS, calculatePartMetrics, getMilkRunGroups, getPocSpaceTrolleysMax } from '../../../utils/calculations';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const ProductionPlanning: React.FC = () => {
  const {
    vehicleModels,
    productionPlan,
    updateProductionPlan,
    isSimulating,
    toggleSimulation,
    parts,
    modeConfigs,
    updateModeConfig,
    operatorName,
    setOperatorName,
    updatePart,
    inventoryStates,
  } = useMaterialFlow();

  const [activeTransportMode, setActiveTransportMode] = useState<TransportMode>('Jumbo Trolley');
  const [partFilter, setPartFilter] = useState('');
  const [editingBins, setEditingBins] = useState<{ partNo: string, value: string } | null>(null);

  const selectedModel = vehicleModels.find((m) => m.id === productionPlan.selectedModelId) || vehicleModels[0];

  const handleModelChange = (modelId: string) => {
    const model = vehicleModels.find((m) => m.id === modelId);
    if (!model) return;

    updateProductionPlan({
      selectedModelId: model.id,
      taktTimeSeconds: model.taktTimeSeconds,
      shiftPlanVehicles: Math.round((8 * 3600) / model.taktTimeSeconds),
      hourlyPlanVehicles: Math.round((3600 / model.taktTimeSeconds)),
    });
  };

  const handleUpdateBins = (partNo: string, value: string) => {
    if (value.trim() === '') {
      updatePart(partNo, { manualHourlyBinsOverride: undefined });
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) {
        updatePart(partNo, { manualHourlyBinsOverride: num });
      }
    }
    setEditingBins(null);
  };

  const handleShiftPlanChange = (valStr: string) => {
    if (valStr === '') {
      updateProductionPlan({ shiftPlanVehicles: 0, hourlyPlanVehicles: 0, taktTimeSeconds: 0 });
      return;
    }
    const val = Number(valStr);
    if (val < 0) return;
    const hourly = Math.round(val / 8);
    const takt = hourly > 0 ? Number((3600 / hourly).toFixed(1)) : 0;
    updateProductionPlan({
      shiftPlanVehicles: val,
      hourlyPlanVehicles: hourly,
      taktTimeSeconds: takt,
    });
  };

  const handleHourlyPlanChange = (valStr: string) => {
    if (valStr === '') {
      updateProductionPlan({ hourlyPlanVehicles: 0, shiftPlanVehicles: 0, taktTimeSeconds: 0 });
      return;
    }
    const val = Number(valStr);
    if (val < 0) return;
    const takt = val > 0 ? Number((3600 / val).toFixed(1)) : 0;
    updateProductionPlan({
      hourlyPlanVehicles: val,
      shiftPlanVehicles: val * 8,
      taktTimeSeconds: takt,
    });
  };

  const handleTaktTimeChange = (valStr: string) => {
    if (valStr === '') {
      updateProductionPlan({ taktTimeSeconds: 0, hourlyPlanVehicles: 0, shiftPlanVehicles: 0 });
      return;
    }
    const val = Number(valStr);
    if (val < 0) return;
    const hourly = val > 0 ? Math.round(3600 / val) : 0;
    updateProductionPlan({
      taktTimeSeconds: val,
      hourlyPlanVehicles: hourly,
      shiftPlanVehicles: hourly * 8,
    });
  };

  // Live metric calculations based on active uploaded parts and active plan target
  const livePartsMetrics = useMemo(() => {
    return parts.map((part) =>
      calculatePartMetrics(
        part,
        productionPlan.hourlyPlanVehicles,
        productionPlan.shiftPlanVehicles,
        modeConfigs
      )
    );
  }, [parts, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs]);

  const totalHourlyTrolleysRequired = useMemo(() => {
    return livePartsMetrics.reduce((acc, m) => acc + m.roundedTrolleysPerHour, 0);
  }, [livePartsMetrics]);

  const totalShiftTrolleysRequired = useMemo(() => {
    return livePartsMetrics.reduce((acc, m) => acc + m.shiftTrolleysReq, 0);
  }, [livePartsMetrics]);

  const totalShiftPartUnitsConsumed = useMemo(() => {
    return livePartsMetrics.reduce((acc, m) => acc + m.shiftConsumption, 0);
  }, [livePartsMetrics]);

  // Group by transport mode using milk-run grouping (up to 3 trolleys per trip for Jumbo/BOV)
  const modeRequirementSummary = useMemo<Record<string, { trolleysPerHour: number; shiftTrips: number; partsCount: number; hourlyTrips: number; hourlyTravelKm: number; hourlyCycleTimeMin: number; }>>(() => {
    const summary: Record<string, { trolleysPerHour: number; shiftTrips: number; partsCount: number; hourlyTrips: number; hourlyTravelKm: number; hourlyCycleTimeMin: number; }> = {};
    
    parts.forEach((p) => {
      const mode = p.transportMode || 'Jumbo Trolley';
      if (!summary[mode]) {
        summary[mode] = { trolleysPerHour: 0, shiftTrips: 0, partsCount: 0, hourlyTrips: 0, hourlyTravelKm: 0, hourlyCycleTimeMin: 0 };
      }
      summary[mode].partsCount += 1;
    });

    livePartsMetrics.forEach((m, idx) => {
      const p = parts[idx];
      if (!p) return;
      const mode = p.transportMode || 'Jumbo Trolley';
      summary[mode].trolleysPerHour += m.roundedTrolleysPerHour;
      
      // For non-milkrun transport modes (Hand Pallet Truck, Manual Handling, etc.)
      if (mode !== 'Jumbo Trolley' && mode !== 'BOV (Battery Vehicle)') {
        summary[mode].shiftTrips += m.tripsRequiredPerShift;
        summary[mode].hourlyTrips += m.tripsRequiredPerHour;
        const distMeters = (p.loadedDistanceMeters || 0) + (p.returnDistanceMeters || 0);
        summary[mode].hourlyTravelKm += (m.tripsRequiredPerHour * distMeters) / 1000;
        summary[mode].hourlyCycleTimeMin += m.tripsRequiredPerHour * m.cycleTimeMin;
      }
    });

    const milkRunGroups = getMilkRunGroups(parts, productionPlan, modeConfigs, inventoryStates);
    milkRunGroups.forEach((group) => {
      const mode = group.transportMode || 'Jumbo Trolley';
      if (!summary[mode]) {
        summary[mode] = { trolleysPerHour: 0, shiftTrips: 0, partsCount: 0, hourlyTrips: 0, hourlyTravelKm: 0, hourlyCycleTimeMin: 0 };
      }
      const tripsShift = group.tripsShift ?? 1;
      const tripsHr = group.tripsHr ?? (1 / 8);
      
      summary[mode].shiftTrips += tripsShift;
      summary[mode].hourlyTrips += tripsHr;

      const firstPart = group.parts[0]?.part;
      const distMeters = firstPart ? ((firstPart.loadedDistanceMeters || 0) + (firstPart.returnDistanceMeters || 0)) : 120;
      summary[mode].hourlyTravelKm += (tripsHr * distMeters) / 1000;
      summary[mode].hourlyCycleTimeMin += tripsHr * group.cycleTimeMin;
    });

    return summary;
  }, [livePartsMetrics, parts, productionPlan, modeConfigs, inventoryStates]);

  const totalShiftTripsRequired = useMemo(() => {
    return Object.values(modeRequirementSummary).reduce((acc, data) => acc + data.shiftTrips, 0);
  }, [modeRequirementSummary]);

  // Filter parts for live requirements table
  const filteredParts = useMemo(() => {
    if (!partFilter) return parts;
    const q = partFilter.toLowerCase();
    return parts.filter(
      (p) =>
        p.partNo.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.modelNo.toLowerCase().includes(q) ||
        p.storeLocation.toLowerCase().includes(q) ||
        p.pocPoint.toLowerCase().includes(q)
    );
  }, [parts, partFilter]);

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="production-planning-view" className="space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm dark:shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Assembly Production Schedule & Line Pace Planning</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure shift targets, vehicle model specifications, and single operator delivery takt parameters
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-auto">
          <button
            onClick={() => exportProductionPlanningData(parts, productionPlan, modeConfigs, 'xlsx')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow border border-emerald-400/30 cursor-pointer whitespace-nowrap"
            title="Download Production Plan as Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Download Excel</span>
          </button>

          <button
            onClick={() => exportProductionPlanningData(parts, productionPlan, modeConfigs, 'csv')}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow border border-blue-400/30 cursor-pointer whitespace-nowrap"
            title="Download Production Plan as CSV (.csv)"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={toggleSimulation}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              isSimulating
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4 shrink-0" /> : <Play className="w-4 h-4 shrink-0" />}
            <span>Line Status: {isSimulating ? 'RUNNING (LIVE)' : 'PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* Live Data Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm dark:shadow">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">Uploaded Part Master</p>
          <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">{parts.length} Active Parts</p>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Reflects current uploaded Excel file</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm dark:shadow">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">Hourly Trolley Demand</p>
          <p className="text-2xl font-bold font-mono text-cyan-700 dark:text-cyan-400 mt-0.5">{totalHourlyTrolleysRequired} Bins / Hr</p>
          <p className="text-[10px] text-cyan-600 dark:text-cyan-500/80 font-mono mt-1">For target {productionPlan.hourlyPlanVehicles} vehicles/hr</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm dark:shadow">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">Shift Delivery Trips</p>
          <p className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-0.5">{totalShiftTripsRequired} Trips / Shift</p>
          <p className="text-[10px] text-purple-600 dark:text-purple-400/80 font-mono mt-1">Net trips with initial POC carryover</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm dark:shadow">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">Shift Component Demand</p>
          <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-0.5">{totalShiftPartUnitsConsumed.toLocaleString()} Units</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-500/80 font-mono mt-1">For target {productionPlan.shiftPlanVehicles} vehicles/shift</p>
        </div>
      </div>

      {/* Mode-wise Requirement Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 font-mono mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Operator Hourly Workload & Transport Mode Analysis (From Uploaded Data)
        </h3>
        <div className="flex flex-col gap-4 text-xs font-mono">
          {(Object.entries(modeRequirementSummary) as [string, { trolleysPerHour: number; shiftTrips: number; partsCount: number; hourlyTrips: number; hourlyTravelKm: number; hourlyCycleTimeMin: number }][]).map(([mode, data]) => (
            <div key={mode} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-800 dark:text-slate-200 text-sm font-bold truncate">{mode}</span>
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">
                  {data.partsCount} Parts
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Hourly Trips</div>
                  <div className="text-lg font-black text-indigo-700 dark:text-indigo-400">{data.hourlyTrips}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Req / Hour</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Travel Distance</div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-400">{data.hourlyTravelKm.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">KM / Hour</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Hourly Trolleys</div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{data.trolleysPerHour}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Bins / Hour</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Operator Util</div>
                  <div className={`text-lg font-black ${((data.hourlyCycleTimeMin / 60) * 100) > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-700 dark:text-cyan-400'}`}>
                    {((data.hourlyCycleTimeMin / 60) * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {data.hourlyCycleTimeMin.toFixed(1)}m / 60m
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Single Operator Usage Delivery Data Indicator Banner */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-200 dark:bg-indigo-600/30 border border-indigo-300 dark:border-indigo-400/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-indigo-950 dark:text-white block">Single Operator Delivery Model Active</span>
            <span className="text-[10px] text-indigo-800 dark:text-indigo-300/80">
              Daily schedule & master calculations reflect 1 single operator per delivery trip cycle.
            </span>
          </div>
        </div>

        {/* Operator Name Form Field */}
        <div className="flex items-center space-x-2 bg-indigo-900/60 px-2 py-1 rounded-lg border border-indigo-500/40 text-[11px] shrink-0 w-full sm:w-auto">
          <span className="text-indigo-200 font-mono font-bold uppercase text-[9px]">Operator:</span>
          <input
            id="input-operator-name-planning"
            type="text"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder="Operator Name"
            className="bg-indigo-950 border border-indigo-400/50 text-white font-mono font-bold rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-emerald-400 w-28"
            title="Active Operator Name"
          />
        </div>
      </div>

      {/* Main Form & Takt Gauge Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Controls Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
            Shift Parameters & Target Plan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            
            {/* Date */}
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium text-[11px]">Schedule Date</label>
              <input
                type="date"
                value={productionPlan.date}
                onChange={(e) => updateProductionPlan({ date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Vehicle Model Selection */}
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium text-[11px]">Two-Wheeler Vehicle Model</label>
              <select
                value={productionPlan.selectedModelId}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-emerald-700 dark:text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
              >
                {vehicleModels.map((m, idx) => (
                  <option key={`${m.id}-${idx}`} value={m.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                    {m.name} ({m.code}) - Takt {m.taktTimeSeconds}s
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Target Plan */}
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium text-[11px]">Shift Target (8 Hours)</label>
              <input
                type="number"
                value={productionPlan.shiftPlanVehicles || ''}
                onChange={(e) => handleShiftPlanChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-800 dark:text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Hourly Plan */}
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium text-[11px]">Calculated Hourly Plan (Vehicles / Hr)</label>
              <input
                type="number"
                value={productionPlan.hourlyPlanVehicles || ''}
                onChange={(e) => handleHourlyPlanChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-cyan-700 dark:text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Target Takt Time */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium text-[11px]">Target Takt Time (Seconds / Unit)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={productionPlan.taktTimeSeconds || ''}
                  onChange={(e) => handleTaktTimeChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-emerald-700 dark:text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 pr-9"
                />
                <Gauge className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute right-3 top-2 pointer-events-none" />
              </div>
            </div>

          </div>
        </div>

        {/* Takt Time & Line Pace Visualizer Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Takt Time Benchmark
            </h3>

            <div className="mt-3 text-center">
              <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight font-mono">
                {productionPlan.taktTimeSeconds}s
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Required Cycle Time per Assembly Station</div>
            </div>

            <div className="mt-4 space-y-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Shift Target:</span>
                <span className="text-slate-800 dark:text-white font-bold">{productionPlan.shiftPlanVehicles} units</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Completed So Far:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{productionPlan.unitsCompleted} units</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Completion Status:</span>
                <span className="text-cyan-700 dark:text-cyan-300 font-bold">
                  {((productionPlan.unitsCompleted / Math.max(1, productionPlan.shiftPlanVehicles)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="leading-tight">Zero Line Stoppage target active. Material flow calculations synchronized to takt time.</span>
          </div>
        </div>
      </div>

      {/* Live Uploaded Parts Line Requirement Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Live Parts Delivery Requirements ({parts.length} Active Parts from Uploaded File)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reflects exact bin capacities, usage per vehicle, and hourly trolley/bin delivery demand
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={partFilter}
              onChange={(e) => setPartFilter(e.target.value)}
              placeholder="Search uploaded parts..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Part No</th>
                <th className="px-3 py-2.5">Model</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 text-center text-amber-700 dark:text-amber-400 font-bold">No of Usages (Qty/Veh)</th>
                <th className="px-3 py-2.5 text-center">Bin Qty</th>
                <th className="px-3 py-2.5 text-center text-teal-700 dark:text-teal-400">Coverage (Mins)</th>
                <th className="px-3 py-2.5">Store / POC</th>
                <th className="px-3 py-2.5">Transport Mode</th>
                <th className="px-3 py-2.5 text-center text-amber-700 dark:text-amber-400">Hourly Demand</th>
                <th className="px-3 py-2.5 text-center text-cyan-700 dark:text-cyan-400">Hourly Bins Req</th>
                <th className="px-3 py-2.5 text-center text-indigo-700 dark:text-indigo-300">Shift Bins Req</th>
                <th className="px-3 py-2.5 text-center text-purple-700 dark:text-purple-400">Shift Delivery Trips</th>
                <th className="px-3 py-2.5 text-center text-emerald-700 dark:text-emerald-400 font-bold">Operator Util %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                    No parts match the search filter.
                  </td>
                </tr>
              ) : (
                filteredParts.map((part, idx) => {
                  const m = calculatePartMetrics(
                    part,
                    productionPlan.hourlyPlanVehicles,
                    productionPlan.shiftPlanVehicles,
                    modeConfigs
                  );
                  return (
                    <tr key={`${part.partNo}-${part.pocPoint}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-white">{part.partNo}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{part.modelNo || 'TVS iQube'}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate">{part.description}</td>
                      <td className="px-3 py-2 text-center text-amber-700 dark:text-amber-300 font-bold">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${(part.usagePerVehicle || 1) > 1 ? 'bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                          {part.usagePerVehicle || 1} / veh
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-700 dark:text-slate-300 font-bold">{part.binCapacity}</td>
                      <td className="px-3 py-2 text-center text-teal-700 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950/10">
                        {m.trolleyCoverageTimeMin}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        <span className="text-slate-700 dark:text-slate-300">{part.storeLocation}</span> → <span className="text-emerald-700 dark:text-emerald-400 font-bold">{part.pocPoint}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] block">
                          {part.transportMode}
                        </span>
                        <span className="text-[10px] text-slate-500">{m.carryingCapacity} Bins / Trip</span>
                      </td>
                      <td className="px-3 py-2 text-center text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/10">
                        <div>{m.hourlyConsumption} units/hr</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal font-sans">
                          ({productionPlan.hourlyPlanVehicles} vph × {part.usagePerVehicle || 1})
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 group relative">
                        {editingBins?.partNo === part.partNo ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              className="w-16 px-1 py-0.5 text-center bg-white dark:bg-slate-900 border border-cyan-400 dark:border-cyan-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              value={editingBins.value}
                              onChange={(e) => setEditingBins({ partNo: part.partNo, value: e.target.value })}
                              onBlur={() => handleUpdateBins(part.partNo, editingBins.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateBins(part.partNo, editingBins.value);
                                if (e.key === 'Escape') setEditingBins(null);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => setEditingBins({ partNo: part.partNo, value: m.roundedTrolleysPerHour.toString() })}>
                            <div className="flex items-center gap-1">
                              {part.manualHourlyBinsOverride !== undefined && (
                                <span className="w-2 h-2 rounded-full bg-amber-500" title="Manually overridden"></span>
                              )}
                              <span>{m.roundedTrolleysPerHour} Bins/hr</span>
                              <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-500 transition-opacity" />
                            </div>
                            <div className="text-[10px] text-cyan-600 dark:text-cyan-50 font-normal">({m.trolleyDemandPerHour.toFixed(1)} exact)</div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/20">
                        {m.shiftTrolleysReq} Bins
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/20">
                        <div>{m.tripsRequiredPerShift} Trips</div>
                        {(part.transportMode === 'Jumbo Trolley' || part.transportMode === 'BOV (Battery Vehicle)') && (
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold inline-block mt-1">Co-loaded</span>
                        )}
                        <div className="text-[10px] text-purple-600 dark:text-purple-400/80 font-normal mt-0.5">({m.grossTripsRequiredPerShift} Gross)</div>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-700 dark:text-emerald-400">
                        {m.singleOperatorUtilizationPercent}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Shift Operational Schedule & POC Stock Carryover Optimization Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 dark:from-blue-950/60 dark:via-slate-900 dark:to-indigo-950/60 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-blue-200 dark:border-blue-800/40 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                2-Shift Operational Production Cycle (07:00 AM Start)
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Optimized
                </span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Shift 1 starts at 07:00 AM following Shift 2 completion. Initial stock at POC (1–2 trolleys) is factored in to optimize net trips for remaining shifts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Active Shift:</span>
            <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs font-mono">
              {productionPlan.shift}
            </span>
          </div>
        </div>

        {/* 2 Shift Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className={`p-3 rounded-xl border text-xs space-y-1 ${
            productionPlan.shift.includes('Shift 1')
              ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-400 text-blue-900 dark:text-white'
              : 'bg-slate-100/50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
          <div className="flex justify-between items-center font-bold">
              <span className="text-blue-700 dark:text-blue-300 font-bold">Shift 1 (Day Shift)</span>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded text-blue-800 dark:text-blue-200 font-mono">07:00 - 15:30</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Starts at 07:00 AM. Lunch: 11:45 AM – 12:15 PM (30 min).
            </p>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono pt-1">
              • Initial POC Carryover Active (from previous Shift 2 ending)
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs space-y-1 ${
            productionPlan.shift.includes('Shift 2')
              ? 'bg-purple-50 dark:bg-purple-900/40 border-purple-300 dark:border-purple-400 text-purple-900 dark:text-white'
              : 'bg-slate-100/50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            <div className="flex justify-between items-center font-bold">
              <span className="text-purple-700 dark:text-purple-300 font-bold">Shift 2 (Night Shift)</span>
              <span className="text-[10px] bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded text-purple-800 dark:text-purple-200 font-mono">15:30 - 24:00</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Starts at 03:30 PM. Lunch: 07:15 PM – 07:45 PM (30 min).
            </p>
            <div className="text-[10px] text-purple-700 dark:text-purple-300 font-mono pt-1">
              • Stock Carryover to 07:00 AM (leaves 1–2 buffer trolleys at POC)
            </div>
          </div>
        </div>
      </div>

      {/* Transport Mode Capacity & Speed Parameters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Mode of Transfer Standards & Equipment Capacities
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure transport speeds, bin carrying capacities, picking, and empty handling time (40s standard)
            </p>
          </div>
          <button
            onClick={() => {
              Object.keys(DEFAULT_TRANSPORT_MODE_CONFIGS).forEach((m) => {
                const modeKey = m as TransportMode;
                updateModeConfig(modeKey, DEFAULT_TRANSPORT_MODE_CONFIGS[modeKey]);
              });
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Standards</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          {(Object.keys(modeConfigs) as TransportMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveTransportMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                activeTransportMode === mode
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/50 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="max-w-md">
          {(() => {
            const mode = activeTransportMode;
            const config = modeConfigs[mode];
            const isJumboOrBOV = mode.includes('Jumbo') || mode.includes('BOV');

            return (
              <div
                key={mode}
                className={`p-4 rounded-xl border text-xs space-y-3 ${
                  isJumboOrBOV
                    ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/30 text-slate-800 dark:text-white'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white'
                }`}
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800/80">
                  <span className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-1.5">
                    <Truck className={`w-3.5 h-3.5 ${isJumboOrBOV ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                    {mode}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isJumboOrBOV ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}>
                    {config.carryingCapacityTrolleys} {config.carryingCapacityTrolleys === 1 ? 'bin/trolley' : 'bins/trip'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Carrying Capacity (Bins/Trip)</label>
                    <input
                      type="number"
                      min="1"
                      value={config.carryingCapacityTrolleys}
                      onChange={(e) => updateModeConfig(mode, { carryingCapacityTrolleys: Number(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Load Speed (sec/m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={config.loadSpeedSecPerMtr}
                        onChange={(e) => updateModeConfig(mode, { loadSpeedSecPerMtr: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-emerald-700 dark:text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Empty Speed (sec/m)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={config.emptySpeedSecPerMtr}
                        onChange={(e) => updateModeConfig(mode, { emptySpeedSecPerMtr: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-cyan-700 dark:text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60 text-[10px]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Pick (sec):</span>
                      <input
                        type="number"
                        value={config.pickTimeSec}
                        onChange={(e) => updateModeConfig(mode, { pickTimeSec: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Unload (sec):</span>
                      <input
                        type="number"
                        value={config.storingTimeSec}
                        onChange={(e) => updateModeConfig(mode, { storingTimeSec: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Empty Pick:</span>
                      <input
                        type="number"
                        value={config.emptyHandlingTimeSec}
                        onChange={(e) => updateModeConfig(mode, { emptyHandlingTimeSec: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    
                    <div className="col-span-3">
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5">Empty Drop at Stores (sec):</span>
                      <input
                        type="number"
                        value={config.emptyDropTimeSec}
                        onChange={(e) => updateModeConfig(mode, { emptyDropTimeSec: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-white font-mono focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Hourly Plan Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Hourly Production Plan Breakdown (8 Hour Shift)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Dynamically syncs target vehicle volumes and total required trolley replenishment</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportProductionPlanningData(parts, productionPlan, modeConfigs, 'xlsx')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-bold flex items-center space-x-1 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Download Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => exportProductionPlanningData(parts, productionPlan, modeConfigs, 'csv')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 font-mono text-[11px] font-bold flex items-center space-x-1 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Download CSV"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Hour</th>
                <th className="px-4 py-2.5">Time Slot</th>
                <th className="px-4 py-2.5">Target Vehicles</th>
                <th className="px-4 py-2.5">Hourly Trolleys Needed</th>
                <th className="px-4 py-2.5">Cumulative Vehicles</th>
                <th className="px-4 py-2.5">Line Feeding Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
              {(productionPlan.hourlyBreakdown || []).map((hSlot, idx, arr) => {
                const hourlyTarget = hSlot.targetVehicles;
                const cumVehicles = arr.slice(0, idx + 1).reduce((sum, slot) => sum + slot.targetVehicles, 0);
                
                const match = hSlot.hourSlot.match(/\(H(\d+)\)/);
                const hourNum = match ? parseInt(match[1], 10) : null;
                const isCurrent = hourNum !== null ? hourNum === productionPlan.currentHour : (hSlot.hourSlot.includes('LUNCH') && productionPlan.currentHour === 6);
                
                // Calculate dynamic hourly trips for this target vehicles
                const milkRunEligible = parts.filter(p => p.transportMode === 'Jumbo Trolley' || p.transportMode === 'BOV (Battery Vehicle)');
                const standardParts = parts.filter(p => p.transportMode !== 'Jumbo Trolley' && p.transportMode !== 'BOV (Battery Vehicle)');
                
                let hourlyTrips = 0;
                if (milkRunEligible.length > 0) {
                  const groups = getMilkRunGroups(milkRunEligible, { ...productionPlan, hourlyPlanVehicles: hSlot.targetVehicles }, modeConfigs);
                  hourlyTrips += groups.length / 8;
                }
                
                if (standardParts.length > 0) {
                  hourlyTrips += standardParts.reduce((acc, part) => {
                    const m = calculatePartMetrics(part, hSlot.targetVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
                    return acc + m.tripsRequiredPerHour;
                  }, 0);
                }
                
                const hourlyTrolleys = parts.reduce((acc, part) => {
                  const m = calculatePartMetrics(part, hSlot.targetVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
                  return acc + m.roundedTrolleysPerHour;
                }, 0);

                const tripsDisplay = hourlyTrips > 0 ? `${hourlyTrips.toFixed(1)} Trips` : '0 Trips';
                const trolleysDisplay = `${hourlyTrolleys} Bins`;

                let status = 'Scheduled';
                if (hourNum !== null) {
                  if (hourNum < productionPlan.currentHour) status = 'Completed';
                  else if (hourNum === productionPlan.currentHour) status = 'Active Line Feeding';
                } else {
                  if (productionPlan.currentHour > 5) status = 'Completed';
                  else if (productionPlan.currentHour === 5) status = 'Active Break';
                }

                return (
                  <tr key={idx} className={isCurrent ? 'bg-emerald-50 dark:bg-emerald-950/20 text-slate-900 dark:text-white font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}>
                    <td className="px-4 py-2">{hourNum !== null ? `Hour ${hourNum}` : 'Break'}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {hSlot.hourSlot}
                    </td>
                    <td className="px-4 py-2 text-emerald-700 dark:text-emerald-400 font-bold">{hourlyTarget} units</td>
                    <td className="px-4 py-2 text-cyan-700 dark:text-cyan-400 font-bold">{tripsDisplay} ({trolleysDisplay})</td>
                    <td className="px-4 py-2 text-slate-800 dark:text-white">{cumVehicles} units</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        status === 'Completed'
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                          : status === 'Active Line Feeding' || status === 'Active Break'
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {status}
                      </span>
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
