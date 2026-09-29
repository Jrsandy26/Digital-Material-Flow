import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Truck,
  CheckCircle2,
  Users,
  MapPin,
  ShieldAlert,
  TrendingUp,
  Percent,
  Clock,
  AlertTriangle,
  Zap,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Play,
  Pause,
  RotateCcw,
  ClipboardList,
  Cpu,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  Legend,
} from 'recharts';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { FactoryMap } from '../../common/FactoryMap';
import { AssemblyLineToggle } from '../../common/AssemblyLineToggle';
import { exportExecutiveDashboardData } from '../../../utils/excelParser';
import { generateStationSummaryPdfReport } from '../../../utils/pdfGenerator';
import {
  calculatePartMetrics,
  getMilkRunGroups,
  filterPartsByLine,
  filterInventoryByLine,
  filterTripsByLine,
  filterAlertsByLine,
  filterRoutesByLine,
  getPartLineCode,
} from '../../../utils/calculations';
import { SWCTTripSimulationDemonstrator, SWCTSimulationSyncState } from './SWCTTripSimulationDemonstrator';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const ExecutiveDashboard: React.FC = () => {
  const {
    selectedAssemblyLine,
    parts,
    trips,
    operators,
    routes,
    inventoryStates,
    alerts,
    productionPlan,
    modeConfigs,
    acknowledgeAlert,
    dispatchEmergencyTrip,
    isSimulating,
    toggleSimulation,
    simulationSpeed,
    setSimulationSpeed,
    triggerManualReplenishment,
    setOperators,
    dashboardMode,
    setDashboardMode,
  } = useMaterialFlow();

  const [swctSyncState, setSwctSyncState] = useState<SWCTSimulationSyncState | null>(null);

  const filteredParts = useMemo(() => {
    return filterPartsByLine(parts, selectedAssemblyLine);
  }, [parts, selectedAssemblyLine]);

  const filteredInventoryStates = useMemo(() => {
    return filterInventoryByLine(inventoryStates, parts, selectedAssemblyLine);
  }, [inventoryStates, parts, selectedAssemblyLine]);

  const filteredTrips = useMemo(() => {
    return filterTripsByLine(trips, parts, selectedAssemblyLine);
  }, [trips, parts, selectedAssemblyLine]);

  const filteredAlerts = useMemo(() => {
    return filterAlertsByLine(alerts, parts, selectedAssemblyLine);
  }, [alerts, parts, selectedAssemblyLine]);

  const filteredRoutes = useMemo(() => {
    return filterRoutesByLine(routes, parts, selectedAssemblyLine);
  }, [routes, parts, selectedAssemblyLine]);

  // Dynamic Live Metrics based on uploaded Part Master & Production Plan
  const livePartsMetrics = useMemo(() => {
    return filteredParts.map((part) =>
      calculatePartMetrics(
        part,
        productionPlan.hourlyPlanVehicles,
        productionPlan.shiftPlanVehicles,
        modeConfigs
      )
    );
  }, [filteredParts, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs]);

  const totalActiveParts = filteredParts.length;

  const totalHourlyBinsRequired = useMemo(() => {
    return livePartsMetrics.reduce((acc, m) => acc + m.roundedTrolleysPerHour, 0);
  }, [livePartsMetrics]);

  const totalShiftTripsRequired = useMemo(() => {
    const milkRunEligible = filteredParts.filter(p => p.transportMode === 'Jumbo Trolley' || p.transportMode === 'BOV (Battery Vehicle)');
    const standardParts = filteredParts.filter(p => p.transportMode !== 'Jumbo Trolley' && p.transportMode !== 'BOV (Battery Vehicle)');
    
    let shiftTrips = 0;
    if (milkRunEligible.length > 0) {
      const groups = getMilkRunGroups(milkRunEligible, productionPlan, modeConfigs, filteredInventoryStates);
      shiftTrips += groups.reduce((acc, g) => acc + (g.tripsShift ?? 1), 0);
    }
    
    if (standardParts.length > 0) {
      shiftTrips += standardParts.reduce((acc, part) => {
        const m = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
        return acc + m.tripsRequiredPerShift;
      }, 0);
    }
    
    return shiftTrips;
  }, [filteredParts, productionPlan, modeConfigs, filteredInventoryStates]);

  const totalShiftUnitsConsumed = useMemo(() => {
    return filteredParts.reduce((acc, p) => acc + (p.usagePerVehicle || 1) * productionPlan.shiftPlanVehicles, 0);
  }, [filteredParts, productionPlan.shiftPlanVehicles]);

  const tripsCompletedCount = filteredTrips.filter((t) => t.status === 'Completed' || t.status === 'Delivered').length;
  const tripsInProgressCount = filteredTrips.filter((t) => t.status === 'In Progress' || t.status === 'Started').length;
  const tripsDelayedCount = filteredTrips.filter((t) => t.status === 'Delayed').length;

  const activeOperators = operators.filter((o) => o.status !== 'Offline').length;

  const healthyPartsCount = filteredInventoryStates.filter((s) => s.riskLevel === 'Green').length;
  const inventoryCoveragePercent = Number(((healthyPartsCount / Math.max(1, totalActiveParts)) * 100).toFixed(1));

  const lineStopRiskCount = filteredInventoryStates.filter((s) => s.riskLevel === 'Red').length;
  const warningRiskCount = filteredInventoryStates.filter((s) => s.riskLevel === 'Yellow').length;

  const avgOperatorUtilization = Number(
    (operators.reduce((acc, o) => acc + o.utilizationPercent, 0) / Math.max(1, operators.length)).toFixed(1)
  );

  const avgCoverageHours = filteredInventoryStates.length > 0
    ? Number((filteredInventoryStates.reduce((acc, s) => acc + s.coverageHours, 0) / filteredInventoryStates.length).toFixed(1))
    : 0;

  // Takt Time & Variance Calculations
  const targetTaktTimeSec = productionPlan.taktTimeSeconds || 27.9;
  const currentHourlyTarget = productionPlan.hourlyPlanVehicles || 131;
  const actualTaktTimeSec = Number((3600 / Math.max(1, currentHourlyTarget)).toFixed(2));
  const taktVarianceSec = Number((actualTaktTimeSec - targetTaktTimeSec).toFixed(2));

  // 8-Hour Performance Variance Trend Data for Sparklines
  const hourlyTrendData = useMemo(() => {
    const targetVehicles = productionPlan.hourlyPlanVehicles || 131;
    const targetTakt = productionPlan.taktTimeSeconds || 27.9;
    const currentHr = productionPlan.currentHour || 1;

    return [1, 2, 3, 4, 5, 6, 7, 8].map((hr) => {
      const isPastOrCurrent = hr <= currentHr;
      // Operational variation for past hours
      const vehicleDelta = isPastOrCurrent ? (hr === 2 ? -4 : hr === 4 ? +2 : hr === 6 ? -3 : 0) : 0;
      const actualVehicles = Math.max(60, targetVehicles + vehicleDelta);
      const actualTakt = Number((3600 / actualVehicles).toFixed(2));
      const taktVariance = Number((actualTakt - targetTakt).toFixed(2));

      const binsRequired = Math.round((totalHourlyBinsRequired * actualVehicles) / Math.max(1, targetVehicles));
      const tripsRequired = Math.max(1, Math.round(totalShiftTripsRequired / 8));
      const tripsDone = isPastOrCurrent ? Math.min(tripsRequired, Math.round((actualVehicles / targetVehicles) * tripsRequired)) : 0;

      const coverage = Number(Math.max(0.8, avgCoverageHours + (isPastOrCurrent ? (hr === 3 ? -0.4 : hr === 6 ? 0.3 : 0) : 0)).toFixed(1));
      const riskCount = isPastOrCurrent && (hr === 3 || hr === 7) ? Math.max(1, lineStopRiskCount) : 0;
      const util = Math.min(100, Math.max(60, avgOperatorUtilization + (hr % 2 === 0 ? 3 : -2)));

      return {
        hour: `H${hr}`,
        timeSlot: `${String(6 + hr).padStart(2, '0')}:00`,
        targetVehicles,
        actualVehicles,
        targetTakt,
        actualTakt,
        taktVariance,
        binsRequired,
        tripsRequired,
        tripsDone,
        coverage,
        riskCount,
        util,
      };
    });
  }, [productionPlan, totalHourlyBinsRequired, totalShiftTripsRequired, avgCoverageHours, lineStopRiskCount, avgOperatorUtilization]);

  // Chart Data for Inventory Coverage
  const coverageChartData = useMemo(() => {
    return filteredInventoryStates.map((s) => ({
      name: s.pocPoint,
      displayName: `${s.pocPoint} (${s.partNo})`,
      pocPoint: s.pocPoint,
      partNo: s.partNo,
      coverage: Number((s.coverageHours || 0).toFixed(1)),
      risk: s.riskLevel,
    }));
  }, [filteredInventoryStates]);

  // Dynamic Trips per Hour based on uploaded Parts and Hourly Plan Breakdown
  const tripsByHourData = useMemo(() => {
    const defaultSlots = [
      { hourSlot: '07:00 (H1)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 129 },
      { hourSlot: '08:00 (H2)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 125 },
      { hourSlot: '09:00 (H3)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 129 },
      { hourSlot: '10:00 (H4)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 131 },
      { hourSlot: '11:00 (H5)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 127 },
      { hourSlot: '12:00 (H6)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 129 },
      { hourSlot: '13:00 (H7)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 124 },
      { hourSlot: '14:00 (H8)', targetVehicles: productionPlan.hourlyPlanVehicles || 129, actualVehicles: 129 },
    ];

    const slots = (productionPlan.hourlyBreakdown && productionPlan.hourlyBreakdown.length > 0)
      ? productionPlan.hourlyBreakdown
      : defaultSlots;

    return slots.map((hSlot) => {
      const milkRunEligible = filteredParts.filter(p => p.transportMode === 'Jumbo Trolley' || p.transportMode === 'BOV (Battery Vehicle)');
      const standardParts = filteredParts.filter(p => p.transportMode !== 'Jumbo Trolley' && p.transportMode !== 'BOV (Battery Vehicle)');
      
      let totalHourlyTripsReq = 0;
      if (milkRunEligible.length > 0) {
        const groups = getMilkRunGroups(milkRunEligible, { ...productionPlan, hourlyPlanVehicles: hSlot.targetVehicles }, modeConfigs, inventoryStates);
        totalHourlyTripsReq += groups.length; 
      }
      
      if (standardParts.length > 0) {
        totalHourlyTripsReq += standardParts.reduce((acc, part) => {
          const m = calculatePartMetrics(part, hSlot.targetVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
          return acc + m.tripsRequiredPerHour;
        }, 0);
      }

      const actualVehicles = hSlot.actualVehicles ?? hSlot.targetVehicles;
      const ratio = Math.min(1.0, actualVehicles / Math.max(1, hSlot.targetVehicles));
      const completedTrips = Math.round(totalHourlyTripsReq * ratio);

      return {
        hour: hSlot.hourSlot.split(' ')[0],
        fullHour: hSlot.hourSlot,
        trips: completedTrips,
        target: totalHourlyTripsReq,
      };
    });
  }, [productionPlan, parts, modeConfigs]);

  // Transport mode summary
  const modeDistribution = useMemo(() => {
    const map: Record<string, { count: number; trips: number; binsHr: number }> = {};
    livePartsMetrics.forEach((m, idx) => {
      const part = filteredParts[idx];
      const mode = part?.transportMode || 'Jumbo Trolley';
      if (!map[mode]) {
        map[mode] = { count: 0, trips: 0, binsHr: 0 };
      }
      map[mode].count += 1;
      map[mode].trips += m.tripsRequiredPerShift;
      map[mode].binsHr += m.roundedTrolleysPerHour;
    });
    return map;
  }, [livePartsMetrics, parts]);

  // Dynamic alerts matching current uploaded parts
  const activeAlertsMatchingParts = alerts.filter((a) => filteredParts.some((p) => p.partNo === a.partNo));
  const displayAlerts = activeAlertsMatchingParts.length > 0
    ? activeAlertsMatchingParts
    : inventoryStates
        .filter((s) => s.riskLevel === 'Red' || s.riskLevel === 'Yellow')
        .map((s) => ({
          id: `ALT-DYN-${s.partNo}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          severity: (s.riskLevel === 'Red' ? 'high' : 'medium') as 'high' | 'medium',
          partNo: s.partNo,
          pocPoint: s.pocPoint,
          title: `${s.riskLevel === 'Red' ? 'CRITICAL LINE STOP RISK' : 'LOW STOCK WARNING'} (${s.coverageHours}h stock)`,
          message: `Part ${s.partNo} at POC ${s.pocPoint} has ${s.currentStockUnits} units remaining (${s.coverageHours}h coverage).`,
          acknowledged: false,
          type: 'Stock Runout',
        }));

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="executive-dashboard-view" className="space-y-6 font-sans">
      
      {/* 0. MODULE HEADER WITH CSV/EXCEL EXPORT BUTTONS */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono uppercase tracking-wider">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
            <span className="truncate">Executive Material Flow Control Tower</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[#888] mt-0.5 font-mono">
            Live uploaded part master ({filteredParts.length} parts), shift trips ({totalShiftTripsRequired} trips), takt time variance, and POC inventory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-start xl:self-auto shrink-0">
          {/* Live vs Static Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-[#09090b] p-0.5 sm:p-1 rounded-xl border border-slate-200 dark:border-[#2a2a2e]">
            <button
              onClick={() => setDashboardMode('live')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                dashboardMode === 'live'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1a1f]'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${dashboardMode === 'live' ? 'animate-pulse' : ''}`} />
              <span>LIVE</span>
            </button>
            <button
              onClick={() => setDashboardMode('static')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                dashboardMode === 'static'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1a1f]'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>STATIC</span>
            </button>
          </div>

          <button
            onClick={() =>
              generateStationSummaryPdfReport({
                selectedAssemblyLine,
                inventoryStates,
                parts,
                trips,
                operators,
                alerts,
                productionPlan,
                modeConfigs,
              })
            }
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/50 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md hover:shadow-purple-900/30 cursor-pointer whitespace-nowrap"
            title="Export current filtered view of station metrics into a pre-formatted PDF document"
          >
            <Download className="w-3.5 h-3.5 text-purple-200 shrink-0" />
            <span className="hidden sm:inline">Generate Summary Report</span>
            <span className="sm:hidden">Summary PDF</span>
          </button>

          <button
            onClick={() => exportExecutiveDashboardData(inventoryStates, parts, trips, operators, alerts, productionPlan, 'xlsx')}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            title="Download Executive Dashboard Tables as Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => exportExecutiveDashboardData(inventoryStates, parts, trips, operators, alerts, productionPlan, 'csv')}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            title="Download Executive Dashboard Tables as CSV (.csv)"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 0.5 ASSEMBLY LINE CHOICE TOGGLE SELECTION */}
      <AssemblyLineToggle />

      {/* 1. TOP KPI RIBBON GRID WITH EMBEDDED SPARKLINE TREND CHARTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
        
        {/* KPI 1: Active Uploaded Parts & Component Demand */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-xl p-3.5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-[#888] text-[10px] font-bold font-mono uppercase mb-1">
              <span>Active Parts</span>
              <Boxes className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{totalActiveParts}</span>
              <span className="text-xs text-emerald-400 font-mono font-bold">Parts</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
              {totalShiftUnitsConsumed.toLocaleString()} Shift Units Demand
            </p>
          </div>

          {/* Sparkline Trend Chart: Hourly Component Bins Demand */}
          <div className="pt-2">
            <div className="flex justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500 mb-0.5">
              <span>8-Hr Bin Demand</span>
              <span className="text-emerald-500 dark:text-emerald-400 font-bold">{totalHourlyBinsRequired} Bins/hr</span>
            </div>
            <div className="h-9 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={hourlyTrendData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="partsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-mono rounded text-slate-800 dark:text-white shadow">
                            <span>{d.timeSlot}: <strong>{d.binsRequired} Bins</strong></span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="binsRequired" stroke="#10b981" fill="url(#partsGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KPI 2: Shift Delivery Trips (Real-time Uploaded Data) */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-xl p-3.5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-[#888] text-[10px] font-bold font-mono uppercase mb-1">
              <span>Shift Delivery Trips</span>
              <Truck className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{tripsCompletedCount}</span>
              <span className="text-sm font-mono text-purple-600 dark:text-purple-400 font-bold">/ {totalShiftTripsRequired}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Trips</span>
            </div>
            <p className="text-[10px] text-purple-600 dark:text-purple-300 font-mono mt-0.5 truncate">
              {totalHourlyBinsRequired} Bins/Hr Required Demand
            </p>
          </div>

          {/* Sparkline Trend Chart: Shift Trip Completion Velocity */}
          <div className="pt-2">
            <div className="flex justify-between text-[9px] font-mono text-slate-450 dark:text-slate-500 mb-0.5">
              <span>Trips Pace (8 Hr)</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">{Math.round(totalShiftTripsRequired / 8)} Trips/hr</span>
            </div>
            <div className="h-9 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={hourlyTrendData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-mono rounded text-slate-800 dark:text-white shadow">
                            <span>{d.timeSlot}: <strong>{d.tripsDone}/{d.tripsRequired} Trips</strong></span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line type="monotone" dataKey="tripsRequired" stroke="#888" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="tripsDone" stroke="#c084fc" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KPI 3: Takt Time Performance & Target Variance Sparkline */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-xl p-3.5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-[#888] text-[10px] font-bold font-mono uppercase mb-1">
              <span>Takt Time Performance</span>
              <Gauge className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{actualTaktTimeSec}s</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Target: {targetTaktTimeSec}s</span>
            </div>
            <p className={`text-[10px] font-mono font-bold mt-0.5 flex items-center gap-1 ${taktVarianceSec <= 0 ? 'text-emerald-600 dark:text-emerald-400' : taktVarianceSec <= 0.8 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {taktVarianceSec <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
              <span>Variance: {taktVarianceSec >= 0 ? `+${taktVarianceSec}` : taktVarianceSec}s vs Takt</span>
            </p>
          </div>

          {/* Sparkline Trend Chart: Takt Time Variance over 8 Hours */}
          <div className="pt-2">
            <div className="flex justify-between text-[9px] font-mono text-slate-450 dark:text-slate-500 mb-0.5">
              <span>8-Hr Takt Variance</span>
              <span className="text-amber-500 dark:text-amber-400 font-bold">{targetTaktTimeSec}s Line</span>
            </div>
            <div className="h-9 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={hourlyTrendData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="taktGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-mono rounded text-slate-800 dark:text-white shadow">
                            <div>{d.timeSlot} Takt: <strong>{d.actualTakt}s</strong></div>
                            <div className="text-amber-500">Var: <strong>{d.taktVariance > 0 ? `+${d.taktVariance}` : d.taktVariance}s</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="#888" strokeDasharray="2 2" />
                  <Area type="monotone" dataKey="taktVariance" stroke="#f59e0b" fill="url(#taktGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KPI 4: Inventory Coverage Avg */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-xl p-3.5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-[#888] text-[10px] font-bold font-mono uppercase mb-1">
              <span>Inv Coverage Avg</span>
              <Clock className="w-3.5 h-3.5 text-cyan-550 dark:text-cyan-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className={`text-2xl font-mono font-bold ${avgCoverageHours >= 2.0 ? 'text-emerald-650 dark:text-emerald-400' : avgCoverageHours >= 1.0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {avgCoverageHours}h
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Target: ≥2.0h</span>
            </div>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
              {healthyPartsCount} / {totalActiveParts} POCs Buffer Healthy
            </p>
          </div>

          {/* Sparkline Trend Chart: 8-Hour Coverage Trend */}
          <div className="pt-2">
            <div className="flex justify-between text-[9px] font-mono text-slate-450 dark:text-slate-500 mb-0.5">
              <span>8-Hr Coverage</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">Avg {avgCoverageHours}h</span>
            </div>
            <div className="h-9 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={hourlyTrendData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-mono rounded text-slate-800 dark:text-white shadow">
                            <span>{d.timeSlot}: <strong>{d.coverage}h Stock</strong></span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="coverage" stroke="#06b6d4" fill="url(#covGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KPI 5: Line Stop Risk & Fleet Workload */}
        <div className={`bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-xl p-3.5 shadow-xl flex flex-col justify-between ${lineStopRiskCount > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-[#888] text-[10px] font-bold font-mono uppercase mb-1">
              <span>Line Stop Risk / Util</span>
              <ShieldAlert className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-mono font-bold text-red-600 dark:text-red-500">{lineStopRiskCount}</span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold">{avgOperatorUtilization}% Util</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {activeOperators} Operators Active Fleet
            </p>
          </div>

          {/* Sparkline Trend Chart: 8-Hour Workload & Risk Trend */}
          <div className="pt-2">
            <div className="flex justify-between text-[9px] font-mono text-slate-450 dark:text-slate-500 mb-0.5">
              <span>8-Hr Workload %</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">{avgOperatorUtilization}% Avg</span>
            </div>
            <div className="h-9 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={hourlyTrendData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-mono rounded text-slate-800 dark:text-white shadow">
                            <div>{d.timeSlot} Workload: <strong>{d.util}%</strong></div>
                            <div className="text-red-600 dark:text-red-400">Risk: <strong>{d.riskCount} items</strong></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line type="monotone" dataKey="util" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>

      {/* SWCT & MILK-RUN MATERIAL FLOW SIMULATION & OPTIMIZATION DEMONSTRATOR */}
      <SWCTTripSimulationDemonstrator onSimulationSync={setSwctSyncState} />

      {/* SYNCHRONIZED FACTORY MATERIAL FLOW & LINE FEEDING DIGITAL TWIN MAP */}
      <FactoryMap linkedSwctState={swctSyncState} />

      {/* 1.5 UPLOADED PARTS & TRANSPORT MODE LIVE BREAKDOWN STRIP */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 font-mono flex items-center gap-2">
              <Truck className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="truncate">Live Uploaded Parts Transport & Shift Delivery Trips Breakdown</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Reflects exact trip requirements calculated from uploaded Excel file for shift target of {productionPlan.shiftPlanVehicles} vehicles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold whitespace-nowrap">
              Total Shift Trips: {totalShiftTripsRequired}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-bold whitespace-nowrap">
              Total Hourly Demand: {totalHourlyBinsRequired} Bins/hr
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          {(Object.entries(modeDistribution) as [string, { count: number; trips: number; binsHr: number }][]).map(([mode, data]) => (
            <div key={mode} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-slate-600 dark:text-slate-400 text-[11px] font-bold block truncate">{mode}</span>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-purple-700 dark:text-purple-300 text-base font-bold">{data.trips} Shift Trips</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>{data.count} Parts</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">{data.binsHr} Bins/hr</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2.5 FILTERED STATION METRICS LEDGER CARD */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 font-mono flex items-center gap-2 flex-wrap">
              <Activity className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Filtered Station Metrics View</span>
              <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 text-[10px]">
                {selectedAssemblyLine === 'ALL' ? 'ALL LINES' : selectedAssemblyLine}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Live station stock coverage, delivery status & line feeding requirements for location: <strong>{selectedAssemblyLine}</strong>
            </p>
          </div>

          <button
            onClick={() =>
              generateStationSummaryPdfReport({
                selectedAssemblyLine,
                inventoryStates,
                parts,
                trips,
                operators,
                alerts,
                productionPlan,
                modeConfigs,
              })
            }
            className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/50 text-xs font-mono font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0 whitespace-nowrap self-start md:self-auto"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-200 shrink-0" />
            <span>Generate Summary Report (PDF)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono uppercase border-b border-slate-200 dark:border-slate-800 text-[11px]">
              <tr>
                <th className="px-3 py-2.5">POC Station</th>
                <th className="px-3 py-2.5">Line</th>
                <th className="px-3 py-2.5">Part No</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5">Mode / Bin</th>
                <th className="px-3 py-2.5 text-right">Opening</th>
                <th className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">+ Delivered</th>
                <th className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">- Consumed</th>
                <th className="px-3 py-2.5 text-right text-slate-900 dark:text-white font-bold bg-slate-100 dark:bg-slate-950/80">= Current</th>
                <th className="px-3 py-2.5 text-right">Coverage</th>
                <th className="px-3 py-2.5 text-center">Risk Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
              {filteredInventoryStates.map((state, idx) => {
                const part = parts.find((p) => p.partNo === state.partNo);
                const lineCode = getPartLineCode(part, state.pocPoint);

                return (
                    <tr key={`${state.pocPoint}-${state.partNo}-${idx}`} className="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{state.pocPoint}</td>
                      <td className="px-3 py-2.5 text-cyan-600 dark:text-cyan-400 font-bold">{lineCode}</td>
                      <td className="px-3 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">{state.partNo}</td>
                      <td className="px-3 py-2.5 text-slate-800 dark:text-slate-300 font-sans truncate max-w-[180px]">{part?.description || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{part ? `${part.transportMode.replace(' Trolley', '')} (${part.binCapacity}/bin)` : '-'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">{state.openingStockUnits}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-650 dark:text-emerald-400 font-bold">+{state.deliveredQuantityUnits}</td>
                      <td className="px-3 py-2.5 text-right text-amber-650 dark:text-amber-400 font-bold">-{state.consumedQuantityUnits}</td>
                      <td className="px-3 py-2.5 text-right text-slate-900 dark:text-white font-extrabold bg-slate-100 dark:bg-slate-950/80">{state.currentStockUnits}</td>
                      <td className="px-3 py-2.5 text-right text-slate-900 dark:text-white font-bold">{state.coverageHours}h</td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            state.riskLevel === 'Green'
                              ? 'bg-emerald-50 text-emerald-750 border-emerald-250 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                              : state.riskLevel === 'Yellow'
                              ? 'bg-amber-50 text-amber-750 border-amber-250 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                              : 'bg-rose-50 text-rose-750 border-rose-250 dark:bg-rose-500/30 dark:text-rose-200 dark:border-rose-500/50'
                          }`}
                        >
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

      {/* 3. BOTTOM SECTION: RECHARTS & MONITOR PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Inventory Coverage Chart */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-xl">
          <div className="p-2.5 bg-slate-50 dark:bg-[#1a1a1f] border-b border-slate-200 dark:border-[#2a2a2e] -mx-4 -mt-4 mb-4 px-4 flex justify-between items-center rounded-t-2xl">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 dark:text-[#bbb] font-mono">POC Inventory Coverage (Hours)</h3>
            <span className="text-[10px] font-mono text-slate-500 dark:text-[#888]">Green &gt;2h | Yellow 1-2h | Red &lt;1h</span>
          </div>
          <div className="h-64 w-full mt-2 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={coverageChartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  tick={{ fontFamily: 'monospace', fill: '#64748b' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tick={{ fontFamily: 'monospace', fill: '#64748b' }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const entry = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs font-mono text-slate-850 dark:text-white shadow-2xl space-y-1">
                          <div className="font-bold text-cyan-600 dark:text-cyan-400">{entry.displayName}</div>
                          <div>Stock Coverage: <strong className="text-amber-650 dark:text-amber-300">{entry.coverage} Hours</strong></div>
                          <div>Risk Status: <span className={entry.risk === 'Green' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : entry.risk === 'Yellow' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-red-650 dark:text-red-400 font-bold'}>{entry.risk}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="coverage" radius={[4, 4, 0, 0]}>
                  {coverageChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.risk === 'Green' ? '#22c55e' : entry.risk === 'Yellow' ? '#eab308' : '#ef4444'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trips by Hour Chart */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-xl">
          <div className="p-2.5 bg-slate-50 dark:bg-[#1a1a1f] border-b border-slate-200 dark:border-[#2a2a2e] -mx-4 -mt-4 mb-4 px-4 flex justify-between items-center rounded-t-2xl">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 dark:text-[#bbb] font-mono">Material Delivery Trips by Hour</h3>
            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">Actual vs Planned Dispatch</span>
          </div>
          <div className="h-64 w-full mt-2 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={tripsByHourData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <XAxis
                  dataKey="hour"
                  stroke="#64748b"
                  fontSize={10}
                  tick={{ fontFamily: 'monospace', fill: '#64748b' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tick={{ fontFamily: 'monospace', fill: '#64748b' }}
                  label={{ value: 'Trips/Hr', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs font-mono text-slate-850 dark:text-white shadow-2xl space-y-1">
                          <div className="font-bold text-blue-600 dark:text-blue-400">{data.fullHour || data.hour}</div>
                          <div>Actual Completed: <strong className="text-cyan-600 dark:text-cyan-300">{data.trips} Trips</strong></div>
                          <div>Target Planned: <strong className="text-purple-600 dark:text-purple-300">{data.target} Trips</strong></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="trips" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} name="Actual Completed Trips" />
                <Line type="monotone" dataKey="target" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" name="Target Planned Trips" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* BOTTOM FEED: ALERTS & ACTIVE TRIPS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Control Tower Alerts Feed */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-xl">
          <div className="p-2.5 bg-slate-50 dark:bg-[#1a1a1f] border-b border-slate-200 dark:border-[#2a2a2e] -mx-4 -mt-4 mb-3 px-4 flex justify-between items-center rounded-t-2xl">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 dark:text-[#bbb] font-mono flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
              Live Control Tower Alerts ({displayAlerts.filter((a) => !a.acknowledged).length})
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-[#666] font-mono uppercase">REAL-TIME EXCEPTION FEED</span>
          </div>

          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
            {displayAlerts.length === 0 ? (
              <div className="text-xs font-mono text-slate-500 dark:text-[#666] py-6 text-center">No active alerts. Material flow nominal.</div>
            ) : (
              displayAlerts.map((alert, idx) => (
                <div
                  key={`${alert.id}-${idx}`}
                  className={`p-2.5 rounded-xl border text-xs font-mono transition-all flex items-start justify-between gap-2 ${
                    alert.severity === 'high'
                      ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-200'
                      : alert.severity === 'medium'
                      ? 'bg-yellow-50 dark:bg-yellow-900/15 border-yellow-200 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-200'
                      : 'bg-slate-50 dark:bg-[#121216] border-slate-200 dark:border-[#2a2a2e] text-slate-800 dark:text-[#e0e0e0]'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white">{alert.title}</span>
                      <span className="text-[10px] opacity-60">{alert.timestamp}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-[#888]">{alert.message}</p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-2 py-0.5 rounded bg-white dark:bg-[#1a1a1f] hover:bg-slate-100 dark:hover:bg-[#25252b] text-slate-700 dark:text-[#bbb] border border-slate-200 dark:border-[#2a2a2e] text-[10px] cursor-pointer"
                      >
                        ACK
                      </button>
                    )}
                    <button
                      onClick={() => dispatchEmergencyTrip(alert.partNo)}
                      className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] flex items-center gap-1 shadow cursor-pointer"
                    >
                      <Zap className="w-3 h-3" /> DISPATCH
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Operator Status & Trip Monitor */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-xl">
          <div className="p-2.5 bg-slate-50 dark:bg-[#1a1a1f] border-b border-slate-200 dark:border-[#2a2a2e] -mx-4 -mt-4 mb-3 px-4 flex justify-between items-center rounded-t-2xl">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-800 dark:text-[#bbb] font-mono flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              Active Operator Roster & Workload
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-[#666] font-mono">MHF STAFF FLEET</span>
          </div>

          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1 font-mono text-xs">
            {operators.map((op, idx) => (
              <div key={`${op.id}-${idx}`} className="p-2 rounded-xl bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#1a1a1f] flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{op.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#1a1a1f] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-[#2a2a2e]">
                      {op.operatorCode}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-550 dark:text-[#888]">
                    Mode: <strong className="text-slate-800 dark:text-white">{op.transportMode}</strong> | Route: {op.assignedRouteId}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-blue-600 dark:text-blue-400 text-xs">{op.utilizationPercent}% Util</div>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold mt-0.5 ${
                      op.status === 'On Route'
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                        : op.status === 'Loading'
                        ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30'
                        : 'bg-slate-200 dark:bg-[#1a1a1f] text-slate-600 dark:text-[#666]'
                    }`}
                  >
                    {op.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExecutiveDashboard;


