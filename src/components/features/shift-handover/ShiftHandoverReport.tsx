import React, { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Users,
  Box,
  ArrowRight,
  ClipboardCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  FileSpreadsheet,
  Truck,
  Copy,
  Check,
  FileText,
  Layers,
  Search,
  Navigation,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculatePartMetrics, getRiskLevel, getShiftTripHandoverMapping, getInitialStockUnits } from '../../../utils/calculations';
import { exportMaterialFlowExcel } from '../../../utils/excelParser';
import * as XLSX from 'xlsx-js-style';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const ShiftHandoverReportView: React.FC = () => {
  const {
    inventoryStates,
    parts,
    productionPlan,
    advanceShift,
    modeConfigs,
    operators,
    operatorName,
    setOperatorName,
  } = useMaterialFlow();

  const [outgoingSupervisor, setOutgoingSupervisor] = useState(operatorName);
  const [incomingSupervisor, setIncomingSupervisor] = useState('Suresh Nair (Shift Supv)');
  const [handoverNotes, setHandoverNotes] = useState(
    'Line clear executed at POC. All Jumbo trolleys inspected. No active part starvation alerts.'
  );
  const [copiedScheduleText, setCopiedScheduleText] = useState(false);
  const [copiedManifestText, setCopiedManifestText] = useState(false);
  const [selected1HrSlot, setSelected1HrSlot] = useState<number>(0);
  const [selectedTripNumber, setSelectedTripNumber] = useState<number>(1);
  const [selectedHourFilter, setSelectedHourFilter] = useState<number | 'all'>('all');
  const [selectedFilterPeriod, setSelectedFilterPeriod] = useState<'1hr' | 'shift1' | 'shift 2'>('shift1');
  const [activeOutputTab, setActiveOutputTab] = useState<'schedule' | 'manifest'>('schedule');
  const [tripSearchQuery, setTripSearchQuery] = useState('');

  // 1-Hour timing slot options based on active shift
  const hourlySlotOptions = useMemo(() => {
    const isShift2 = selectedFilterPeriod === 'shift 2' || productionPlan.shift.includes('Shift 2');
    if (isShift2) {
      return [
        { slotIndex: 0, label: '15:30 - 16:30' },
        { slotIndex: 1, label: '16:30 - 17:30' },
        { slotIndex: 2, label: '17:30 - 18:30' },
        { slotIndex: 3, label: '18:30 - 19:30' },
        { slotIndex: 4, label: '19:30 - 20:30' },
        { slotIndex: 5, label: '20:30 - 21:30' },
        { slotIndex: 6, label: '21:30 - 22:30' },
        { slotIndex: 7, label: '22:30 - 23:30' },
      ];
    }
    return [
      { slotIndex: 0, label: '07:00 - 08:00' },
      { slotIndex: 1, label: '08:00 - 09:00' },
      { slotIndex: 2, label: '09:00 - 10:00' },
      { slotIndex: 3, label: '10:00 - 11:00' },
      { slotIndex: 4, label: '11:00 - 12:00' },
      { slotIndex: 5, label: '12:00 - 13:00' },
      { slotIndex: 6, label: '13:00 - 14:00' },
      { slotIndex: 7, label: '14:00 - 15:00' },
    ];
  }, [selectedFilterPeriod, productionPlan.shift]);

  const activeSlotLabel = hourlySlotOptions[selected1HrSlot]?.label || '07:00 - 08:00';

  // Compute shift hours, offset, and labels for active filter
  const { hoursInShift, startHour, periodLabel } = useMemo(() => {
    if (selectedFilterPeriod === '1hr') {
      return { hoursInShift: 1, startHour: 0, periodLabel: `1hr (${activeSlotLabel})` };
    }
    if (selectedFilterPeriod === 'shift 2') {
      return { hoursInShift: 8, startHour: 8, periodLabel: 'shift 2 (Shift 2: 15:30 - 00:00)' };
    }
    return { hoursInShift: 8, startHour: 0, periodLabel: 'shift1 (Shift 1: 07:00 - 15:30)' };
  }, [selectedFilterPeriod, activeSlotLabel]);

  // Compute Shift Trip Mapping Output based on selected filter period (1hr, shift1, shift 2)
  const shiftTripMapping = useMemo(() => {
    return getShiftTripHandoverMapping(parts, productionPlan, modeConfigs, hoursInShift, startHour, selected1HrSlot);
  }, [parts, productionPlan, modeConfigs, hoursInShift, startHour, selected1HrSlot]);

  // Auto-sync active selected trip when filter changes
  useEffect(() => {
    if (shiftTripMapping.allShiftTrips.length > 0) {
      const exists = shiftTripMapping.allShiftTrips.some((t) => t.tripNumber === selectedTripNumber);
      if (!exists) {
        setSelectedTripNumber(shiftTripMapping.allShiftTrips[0].tripNumber);
      }
    }
  }, [shiftTripMapping, selectedTripNumber]);

  // Active selected trip object
  const activeSelectedTrip = useMemo(() => {
    return (
      shiftTripMapping.allShiftTrips.find((t) => t.tripNumber === selectedTripNumber) ||
      shiftTripMapping.allShiftTrips[0]
    );
  }, [shiftTripMapping, selectedTripNumber]);

  // Filtered trips for list / matrix
  const filteredTrips = useMemo(() => {
    return shiftTripMapping.allShiftTrips.filter((trip) => {
      const matchesHour = selectedHourFilter === 'all' || trip.shiftHour === selectedHourFilter;
      const matchesSearch =
        tripSearchQuery === '' ||
        trip.tripNumber.toString().includes(tripSearchQuery) ||
        trip.items.some(
          (i) =>
            i.partNo.toLowerCase().includes(tripSearchQuery.toLowerCase()) ||
            i.description.toLowerCase().includes(tripSearchQuery.toLowerCase()) ||
            i.store.toLowerCase().includes(tripSearchQuery.toLowerCase()) ||
            i.pocPoint.toLowerCase().includes(tripSearchQuery.toLowerCase())
        );
      return matchesHour && matchesSearch;
    });
  }, [shiftTripMapping, selectedHourFilter, tripSearchQuery]);

  // Handover verification checklist state
  const [checklist, setChecklist] = useState({
    lineClear: true,
    equipmentInspected: true,
    emptyTrolleysReturned: true,
    operatorAttendanceVerified: true,
    emergencyBuffersIntact: true,
  });

  const toggleChecklistItem = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Determine current active shift and next incoming shift
  const currentShiftName = productionPlan.shift;
  const nextShiftName = useMemo(() => {
    if (currentShiftName.includes('Shift 1')) return 'Shift 2 (15:30 - 00:00)';
    return 'Shift 1 (07:00 - 15:30)';
  }, [currentShiftName]);

  // Calculate detailed handover metrics per part
  const partHandoverList = useMemo(() => {
    return parts.map((part) => {
      const state = inventoryStates.find((s) => s.partNo === part.partNo);
      const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);

      const closingStockUnits = state ? Math.round(state.currentStockUnits) : getInitialStockUnits(part);
      const closingStockTrolleys = Number((closingStockUnits / Math.max(1, part.binCapacity)).toFixed(2));

      // Recommended starting stock for incoming shift = 2 hours of buffer coverage or at least 1-2 trolleys
      const recommendedStartingUnits = Math.max(
        Math.round(metrics.hourlyConsumption * 1.5),
        part.binCapacity
      );
      const recommendedStartingTrolleys = Number((recommendedStartingUnits / Math.max(1, part.binCapacity)).toFixed(2));

      const stockVarianceUnits = closingStockUnits - recommendedStartingUnits;
      const stockVarianceTrolleys = Number((stockVarianceUnits / Math.max(1, part.binCapacity)).toFixed(2));

      let status: 'Surplus' | 'Optimal' | 'Deficit' = 'Optimal';
      if (stockVarianceUnits < -5) status = 'Deficit';
      else if (stockVarianceUnits > 15) status = 'Surplus';

      const preShiftTripsNeeded = status === 'Deficit'
        ? Math.ceil(Math.abs(stockVarianceUnits) / (part.binCapacity * metrics.carryingCapacity))
        : 0;

      // Calculate Lag Time based on line consumption with +/- 2 min tolerance
      const consumptionPerMinute = metrics.hourlyConsumption / 60;
      let stockDurationMinutes = 0;
      let lagTimeMinutes = 0;
      let nextDeliveryTimeStatus = 'Stable';
      
      if (consumptionPerMinute > 0) {
        stockDurationMinutes = Math.round(closingStockUnits / consumptionPerMinute);
        // Compare to 90 min ideal buffer (1.5 hours)
        lagTimeMinutes = stockDurationMinutes - 90;
        
        if (lagTimeMinutes < -2) {
           nextDeliveryTimeStatus = `Lagging ${Math.abs(lagTimeMinutes)}m`;
        } else if (lagTimeMinutes > 2) {
           nextDeliveryTimeStatus = `Leading ${lagTimeMinutes}m`;
        } else {
           nextDeliveryTimeStatus = `On Time (±2m)`;
        }
      } else {
        nextDeliveryTimeStatus = 'No Demand';
      }

      return {
        part,
        metrics,
        closingStockUnits,
        closingStockTrolleys,
        recommendedStartingUnits,
        recommendedStartingTrolleys,
        stockVarianceUnits,
        stockVarianceTrolleys,
        status,
        preShiftTripsNeeded,
        lagTimeMinutes,
        nextDeliveryTimeStatus,
        stockDurationMinutes,
        riskLevel: state ? state.riskLevel : getRiskLevel(closingStockUnits / Math.max(1, metrics.hourlyConsumption)),
        coverageHours: state ? state.coverageHours : Number((closingStockUnits / Math.max(1, metrics.hourlyConsumption)).toFixed(1)),
      };
    });
  }, [parts, inventoryStates, productionPlan, modeConfigs]);

  // Aggregate stats
  const totalPartsInDeficit = partHandoverList.filter((item) => item.status === 'Deficit').length;
  const totalPartsOptimal = partHandoverList.filter((item) => item.status === 'Optimal').length;
  const totalPartsSurplus = partHandoverList.filter((item) => item.status === 'Surplus').length;
  const totalPreShiftTripsRequired = partHandoverList.reduce((sum, item) => sum + item.preShiftTripsNeeded, 0);

  const allChecklistCompleted = Object.values(checklist).every(Boolean);

  const handleExportOperatorManifest = () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    
    // Header row (merged)
    XLSX.utils.sheet_add_aoa(ws, [['OPERATOR-1']], { origin: 'A1' });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];

    // Column Headers
    const headers = [
      'S.no',
      'Type of Movement',
      'Model',
      'Part Description',
      'Part No',
      'Trolley/Bin',
      'Qty/Bin',
      'Req Qty per Trip ID',
      'From',
      'To',
      'Trip No',
      'Lag Time'
    ];
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A2' });

    // Data Rows
    const rows = shiftTripMapping.items.map((row) => {
      const handoverItem = partHandoverList.find(p => p.part.partNo === row.partNo);
      const lagTime = handoverItem ? handoverItem.lagTimeMinutes : '';
      
      const tripBreakdown = row.hourlyTripIds.map((tripId, idx) => {
        const trolleys = row.trolleyLoadCounts[idx] || 1;
        const totalQty = trolleys * row.qtyPerTrolley;
        return `Trip ${tripId}: ${trolleys} ${row.binOrTrolley}(s) (${totalQty} qty)`;
      }).join(' | ');

      return [
        row.sNo,
        'JUMBO', 
        row.modelNo,
        row.description,
        row.partNo,
        row.binOrTrolley,
        row.qtyPerTrolley,
        tripBreakdown,
        row.store,
        row.pocPoint,
        row.oneCycleTripIdsFormatted,
        lagTime
      ];
    });

    XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A3' });

    // Apply styles to title (OPERATOR-1)
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 12, color: { rgb: "000000" } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    // Apply styles to headers
    const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    colLetters.forEach(col => {
      if (ws[`${col}2`]) {
        ws[`${col}2`].s = {
          fill: { fgColor: { rgb: "7030A0" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { auto: 1 } },
            bottom: { style: 'thin', color: { auto: 1 } },
            left: { style: 'thin', color: { auto: 1 } },
            right: { style: 'thin', color: { auto: 1 } }
          }
        };
      }
    });

    // Apply styles to data rows
    for (let r = 0; r < rows.length; r++) {
      colLetters.forEach(col => {
        const cellRef = `${col}${r + 3}`;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            alignment: { vertical: 'center' },
            border: {
              top: { style: 'thin', color: { auto: 1 } },
              bottom: { style: 'thin', color: { auto: 1 } },
              left: { style: 'thin', color: { auto: 1 } },
              right: { style: 'thin', color: { auto: 1 } }
            }
          };
        }
      });
    }

    // Column Widths
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 10 },
      { wch: 40 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 45 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operator Manifest');
    XLSX.writeFile(wb, `Operator_Manifest_${currentShiftName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="shift-handover-report-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-50 via-emerald-50/40 to-slate-100 dark:from-slate-900 dark:via-emerald-950/80 dark:to-slate-900 border border-slate-200 dark:border-emerald-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Automated Shift Handover Control Report
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 font-mono">
                  LIVE SHIFT SYNC
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Automatically maps outgoing shift closing stock to incoming shift recommended starting stock, calculating pre-shift dispatch trips and buffer variances.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportMaterialFlowExcel(parts, productionPlan, `Shift_Handover_Report_${currentShiftName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`, modeConfigs)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow border border-blue-400/30 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Handover Excel</span>
            </button>

            <button
              onClick={advanceShift}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-lg border border-emerald-400/40 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Simulate Shift Advance & Carry Forward</span>
            </button>
          </div>
        </div>

        {/* Shift Transition Status Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-emerald-800/40 font-mono text-xs">
          <div className="bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans font-semibold">Outgoing Shift (Ending)</span>
            <span className="font-bold text-amber-600 dark:text-amber-300 text-sm block">{currentShiftName}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">Lead: {outgoingSupervisor}</span>
          </div>

          <div className="bg-white dark:bg-slate-950/90 border border-emerald-200 dark:border-emerald-500/40 p-3 rounded-xl space-y-1 shadow-xs">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-sans font-semibold">Incoming Shift (Starting)</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-300 text-sm block">{nextShiftName}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">Lead: {incomingSupervisor}</span>
          </div>

          <div className="bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans font-semibold">Shift Vehicle Target</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-300 text-sm block">{productionPlan.shiftPlanVehicles} Vehicles</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">@{productionPlan.taktTimeSeconds}s Takt Rate</span>
          </div>

          <div className="bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans font-semibold">Pre-Shift Action Required</span>
            <span className={`font-bold text-sm block ${totalPreShiftTripsRequired > 0 ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {totalPreShiftTripsRequired > 0 ? `${totalPreShiftTripsRequired} Pre-Shift Trips` : 'Line Fully Stocked'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-sans">Deficit Parts: {totalPartsInDeficit}</span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-lg space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Total Dispatch Trips
            <Truck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {shiftTripMapping.totalShiftTripsCount} Trips
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {selectedFilterPeriod === '1hr' ? `${shiftTripMapping.allShiftTrips.length} Trips in ${activeSlotLabel}` : `${shiftTripMapping.totalTripsInHourlyCycle} Trips/Hr (${shiftTripMapping.totalShiftTripsCount} Total) in ${selectedFilterPeriod}`}
          </p>
        </div>

        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-lg space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Total Delivered Volume
            <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {shiftTripMapping.items.reduce((sum, item) => sum + item.shiftDeliveredUnits, 0).toLocaleString()} Units
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Delivered across {shiftTripMapping.items.length} managed parts
          </p>
        </div>

        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-lg space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Horizon Production Target
            <CheckCircle2 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          </span>
          <div className="text-2xl font-black text-cyan-600 dark:text-cyan-300 font-mono">
            {Math.round(productionPlan.hourlyPlanVehicles * hoursInShift)} Vehicles
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Target for {selectedFilterPeriod} (@{productionPlan.taktTimeSeconds}s Takt)
          </p>
        </div>

        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 shadow-lg space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            Line Buffer & Action Required
            <AlertTriangle className={`w-4 h-4 ${totalPreShiftTripsRequired > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500'}`} />
          </span>
          <div className={`text-2xl font-black font-mono ${totalPreShiftTripsRequired > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {totalPreShiftTripsRequired > 0 ? `${totalPreShiftTripsRequired} Pre-Shift Trips` : 'Line Stocked'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {totalPartsInDeficit} Deficit | {totalPartsOptimal} Optimal | {totalPartsSurplus} Surplus
          </p>
        </div>
      </div>

      {/* 8-Hour Shift Handover Trip Mapping & Operator Pick Manifest Panel */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                Shift Trip Dispatch Handover Schedule & Operator Pick Quantities
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/90 dark:text-indigo-300 font-mono border border-indigo-200 dark:border-indigo-500/40">
                {shiftTripMapping.totalShiftTripsCount} TRIPS / SHIFT
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Exact trip dispatch schedule and step-by-step loading quantities per trip for shop floor operators
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportOperatorManifest}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer self-start sm:self-auto border border-emerald-400"
            >
              <FileText className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                if (activeOutputTab === 'schedule') {
                  navigator.clipboard.writeText(shiftTripMapping.formattedTextOutput);
                  setCopiedScheduleText(true);
                  setTimeout(() => setCopiedScheduleText(false), 2000);
                } else {
                  navigator.clipboard.writeText(shiftTripMapping.formattedTripManifestOutput);
                  setCopiedManifestText(true);
                  setTimeout(() => setCopiedManifestText(false), 2000);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer self-start sm:self-auto border border-slate-700/30"
            >
              {(activeOutputTab === 'schedule' ? copiedScheduleText : copiedManifestText) ? (
                <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>
                {(activeOutputTab === 'schedule' ? copiedScheduleText : copiedManifestText)
                  ? 'Copied to Clipboard!'
                  : activeOutputTab === 'schedule'
                  ? 'Copy Schedule Text'
                  : 'Copy Trip Manifest'}
              </span>
            </button>
          </div>
        </div>

        {/* 1. Master Part-wise Schedule Table with Dynamic Horizon Control */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mr-1">
                <Clock className="w-4 h-4 text-indigo-500" />
                Select Planning Horizon:
              </span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                {[
                  { id: '1hr', label: '1hr', desc: '1 Hour Cycle' },
                  { id: 'shift1', label: 'shift1', desc: 'Shift 1 (07:00 - 15:30)' },
                  { id: 'shift 2', label: 'shift 2', desc: 'Shift 2 (15:30 - 00:00)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedFilterPeriod(opt.id as '1hr' | 'shift1' | 'shift 2');
                      setSelectedHourFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedFilterPeriod === opt.id
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    <span className="font-black font-mono">{opt.label}</span>
                    <span className="text-[10px] opacity-80 font-normal">({opt.desc})</span>
                  </button>
                ))}
              </div>

              {selectedFilterPeriod === '1hr' && (
                <div className="flex items-center gap-1.5 bg-indigo-50/90 dark:bg-indigo-950/90 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-xs">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 whitespace-nowrap">
                    Cycle Timing:
                  </span>
                  <select
                    value={selected1HrSlot}
                    onChange={(e) => setSelected1HrSlot(Number(e.target.value))}
                    className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 font-mono text-xs font-bold border border-indigo-300 dark:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                  >
                    {hourlySlotOptions.map((slot, idx) => (
                      <option key={idx} value={idx}>
                        Hour {idx + 1} ({slot.label})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                Target: <strong className="font-bold">{Math.round(productionPlan.hourlyPlanVehicles * hoursInShift)} Vehicles</strong> ({periodLabel})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Dispatch: <strong className="font-bold">{shiftTripMapping.totalShiftTripsCount} Trips Total</strong>
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr className="divide-x divide-slate-200 dark:divide-slate-800">
                  <th className="px-3 py-2.5 text-center w-12 border-r border-slate-200 dark:border-slate-800">S.No</th>
                  <th className="px-3 py-2.5 text-center w-20 border-r border-slate-200 dark:border-slate-800">Model</th>
                  <th className="px-3 py-2.5 text-left w-28 border-r border-slate-200 dark:border-slate-800">Part No</th>
                  <th className="px-3 py-2.5 text-left font-sans min-w-[160px] border-r border-slate-200 dark:border-slate-800">Description</th>
                  <th className="px-3 py-2.5 text-center w-28 border-r border-slate-200 dark:border-slate-800">Bin / Trolley</th>
                  <th className="px-3 py-2.5 text-center w-28 bg-indigo-50/60 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 border-r border-slate-200 dark:border-slate-800">
                    Qty / Trolley
                  </th>
                  <th className="px-3 py-2.5 text-center w-36 border-r border-slate-200 dark:border-slate-800">Store ➔ POC</th>
                  <th className={`px-3 py-2.5 text-left bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-r border-slate-200 dark:border-slate-800 ${selectedFilterPeriod === '1hr' ? 'w-auto' : 'min-w-[240px]'}`}>
                    {selectedFilterPeriod === '1hr' ? `1-Hr Cycle Trips (${activeSlotLabel})` : `${selectedFilterPeriod === 'shift1' ? 'Shift 1' : 'Shift 2'} Dispatch Trips`}
                  </th>
                  <th className="px-3 py-2.5 text-center w-36 bg-purple-50/40 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold border-r border-slate-200 dark:border-slate-800">
                    {selectedFilterPeriod === '1hr' ? '1-Hr Delivered' : selectedFilterPeriod === 'shift1' ? 'Shift 1 Delivered' : 'Shift 2 Delivered'}
                  </th>
                  <th className="px-3 py-2.5 text-center w-36 bg-rose-50/40 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold">
                    Delivery Lag (±2m)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                {shiftTripMapping.items.map((row) => {
                  const handoverItem = partHandoverList.find(p => p.part.partNo === row.partNo);
                  const activeTripIds = selectedFilterPeriod === '1hr' ? row.hourlyTripIds : row.shiftTripIds;
                  const formatTripChunks = (tripIds: number[], chunkSize: number = 10) => {
                    if (!tripIds || tripIds.length === 0) return ['No Trips'];
                    const chunks: string[] = [];
                    for (let i = 0; i < tripIds.length; i += chunkSize) {
                      const chunk = tripIds.slice(i, i + chunkSize);
                      chunks.push(chunk.map((t) => `T${t}`).join(', '));
                    }
                    return chunks;
                  };

                  return (
                    <tr key={row.partNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors align-middle divide-x divide-slate-200 dark:divide-slate-800/60">
                      <td className="px-3 py-2.5 text-center font-bold text-slate-500 border-r border-slate-200 dark:border-slate-800/60">{row.sNo}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800/60">{row.modelNo}</td>
                      <td className="px-3 py-2.5 font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-800/60">{row.partNo}</td>
                      <td className="px-3 py-2.5 font-sans font-medium text-slate-900 dark:text-white max-w-[200px] truncate border-r border-slate-200 dark:border-slate-800/60" title={row.description}>
                        {row.description}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-slate-200 dark:border-slate-800/60">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          row.binOrTrolley === 'Cover'
                            ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-700/60'
                            : row.binOrTrolley === 'Carton'
                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60'
                            : row.binOrTrolley === 'Bin'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60'
                            : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700/60'
                        }`}>
                          {row.binOrTrolley === 'Cover' ? 'Cover' : row.binOrTrolley === 'Carton' ? 'Carton' : row.binOrTrolley === 'Bin' ? 'Bin' : 'Trolley'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/20 dark:bg-indigo-950/20 border-r border-slate-200 dark:border-slate-800/60 whitespace-nowrap">
                        {row.qtyPerTrolley} pcs
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-slate-200 dark:border-slate-800/60">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{row.store}</span>
                        <span className="text-slate-400 mx-1">➔</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{row.pocPoint}</span>
                      </td>
                      <td className={`px-3 py-2.5 text-left font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/[0.02] dark:bg-indigo-950/10 border-r border-slate-200 dark:border-slate-800/60 ${selectedFilterPeriod === '1hr' ? 'w-auto' : 'min-w-[240px]'}`}>
                        <div className="flex flex-col items-start gap-1 font-mono">
                          {formatTripChunks(activeTripIds, 10).map((lineStr, idx) => (
                            <span
                              key={idx}
                              className="inline-flex w-fit max-w-fit px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/90 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono border border-indigo-200 dark:border-indigo-800/80 whitespace-nowrap font-bold tracking-tight shadow-2xs"
                            >
                              {lineStr}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-purple-700 dark:text-purple-300 bg-purple-50/20 dark:bg-purple-950/20 border-r border-slate-200 dark:border-slate-800/60 whitespace-nowrap">
                        <div className="font-mono text-xs font-black">{row.shiftDeliveredUnits.toLocaleString()} Units</div>
                        <div className="text-[10px] text-slate-500 font-normal">({row.shiftTripsCount} trips / {selectedFilterPeriod})</div>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {handoverItem && (
                          <div className="flex flex-col items-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${handoverItem.lagTimeMinutes < -2 ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-500/40' : handoverItem.lagTimeMinutes > 2 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-500/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-500/40'}`}>
                              {handoverItem.nextDeliveryTimeStatus}
                            </span>
                            <span className="text-[9px] text-slate-500 font-normal mt-0.5">Coverage: {handoverItem.stockDurationMinutes}m</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold border-t-2 border-slate-300 dark:border-slate-700 font-mono text-xs">
                <tr className="divide-x divide-slate-300 dark:divide-slate-700">
                  <td colSpan={3} className="px-3 py-2.5 text-left font-sans border-r border-slate-300 dark:border-slate-700">
                    Total ({shiftTripMapping.items.length} Parts Managed)
                  </td>
                  <td colSpan={4} className="px-3 py-2.5 text-center text-slate-500 font-sans text-[11px] border-r border-slate-300 dark:border-slate-700">
                    Horizon Target: <strong className="text-slate-800 dark:text-slate-200 font-mono">{selectedFilterPeriod}</strong> ({Math.round(productionPlan.hourlyPlanVehicles * hoursInShift)} Vehicles)
                  </td>
                  <td className="px-3 py-2.5 text-left text-indigo-600 dark:text-indigo-400 font-bold border-r border-slate-300 dark:border-slate-700">
                    {shiftTripMapping.totalShiftTripsCount} Trips Total
                  </td>
                  <td className="px-3 py-2.5 text-center font-black text-purple-700 dark:text-purple-300 text-xs border-r border-slate-300 dark:border-slate-700">
                    {shiftTripMapping.items.reduce((sum, item) => sum + item.shiftDeliveredUnits, 0).toLocaleString()} Units
                  </td>
                  <td className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400 text-[11px]">
                    100% On-Time
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 2. Operator Trip-by-Trip Loading & Pick Manifest */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Operator Loading Sheet & Pick Manifest ({selectedFilterPeriod}: Trips {shiftTripMapping.allShiftTrips[0]?.tripNumber || 1} to {shiftTripMapping.allShiftTrips[shiftTripMapping.allShiftTrips.length - 1]?.tripNumber || 1})
                </h4>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                  Select Any Trip to View Pick Qty
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Clear pickup quantities, trolleys, store racks, and line feed drop locations for the selected trip in {selectedFilterPeriod}
              </p>
            </div>

            {/* Hour Switcher */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Filter Hour:</span>
              <button
                onClick={() => setSelectedHourFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedHourFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                All (T{shiftTripMapping.allShiftTrips[0]?.tripNumber || 1}–T{shiftTripMapping.allShiftTrips[shiftTripMapping.allShiftTrips.length - 1]?.tripNumber || 1})
              </button>
              {[...Array(hoursInShift)].map((_, idx) => {
                const hr = startHour + idx + 1;
                return (
                  <button
                    key={hr}
                    onClick={() => {
                      setSelectedHourFilter(hr);
                      setSelectedTripNumber((hr - 1) * shiftTripMapping.totalTripsInHourlyCycle + 1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedHourFilter === hr
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Hr {hr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trip Selector Buttons Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {filteredTrips.map((trip) => {
              const isSelected = trip.tripNumber === activeSelectedTrip?.tripNumber;
              return (
                <button
                  key={trip.tripNumber}
                  onClick={() => setSelectedTripNumber(trip.tripNumber)}
                  className={`px-3 py-2 rounded-xl text-left transition-all flex-shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/30'
                      : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-indigo-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono font-black text-xs">Trip #{trip.tripNumber}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isSelected
                          ? 'bg-indigo-800/80 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Hr {trip.shiftHour}
                    </span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-90 truncate max-w-[120px] font-mono">
                    {trip.totalTrolleys} Trl ({trip.totalUnits} Qty)
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Trip Manifest Detail Banner & Cards */}
          {activeSelectedTrip && (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
              {/* Trip Highlight Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-mono font-black text-base shadow-md">
                    #{activeSelectedTrip.tripNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        TRIP #{activeSelectedTrip.tripNumber} LOADING MANIFEST
                      </h5>
                      <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                        Shift Hour {activeSelectedTrip.shiftHour} (Cycle Trip {activeSelectedTrip.hourlyTripIndex})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Vehicle: Jumbo Electric Tow Tug (Capacity: {activeSelectedTrip.vehicleCapacity} Trolleys)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Trip Payload</span>
                    <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                      {activeSelectedTrip.totalTrolleys} / {activeSelectedTrip.vehicleCapacity} Trolleys ({activeSelectedTrip.utilizationPercent}%)
                    </span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 text-right">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Total Pieces Picked</span>
                    <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300">
                      {activeSelectedTrip.totalUnits} Units
                    </span>
                  </div>
                </div>
              </div>

              {/* Part Loading Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeSelectedTrip.items.map((item, idx) => (
                  <div
                    key={`${item.partNo}-${idx}`}
                    className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-950/80 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-2.5 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 block">
                          {item.partNo}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {item.description}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-600 text-white font-mono shadow-xs">
                        Item {idx + 1}
                      </span>
                    </div>

                    {/* Prominent Quantity Callout */}
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
                          Trolleys to Load
                        </span>
                        <span className="text-sm font-mono font-black text-slate-900 dark:text-white">
                          {item.trolleysLoaded} Trolley{item.trolleysLoaded > 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({item.qtyPerTrolley} pcs/trolley)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">
                          TOTAL PICK QTY
                        </span>
                        <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {item.totalUnitsLoaded} Units
                        </span>
                      </div>
                    </div>

                    {/* Routing Details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-md text-center">
                        <span className="text-[9px] text-slate-500 block font-bold uppercase">Pick Location</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.store}</span>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-md text-center border border-emerald-200/50 dark:border-emerald-800/30">
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-bold uppercase">Feed POC</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{item.pocPoint}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transit Route Summary */}
              <div className="bg-slate-100 dark:bg-slate-900 p-2.5 rounded-lg text-xs font-mono flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-bold">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                  Route Flow:
                </span>
                <span>
                  Store [{activeSelectedTrip.pickupStores.join(', ')}] ➔ Line POC [{activeSelectedTrip.dropPocs.join(', ')}] ➔ Return Empty Trolleys
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Formatted Text Output with Tab Switching (Schedule Summary vs Trip Manifest Summary) */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Expected Handover Text Output (Formatted Dispatch & Pick Summary)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveOutputTab('schedule')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  activeOutputTab === 'schedule'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Part Schedule Format
              </button>
              <button
                onClick={() => setActiveOutputTab('manifest')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  activeOutputTab === 'manifest'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Trip Pick Manifest Format
              </button>
            </div>
          </div>

          <div className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto shadow-inner whitespace-pre-wrap leading-relaxed select-all">
            {activeOutputTab === 'schedule'
              ? shiftTripMapping.formattedTextOutput
              : shiftTripMapping.formattedTripManifestOutput}
          </div>
        </div>
      </div>

      {/* Main Stock Handover Ledger Table */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Line Point of Consumption (POC) Stock Handover Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comparing outgoing shift closing stock vs. recommended starting stock for incoming shift
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Optimal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Surplus
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Deficit
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-3">Part No</th>
                <th className="px-3 py-3">Part Description</th>
                <th className="px-3 py-3 text-center">Bin Cap</th>
                <th className="px-3 py-3 text-center bg-amber-500/5 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-x border-slate-200 dark:border-slate-800">
                  Outgoing Closing Stock ({currentShiftName.split(' ')[0]})
                </th>
                <th className="px-3 py-3 text-center bg-emerald-500/5 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-x border-slate-200 dark:border-slate-800">
                  Recommended Starting Stock ({nextShiftName.split(' ')[0]})
                </th>
                <th className="px-3 py-3 text-center">Stock Variance</th>
                <th className="px-3 py-3 text-center">Buffer Coverage</th>
                <th className="px-3 py-3 text-center">Delivery Lag (±2m)</th>
                <th className="px-3 py-3 text-center">Handover Status</th>
                <th className="px-3 py-3 text-center font-bold text-indigo-600 dark:text-indigo-300">Pre-Shift Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-xs">
              {partHandoverList.map((item, idx) => {
                const isDeficit = item.status === 'Deficit';
                const isSurplus = item.status === 'Surplus';

                return (
                  <tr key={`${item.part.partNo}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{item.part.partNo}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-sans truncate max-w-[180px]">
                      {item.part.description}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 dark:text-slate-400">{item.part.binCapacity} u</td>

                    {/* Outgoing Closing Stock */}
                    <td className="px-3 py-2.5 text-center font-bold text-amber-700 dark:text-amber-300 bg-amber-500/[0.02] dark:bg-amber-950/10 border-x border-slate-200 dark:border-slate-800">
                      <span>{item.closingStockTrolleys} trolleys</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-normal">({item.closingStockUnits} units)</span>
                    </td>

                    {/* Recommended Starting Stock */}
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/[0.02] dark:bg-emerald-950/10 border-x border-slate-200 dark:border-slate-800">
                      <span>{item.recommendedStartingTrolleys} trolleys</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-normal">({item.recommendedStartingUnits} units)</span>
                    </td>

                    {/* Stock Variance */}
                    <td className="px-3 py-2.5 text-center font-bold">
                      <span className={item.stockVarianceUnits >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {item.stockVarianceUnits > 0 ? `+${item.stockVarianceUnits}` : item.stockVarianceUnits} u
                      </span>
                      <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-normal">
                        ({item.stockVarianceTrolleys > 0 ? `+${item.stockVarianceTrolleys}` : item.stockVarianceTrolleys} trolleys)
                      </span>
                    </td>

                    {/* Buffer Coverage */}
                    <td className="px-3 py-2.5 text-center font-bold text-cyan-600 dark:text-cyan-300">
                      {item.coverageHours} Hours
                    </td>
                    {/* Delivery Lag */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${item.lagTimeMinutes < -2 ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-500/40' : item.lagTimeMinutes > 2 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-500/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-500/40'}`}>
                        {item.nextDeliveryTimeStatus}
                      </span>
                      <span className="text-[9px] text-slate-500 block font-normal mt-0.5">Next: {item.stockDurationMinutes}m</span>
                    </td>
                    {/* Handover Status */}
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          isDeficit
                            ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40 animate-pulse'
                            : isSurplus
                            ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/40'
                            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                        }`}
                      >
                        {isDeficit && <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400" />}
                        {isSurplus && <TrendingUp className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />}
                        {!isDeficit && !isSurplus && <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />}
                        {item.status}
                      </span>
                    </td>

                    {/* Pre-Shift Action */}
                    <td className="px-3 py-2.5 text-center font-bold">
                      {item.preShiftTripsNeeded > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/80 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-500/50">
                          Dispatch {item.preShiftTripsNeeded} Trip(s)
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-normal">No Action Required</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Handover Operations Checklist & Sign-off Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Checklist */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            Shift Handover Verification Protocol Checklist
          </h3>

          <div className="space-y-2.5 text-xs">
            <label className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.lineClear}
                onChange={() => toggleChecklistItem('lineClear')}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Line Point of Consumption (POC) clean and free from obsolete empty bins
              </span>
            </label>

            <label className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.equipmentInspected}
                onChange={() => toggleChecklistItem('equipmentInspected')}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Material handling equipment (Jumbo Trolleys, BOVs, HPT) safety inspected
              </span>
            </label>

            <label className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.emptyTrolleysReturned}
                onChange={() => toggleChecklistItem('emptyTrolleysReturned')}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                All empty trolleys returned to main supermarket storage dock
              </span>
            </label>

            <label className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.operatorAttendanceVerified}
                onChange={() => toggleChecklistItem('operatorAttendanceVerified')}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Incoming shift operator attendance and route assignment confirmed
              </span>
            </label>

            <label className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.emergencyBuffersIntact}
                onChange={() => toggleChecklistItem('emergencyBuffersIntact')}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Emergency buffer safety stock validated across high-criticality parts
              </span>
            </label>
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between font-mono ${
            allChecklistCompleted
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
          }`}>
            <span>Checklist Protocol Status:</span>
            <span className="font-bold">
              {allChecklistCompleted ? '✓ 100% Verified Ready for Shift Start' : '⚠️ Verification Pending'}
            </span>
          </div>
        </div>

        {/* Supervisor Sign-off & Notes Panel */}
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            Supervisor Digital Sign-off & Handover Log
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">Outgoing Shift Lead / Supervisor</label>
              <input
                type="text"
                value={outgoingSupervisor}
                onChange={(e) => setOutgoingSupervisor(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">Incoming Shift Lead / Supervisor</label>
              <input
                type="text"
                value={incomingSupervisor}
                onChange={(e) => setIncomingSupervisor(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-emerald-700 dark:text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1 font-medium">Handover Observations & Notes</label>
              <textarea
                rows={3}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => {
                advanceShift();
                alert(`Shift Handover completed successfully!\nAdvanced to ${nextShiftName}.`);
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg border border-emerald-400/40 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Supervisor Sign-off & Execute Handover</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
