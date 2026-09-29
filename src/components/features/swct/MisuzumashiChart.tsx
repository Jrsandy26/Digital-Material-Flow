import React, { useState, useMemo } from 'react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { getInitialStockUnits } from '../../../utils/calculations';
import { 
  ZoomIn, 
  ZoomOut, 
  Clock, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  Info,
  Maximize2,
  FileDown,
  ChevronRight
} from 'lucide-react';

export interface SWCTCycleStep {
  id: string;
  operation: string;
  pickTime: number;
  consumption: {
    label: string;
    description?: string;
    mins: number;
    trolleys?: number;
    units?: number;
    vehiclesDemand?: number;
    initialStockUnits?: number;
    initialCoverageMins?: number;
    initialVehiclesDemand?: number;
    deliveryTimeMin?: number;
    consumeStartMin?: number;
    consumeEndMin?: number;
    totalBufferFromDeliveryMin?: number;
    statement?: string;
  }[];
  emptyTime: number;
  startTimeSec?: number;
  leadTimeToPocSec?: number;
  minBatchCoverageSec?: number;
  steps: {
    type: 'Manual' | 'Walking' | 'Waiting';
    duration: number;
    label: string;
  }[];
}

export interface MisuzumashiChartProps {
  swctCycleSteps: SWCTCycleStep[];
  selectedHour?: number;
  onSelectHour?: (hour: number) => void;
  windowLabel?: string;
  totalShiftTrips?: number;
  timelineScheduleMode?: 'takt_interval' | 'consecutive';
  onScheduleModeChange?: (mode: 'takt_interval' | 'consecutive') => void;
  tripDemandSource?: 'uploaded_bins' | 'takt_rate';
  onDemandSourceChange?: (src: 'uploaded_bins' | 'takt_rate') => void;
  onDownloadPDF?: () => void;
  onDownloadExcel?: () => void;
}

export const MisuzumashiChart: React.FC<MisuzumashiChartProps> = ({ 
  swctCycleSteps,
  selectedHour = 1,
  onSelectHour,
  windowLabel = 'Hour 1 (06:00 - 07:00)',
  totalShiftTrips = 10,
  timelineScheduleMode = 'takt_interval',
  onScheduleModeChange,
  tripDemandSource = 'takt_rate',
  onDemandSourceChange,
  onDownloadPDF,
  onDownloadExcel
}) => {
  const { operatorName, selectedAssemblyLine, productionPlan, parts } = useMaterialFlow();

  // Column size scaling state: width per 5-minute increment (in pixels)
  // Options: Compact (75px), Standard (105px), Wide (145px), Ultra (190px)
  const [colWidth5Min, setColWidth5Min] = useState<number>(105);

  const firstTripForPart = useMemo(() => {
    const map: Record<string, number> = {};
    swctCycleSteps.forEach((step, idx) => {
      if (step.consumption) {
        step.consumption.forEach((c) => {
          const pNo = c.label;
          if (map[pNo] === undefined) {
            map[pNo] = idx;
          }
        });
      }
    });
    return map;
  }, [swctCycleSteps]);

  // Dynamic Timeline Span Calculation based on available trips in this timeline window
  const { timelineMaxMin, timeIncrements } = useMemo(() => {
    let latestMin = 0;

    swctCycleSteps.forEach((step) => {
      const tripStartMin = (step.startTimeSec || 0) / 60;
      const totalStepsMin = step.steps.reduce((acc, s) => acc + s.duration, 0) / 60;
      const tripEndMin = tripStartMin + totalStepsMin;

      let maxConsMin = 0;
      if (step.consumption && step.consumption.length > 0) {
        maxConsMin = Math.max(...step.consumption.map(c => c.mins));
      }
      
      const leadTimeMin = step.leadTimeToPocSec ? step.leadTimeToPocSec / 60 : 2;
      const consumptionEndMin = tripStartMin + leadTimeMin + maxConsMin;

      latestMin = Math.max(latestMin, tripEndMin, consumptionEndMin);
    });

    // Ensure baseline is at least 60 min for standard hour, or dynamic for extended shift
    const baseMin = selectedHour === 0 ? 90 : 60;
    const requiredMin = Math.max(baseMin, latestMin + 5);
    // Round up to nearest 5 minutes
    const roundedMaxMin = Math.ceil(requiredMin / 5) * 5;

    const numBlocks = Math.ceil(roundedMaxMin / 5);
    const increments = Array.from({ length: numBlocks }, (_, i) => (i + 1) * 5);

    return {
      timelineMaxMin: roundedMaxMin,
      timeIncrements: increments
    };
  }, [swctCycleSteps, selectedHour]);

  // Width of the timeline area in pixels
  const timelineWidthPx = (timelineMaxMin / 5) * colWidth5Min;
  const pixelsPerMinute = timelineWidthPx / timelineMaxMin;

  const neededParts = productionPlan.shiftPlanVehicles * 3;

  // Zoom handlers
  const handleZoomIn = () => setColWidth5Min(prev => Math.min(220, prev + 25));
  const handleZoomOut = () => setColWidth5Min(prev => Math.max(65, prev - 25));

  // Determine standard total rows: at least 12 rows or available trips + 3 for clean sheet layout
  const totalRowsCount = Math.max(12, swctCycleSteps.length + 3);

  return (
    <div className="w-full flex flex-col gap-4 font-sans">
      
      {/* 1. DYNAMIC CONTROLS & TIMELINE WINDOW TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Left: Timeline Window Quick Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Timeline Window:
          </span>

          {onSelectHour && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectHour(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedHour === 0
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Full Shift
              </button>

              {[1, 2, 3, 4, 5, 6, 7, 8].map((hr) => {
                const isActive = selectedHour === hr;
                const slot = productionPlan.hourlyBreakdown?.[hr - 1];
                const hrLabel = slot ? slot.hourSlot.replace(' (Planned)', '') : `Hour ${hr}`;
                return (
                  <button
                    key={hr}
                    type="button"
                    onClick={() => onSelectHour(hr)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {hrLabel}
                  </button>
                );
              })}
            </div>
          )}

          <div className="ml-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            {swctCycleSteps.length} Trips Available
          </div>
        </div>

        {/* Right: Column Width / Zoom Scaling Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 px-2 uppercase">Column Size:</span>
            {[
              { label: 'Compact', width: 75 },
              { label: 'Standard', width: 105 },
              { label: 'Wide', width: 145 },
              { label: 'Ultra', width: 190 }
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setColWidth5Min(preset.width)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  colWidth5Min === preset.width
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={colWidth5Min <= 65}
              title="Decrease Column Width"
              className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-500 min-w-[28px] text-center">
              {colWidth5Min}px
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={colWidth5Min >= 220}
              title="Increase Column Width"
              className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* PDF and Excel export buttons */}
          <div className="flex items-center gap-2">
            {onDownloadPDF && (
              <button
                type="button"
                onClick={onDownloadPDF}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-amber-400" />
                Export PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. THE MAIN MISUZUMASHI SHEET */}
      <div className="w-full bg-white dark:bg-slate-950 p-3 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto text-black font-sans">
        
        {/* Dynamic Sheet Matrix Container with Explicit Columns & Sticky Left Panes */}
        <div 
          className="border-2 border-black bg-white text-black text-[11px] leading-tight flex flex-col select-none"
          style={{ width: `${864 + timelineWidthPx}px` }}
        >

          {/* SHEET TITLE BAR */}
          <div className="flex border-b-2 border-black bg-slate-50">
            <div className="flex-1 flex flex-col sm:flex-row items-center justify-between px-4 py-2 border-r-2 border-black">
              <div className="font-extrabold text-base tracking-wider uppercase text-slate-950">
                Misuzumashi — Standardized Work Combination Table (SWCT)
              </div>
              <div className="text-xs font-semibold text-slate-600 mt-1 sm:mt-0 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold border border-blue-300">
                  Window: {windowLabel}
                </span>
                <span className="text-slate-500">
                  Total Timeline Span: {timelineMaxMin} mins
                </span>
              </div>
            </div>
            <div className="w-56 p-2 flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-800 text-center">
              TPS Material Replenishment Standard
            </div>
          </div>

          {/* MAIN HEADER MATRIX */}
          <div className="flex border-b-2 border-black">
            
            {/* Top Left Corner: Diagonal Split */}
            <div className="w-16 min-w-[64px] border-r-2 border-black relative bg-white h-14">
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100%" y2="100%" stroke="black" strokeWidth="1.5" />
              </svg>
              <div className="absolute top-1 right-1 text-[9px] font-bold text-slate-800 leading-tight text-right">
                Product<br/>No.
              </div>
              <div className="absolute bottom-1 left-1 text-[9px] font-bold text-slate-800 leading-tight">
                Product<br/>Name
              </div>
            </div>

            {/* Department / Operation Matrix Block */}
            <div className="w-[352px] min-w-[352px] border-r-2 border-black flex flex-col bg-white">
              <div className="flex-1 border-b border-black flex items-center px-3 font-bold text-xs bg-slate-50">
                <span>Misuzumashi</span>
              </div>
            </div>

            {/* Time / Model Specifications */}
            <div className="w-24 min-w-[96px] border-r-2 border-black flex flex-col justify-center items-center text-center p-1 bg-white">
              <div className="text-[9px] uppercase font-bold text-slate-500">Pick Phase</div>
              <div className="font-mono font-bold text-xs text-slate-900">Standard</div>
            </div>

            {/* Consumption Column Header Block */}
            <div className="w-64 min-w-[260px] border-r-2 border-black flex flex-col justify-center px-2 py-1 bg-white">
              <div className="text-[10px] font-bold text-red-700 uppercase flex items-center justify-between">
                <span>Line Inventory Drain</span>
                <span className="text-[9px] bg-red-100 text-red-800 px-1 rounded border border-red-300">Non-Overlapping</span>
              </div>
              <div className="text-[9px] text-slate-500">Calculated Batch Coverage (mins)</div>
            </div>

            {/* Empty Return Header Block */}
            <div className="w-24 min-w-[96px] border-r-2 border-black flex flex-col justify-center items-center text-center p-1 bg-white">
              <div className="text-[9px] uppercase font-bold text-slate-500">Empty Return</div>
              <div className="font-mono font-bold text-xs text-slate-900">Standard</div>
            </div>

            {/* Metadata Section */}
            <div className="w-80 min-w-[320px] border-r-2 border-black flex flex-col bg-white">
              <div className="flex flex-1 border-b border-black text-[10px]">
                <div className="w-16 border-r border-black p-1 font-bold text-slate-600 bg-slate-50">Date</div>
                <div className="flex-1 border-r border-black p-1 font-semibold text-center">{new Date().toLocaleDateString()}</div>
                <div className="w-32 p-1 font-semibold text-center text-slate-800">Needed/Day: <span className="font-bold">{neededParts}</span></div>
              </div>
              <div className="flex flex-1 text-[10px]">
                <div className="w-16 border-r border-black p-1 font-bold text-slate-600 bg-slate-50">Dept</div>
                <div className="flex-1 border-r border-black p-1 font-bold text-center text-blue-700">{selectedAssemblyLine}</div>
                <div className="w-32 p-1 font-semibold text-center text-slate-800">Takt Time: <span className="font-bold">{productionPlan.taktTimeSeconds}s</span></div>
              </div>
            </div>

            {/* Legend Section */}
            <div className="flex-1 flex flex-col text-[10px] bg-white min-w-[340px]">
              <div className="flex-1 flex items-center px-3 border-b border-black bg-white">
                <div className="w-8 h-3 bg-yellow-300 mr-2.5 border border-black shadow-xs shrink-0"></div> 
                <span className="font-semibold text-slate-800">Pick load and placing (Manual/Handling)</span>
              </div>
              <div className="flex-1 flex items-center px-3 border-b border-black bg-white">
                <div className="w-8 border-t-[2.5px] border-dashed border-red-500 mr-2.5 shrink-0"></div> 
                <span className="font-bold text-red-600">Inventory Drain (Individual Part Lanes)</span>
              </div>
              <div className="flex-1 flex items-center px-3 bg-white">
                <svg className="w-8 h-3 mr-2.5 shrink-0" viewBox="0 0 32 12" preserveAspectRatio="none">
                  <path d="M 0 6 Q 4 0, 8 6 T 16 6 T 24 6 T 32 6" fill="none" stroke="blue" strokeWidth="2" />
                </svg> 
                <span className="font-semibold text-blue-700">Empty picking & placing / Moving</span>
              </div>
            </div>

          </div>

          {/* SUB-HEADER: COLUMN LABELS & TIMELINE AXIS */}
          <div className="flex border-b-2 border-black font-bold text-center bg-slate-50 text-slate-900 h-12">
            
            {/* Left Data Column Titles (Sticky Left Panes) */}
            <div className="w-16 min-w-[64px] p-1 border-r border-black flex items-center justify-center text-xs">
              Order
            </div>
            <div className="w-[352px] min-w-[352px] p-1 border-r border-black flex items-center justify-center text-xs">
              Operation / Materials Delivered
            </div>
            <div className="w-24 min-w-[96px] p-1 border-r border-black flex flex-col items-center justify-center text-[10px] leading-tight">
              <span>Pick time</span>
              <span className="text-[8px] font-normal text-slate-500">(Seconds)</span>
            </div>
            <div className="w-64 min-w-[260px] p-1 border-r border-black flex flex-col items-center justify-center text-[10px] leading-tight text-red-700 bg-red-50/40">
              <span className="font-bold">Consumption time</span>
              <span className="text-[8px] font-normal text-red-500">(Part Minutes Breakdown)</span>
            </div>
            <div className="w-24 min-w-[96px] p-1 border-r-2 border-black flex flex-col items-center justify-center text-[10px] leading-tight">
              <span>Empty Time</span>
              <span className="text-[8px] font-normal text-slate-500">(Seconds)</span>
            </div>

            {/* Timeline Axis Header */}
            <div 
              className="flex bg-slate-50 relative"
              style={{ width: `${timelineWidthPx}px` }}
            >
              {timeIncrements.map((t, i) => (
                <div 
                  key={t} 
                  className="flex flex-col justify-between border-r border-black pb-1 relative"
                  style={{ width: `${colWidth5Min}px` }}
                >
                  <div className="text-[9px] text-slate-400 font-mono text-center pt-0.5">
                    {t - 5}m
                  </div>
                  
                  {/* Fine 1-minute sub-tick marks along bottom of header */}
                  <div className="flex w-full items-end justify-between px-0.5 pb-0.5">
                    <span className="w-px h-1 bg-slate-300"></span>
                    <span className="w-px h-1 bg-slate-300"></span>
                    <span className="w-px h-1 bg-slate-300"></span>
                    <span className="w-px h-1 bg-slate-300"></span>
                    <span className="w-px h-2 bg-slate-600"></span>
                  </div>

                  <div className="absolute right-1 bottom-0.5 text-xs font-black text-slate-950 font-mono">
                    {t}
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* SHEET BODY ROWS: DYNAMICALLY GENERATED FOR TIMELINE WINDOW */}
          <div className="flex flex-col bg-white">
            {Array.from({ length: totalRowsCount }).map((_, rowIndex) => {
              const rowData = swctCycleSteps[rowIndex];
              const isTripRow = Boolean(rowData);

              // Dynamic row height based on consumption count to guarantee NO overlapping
              const numParts = rowData?.consumption?.length || 1;
              const rowHeightPx = isTripRow ? Math.max(68, 42 + (numParts * 32)) : 38;

              return (
                <div 
                  key={rowIndex} 
                  className={`flex border-b border-black relative transition-colors ${
                    isTripRow ? 'hover:bg-slate-50/80 group' : 'bg-white/60'
                  }`}
                  style={{ height: `${rowHeightPx}px` }}
                >

                  {/* 1. Order Number */}
                  <div className="w-16 min-w-[64px] border-r border-black flex items-center justify-center font-bold text-xs bg-white group-hover:bg-slate-50">
                    {isTripRow ? (
                      <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-900 font-bold">
                        {rowIndex + 1}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-mono">{rowIndex + 1}</span>
                    )}
                  </div>

                  {/* 2. Operation / Materials Delivered */}
                  <div className="w-[352px] min-w-[352px] border-r border-black px-3 py-1.5 flex flex-col justify-center bg-white group-hover:bg-slate-50 text-[11px] leading-tight overflow-hidden">
                    {rowData ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pb-0.5 border-b border-slate-100">
                          <span className="font-extrabold text-blue-700">Trip {rowIndex + 1} ({rowData.id})</span>
                          <span className="text-[9px] bg-blue-50 text-blue-800 px-1 rounded font-bold border border-blue-200">
                            {rowData.consumption?.length || 1} Parts Delivered
                          </span>
                        </div>
                        {rowData.consumption && rowData.consumption.length > 0 ? (
                          rowData.consumption.map((cons, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 leading-snug">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                              <span className="whitespace-normal break-words" title={cons.description || cons.label}>
                                {cons.description || cons.label} {cons.trolleys ? `(${cons.trolleys} Trolley${cons.trolleys > 1 ? 's' : ''})` : ''}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="font-bold text-slate-900 whitespace-normal break-words">
                            {rowData.operation}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-300 italic text-[10px]">— Standard Work Step —</div>
                    )}
                  </div>

                  {/* 3. Pick Time */}
                  <div className="w-24 min-w-[96px] border-r border-black flex items-center justify-center font-mono font-bold text-xs text-slate-900 bg-white group-hover:bg-slate-50">
                    {rowData ? (
                      <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-[11px]">
                        {rowData.pickTime}s
                      </span>
                    ) : ''}
                  </div>

                  {/* 4. Consumption Time (Expanded Column with Clear Part Breakdown, Demand & Delivery Time) */}
                  <div className="w-72 min-w-[280px] border-r border-black px-2 py-1 flex flex-col justify-center gap-1 bg-white group-hover:bg-slate-50 overflow-hidden">
                    {rowData && rowData.consumption && rowData.consumption.length > 0 ? (
                      rowData.consumption.map((cons, cIdx) => {
                        const partName = cons.description || cons.label || `Part #${cIdx + 1}`;
                        const partInfo = parts?.find(p => p.partNo === cons.label);
                        const usage = partInfo?.usagePerVehicle || 1;
                        const pcs = cons.units || ((cons.trolleys || 1) * (partInfo?.binCapacity || 1));
                        const vehDemand = cons.vehiclesDemand !== undefined ? cons.vehiclesDemand : Math.round(pcs / usage);
                        const consStart = cons.consumeStartMin !== undefined ? `${cons.consumeStartMin}m` : null;
                        const consEnd = cons.consumeEndMin !== undefined ? `${cons.consumeEndMin}m` : null;
                        return (
                          <div 
                            key={cIdx} 
                            className="flex flex-col text-[10px] bg-red-50/80 border border-red-200 rounded px-1.5 py-1"
                            title={cons.statement || `${partName} - ${cons.mins}m buffer (${vehDemand} veh demand)`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate max-w-[170px] font-bold text-slate-900">
                                {partName} {cons.trolleys ? `(${cons.trolleys} Tr)` : `(${pcs} pcs)`}
                              </span>
                              <span className="font-mono font-extrabold text-red-600 shrink-0 ml-1">
                                {cons.mins}m
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-600">
                                Demand: {vehDemand} veh
                              </span>
                              {consStart !== null && consEnd !== null && (
                                <span className="font-mono text-slate-600">
                                  Cons: {consStart} → {consEnd}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : rowData ? (
                      <span className="text-slate-400 italic text-[10px]">No parts allocated</span>
                    ) : null}
                  </div>

                  {/* 5. Empty Time */}
                  <div className="w-24 min-w-[96px] border-r-2 border-black flex items-center justify-center font-mono font-bold text-xs text-slate-900 bg-white group-hover:bg-slate-50">
                    {rowData ? (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-[11px]">
                        {rowData.emptyTime}s
                      </span>
                    ) : ''}
                  </div>

                  {/* 6. Dynamic Timeline Graph Area */}
                  <div 
                    className="flex relative bg-white"
                    style={{ width: `${timelineWidthPx}px` }}
                  >
                    {/* Background Grid Lines (1 line per minute, bold border every 5th minute) */}
                    {Array.from({ length: timelineMaxMin }).map((_, mIdx) => {
                      const is5Min = mIdx % 5 === 4;
                      return (
                        <div 
                          key={mIdx} 
                          className={`h-full border-r ${is5Min ? 'border-black' : 'border-slate-200'}`}
                          style={{ width: `${colWidth5Min / 5}px` }}
                        />
                      );
                    })}

                    {/* Active Cycle Elements Drawing */}
                    {rowData && (
                      <div className="absolute top-0 left-0 h-full w-full pointer-events-none">
                        {(() => {
                          const tripStartMin = (rowData.startTimeSec || 0) / 60;
                          let currentLeftMin = tripStartMin;
                          let unloadEndTimeMin = 0;

                          const elements: React.ReactNode[] = [];

                          // A. Draw Operation Steps (Loading, Moving, Unloading, Empty Pick, Moving Return, Empty Drop)
                          rowData.steps.forEach((step, sIdx) => {
                            const durationMin = step.duration / 60;
                            const leftPx = currentLeftMin * pixelsPerMinute;
                            const widthPx = Math.max(14, durationMin * pixelsPerMinute);

                            if (step.label === 'Unloading') {
                              unloadEndTimeMin = currentLeftMin + durationMin;
                            }

                            currentLeftMin += durationMin;

                            const isManual = step.type === 'Manual' || step.label === 'Loading' || step.label === 'Unloading' || step.label === 'Empty Pick' || step.label === 'Empty Drop';

                            if (isManual) {
                              // Yellow box with black outline (Handling work)
                              elements.push(
                                <div 
                                  key={`step-${sIdx}`} 
                                  className="absolute top-[8px] h-[18px] bg-yellow-300 border border-black shadow-2xs z-10 flex items-center justify-center text-[9px] font-bold text-slate-900 px-1 pointer-events-auto"
                                  style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                                  title={`${step.label}: ${step.duration}s (${durationMin.toFixed(2)}m)`}
                                >
                                  <span className="truncate font-mono">{durationMin >= 0.4 ? `${step.duration}s` : ''}</span>
                                </div>
                              );
                            } else {
                              // Wavy Blue Path for Moving / Transit / Return
                              elements.push(
                                <div 
                                  key={`step-${sIdx}`} 
                                  className="absolute top-[2px] h-[26px] flex flex-col items-center justify-center z-10 pointer-events-auto"
                                  style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                                  title={`${step.label}: ${step.duration}s (${durationMin.toFixed(2)}m)`}
                                >
                                  {/* Duration in Minutes above the moving line */}
                                  <div className="text-[9px] font-mono font-extrabold text-blue-800 bg-white/95 px-1 rounded leading-tight mb-0.5 border border-blue-300 shadow-2xs">
                                    {durationMin.toFixed(1)}m
                                  </div>
                                  <svg className="w-full h-3" preserveAspectRatio="none" viewBox="0 0 100 12">
                                    <path 
                                      d="M 0 6 Q 12.5 0, 25 6 T 50 6 T 75 6 T 100 6" 
                                      fill="none" 
                                      stroke="#1d4ed8" 
                                      strokeWidth="2.5" 
                                      vectorEffect="non-scaling-stroke" 
                                    />
                                  </svg>
                                </div>
                              );
                            }
                          });

                          // B. Vertical Black Line Connecting Trip i End to Trip i+1 Start
                          const nextRow = swctCycleSteps[rowIndex + 1];
                          if (nextRow && rowIndex < swctCycleSteps.length - 1) {
                            const nextStartMin = (nextRow.startTimeSec || 0) / 60;
                            const dropLeftPx = currentLeftMin * pixelsPerMinute;
                            const nextStartPx = nextStartMin * pixelsPerMinute;
                            
                            // Vertical drop line at trip end
                            elements.push(
                              <div 
                                key="drop-line-v" 
                                className="absolute top-[14px] border-l-2 border-black z-30 pointer-events-none"
                                style={{ 
                                  left: `${dropLeftPx}px`, 
                                  height: `${rowHeightPx}px` 
                                }}
                                title={`Trip ${rowIndex + 1} End -> Trip ${rowIndex + 2} Start Handover`}
                              />
                            );

                            // If there is a small gap to next trip start, connect with horizontal baseline
                            if (Math.abs(nextStartPx - dropLeftPx) > 1) {
                              const startX = Math.min(dropLeftPx, nextStartPx);
                              const gapW = Math.abs(nextStartPx - dropLeftPx);
                              elements.push(
                                <div
                                  key="drop-line-h"
                                  className="absolute top-[14px] border-t-2 border-black z-30 pointer-events-none"
                                  style={{
                                    left: `${startX}px`,
                                    width: `${gapW}px`,
                                    transform: `translateY(${rowHeightPx}px)`
                                  }}
                                />
                              );
                            }
                          }

                           // C. Dedicated Inventory Consumption Lanes (Zero Overlap!)
                          if (unloadEndTimeMin > 0 && rowData.consumption && rowData.consumption.length > 0) {
                            rowData.consumption.forEach((cons, cIdx) => {
                              const partInfo = parts?.find(p => p.partNo === cons.label);
                              const partName = cons.description || cons.label;
                              const usage = partInfo?.usagePerVehicle || 1;
                              const binCap = partInfo?.binCapacity || 1;
                              const pcs = cons.units || ((cons.trolleys || 1) * binCap);
                              const vehDemand = cons.vehiclesDemand !== undefined ? cons.vehiclesDemand : Math.round(pcs / usage);

                              // Consumption window: start at consumeStartMin (or unloadEndTimeMin), duration cons.mins
                              const consStartMin = cons.consumeStartMin !== undefined ? cons.consumeStartMin : unloadEndTimeMin;
                              const consEndMin = cons.consumeEndMin !== undefined ? cons.consumeEndMin : (consStartMin + cons.mins);
                              const invStartPx = consStartMin * pixelsPerMinute;
                              const consWidthPx = cons.mins * pixelsPerMinute;
                              const invEndPx = invStartPx + consWidthPx;
                              
                              // Dedicated Vertical Track with offset sub-lanes to guarantee NO overlapping
                              const trackYPx = 34 + (cIdx * 32);
                              const initialTrackYPx = trackYPx - 8;
                              const deliveredTrackYPx = trackYPx + 10;

                              // Prepend Initial Stock Coverage only if user has entered initial stock (> 0)
                              const isFirstTripForPart = rowIndex === firstTripForPart[cons.label];
                              if (isFirstTripForPart) {
                                const initialUnits = partInfo ? getInitialStockUnits(partInfo) : 0;
                                if (initialUnits > 0) {
                                  const initialTrolleys = Number((initialUnits / binCap).toFixed(1));
                                  const taktTime = productionPlan?.taktTimeSeconds || (3600 / (productionPlan?.hourlyPlanVehicles || 129));
                                  const initialCoverageMin = cons.initialCoverageMins !== undefined
                                    ? cons.initialCoverageMins
                                    : Number((((initialUnits / usage) * taktTime) / 60).toFixed(2));
                                  const initialVehDemand = cons.initialVehiclesDemand !== undefined
                                    ? cons.initialVehiclesDemand
                                    : Math.round(initialUnits / usage);

                                  const initWidthPx = initialCoverageMin * pixelsPerMinute;

                                  // Initial Stock Amber/Orange Dashed Line
                                  elements.push(
                                    <div 
                                      key={`init-inv-line-${cIdx}`}
                                      className="absolute border-t-[2.5px] border-dashed border-amber-500 z-10 pointer-events-auto cursor-help"
                                      style={{ 
                                        left: `0px`, 
                                        width: `${initWidthPx}px`,
                                        top: `${initialTrackYPx}px` 
                                      }}
                                      title={`Initial Stock [${initialTrolleys} ${partInfo?.binOrTrolley || 'Trolley'}] - ${partName}: ${initialCoverageMin.toFixed(1)} mins buffer (${initialVehDemand} veh demand, consumed 0.0m to ${initialCoverageMin.toFixed(1)}m)`}
                                    >
                                      {/* Solid Amber End Tick */}
                                      <div className="absolute right-0 -top-[5px] h-[11px] border-r-2 border-amber-600"></div>
                                    </div>
                                  );

                                  // Initial Stock Badge
                                  elements.push(
                                    <div
                                      key={`init-inv-badge-${cIdx}`}
                                      className="absolute z-20 flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded shadow-xs text-[9px] whitespace-nowrap select-none -translate-y-1/2"
                                      style={{
                                        left: `${initWidthPx + 4}px`,
                                        top: `${initialTrackYPx}px`
                                      }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                      <span className="text-slate-700 font-semibold truncate max-w-[90px]">
                                        Initial {partName}:
                                      </span>
                                      <span className="font-mono text-amber-800 font-extrabold">
                                        {initialCoverageMin.toFixed(1)}m ({initialVehDemand} veh)
                                      </span>
                                    </div>
                                  );
                                }
                              }

                              // If part was delivered before previous stock exhausted, draw subtle queue/buffer indicator
                              if (consStartMin > unloadEndTimeMin + 0.1) {
                                const stagingStartPx = unloadEndTimeMin * pixelsPerMinute;
                                const stagingWidthPx = (consStartMin - unloadEndTimeMin) * pixelsPerMinute;
                                elements.push(
                                  <div
                                    key={`staging-line-${cIdx}`}
                                    className="absolute border-t-[1.5px] border-dotted border-blue-400/80 z-5 pointer-events-auto cursor-help"
                                    style={{
                                      left: `${stagingStartPx}px`,
                                      width: `${stagingWidthPx}px`,
                                      top: `${deliveredTrackYPx}px`
                                    }}
                                    title={`Staged Line-Side Buffer: Delivered at ${unloadEndTimeMin.toFixed(1)}m, staged until consumption starts at ${consStartMin.toFixed(1)}m`}
                                  />
                                );
                              }

                              // Red Dashed Consumption Line (Delivered Part)
                              elements.push(
                                <div 
                                  key={`inv-line-${cIdx}`}
                                  className="absolute border-t-[2.5px] border-dashed border-red-500 z-10 pointer-events-auto cursor-help"
                                  style={{ 
                                    left: `${invStartPx}px`, 
                                    width: `${consWidthPx}px`,
                                    top: `${deliveredTrackYPx}px` 
                                  }}
                                  title={cons.statement || `${partName}: ${cons.mins} mins buffer (${vehDemand} veh demand, consumed from ${consStartMin.toFixed(1)}m to ${consEndMin.toFixed(1)}m)`}
                                >
                                  {/* Solid Red End Tick */}
                                  <div className="absolute right-0 -top-[5px] h-[11px] border-r-2 border-red-600"></div>
                                </div>
                              );

                              // High-Contrast Callout Badge at End of Line (Delivered Part)
                              const isNearRightEdge = invEndPx + 120 > timelineWidthPx;
                              elements.push(
                                <div
                                  key={`inv-badge-${cIdx}`}
                                  className={`absolute z-20 flex items-center gap-1 bg-white text-red-700 border border-red-300 font-bold px-1.5 py-0.5 rounded shadow-xs text-[9px] whitespace-nowrap select-none -translate-y-1/2 ${
                                    isNearRightEdge ? '-translate-x-full pr-1.5' : 'pl-1.5'
                                  }`}
                                  style={{
                                    left: `${isNearRightEdge ? invEndPx - 4 : invEndPx + 4}px`,
                                    top: `${deliveredTrackYPx}px`
                                  }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                  <span className="text-slate-700 font-semibold max-w-[85px] truncate" title={partName}>
                                    {partName}:
                                  </span>
                                  <span className="font-mono text-red-600 font-extrabold">
                                    {cons.mins}m ({vehDemand} veh)
                                  </span>
                                </div>
                              );
                            });
                          }

                          return elements;
                        })()}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {/* FOOTER SUMMARY BAR */}
          <div className="flex border-t-2 border-black bg-slate-50 text-[10px] font-semibold text-slate-700 p-2 justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-900">Summary Status:</span>
              <span>Available Trips in Sheet: <strong className="text-blue-700">{swctCycleSteps.length}</strong></span>
              <span>•</span>
              <span>Timeline Window: <strong className="text-slate-900">{windowLabel}</strong></span>
              <span>•</span>
              <span>Timeline Scaling: <strong className="text-slate-900">{colWidth5Min}px per 5-min interval</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 font-mono">
              <span>Standard Toyota Production System (TPS) SWCT Sheet</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default MisuzumashiChart;
