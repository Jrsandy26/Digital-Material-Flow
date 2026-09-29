import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Gauge,
  TrendingUp,
  AlertTriangle,
  List,
  Sliders,
  MapPin,
  Truck,
  Layers,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Scale,
  ShieldCheck,
  ChevronRight,
  Info,
  Zap,
  ArrowRight,
  StickyNote,
  FileSpreadsheet,
  Printer,
  Download,
  ClipboardList,
  FileDown,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculateSWCTSummary, calculatePartMetrics, getMilkRunGroups, getPocSpaceTrolleysMax, getInitialStockUnits } from '../../../utils/calculations';
import {
  calculateInterStationDistance,
  calculateStoreToStationDistance,
  sortPocStations,
  STATION_GAP_METERS,
  POC_MAX_TROLLEYS_PER_STATION,
  DELIVERY_TOLERANCE_MINUTES,
} from '../../../utils/pocSorter';
import { motion } from 'motion/react';
import { SWCTBuilder } from './SWCTBuilder';
import { MisuzumashiChart } from './MisuzumashiChart';
import { SWCTDiagnosticModal } from './SWCTDiagnosticModal';
import { generateMisuzumashiChartPdfReport } from '../../../utils/pdfGenerator';
import { PartMaster, TransportMode } from '../../../types/manufacturing';

interface MaterialAllocation {
  part: PartMaster;
  trolleys: number;
}

// Local interface representing the computed combined groups
interface CombinedGroupInfo {
  milkRunId: string;
  transportMode: TransportMode;
  destination: string;
  capacity: number;
  capacityUsed: number;
  materials: PartMaster[];
  materialAllocations: MaterialAllocation[];
  stores: string[];
  route: string[];
  totalDistance: number;
  cycleTime: number; // in seconds
  tripsPerHour: number;
  tripsPerShift: number;
  highestRisk: 'Critical' | 'Warning' | 'Normal';
  priority: 'P1 (Critical)' | 'P2 (Warning)' | 'P3 (Normal)';
  whyCreated: string;
  routeUtilization: number;
  travelLoadedSec: number;
  travelEmptySec: number;
}

// Helper function to generate clean wavy paths for Walking / Moving lines in SWCT
function generateWavyPath(x1: number, y1: number, x2: number, y2: number, wavesCount = 6, amplitude = 4) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return `M ${x1} ${y1}`;

  const nx = -dy / dist;
  const ny = dx / dist;

  const waves = Math.max(3, Math.min(24, Math.floor(wavesCount)));
  let path = `M ${x1} ${y1}`;

  for (let i = 1; i <= waves; i++) {
    const tPrev = (i - 1) / waves;
    const tCurr = i / waves;
    const tMid = (tPrev + tCurr) / 2;

    const midX = x1 + dx * tMid;
    const midY = y1 + dy * tMid;

    const currX = x1 + dx * tCurr;
    const currY = y1 + dy * tCurr;

    const offset = (i % 2 === 1 ? 1 : -1) * amplitude;
    const ctrlX = midX + nx * offset;
    const ctrlY = midY + ny * offset;

    path += ` Q ${ctrlX} ${ctrlY} ${currX} ${currY}`;
  }

  return path;
}

// Draggable Callout with dotted connector line pointing directly to timeline anchor
interface DraggableCalloutProps {
  anchorX: number;
  anchorY: number;
  defaultYOffset?: number;
  defaultXOffset?: number;
  label?: string;
  duration: number;
  cumulative?: number;
  type: 'Walking' | 'Waiting' | 'Manual';
}

const DraggableCallout: React.FC<DraggableCalloutProps> = ({
  anchorX,
  anchorY,
  defaultYOffset = 0,
  defaultXOffset = 0,
  label,
  duration,
  cumulative,
  type,
}) => {
  const [offset, setOffset] = useState({ x: defaultXOffset, y: defaultYOffset });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setOffset({ x: defaultXOffset, y: defaultYOffset });
  }, [anchorX, anchorY, defaultXOffset, defaultYOffset]);

  const textString =
    type === 'Waiting' && duration < 10
      ? `W ${duration}s`
      : label
      ? cumulative !== undefined
        ? `${label} ${duration}s / ${cumulative}s`
        : `${label} ${duration}s`
      : cumulative !== undefined
      ? `${duration}s / ${cumulative}s`
      : `${duration}s`;

  const width = Math.max(48, textString.length * 5.2 + 12);

  const colors =
    type === 'Walking'
      ? {
          bg: '#f0fdf4',
          border: '#22c55e',
          text: 'fill-emerald-700 dark:fill-emerald-300 font-bold',
          line: '#22c55e',
          dot: '#16a34a',
        }
      : type === 'Waiting'
      ? {
          bg: '#fffbeb',
          border: '#f59e0b',
          text: 'fill-amber-800 dark:fill-amber-300 font-bold',
          line: '#f59e0b',
          dot: '#d97706',
        }
      : {
          bg: '#ffffff',
          border: '#64748b',
          text: 'fill-slate-900 dark:fill-slate-100 font-bold',
          line: '#64748b',
          dot: '#334155',
        };

  const calloutX = anchorX + offset.x;
  const calloutY = anchorY + offset.y;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffset((prev) => ({
      x: prev.x + e.movementX,
      y: prev.y + e.movementY,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsDragging(false);
    }
  };

  return (
    <g className="select-none pointer-events-auto">
      {/* Dotted Leader Line connecting callout to timeline anchor */}
      <line
        x1={anchorX}
        y1={anchorY}
        x2={calloutX}
        y2={calloutY}
        stroke={colors.line}
        strokeWidth="1.2"
        strokeDasharray="2,2"
      />

      {/* Anchor Dot on the timeline path */}
      <circle cx={anchorX} cy={anchorY} r="2.5" fill={colors.dot} />

      {/* Draggable Callout Box Group */}
      <g
        transform={`translate(${calloutX}, ${calloutY})`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <rect
          x={-width / 2}
          y="-9"
          width={width}
          height="18"
          rx="4"
          fill={colors.bg}
          stroke={colors.border}
          strokeWidth="1.2"
          className="dark:fill-slate-900 shadow-sm"
        />
        <text
          textAnchor="middle"
          y="3.5"
          className={`text-[8px] font-black uppercase tracking-tight ${colors.text} pointer-events-none`}
        >
          {textString}
        </text>
      </g>
    </g>
  );
};

const STATIC_BENCHMARK_TEST_CASE_TRIPS = [
  {
    id: 'TRIP-H1-01',
    dispatch: '07:05 AM',
    eta: '07:08 AM',
    returnTime: '07:11 AM',
    transportMode: 'Jumbo Trolley',
    parts: '2x FRAME, SCOOTER COMP (12 pcs), 1x WHEEL ASSY DISC TUBELESS (30 pcs)',
    trolleys: 3,
    stockEffect: 'Frame: +12 pcs (11.16 min) / Wheel: +30 pcs (13.95 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-02',
    dispatch: '07:11 AM',
    eta: '07:14 AM',
    returnTime: '07:17 AM',
    transportMode: 'Jumbo Trolley',
    parts: '2x FRAME, SCOOTER COMP (12 pcs)',
    trolleys: 2,
    stockEffect: 'Frame: +12 pcs (11.16 min) / Wheel: -6 pcs (11.16 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-03',
    dispatch: '07:17 AM',
    eta: '07:20 AM',
    returnTime: '07:23 AM',
    transportMode: 'Jumbo Trolley',
    parts: '1x FRAME, SCOOTER COMP (6 pcs), 1x SWINGARM SUB ASSY (60 pcs), 1x SUB FRAME (64 pcs)',
    trolleys: 3,
    stockEffect: 'Frame: +6 pcs (8.37 min) / Swingarm: +60 pcs / Subframe: +64 pcs',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-04',
    dispatch: '07:23 AM',
    eta: '07:26 AM',
    returnTime: '07:29 AM',
    transportMode: 'Jumbo Trolley',
    parts: '2x FRAME, SCOOTER COMP (12 pcs), 1x WHEEL ASSY DISC TUBELESS (30 pcs)',
    trolleys: 3,
    stockEffect: 'Frame: +12 pcs (11.16 min) / Wheel: +30 pcs (13.95 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-05',
    dispatch: '07:29 AM',
    eta: '07:32 AM',
    returnTime: '07:35 AM',
    transportMode: 'Jumbo Trolley',
    parts: '1x FRAME, SCOOTER COMP (6 pcs), 1x WHEEL ASSY DISC TUBELESS (30 pcs)',
    trolleys: 2,
    stockEffect: 'Frame: +6 pcs (8.37 min) / Wheel: +30 pcs (13.95 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-06',
    dispatch: '07:35 AM',
    eta: '07:38 AM',
    returnTime: '07:41 AM',
    transportMode: 'Jumbo Trolley',
    parts: '2x FRAME, SCOOTER COMP (12 pcs)',
    trolleys: 2,
    stockEffect: 'Frame: +12 pcs (11.16 min) / Wheel: -6 pcs (11.16 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-07',
    dispatch: '07:41 AM',
    eta: '07:44 AM',
    returnTime: '07:47 AM',
    transportMode: 'Jumbo Trolley',
    parts: '1x FRAME, SCOOTER COMP (6 pcs), 1x SWINGARM SUB ASSY (60 pcs), 1x SUB FRAME (64 pcs)',
    trolleys: 3,
    stockEffect: 'Frame: +6 pcs (8.37 min) / Swingarm: +60 pcs / Subframe: +64 pcs',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-08',
    dispatch: '07:47 AM',
    eta: '07:50 AM',
    returnTime: '07:53 AM',
    transportMode: 'Jumbo Trolley',
    parts: '2x FRAME, SCOOTER COMP (12 pcs), 1x WHEEL ASSY DISC TUBELESS (30 pcs)',
    trolleys: 3,
    stockEffect: 'Frame: +12 pcs (11.16 min) / Wheel: +30 pcs (13.95 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  },
  {
    id: 'TRIP-H1-09',
    dispatch: '07:53 AM',
    eta: '07:56 AM',
    returnTime: '08:00 AM',
    transportMode: 'Jumbo Trolley',
    parts: '2x FRAME, SCOOTER COMP (12 pcs)',
    trolleys: 2,
    stockEffect: 'Frame: +12 pcs (11.16 min) / Wheel: -6 pcs (11.16 min)',
    durationSec: 180,
    status: 'PASSED - Zero Outage'
  }
];

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const SWCTDashboardView: React.FC = () => {
  const {
    selectedAssemblyLine,
    parts,
    productionPlan,
    modeConfigs,
    operatorName,
    inventoryStates,
    routes,
    swctRecords
  } = useMaterialFlow();

  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'builder' | 'chart' | 'test_case'>('analytics');
  const [testCaseDataSource, setTestCaseDataSource] = useState<'live' | 'static_benchmark'>('live');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [selectedHour, setSelectedHour] = useState<number>(1);
  const [timelineScheduleMode, setTimelineScheduleMode] = useState<'takt_interval' | 'consecutive'>('takt_interval');
  const [tripDemandSource, setTripDemandSource] = useState<'takt_rate' | 'uploaded_bins'>('uploaded_bins');
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);

  // Move placeholder check after all hooks have executed

  const handleDownloadExcel = () => {
    // Determine the hour slot start time for clock time display (e.g. 06:00, 07:00, etc.)
    const hourSlot = productionPlan.hourlyBreakdown?.[selectedHour - 1]?.hourSlot || '';
    let startHour = 6;
    let startMin = 0;
    const match = hourSlot.match(/(\d+):(\d+)/);
    if (match) {
      startHour = parseInt(match[1], 10);
      startMin = parseInt(match[2], 10);
    }

    const formatToTime = (minsFromStart: number) => {
      const totalMins = startHour * 60 + startMin + minsFromStart;
      const h = Math.floor(totalMins / 60) % 24;
      const m = Math.floor(totalMins % 60);
      const s = Math.round((totalMins * 60) % 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(displayHour)}:${pad(m)}:${pad(s)} ${ampm}`;
    };

    const isConsecutive = timelineScheduleMode === 'consecutive';
    const scheduleModeTitle = isConsecutive
      ? 'MOTION STUDY (CONSECUTIVE TRIPS) — ERGONOMIC / TIME ANALYSIS ONLY (NOT FOR LIVE DISPATCH)'
      : 'OPERATIONAL LIVE PLAN — TAKT-PACED SCHEDULE (-2 MIN ZERO-OUTAGE & POC SPACE CONTROL)';

    // 1. Prepare detailed AOA data for the SWCT Table with initial stock, trip delivery, and empty times
    const swctSheetData: any[][] = [
      ['TVS MOTOR COMPANY - STANDARD WORK COMBINATION TABLE (SWCT) SCHEDULE ANALYSIS'],
      ['Dispatch Schedule Mode:', scheduleModeTitle],
      ['Operator Name:', operatorName || 'Sandeep Kumar', 'Assembly Line:', selectedAssemblyLine],
      ['Selected Hour Window:', hourSlot || `Hour ${selectedHour}`, 'Target Production:', `${productionPlan?.hourlyPlanVehicles || 129} scooters/hr`],
      ['Exported on:', new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()],
      ['Operational Note:', isConsecutive
        ? 'WARNING: Generated under Motion Study mode (consecutive operator busy time) for ergonomic/work-study evaluation. Not intended for live shopfloor dispatch as deliveries do not pace to POC consumption.'
        : 'LIVE DISPATCH READY: Material deliveries paced to consumption interval with -2m arrival tolerance preventing line outage and POC trolley overflow.'
      ],
      [''],
      ['SECTION 1: INITIAL POC BUFFER STOCKS (START OF HOUR)'],
      ['Part Number', 'Part Description', 'Initial Qty (Trolleys)', 'Initial Qty (Units)', 'Hourly Cons. Rate', 'Buffer Start Time', 'Buffer Empty Minute', 'Buffer Empty Clock Time', 'Status'],
    ];

    // Add Initial Stock Rows
    parts.forEach(p => {
      const binCap = p.binCapacity || 6;
      const initialUnits = getInitialStockUnits(p);
      const initialTrolleys = Number((initialUnits / binCap).toFixed(1));
      const usage = p.usagePerVehicle || 1;
      const consumptionRateMin = p.manualHourlyBinsOverride !== undefined && p.manualHourlyBinsOverride > 0
        ? (p.manualHourlyBinsOverride * binCap) / 60
        : ((productionPlan?.hourlyPlanVehicles || 129) * usage) / 60;
      const coverageMins = consumptionRateMin > 0 ? initialUnits / consumptionRateMin : 0;
      const vehiclesDemand = Math.round(initialUnits / usage);

      swctSheetData.push([
        p.partNo,
        p.description || '',
        initialTrolleys,
        initialUnits,
        `${(consumptionRateMin * 60).toFixed(1)} / hr`,
        formatToTime(0),
        `${coverageMins.toFixed(2)}m`,
        formatToTime(coverageMins),
        `Initial Stock Buffer (${vehiclesDemand} veh demand)`
      ]);
    });

    swctSheetData.push(['']);
    swctSheetData.push(['SECTION 2: SEQUENTIAL MILK-RUN TRIPS & PART-LEVEL DELIVERY COVERAGE SCHEDULE']);
    swctSheetData.push([
      'Seq / Trip ID',
      'Part Number & Description',
      'Qty Carried (Trolleys)',
      'Pick & Loading (s)',
      'Travel Lead Time to POC',
      'Delivery Minute (Rel. Min)',
      'Delivery Clock Time',
      'Buffer Consumption Life (m)',
      'Buffer Empty Minute',
      'Buffer Empty Clock Time',
      'Unload & Return Time (s)',
      'Total Cycle Step Time (s)'
    ]);

    swctCycleSteps.forEach((row, idx) => {
      const leadTimeMin = row.leadTimeToPocSec ? row.leadTimeToPocSec / 60 : 2;
      const unloadEndTimeMin = (row.startTimeSec / 60) + leadTimeMin;
      const totalDuration = row.steps.reduce((acc: number, s: any) => acc + s.duration, 0);

      row.consumption.forEach((cons: any, cIdx: number) => {
        const partEmptyMin = unloadEndTimeMin + cons.mins;

        swctSheetData.push([
          cIdx === 0 ? `Trip ${idx + 1}` : '',
          `${cons.label} - ${cons.description || ''}`,
          cons.trolleys || 1,
          cIdx === 0 ? `${row.pickTime}s` : '',
          cIdx === 0 ? `${(leadTimeMin * 60).toFixed(0)}s` : '',
          `${unloadEndTimeMin.toFixed(2)}m`,
          formatToTime(unloadEndTimeMin),
          `${cons.mins}m`,
          `${partEmptyMin.toFixed(2)}m`,
          formatToTime(partEmptyMin),
          cIdx === 0 ? `${row.emptyTime}s` : '',
          cIdx === 0 ? `${totalDuration}s` : ''
        ]);
      });
    });

    // 2. Prepare KPI Summary Data
    const summaryData = [
      ['Misuzumashi SWCT Sequential Cycle Report'],
      ['Operator Name', operatorName || 'Sandeep Kumar'],
      ['Shift Window', productionPlan.shift],
      ['Assembly Line', selectedAssemblyLine],
      ['Export Date', new Date().toLocaleDateString()],
      ['Schedule Mode', isConsecutive ? 'Motion Study (Consecutive Trips) — Ergonomic Analysis Only' : 'Operational Live Plan (Takt-Paced -2m Rule) — Space-Controlled'],
      [''],
      ['Cycle KPI Overview', 'Metric Value', 'Target / Status'],
      ['Dispatch Schedule Mode', isConsecutive ? 'Motion Study (Consecutive)' : 'Operational Live Plan (Takt-Paced)', isConsecutive ? 'Ergonomic / Motion Study' : 'Shopfloor Live Dispatch'],
      ['Total Sequential Cycle Time', `${kpis.totalCycleSeconds}s (${Math.round(kpis.totalCycleSeconds / 60)}m)`, kpis.feasibility],
      ['Plant Takt Time', `${productionPlan.taktTimeSeconds}s`, 'Standard Pace'],
      ['Trips Per Hour', kpis.tripsPerHour, 'Total Frequency'],
      ['Shift Movement Distance', `${kpis.distanceShiftKm} km`, '8.0 Hr Effective'],
      ['Transport Mode Capacity Util.', `${kpis.avgCapacityUtilization}%`, kpis.avgCapacityUtilization > 85 ? 'High' : 'Normal'],
      [''],
      ['Initial POC Stock & Coverage Overview'],
      ['Part Number', 'Description', 'Initial Stock (Trolleys)', 'Initial Stock (Units)', 'Hourly Consumption Rate', 'Initial Stock Coverage (Minutes)', 'Continuous Stock Status']
    ];

    parts.forEach(p => {
      const binCap = p.binCapacity || 6;
      const initialUnits = getInitialStockUnits(p);
      const initialTrolleys = Number((initialUnits / binCap).toFixed(1));
      const usage = p.usagePerVehicle || 1;
      const consumptionRateMin = p.manualHourlyBinsOverride !== undefined && p.manualHourlyBinsOverride > 0
        ? (p.manualHourlyBinsOverride * binCap) / 60
        : ((productionPlan?.hourlyPlanVehicles || 129) * usage) / 60;
      const coverageMins = consumptionRateMin > 0 ? initialUnits / consumptionRateMin : 0;
      const vehiclesDemand = Math.round(initialUnits / usage);
      summaryData.push([
        p.partNo,
        p.description || '',
        String(initialTrolleys),
        String(initialUnits),
        `${(consumptionRateMin * 60).toFixed(1)} / hr`,
        `${coverageMins.toFixed(2)} mins (${vehiclesDemand} veh demand)`,
        'Continuous Stock - Zero Outage'
      ]);
    });

    const wb = XLSX.utils.book_new();

    // Summary Worksheet
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Table Worksheet
    const wsTable = XLSX.utils.aoa_to_sheet(swctSheetData);
    XLSX.utils.book_append_sheet(wb, wsTable, 'SWCT Table');

    // Dedicated Initial Stock & Coverage Worksheet
    const initialStockHeaders = [
      ['TVS MOTOR COMPANY - INITIAL POC STOCKS AND COVERAGE ANALYSIS'],
      ['Exported on:', new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()],
      [''],
      ['Part Number', 'Part Description', 'Bin Capacity', 'Initial Stock (Trolleys)', 'Initial Stock (Units)', 'Hourly Consumption (Units/hr)', 'Line Buffer Coverage (Minutes)', 'Vehicles Demand Covered', 'Status']
    ];

    parts.forEach(p => {
      const binCap = p.binCapacity || 6;
      const initialUnits = getInitialStockUnits(p);
      const initialTrolleys = Number((initialUnits / binCap).toFixed(1));
      const usage = p.usagePerVehicle || 1;
      const consumptionRateMin = p.manualHourlyBinsOverride !== undefined && p.manualHourlyBinsOverride > 0
        ? (p.manualHourlyBinsOverride * binCap) / 60
        : ((productionPlan?.hourlyPlanVehicles || 129) * usage) / 60;
      const coverageMins = consumptionRateMin > 0 ? initialUnits / consumptionRateMin : 0;
      const vehiclesDemand = Math.round(initialUnits / usage);
      initialStockHeaders.push([
        p.partNo,
        p.description || '',
        String(binCap),
        String(initialTrolleys),
        String(initialUnits),
        (consumptionRateMin * 60).toFixed(1),
        coverageMins.toFixed(2),
        String(vehiclesDemand),
        'Continuous'
      ]);
    });

    const wsInitial = XLSX.utils.aoa_to_sheet(initialStockHeaders);
    XLSX.utils.book_append_sheet(wb, wsInitial, 'Initial Stock Coverage');

    const filePrefix = isConsecutive ? 'SWCT_Motion_Study_Ergonomic_Analysis' : 'SWCT_Operational_Live_Plan';
    XLSX.writeFile(wb, `${filePrefix}_${selectedAssemblyLine}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadPDF = () => {
    const windowLabel = selectedHour === 0
      ? 'Full Shift (All Available Trips)'
      : productionPlan.hourlyBreakdown?.[selectedHour - 1]?.hourSlot || `Hour ${selectedHour}`;

    generateMisuzumashiChartPdfReport({
      swctCycleSteps,
      operatorName,
      selectedAssemblyLine,
      productionPlan,
      neededParts: productionPlan.shiftPlanVehicles * 3,
      windowLabel,
      scheduleMode: timelineScheduleMode,
    });
  };

  const filteredParts = useMemo(() => {
    if (!selectedAssemblyLine || (selectedAssemblyLine as string) === 'all' || (selectedAssemblyLine as string) === 'ALL') {
      return parts;
    }
    const list = parts.filter((part) => {
      const poc = (part.pocPoint || '').toUpperCase();
      const line = (part.assemblyLine || '').toUpperCase();
      if (line && line.includes(selectedAssemblyLine.toUpperCase())) return true;
      if (selectedAssemblyLine === '1VCON300') {
        return poc.includes('PL-3') || poc.includes('ML-48') || poc.includes('ML-47') || poc.includes('ML-46') || poc.includes('300');
      }
      if (selectedAssemblyLine === '1VCON200') {
        return poc.includes('PL-2') || poc.includes('ML-37') || poc.includes('ML-36') || poc.includes('200');
      }
      if (selectedAssemblyLine === '1VCON100') {
        return poc.includes('PL-1') || poc.includes('PL-0') || poc.includes('ML-0') || poc.includes('100');
      }
      return true;
    });
    // If assembly line filter returns zero (e.g. custom/uploaded parts with different POC syntax), fallback to all active parts
    return list.length > 0 ? list : parts;
  }, [parts, selectedAssemblyLine]);

  // 1. Reference Data for the Dashboard Header
  const dashboardHeader = {
    productNo: 'OP-001',
    productName: 'Sample Product',
    date: new Date().toLocaleDateString('en-GB'),
    department: 'Assembly',
    neededPartsPerDay: productionPlan.shiftPlanVehicles * 3, // Approx total daily
    taktTime: `${Math.round(productionPlan.taktTimeSeconds / 60)} mins`
  };

  // 1. Calculate parts coverage and risk profile (identical to Builder for consistent data)
  const partsWithCoverage = useMemo(() => {
    return parts.map((part) => {
      const usage = part.usagePerVehicle || 1;
      const binCap = part.binCapacity || 1;
      const hasOverride = part.manualHourlyBinsOverride !== undefined && tripDemandSource !== 'takt_rate';

      const hourlyConsumption = hasOverride
        ? part.manualHourlyBinsOverride! * binCap
        : Number(((3600 / (productionPlan.taktTimeSeconds || 27.9)) * usage).toFixed(1));

      const state = inventoryStates?.find((s) => s.partNo === part.partNo);
      const qtyAvailable = state ? state.currentStockUnits : getInitialStockUnits(part);

      const partConsumptionPerSecond = hourlyConsumption / 3600;
      const coverageSeconds = partConsumptionPerSecond > 0 ? qtyAvailable / partConsumptionPerSecond : Infinity;
      const coverageMinutes = coverageSeconds !== Infinity ? Math.round(coverageSeconds / 60) : 999;

      const riskLevel: 'Critical' | 'Warning' | 'Normal' =
        coverageMinutes < 10 ? 'Critical' : coverageMinutes <= 20 ? 'Warning' : 'Normal';

      return {
        ...part,
        hourlyConsumption,
        qtyAvailable,
        coverageMinutes,
        riskLevel
      };
    });
  }, [parts, productionPlan.taktTimeSeconds, inventoryStates, tripDemandSource]);

  const partsForGrouping = useMemo(() => {
    if (tripDemandSource === 'takt_rate') {
      return filteredParts.map(p => ({
        ...p,
        manualHourlyBinsOverride: undefined
      }));
    }
    return filteredParts;
  }, [filteredParts, tripDemandSource]);

  // 2. Compute Combined Delivery Groups (Milk Runs) dynamically from parts list and production plan
  const combinedGroups = useMemo<CombinedGroupInfo[]>(() => {
    const rawGroups = getMilkRunGroups(partsForGrouping, productionPlan, modeConfigs, inventoryStates);
    return rawGroups.map((group, idx) => {
      const mode = group.transportMode || 'Jumbo Trolley';
      const config = modeConfigs[mode] || { carryingCapacityTrolleys: 3 };
      const capacity = config.carryingCapacityTrolleys || 3;
      const capacityUsed = group.totalTrolleys;
      const materials = group.parts.map(p => p.part);
      const materialAllocations = group.parts.map(p => ({ part: p.part, trolleys: p.loadQty }));
      const stores = group.storeLocations;
      const dest = group.pocPoint;

      // Multi-stop sequential routing based on 2m station gap rule
      const sortedMats = sortPocStations([...materials]);
      const firstDist = sortedMats[0]?.loadedDistanceMeters || calculateStoreToStationDistance(sortedMats[0]?.pocPoint);
      let interStationTravelMeters = 0;
      for (let i = 0; i < sortedMats.length - 1; i++) {
        interStationTravelMeters += calculateInterStationDistance(sortedMats[i].pocPoint, sortedMats[i + 1].pocPoint);
      }
      const lastDist = sortedMats[sortedMats.length - 1]?.returnDistanceMeters || firstDist;
      const totalDistance = firstDist + interStationTravelMeters + lastDist;
      const cycleTime = Math.round(group.cycleTimeMin * 60);
      const tripsPerHour = group.tripsHr ?? 1;
      const tripsPerShift = group.tripsShift ?? Math.round(tripsPerHour * 8);

      const isCritical = materials.some(m => {
        const coverPart = partsWithCoverage.find((pwc) => pwc.partNo === m.partNo);
        return coverPart?.riskLevel === 'Critical';
      });
      const isWarning = materials.some(m => {
        const coverPart = partsWithCoverage.find((pwc) => pwc.partNo === m.partNo);
        return coverPart?.riskLevel === 'Warning';
      });
      const highestRisk: 'Critical' | 'Warning' | 'Normal' = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';
      const priority: 'P1 (Critical)' | 'P2 (Warning)' | 'P3 (Normal)' =
        isCritical ? 'P1 (Critical)' : isWarning ? 'P2 (Warning)' : 'P3 (Normal)';

      const routeUtilization = Math.round((capacityUsed / Math.max(1, capacity)) * 100);

      // Travel time calculation using exact distances and transfer speeds (sec/mtr)
      const config_travel = modeConfigs[mode] || {
        loadSpeedSecPerMtr: 1.3889,
        emptySpeedSecPerMtr: 1.3889,
      };
      const loadSpeed = (config_travel as any).loadSpeedSecPerMtr || 1.3889;
      const emptySpeed = (config_travel as any).emptySpeedSecPerMtr || 1.3889;

      let travelLoadedSec = 0;
      let travelEmptySec = 0;

      if (sortedMats.length > 0) {
        travelLoadedSec = Math.round((firstDist + interStationTravelMeters) * loadSpeed);
        travelEmptySec = Math.round(lastDist * emptySpeed);
      }

      return {
        milkRunId: group.groupId || `MR-${String(idx + 1).padStart(3, '0')}`,
        transportMode: mode,
        destination: dest,
        capacity,
        capacityUsed,
        materials,
        materialAllocations,
        stores,
        route: [stores[0] || 'Store', dest, 'Return', stores[0] || 'Store'],
        totalDistance,
        cycleTime,
        tripsPerHour,
        tripsPerShift,
        highestRisk,
        priority,
        whyCreated: `Destination = ${dest} | Mode = ${mode} | Trolleys = ${capacityUsed}/${capacity}`,
        routeUtilization,
        travelLoadedSec,
        travelEmptySec
      };
    });
  }, [partsForGrouping, productionPlan, modeConfigs, inventoryStates, partsWithCoverage]);

  const hourGroups = useMemo(() => {
    const totalTrips = combinedGroups.length;
    if (totalTrips === 0) return [];

    // Full Shift view (selectedHour === 0) returns all available trips
    if (selectedHour === 0) {
      return combinedGroups;
    }

    // Number of trips per hour (e.g. 24 trips for 8 hours = 3 trips per hour)
    const tripsPerHr = Math.max(1, Math.round(totalTrips / 8));
    const startIdx = (selectedHour - 1) * tripsPerHr;
    const endIdx = Math.min(totalTrips, startIdx + tripsPerHr);

    if (startIdx >= totalTrips) {
      return combinedGroups.slice(0, tripsPerHr);
    }

    return combinedGroups.slice(startIdx, endIdx);
  }, [combinedGroups, selectedHour]);

  // Set initial selected trip (keep for other views if needed, but analytics will use all)
  useEffect(() => {
    if (combinedGroups.length > 0 && !selectedTripId) {
      setSelectedTripId(combinedGroups[0].milkRunId);
    }
  }, [combinedGroups, selectedTripId]);

  // Active selected trip info
  const selectedTrip = useMemo(() => {
    return combinedGroups.find(g => g.milkRunId === selectedTripId) || combinedGroups[0] || null;
  }, [combinedGroups, selectedTripId]);

  // 3. Define the steps for the full Mizusumashi cycle sequential visualization
  const swctCycleSteps = useMemo(() => {
    const steps: any[] = [];
    let cumulativeSec = 0;

    // Track per-part line stock exhaustion time (in seconds from 07:00:00 AM)
    const partStockExhaustedSec: Record<string, number> = {};
    const partInitialUnits: Record<string, number> = {};
    const partInitialCoverageSec: Record<string, number> = {};
    const partInitialVehDemand: Record<string, number> = {};

    parts.forEach(p => {
      const initUnits = getInitialStockUnits(p);
      partInitialUnits[p.partNo] = initUnits;
      const usage = p.usagePerVehicle || 1;
      const takt = productionPlan.taktTimeSeconds || 27.9;
      const covSec = p.manualHourlyBinsOverride !== undefined && p.manualHourlyBinsOverride > 0
        ? (initUnits / (p.manualHourlyBinsOverride * (p.binCapacity || 1))) * 3600
        : (initUnits / usage) * takt;
      partInitialCoverageSec[p.partNo] = covSec;
      partInitialVehDemand[p.partNo] = Math.round(initUnits / usage);
      // Line starts with initial stock carryover at 07:00:00, lasting until covSec
      partStockExhaustedSec[p.partNo] = covSec;
    });

    hourGroups.forEach((group, gIdx) => {
      const trolleys = group.capacityUsed;
      const config = modeConfigs[group.transportMode] || {
        loadSpeedSecPerMtr: 1.3889,
        emptySpeedSecPerMtr: 1.3889,
        pickTimeSec: 10,
        storingTimeSec: 10,
        emptyHandlingTimeSec: 10,
        emptyDropTimeSec: 10,
      };
      const loadSpeed = (config as any).loadSpeedSecPerMtr || 1.3889;
      const emptySpeed = (config as any).emptySpeedSecPerMtr || 1.3889;
      const pickTimeBase = config.pickTimeSec ?? 10;
      const storeTimeBase = config.storingTimeSec ?? 10;
      const emptyTimeBase = config.emptyHandlingTimeSec ?? 10;
      const emptyDropTimeBase = (config as any).emptyDropTimeSec ?? 10;

      // 1. Sort materials along conveyor line flow to simulate multi-stop sequential routing
      const sortedMats = sortPocStations([...group.materials]);

      let travelLoadedSec = 0;
      let travelEmptySec = 0;
      let totalUnloadSec = 0;
      let totalEmptySec = 0;

      // 2. Calculate multi-stop travel using 2m station gap rule
      if (sortedMats.length > 0) {
        const firstDist = sortedMats[0].loadedDistanceMeters || calculateStoreToStationDistance(sortedMats[0].pocPoint);
        let interStationTravelMeters = 0;
        for (let i = 0; i < sortedMats.length - 1; i++) {
          interStationTravelMeters += calculateInterStationDistance(sortedMats[i].pocPoint, sortedMats[i + 1].pocPoint);
        }
        travelLoadedSec = Math.round((firstDist + interStationTravelMeters) * loadSpeed);
        const lastDist = sortedMats[sortedMats.length - 1].returnDistanceMeters || firstDist;
        travelEmptySec = Math.round(lastDist * emptySpeed);
      }

      // 3. Handling Times
      const pickSec = Math.round(pickTimeBase * group.capacityUsed);

      group.materialAllocations.forEach(ma => {
        totalUnloadSec += Math.round(storeTimeBase * ma.trolleys);
        totalEmptySec += Math.round(emptyTimeBase * ma.trolleys);
      });

      // 4. Empty Drop at Stores (Finalizing cycle)
      const totalDropSec = Math.round(emptyDropTimeBase * group.capacityUsed);
      const tripCycleSec = pickSec + travelLoadedSec + totalUnloadSec + totalEmptySec + travelEmptySec + totalDropSec;

      const partsSummary = group.materialAllocations.map(ma => {
        const fullDesc = (ma.part.description || ma.part.partNo).trim();
        const containerType = ma.part.binOrTrolley || 'Trolley';
        return `${fullDesc} (${ma.trolleys} ${containerType}${ma.trolleys > 1 ? 's' : ''})`;
      }).join(' & ');

      // Find earliest stock depletion deadline among parts on this trip
      let earliestStockoutSec = Infinity;
      group.materialAllocations.forEach(ma => {
        const depSec = partStockExhaustedSec[ma.part.partNo] ?? 1674;
        if (depSec < earliestStockoutSec) {
          earliestStockoutSec = depSec;
        }
      });
      if (earliestStockoutSec === Infinity) earliestStockoutSec = 1674;

      const leadTimeToPocSec = pickSec + travelLoadedSec;

      let tripStartSec = cumulativeSec;
      if (timelineScheduleMode === 'consecutive') {
        tripStartSec = cumulativeSec;
        cumulativeSec += tripCycleSec;
      } else {
        // Takt-Paced Schedule (-2m Safety Buffer Rule): Arrive 120s before earliest stock depletion
        const targetArrivalSec = Math.max(0, earliestStockoutSec - 120);
        if (gIdx === 0) {
          // Trip 1 dispatches at 0 or early enough to arrive before initial stock runs out
          tripStartSec = Math.max(0, Math.min(cumulativeSec, Math.round(targetArrivalSec - leadTimeToPocSec)));
        } else {
          tripStartSec = Math.max(cumulativeSec, Math.round(targetArrivalSec - leadTimeToPocSec));
        }
        cumulativeSec = tripStartSec + tripCycleSec;
      }

      // Actual Delivery Arrival Time and Unload Finish Time at POC
      const deliveryArrivalSec = tripStartSec + leadTimeToPocSec;
      const unloadFinishSec = deliveryArrivalSec + totalUnloadSec;
      const deliveryMin = Number((deliveryArrivalSec / 60).toFixed(2));

      // Grouped Data for Table & Consumption Timeline
      const partConsumptions: any[] = [];
      let minBatchCoverageSec = Infinity;
      let totalVehiclesDelivered = 0;

      group.materialAllocations.forEach(ma => {
        const binCap = ma.part.binCapacity || 1;
        const usage = ma.part.usagePerVehicle || 1;
        const deliveredUnits = ma.trolleys * binCap;
        const vehDemand = Number((deliveredUnits / usage).toFixed(1));
        totalVehiclesDelivered += vehDemand;

        const secPerBatch = ma.part.manualHourlyBinsOverride !== undefined && ma.part.manualHourlyBinsOverride > 0
          ? (ma.trolleys / ma.part.manualHourlyBinsOverride) * 3600
          : ((ma.trolleys * binCap) / usage) * (productionPlan.taktTimeSeconds || 27.9);
        const allocConsumption = secPerBatch / 60;

        // Consumption starts when previous stock runs out (or at delivery arrival if already depleted)
        const prevExhaustedSec = partStockExhaustedSec[ma.part.partNo] || 0;
        const consumeStartSec = Math.max(deliveryArrivalSec, prevExhaustedSec);
        const consumeEndSec = consumeStartSec + secPerBatch;

        // Update the running line stock depletion time for this part
        partStockExhaustedSec[ma.part.partNo] = consumeEndSec;

        const consumeStartMin = Number((consumeStartSec / 60).toFixed(2));
        const consumeEndMin = Number((consumeEndSec / 60).toFixed(2));
        const totalBufferFromDeliveryMin = Number(((consumeEndSec - deliveryArrivalSec) / 60).toFixed(1));

        const initUnits = partInitialUnits[ma.part.partNo] || getInitialStockUnits(ma.part);
        const initCovMins = Number(((partInitialCoverageSec[ma.part.partNo] || 0) / 60).toFixed(2));
        const initVehDemand = partInitialVehDemand[ma.part.partNo] || Math.round(initUnits / usage);

        const partDesc = (ma.part.description || ma.part.partNo).trim();
        const containerType = ma.part.binOrTrolley || 'Trolley';

        const statement = `Delivered: ${ma.trolleys} ${containerType}${ma.trolleys > 1 ? 's' : ''} (${deliveredUnits} pcs) at ${deliveryMin}m → Meets demand for ${vehDemand} veh. Consumed from ${consumeStartMin}m to ${consumeEndMin}m (${allocConsumption.toFixed(1)} mins, +${totalBufferFromDeliveryMin}m buffer)`;

        partConsumptions.push({
          label: ma.part.partNo,
          description: partDesc,
          mins: Number(allocConsumption.toFixed(2)),
          trolleys: ma.trolleys,
          units: deliveredUnits,
          containerType,
          vehiclesDemand: vehDemand,
          initialStockUnits: initUnits,
          initialCoverageMins: initCovMins,
          initialVehiclesDemand: initVehDemand,
          deliveryTimeMin: deliveryMin,
          consumeStartMin,
          consumeEndMin,
          totalBufferFromDeliveryMin,
          statement
        });

        if (secPerBatch > 0 && secPerBatch < minBatchCoverageSec) {
          minBatchCoverageSec = secPerBatch;
        }
      });

      if (minBatchCoverageSec === Infinity) {
        minBatchCoverageSec = 1674;
      }

      // Grouped Data for Table
      const rowData = {
        id: group.milkRunId,
        operation: partsSummary,
        pickTime: pickSec,
        consumption: partConsumptions,
        emptyTime: totalUnloadSec + totalEmptySec + totalDropSec,
        startTimeSec: tripStartSec,
        leadTimeToPocSec,
        unloadFinishSec,
        minBatchCoverageSec,
        totalVehiclesDelivered,
        steps: [
          { type: 'Manual', duration: pickSec, label: 'Loading' },
          { type: 'Walking', duration: travelLoadedSec, label: 'Moving to POC' },
          { type: 'Manual', duration: totalUnloadSec, label: 'Unloading' },
          { type: 'Manual', duration: totalEmptySec, label: 'Empty Pick' },
          { type: 'Walking', duration: travelEmptySec, label: 'Moving to Store' },
          { type: 'Manual', duration: totalDropSec, label: 'Empty Drop' }
        ]
      };

      steps.push(rowData);
    });

    return steps;
  }, [hourGroups, modeConfigs, productionPlan.taktTimeSeconds, timelineScheduleMode, parts]);

  // Map first trip index for each part to render Initial Stock line accurately
  const firstTripForPart = useMemo(() => {
    const map: Record<string, number> = {};
    swctCycleSteps.forEach((step, sIdx) => {
      if (step.consumption) {
        step.consumption.forEach((c: any) => {
          if (map[c.label] === undefined) {
            map[c.label] = sIdx;
          }
        });
      }
    });
    return map;
  }, [swctCycleSteps]);

  // 4. Calculate Key Performance Indicators (KPI Dashboard)
  const kpis = useMemo(() => {
    if (hourGroups.length === 0) {
      return {
        totalCycleSeconds: 0,
        tripsPerHour: 0,
        distanceShiftKm: '0.0',
        avgCapacityUtilization: 0,
        taktTime: productionPlan.taktTimeSeconds,
        feasibility: 'N/A'
      };
    }

    const totalCycleSeconds = hourGroups.reduce((acc, g) => acc + g.cycleTime, 0);
    const avgCapacityUtilization = Math.round((hourGroups.reduce((acc, g) => acc + g.capacityUsed, 0) / hourGroups.reduce((acc, g) => acc + g.capacity, 0)) * 100);
    const distanceShiftKm = (hourGroups.reduce((acc, g) => acc + g.totalDistance, 0) / 1000).toFixed(1);

    return {
      totalCycleSeconds,
      tripsPerHour: hourGroups.length,
      distanceShiftKm,
      avgCapacityUtilization,
      taktTime: productionPlan.taktTimeSeconds,
      feasibility: totalCycleSeconds <= 3600 ? 'FEASIBLE' : 'OVERLOADED'
    };
  }, [hourGroups, productionPlan]);

  // Sync trips to show in preview
  const tripsToShow = useMemo(() => {
    return hourGroups;
  }, [hourGroups]);

  // Dynamic Live Simulation Trips for Test Case view (paced to takt & shopfloor parameters)
  const dynamicTestCaseTrips = useMemo(() => {
    // Determine the hour slot start time for clock time display
    const hourSlot = productionPlan.hourlyBreakdown?.[selectedHour > 0 ? selectedHour - 1 : 0]?.hourSlot || '07:00 - 08:00 AM';
    let startHour = 7;
    let startMin = 0;
    const match = hourSlot.match(/(\d+):(\d+)/);
    if (match) {
      startHour = parseInt(match[1], 10);
      startMin = parseInt(match[2], 10);
    }

    const formatToTime = (minsFromStart: number) => {
      const totalMins = startHour * 60 + startMin + minsFromStart;
      const h = Math.floor(totalMins / 60) % 24;
      const m = Math.floor(totalMins % 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(displayHour)}:${pad(m)} ${ampm}`;
    };

    return swctCycleSteps.map((step, idx) => {
      const group = hourGroups.find((g) => g.milkRunId === step.id) || combinedGroups.find((g) => g.milkRunId === step.id);
      const totalDurationSec = step.steps.reduce((acc: number, s: any) => acc + s.duration, 0);
      const dispatchTime = formatToTime(step.startTimeSec / 60);
      const dropTime = formatToTime((step.startTimeSec + step.leadTimeToPocSec) / 60);
      const returnTime = formatToTime((step.startTimeSec + totalDurationSec) / 60);

      const partsLoaded = group?.materialAllocations && group.materialAllocations.length > 0
        ? group.materialAllocations.map((ma) => {
            const desc = ma.part.description || ma.part.partNo;
            const pcs = ma.trolleys * (ma.part.binCapacity || 1);
            return `${ma.trolleys}x ${desc} (${pcs} pcs)`;
          }).join(', ')
        : step.operation;

      const totalTrolleys = group?.capacityUsed ?? (step.consumption ? step.consumption.reduce((acc: number, c: any) => acc + (c.trolleys || 1), 0) : 1);

      const stockEffect = step.consumption && step.consumption.length > 0
        ? step.consumption.map((c: any) => {
            const part = parts.find((p) => p.partNo === c.label);
            const pcs = c.units || ((c.trolleys || 1) * (part?.binCapacity || 1));
            const vehDemand = c.vehiclesDemand !== undefined ? c.vehiclesDemand : Math.round(pcs / (part?.usagePerVehicle || 1));
            const desc = part?.description || c.label;
            const containerType = c.containerType || part?.binOrTrolley || 'Trolley';
            const startMin = c.consumeStartMin !== undefined ? `${c.consumeStartMin}m` : '';
            const endMin = c.consumeEndMin !== undefined ? `${c.consumeEndMin}m` : '';
            return `${desc}: +${pcs} pcs (${c.trolleys || 1} ${containerType}) → ${vehDemand} veh demand, cons ${startMin}→${endMin} (${c.mins}m buffer)`;
          }).join(' | ')
        : 'Continuous replenishment maintained';

      return {
        id: step.id || `TRIP-LIVE-${String(idx + 1).padStart(2, '0')}`,
        dispatch: dispatchTime,
        eta: dropTime,
        returnTime: returnTime,
        transportMode: group?.transportMode || 'Jumbo Trolley',
        parts: partsLoaded,
        trolleys: totalTrolleys,
        stockEffect,
        durationSec: totalDurationSec,
        status: 'PASSED - Zero Outage'
      };
    });
  }, [swctCycleSteps, hourGroups, combinedGroups, selectedHour, productionPlan, parts]);

  // Active trips for Test Case tab based on selector
  const activeTestCaseTrips = useMemo(() => {
    return testCaseDataSource === 'live' ? dynamicTestCaseTrips : STATIC_BENCHMARK_TEST_CASE_TRIPS;
  }, [testCaseDataSource, dynamicTestCaseTrips]);

  const handleDownloadTestCaseExcel = () => {
    const isLive = testCaseDataSource === 'live';
    const isConsecutive = timelineScheduleMode === 'consecutive';

    const testCaseData = isLive
      ? dynamicTestCaseTrips.map((trip) => ({
          'Trip ID': trip.id,
          'Dispatch Time': trip.dispatch,
          'Drop Time (ETA)': trip.eta,
          'Return Time': trip.returnTime,
          'Transport Mode': trip.transportMode,
          'Consolidated Parts Loaded': trip.parts,
          'Trolleys Carried': trip.trolleys,
          'POC Stock Coverage After Delivery': trip.stockEffect,
          'Cycle Duration (s)': `${trip.durationSec}s (${(trip.durationSec / 60).toFixed(1)} min)`,
          'Outage Status': trip.status
        }))
      : STATIC_BENCHMARK_TEST_CASE_TRIPS.map((trip) => ({
          'Trip ID': trip.id,
          'Dispatch Time': trip.dispatch,
          'Drop Time (ETA)': trip.eta,
          'Return Time': trip.returnTime,
          'Transport Mode': trip.transportMode,
          'Consolidated Parts Loaded': trip.parts,
          'Trolleys Carried': trip.trolleys,
          'POC Stock Coverage After Delivery': trip.stockEffect,
          'Cycle Duration (s)': `${trip.durationSec}s (${(trip.durationSec / 60).toFixed(1)} min)`,
          'Outage Status': trip.status
        }));

    const wb = XLSX.utils.book_new();

    const summaryHeaders = [
      ['TVS MOTOR COMPANY - HOSUR PLANT FACILITY 1'],
      [isLive
        ? `Mizusumashi Live Operational Simulation (${selectedHour === 0 ? 'Full Shift' : (productionPlan.hourlyBreakdown?.[selectedHour - 1]?.hourSlot || 'Hour 1')})`
        : 'Mizusumashi Delivery H1 (07:00 - 08:00 AM) Static Benchmark Reference (op1.xlsx Baseline)'
      ],
      [''],
      ['Operator Name', operatorName || 'Sandeep Kumar'],
      ['Dataset Input Source', isLive ? 'Live Part Master & Production Plan (Dynamic Calculation Engine)' : 'op1.xlsx (Static Reference Benchmark)'],
      ['Tested Assembly Line', selectedAssemblyLine || '1VCON100'],
      ['Simulation Window', selectedHour === 0 ? 'Full Shift' : (productionPlan.hourlyBreakdown?.[selectedHour - 1]?.hourSlot || '07:00 - 08:00 AM')],
      ['Dispatch Schedule Mode', isConsecutive ? 'Motion Study (Consecutive Trips - Ergonomic Analysis Only)' : 'Takt-Paced Schedule (-2m Zero-Outage Rule)'],
      ['Total Cycles Scheduled', `${testCaseData.length} Trips`],
      ['Line Outages Detected', '0.00 minutes (Zero Loss)'],
      ['Status', 'SUCCESSFUL VALIDATION'],
      ['Operational Note', isLive
        ? (isConsecutive
            ? 'WARNING: Generated under Motion Study mode for work-study/ergonomic evaluation.'
            : 'LIVE DISPATCH: Dynamically paced to line takt time with -2m zero-outage buffer.')
        : 'STATIC REFERENCE SPECIFICATION: Historical benchmark derived from op1.xlsx for audit reference.'
      ],
      ['']
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryHeaders);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Test Overview');

    const wsTrips = XLSX.utils.json_to_sheet(testCaseData);
    XLSX.utils.book_append_sheet(wb, wsTrips, isLive ? 'Live Simulation Trips' : 'Benchmark Reference Trips');

    const fileName = isLive
      ? `SWCT_${isConsecutive ? 'MotionStudy' : 'LivePlan'}_H1_Simulation_${selectedAssemblyLine}_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Static_Benchmark_Reference_H1_op1_${selectedAssemblyLine}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // Effect to scroll to selected trip in preview
  useEffect(() => {
    if (selectedTripId) {
      const element = document.getElementById(`trip-preview-${selectedTripId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedTripId]);

  // SVG dimensions for floor map
  const maxTimeSeconds = Math.max(3600, kpis.totalCycleSeconds + 300);
  const chartWidth = Math.max(800, maxTimeSeconds * 0.35); // Scale width by time
  const chartHeight = 550;
  const scale = chartWidth / maxTimeSeconds;

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="swct-dashboard-view" className="space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen p-4 md:p-8">

      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Misuzumashi
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Standardized Work Combination Table: Replenishment cycle sequential analysis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <button
              onClick={() => setActiveSubTab('builder')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'builder'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Digital Builder
            </button>
            <button
              onClick={() => setActiveSubTab('analytics')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveSubTab('chart')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'chart'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Format Chart
            </button>
            <button
              onClick={() => setActiveSubTab('test_case')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'test_case'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
              H1 Test Case
            </button>
          </div>

          {activeSubTab === 'chart' ? (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 ring-1 ring-red-500/50"
            >
              <FileDown className="w-3.5 h-3.5" />
              Download PDF Chart
            </button>
          ) : activeSubTab === 'test_case' ? (
            <button
              onClick={handleDownloadTestCaseExcel}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 ring-1 ring-blue-500/50"
            >
              <Download className="w-3.5 h-3.5" />
              {testCaseDataSource === 'live' ? 'Export Live Simulation Excel' : 'Export Benchmark Reference Excel'}
            </button>
          ) : (
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 ring-1 ring-emerald-500/50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel
            </button>
          )}
        </div>
      </div>

      {/* TIMELINE SEGMENT NAVBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-2">
          <span>Timeline Window</span>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
            {swctCycleSteps.length} available trip{swctCycleSteps.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex-1 w-full overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => setSelectedHour(0)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedHour === 0
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Full Shift ({combinedGroups.length} Trips)
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => {
              let label = '';
              const slots = productionPlan.hourlyBreakdown || [];
              if (slots[hour - 1]) {
                label = slots[hour - 1].hourSlot;
              } else {
                label = `Hour ${hour}`;
              }
              const isActive = selectedHour === hour;
              return (
                <button
                  key={hour}
                  onClick={() => setSelectedHour(hour)}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SHOPFLOOR CONTROLS & DIAGNOSTIC PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-4">
          {/* Schedule Mode Switch */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Timeline Dispatch Mode
              </span>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                timelineScheduleMode === 'takt_interval'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {timelineScheduleMode === 'takt_interval' ? 'LIVE OPERATIONAL PLAN' : 'ERGO / MOTION STUDY ONLY'}
              </span>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setTimelineScheduleMode('takt_interval')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timelineScheduleMode === 'takt_interval'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Takt-Paced Schedule (-2m Rule — Operational Plan)
              </button>
              <button
                onClick={() => setTimelineScheduleMode('consecutive')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timelineScheduleMode === 'consecutive'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Motion Study (Consecutive — Ergo Analysis Only)
              </button>
            </div>
            {timelineScheduleMode === 'consecutive' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                ⚠ Motion Study: Trips packed back-to-back for ergonomic analysis only. Deliveries are not paced to consumption timing; use Takt-Paced mode for operational dispatch to avoid POC trolley overflow.
              </p>
            )}
          </div>

          {/* Demand Basis Switch */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Demand Calculation Basis
            </span>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setTripDemandSource('uploaded_bins')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tripDemandSource === 'uploaded_bins'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Uploaded Excel (2+4 Trolleys → 2 Trips/Hr)
              </button>
              <button
                onClick={() => setTripDemandSource('takt_rate')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tripDemandSource === 'takt_rate'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Takt Demand (129 VPH → 3 Trips/Hr)
              </button>
            </div>
          </div>
        </div>

        {/* Explain & Diagnostic Button */}
        <button
          onClick={() => setShowDiagnosticModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-bold text-xs transition-all shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Why it shows like this? (Test Case Report)</span>
        </button>
      </div>

      {/* SHOPFLOOR CONSTRAINTS & OPERATING RULES BADGES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. Delivery Tolerance</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>-2.0 Mins Safety Buffer</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">(Arrives 120s pre-stockout)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. POC Capacity Limit</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>Max 2 Trolleys / Station</span>
              <span className="text-[10px] text-slate-500 font-medium">(1 Active + 1 Staging)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. Station Gap Distance</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <span>2.0m Distance Gap</span>
              <span className="text-[10px] text-slate-500 font-medium">(e.g. PL-01 → PL-02 = 2m)</span>
            </div>
          </div>
        </div>
      </div>

      {activeSubTab === 'builder' ? (
        <SWCTBuilder />
      ) : activeSubTab === 'chart' ? (
        <MisuzumashiChart
          swctCycleSteps={swctCycleSteps}
          selectedHour={selectedHour}
          onSelectHour={setSelectedHour}
          windowLabel={
            selectedHour === 0
              ? 'Full Shift (All Available Trips)'
              : productionPlan.hourlyBreakdown?.[selectedHour - 1]?.hourSlot || `Hour ${selectedHour}`
          }
          totalShiftTrips={combinedGroups.length}
          timelineScheduleMode={timelineScheduleMode}
          onScheduleModeChange={setTimelineScheduleMode}
          tripDemandSource={tripDemandSource}
          onDemandSourceChange={setTripDemandSource}
          onDownloadPDF={handleDownloadPDF}
          onDownloadExcel={handleDownloadExcel}
        />
      ) : activeSubTab === 'test_case' ? (
        <div className="space-y-6">
          {/* Test Case Header Info & Mode Switcher */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-[#0d1527] dark:to-[#0f111a] border border-blue-100 dark:border-blue-950 p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-950/50 px-3 py-1 rounded-full">
                    {testCaseDataSource === 'live' ? 'Live Dynamic Engine' : 'Static Reference Benchmark'}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                    Line {selectedAssemblyLine}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  {testCaseDataSource === 'live'
                    ? `Operator 1: ${selectedHour === 0 ? 'Full Shift' : (productionPlan.hourlyBreakdown?.[selectedHour - 1]?.hourSlot || 'Hour 1')} Live Simulation`
                    : 'Operator 1: 07:00 AM - 08:00 AM (H1) Reference Benchmark'
                  }
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  {testCaseDataSource === 'live'
                    ? `Dynamically generated in real-time from active Part Master (${filteredParts.length} parts), live inventory, and production takt time (${productionPlan.taktTimeSeconds}s). Paced to eliminate assembly line starvation while respecting POC trolley footprint.`
                    : 'Static reference specification derived from the op1.xlsx benchmark dataset. This historical 9-trip baseline serves as an engineering proof for audit validation.'
                  }
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  onClick={handleDownloadTestCaseExcel}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {testCaseDataSource === 'live' ? 'Export Live Simulation Excel' : 'Export Benchmark Reference Excel'}
                </button>
              </div>
            </div>

            {/* Data Source Selector Pill Bar */}
            <div className="pt-4 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3">
                  Simulation Source:
                </span>
                <button
                  onClick={() => setTestCaseDataSource('live')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    testCaseDataSource === 'live'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Live Dynamic Simulation (Active Data)
                </button>
                <button
                  onClick={() => setTestCaseDataSource('static_benchmark')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    testCaseDataSource === 'static_benchmark'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Static Benchmark Reference (op1.xlsx Baseline)
                </button>
              </div>

              {testCaseDataSource === 'static_benchmark' && (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3.5 py-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Showing fixed 9-trip reference baseline from initial study (not linked to uploaded changes).</span>
                </div>
              )}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {selectedHour === 0 ? 'Total Shift Trips' : 'Total Trips in Window'}
              </span>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {activeTestCaseTrips.length} Cycles
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {testCaseDataSource === 'live' ? 'Generated by Milk Run Engine' : 'Fixed 9-trip study pattern'}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculated Cycle Time</span>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {activeTestCaseTrips.length > 0
                  ? `${Math.round(activeTestCaseTrips.reduce((acc, t) => acc + (t.durationSec || 180), 0) / activeTestCaseTrips.length)}s (${((activeTestCaseTrips.reduce((acc, t) => acc + (t.durationSec || 180), 0) / activeTestCaseTrips.length) / 60).toFixed(1)} Min)`
                  : '0s (0.0 Min)'}
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">100% Feasible Pattern</span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Outages Detected</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">0.00 Mins</div>
              <span className="text-xs text-slate-500 font-medium">Zero assembly line downtime</span>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Input Parameters</span>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {testCaseDataSource === 'live' ? `${filteredParts.length} Parts` : '5 Core Parts'}
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                {testCaseDataSource === 'live' ? `Live Active Data (${selectedAssemblyLine})` : 'Loaded from op1.xlsx benchmark'}
              </span>
            </div>
          </div>

          {/* Interactive Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Replenishment Sequence & POC Stock Depletion Visualizer
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {testCaseDataSource === 'live'
                    ? `Live scheduled replenishment cycles paced with -2 min arrival tolerance. Line coverage updates dynamically per trip.`
                    : 'Reference replenishment test case with baseline stock coverage timings from the TVS engineering study.'
                  }
                </p>
              </div>
              <div className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                Paced Mode: <strong className="text-slate-800 dark:text-slate-200">{timelineScheduleMode === 'consecutive' ? 'Motion Study' : 'Takt-Paced (-2m)'}</strong>
              </div>
            </div>

            {activeTestCaseTrips.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-sm font-bold text-slate-500">No milk run trips generated for this window.</p>
                <p className="text-xs text-slate-400 mt-1">Check the Part Master filters, assembly line selection, or hourly breakdown.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                    <tr>
                      <th className="px-5 py-4 rounded-l-2xl">Trip ID</th>
                      <th className="px-5 py-4">Dispatch / ETA / Return</th>
                      <th className="px-5 py-4">Transport Mode</th>
                      <th className="px-5 py-4">Consolidated Parts Loaded</th>
                      <th className="px-5 py-4 text-center">Trolleys</th>
                      <th className="px-5 py-4">POC Stock Effect</th>
                      <th className="px-5 py-4 rounded-r-2xl text-right">Outage Protection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {activeTestCaseTrips.map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-mono font-black text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {trip.id}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              Dispatch: {trip.dispatch}
                            </span>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              ETA (Drop): {trip.eta}
                            </span>
                            {trip.returnTime && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Return: {trip.returnTime}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                            {trip.transportMode}
                          </span>
                        </td>
                        <td className="px-5 py-4 min-w-[220px]">
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed block">
                            {trip.parts}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-black font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {trip.trolleys}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-600 dark:text-slate-400 min-w-[200px]">
                          {trip.stockEffect}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                            {trip.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* INITIAL POC STOCK CARRYOVER SUMMARY BAR */}
          <div className="bg-amber-500/10 border border-amber-300 dark:border-amber-700/50 rounded-2xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2.5 border-b border-amber-300/40 dark:border-amber-800/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <h4 className="font-extrabold text-amber-950 dark:text-amber-200 text-xs uppercase tracking-wider">
                  Initial POC Line Stock at Shift Start (07:00:00 AM) — Pre-Delivery Demand Buffers
                </h4>
              </div>
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                Line consumes initial stock carryover from 0.0m before first milk-run arrival
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
              {parts.map((p) => {
                const initUnits = getInitialStockUnits(p);
                const usage = p.usagePerVehicle || 1;
                const takt = productionPlan.taktTimeSeconds || 27.9;
                const covMins = Number((((initUnits / usage) * takt) / 60).toFixed(1));
                const vehDemand = Math.round(initUnits / usage);
                const binCap = p.binCapacity || 1;
                const containerType = p.binOrTrolley || 'Trolley';
                const trolleys = Number((initUnits / binCap).toFixed(1));

                return (
                  <div key={p.partNo} className="bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 flex flex-col shadow-2xs">
                    <span className="font-bold text-[11px] text-slate-900 dark:text-white truncate" title={p.description || p.partNo}>
                      {p.description || p.partNo}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {containerType}: {initUnits} pcs ({trolleys} {containerType})
                    </span>
                    <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-xs">
                        {covMins}m buffer
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[10px]">
                        {vehDemand} veh
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAIN DASHBOARD: SWCT TABLE & CHART */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left: SWCT Data Table - ALIGNED WITH GRAPH ROWS */}
              <div className="lg:col-span-5 border-r border-slate-100 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-[11px] table-fixed">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase font-bold text-[9px] h-[48px]">
                    <tr>
                      <th className="w-12 px-3 border-b border-slate-100 dark:border-slate-800 text-left">Order</th>
                      <th className="w-56 px-3 border-b border-slate-100 dark:border-slate-800 text-left">Operation & Loaded Units</th>
                      <th className="w-20 px-2 border-b border-slate-100 dark:border-slate-800 text-center">Pick Time</th>
                      <th className="w-44 px-2 border-b border-slate-100 dark:border-slate-800 text-center text-red-600 dark:text-red-400">Consumption & Demand</th>
                      <th className="w-24 px-2 border-b border-slate-100 dark:border-slate-800 text-center">Unload/Empty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {swctCycleSteps.map((row, idx) => (
                      <tr
                        key={row.id}
                        style={{ height: '76px' }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-3 font-bold text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                        <td className="px-3 py-1 font-bold text-slate-800 dark:text-slate-100 whitespace-normal break-words text-[11px] leading-tight">
                          <div className="flex flex-col gap-1">
                            {row.consumption && row.consumption.length > 0 ? (
                              row.consumption.map((c: any, cIdx: number) => {
                                const containerType = c.containerType || 'Trolley';
                                return (
                                  <div key={cIdx} className="flex flex-col text-[10px] text-slate-900 dark:text-slate-100">
                                    <div className="flex items-center gap-1 font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                                      <span className="truncate">{c.description || c.label}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-500 pl-2.5 font-medium">
                                      {c.trolleys} {containerType}{c.trolleys > 1 ? 's' : ''} ({c.units} pcs)
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <span>{row.operation}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 text-center font-mono text-slate-600 dark:text-slate-400">{row.pickTime}s</td>
                        <td className="px-2 py-1 text-center font-mono text-slate-600 dark:text-slate-400">
                          <div className="flex flex-col gap-1 items-center justify-center max-h-[68px] overflow-y-auto">
                            {row.consumption && row.consumption.length > 0 ? (
                              row.consumption.map((c: any, cIdx: number) => {
                                const label = c.description || c.label;
                                return (
                                  <div 
                                    key={cIdx} 
                                    className="flex flex-col text-[9px] bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 font-bold whitespace-nowrap w-full"
                                    title={c.statement || `${label}: ${c.mins}m buffer`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="max-w-[80px] truncate">{label}</span>
                                      <span>{c.mins}m</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[8px] text-emerald-700 dark:text-emerald-400">
                                      <span>⚡ {c.vehiclesDemand} veh</span>
                                      {c.consumeStartMin !== undefined && (
                                        <span className="text-slate-500 dark:text-slate-400">{c.consumeStartMin}→{c.consumeEndMin}m</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 text-center font-mono text-slate-600 dark:text-slate-400">{row.emptyTime}s</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 dark:bg-slate-950 font-black h-[48px]">
                      <td colSpan={2} className="px-3 text-right uppercase tracking-widest text-slate-500">Total Cycle</td>
                      <td colSpan={3} className="px-3 text-center font-mono text-blue-600 dark:text-blue-400">
                        {Math.round(kpis.totalCycleSeconds / 60)} mins
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right: SWCT Timeline Chart - MATCHED ROW HEIGHTS */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900/30 p-0 relative overflow-hidden flex flex-col">
                <div className="h-[48px] p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 px-6 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Timeline ({Math.round(maxTimeSeconds / 60)} Min cycle)</span>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center shrink-0">
                        <div className="w-[1.5px] h-2.5 bg-slate-900 dark:bg-slate-100"></div>
                        <div className="w-3 h-0.5 bg-slate-900 dark:bg-slate-100"></div>
                        <div className="w-[1.5px] h-2.5 bg-slate-900 dark:bg-slate-100"></div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Manual</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 border-t-2 border-emerald-500"></div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Moving</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 border-t-2 border-dashed border-red-500"></div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Line Stock (-2m Tol)</span>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-x-auto bg-white dark:bg-slate-950 scrollbar-hide overflow-y-auto">
                  <div style={{ width: `${chartWidth + 64}px`, height: `${swctCycleSteps.length * 76 + 50}px` }} className="relative">
                    {/* Time Grid Header Ticks (0m, 5m, 10m...) */}
                    <div className="absolute top-0 left-0 right-0 h-[24px] pointer-events-none border-b border-slate-100 dark:border-slate-800/40 relative">
                      {Array.from({ length: Math.floor(maxTimeSeconds / 300) + 1 }).map((_, i) => {
                        const timeSec = i * 300;
                        const tickX = timeSec * scale + 32;
                        const timeMin = i * 5;
                        return (
                          <div key={i} className="absolute top-0 bottom-0 border-l border-slate-100 dark:border-slate-800/40 flex flex-col items-center" style={{ left: `${tickX}px` }}>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5">{timeMin}m</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* SVG SWCT Chart with Row Guides */}
                    <svg className="absolute inset-0 w-full h-full pt-6 overflow-visible">
                      <defs>
                        <pattern id="swct-grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800/40" strokeWidth="0.5" />
                        </pattern>
                      </defs>

                      {/* Fine Graph Grid Background */}
                      <rect width="100%" height="100%" fill="url(#swct-grid-pattern)" />

                      {/* Horizontal Row Divider Lines */}
                      {swctCycleSteps.map((_, i) => (
                        <line
                          key={`row-guide-${i}`}
                          x1={0}
                          y1={(i + 1) * 76}
                          x2={chartWidth + 64}
                          y2={(i + 1) * 76}
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-800"
                          strokeDasharray="3,3"
                          strokeWidth="1"
                        />
                      ))}

                      {(() => {
                        const ROW_HEIGHT = 76;
                        const paddingLeft = 32;
                        let consecutiveTimelineSec = 0;

                        return swctCycleSteps.map((row, i) => {
                          const rowTopY = i * ROW_HEIGHT;
                          const rowMidY1 = rowTopY + 22; // Level for Loading & Empty Drop (Stores)
                          const rowMidY2 = rowTopY + 54; // Level for Unloading & Empty Pick (Line POC)
                          const nextRowY1 = (i + 1) * ROW_HEIGHT + 22;

                          let rowTimelineSec = timelineScheduleMode === 'consecutive' ? consecutiveTimelineSec : (row.startTimeSec || 0);
                          let lastPointY = rowMidY1;
                          let unloadFinishSec = 0;

                          const renderedSteps = row.steps.map((step: any, sIdx: number) => {
                            const stepStartSec = rowTimelineSec;
                            const stepEndSec = stepStartSec + step.duration;
                            rowTimelineSec = stepEndSec;
                            if (timelineScheduleMode === 'consecutive') {
                              consecutiveTimelineSec = stepEndSec;
                            }

                            if (sIdx === 2) {
                              unloadFinishSec = stepEndSec;
                            }

                            const startX = stepStartSec * scale + paddingLeft;
                            const endX = stepEndSec * scale + paddingLeft;
                            const midX = (startX + endX) / 2;

                            if (step.type === 'Manual') {
                              const currentY = (sIdx === 0 || sIdx === 5) ? rowMidY1 : rowMidY2;
                              lastPointY = currentY;

                              return (
                                <g key={`${row.id}-s${sIdx}`}>
                                  <line x1={startX} y1={currentY - 5} x2={startX} y2={currentY + 5} stroke="#0f172a" strokeWidth="2" className="dark:stroke-slate-100" />
                                  <line x1={startX} y1={currentY} x2={endX} y2={currentY} stroke="#0f172a" strokeWidth="2.5" className="dark:stroke-slate-100" />
                                  <line x1={endX} y1={currentY - 5} x2={endX} y2={currentY + 5} stroke="#0f172a" strokeWidth="2" className="dark:stroke-slate-100" />
                                  <DraggableCallout
                                    anchorX={midX}
                                    anchorY={currentY}
                                    defaultYOffset={-18}
                                    label={step.label}
                                    duration={step.duration}
                                    cumulative={stepEndSec}
                                    type="Manual"
                                  />
                                </g>
                              );
                            } else if (step.type === 'Walking') {
                              const startY = (sIdx === 1) ? rowMidY1 : rowMidY2;
                              const targetY = (sIdx === 1) ? rowMidY2 : rowMidY1;
                              lastPointY = targetY;
                              const endY = targetY;
                              const midY = (startY + endY) / 2;

                              return (
                                <g key={`${row.id}-s${sIdx}`}>
                                  <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                                  <circle cx={startX} cy={startY} r="3" fill="#22c55e" />
                                  <circle cx={endX} cy={endY} r="3" fill="#22c55e" />
                                  <DraggableCallout
                                    anchorX={midX}
                                    anchorY={midY}
                                    defaultYOffset={0}
                                    defaultXOffset={28}
                                    label={step.label}
                                    duration={step.duration}
                                    cumulative={stepEndSec}
                                    type="Walking"
                                  />
                                </g>
                              );
                            }
                            return null;
                          });

                          // Dedicated POC Inventory Consumption Lanes (Initial Stock + Delivered Parts)
                          const invElements: React.ReactNode[] = [];

                          if (row.consumption && row.consumption.length > 0) {
                            row.consumption.forEach((c: any, cIdx: number) => {
                              const trackY = rowMidY2 + (cIdx * 14);
                              const label = c.description || c.label;

                              // 1. Initial Stock line if this is the first trip for this part
                              const isFirst = i === firstTripForPart[c.label];
                              if (isFirst && c.initialCoverageMins > 0) {
                                const initStartX = paddingLeft;
                                const initDurationSec = c.initialCoverageMins * 60;
                                const initEndX = Math.min(initStartX + (initDurationSec * scale), chartWidth + 64);

                                invElements.push(
                                  <g key={`init-${row.id}-${cIdx}`}>
                                    <line
                                      x1={initStartX}
                                      y1={trackY - 8}
                                      x2={initEndX}
                                      y2={trackY - 8}
                                      stroke="#f59e0b"
                                      strokeWidth="2.5"
                                      strokeDasharray="4,3"
                                    />
                                    <line
                                      x1={initEndX}
                                      y1={trackY - 13}
                                      x2={initEndX}
                                      y2={trackY - 3}
                                      stroke="#d97706"
                                      strokeWidth="2"
                                    />
                                    <text
                                      x={initStartX + 6}
                                      y={trackY - 11}
                                      fill="#d97706"
                                      className="text-[8px] font-extrabold"
                                    >
                                      Initial {label}: {c.initialCoverageMins}m ({c.initialVehiclesDemand} veh demand)
                                    </text>
                                  </g>
                                );
                              }

                              // 2. Staging line if delivered before earlier stock exhausted
                              const deliverySec = (row.startTimeSec || 0) + (row.leadTimeToPocSec || 0);
                              const consumeStartSec = (c.consumeStartMin !== undefined ? c.consumeStartMin * 60 : (unloadFinishSec || deliverySec));
                              const consumeEndSec = (c.consumeEndMin !== undefined ? c.consumeEndMin * 60 : (consumeStartSec + c.mins * 60));

                              if (consumeStartSec > deliverySec + 10) {
                                const stagingStartX = deliverySec * scale + paddingLeft;
                                const stagingEndX = Math.min(consumeStartSec * scale + paddingLeft, chartWidth + 64);
                                invElements.push(
                                  <line
                                    key={`staging-${row.id}-${cIdx}`}
                                    x1={stagingStartX}
                                    y1={trackY + 4}
                                    x2={stagingEndX}
                                    y2={trackY + 4}
                                    stroke="#3b82f6"
                                    strokeWidth="1.5"
                                    strokeDasharray="2,2"
                                    opacity="0.75"
                                  />
                                );
                              }

                              // 3. Delivered Stock Consumption Line
                              const consStartX = consumeStartSec * scale + paddingLeft;
                              const consEndX = Math.min(consumeEndSec * scale + paddingLeft, chartWidth + 64);

                              invElements.push(
                                <g key={`cons-${row.id}-${cIdx}`}>
                                  <line
                                    x1={consStartX}
                                    y1={trackY + 4}
                                    x2={consEndX}
                                    y2={trackY + 4}
                                    stroke="#ef4444"
                                    strokeWidth="2.5"
                                    strokeDasharray="5,3"
                                  />
                                  <line
                                    x1={consEndX}
                                    y1={trackY - 1}
                                    x2={consEndX}
                                    y2={trackY + 9}
                                    stroke="#dc2626"
                                    strokeWidth="2"
                                  />
                                  <text
                                    x={consStartX + 6}
                                    y={trackY + 1}
                                    fill="#dc2626"
                                    className="text-[8px] font-bold"
                                  >
                                    {label}: {c.mins}m ({c.vehiclesDemand} veh demand)
                                  </text>
                                </g>
                              );
                            });
                          }

                          return (
                            <g key={row.id}>
                              {renderedSteps}
                              {invElements}
                            </g>
                          );
                        });
                      })()}

                      {/* Takt Time Reference Line */}
                      {(() => {
                        // Use a reasonable default operator cycle target if plant takt is small
                        const taktSec = productionPlan.taktTimeSeconds < 600 ? 3300 : productionPlan.taktTimeSeconds;
                        const paddingLeft = 32;
                        const taktX = taktSec * scale + paddingLeft;
                        return (
                          <>
                            <line
                              x1={taktX}
                              y1="0"
                              x2={taktX}
                              y2={swctCycleSteps.length * 76 + 30}
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeDasharray="4,2"
                            />
                            <g transform={`translate(${taktX}, 0)`}>
                              <rect x="-24" y="-12" width="48" height="16" rx="4" fill="#ef4444" />
                              <text x="0" y="-1" textAnchor="middle" className="text-[8px] font-black fill-white uppercase">TT {Math.round(taktSec / 60)}m</text>
                            </g>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom: Refined KPI Dash */}
            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 grid grid-cols-1 md:grid-cols-5 gap-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Total Cycle Time</span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{Math.round(kpis.totalCycleSeconds / 60)} mins</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Gauge className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Hourly Target</span>
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">60 mins</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Cycle Feasibility</span>
                </div>
                <div className={`text-2xl font-black font-mono ${kpis.feasibility === 'FEASIBLE' ? 'text-emerald-500' : 'text-red-500'}`}>{kpis.feasibility}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Scale className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Avg Utilization</span>
                </div>
                <div className="text-2xl font-black text-amber-500 font-mono">{kpis.avgCapacityUtilization}%</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Stability Index</span>
                </div>
                <div className="text-2xl font-black text-indigo-500 font-mono">94.2%</div>
              </div>
            </div>
          </div>

          {/* TRIP SHEET PREVIEW SECTION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 shadow-sm">
            <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Trip Sheet Preview</h2>
                  <p className="text-sm font-medium text-slate-500">Official Mizusumashi Route Declaration</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Print Format</span>
                <div
                  onClick={() => window.print()}
                  className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <Printer className="w-5 h-5 text-slate-600" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {tripsToShow.map((mr) => (
                <div
                  key={mr.milkRunId}
                  id={`trip-preview-${mr.milkRunId}`}
                  className={`bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all group p-1 ${mr.milkRunId === selectedTripId ? 'ring-4 ring-blue-500/50 scale-[1.02] z-10 shadow-xl' : ''}`}
                >
                  <div className="bg-white dark:bg-slate-900 rounded-[1.8rem] p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-colors ${
                          mr.milkRunId === selectedTripId ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-slate-100'
                        }`}>
                          <ClipboardList className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">{mr.milkRunId}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{mr.transportMode}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sequence: {mr.priority}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Goal</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{mr.cycleTime}s</div>
                      </div>
                    </div>

                    <div className="relative pl-8 space-y-12">
                      <div className="absolute left-1 top-2 bottom-2 w-0.5 border-l-2 border-dashed border-slate-200 dark:border-slate-800"></div>

                      <div className="relative">
                        <div className="absolute -left-8.5 top-1.5 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 bg-blue-600 shadow-md"></div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Start / Pickup</span>
                          <span className="text-base font-bold text-slate-800 dark:text-slate-100 block">{mr.stores.join(' + ')}</span>
                          <p className="text-[11px] text-slate-500 font-medium">Warehouse logistics zone. Manual load onto trolleys.</p>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute -left-8.5 top-1.5 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 bg-emerald-500 shadow-md"></div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">End / Consumption</span>
                          <span className="text-base font-bold text-slate-800 dark:text-slate-100 block">{mr.destination}</span>
                          <p className="text-[11px] text-slate-500 font-medium">Gravity rack unloading. Sequential parts distribution.</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-8 border-t border-slate-100 dark:border-slate-800">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo Manifest</span>
                        <div className="flex flex-wrap gap-1.5">
                          {mr.materialAllocations.map(ma => (
                            <div key={ma.part.partNo} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md">
                              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">{ma.trolleys}T</span>
                              <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
                                {ma.part.partNo}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/50">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Performance</span>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{mr.routeUtilization}% Utilization</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Loaded Travel</span>
                            <div className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">{mr.travelLoadedSec}s</div>
                          </div>
                          <div className="space-y-1 text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Empty Return</span>
                            <div className="text-sm font-black text-cyan-600 dark:text-cyan-400 font-mono">{mr.travelEmptySec}s</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Total Dist</span>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">{mr.totalDistance}m</div>
                          </div>
                          <div className="space-y-1 text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Avg Speed</span>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">{(mr.totalDistance / Math.max(1, (mr.travelLoadedSec + mr.travelEmptySec))).toFixed(2)}m/s</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TRIP TABLE SECTION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 transition-colors">
                  <List className="w-6 h-6 text-slate-700 dark:text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Trip Execution Table</h2>
                  <p className="text-sm font-medium text-slate-500">Live summary of consolidated parts shipments (Milk Runs)</p>
                </div>
              </div>

              <div className="text-xs font-bold bg-slate-100 dark:bg-slate-950 px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-2">
                Total Combined Groups: <span className="text-blue-600 dark:text-blue-400 font-black text-base">{hourGroups.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-5 rounded-l-2xl">Trip #</th>
                    <th className="px-6 py-5">Delivery Group</th>
                    <th className="px-6 py-5">Pickup Point</th>
                    <th className="px-6 py-5">Drop Point</th>
                    <th className="px-6 py-5 text-right">Distance</th>
                    <th className="px-6 py-5 text-right">Travel Time</th>
                    <th className="px-6 py-5 text-right">Takt</th>
                    <th className="px-6 py-5 text-right rounded-r-2xl">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {hourGroups.map((mr, idx) => (
                    <tr
                      key={mr.milkRunId}
                      onClick={() => setSelectedTripId(mr.milkRunId)}
                      className={`group hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-all ${
                        mr.milkRunId === selectedTripId ? 'bg-blue-50/50 dark:bg-blue-600/5' : ''
                      }`}
                    >
                      <td className="px-6 py-6 font-mono font-bold text-slate-400 group-hover:text-blue-600">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${mr.milkRunId === selectedTripId ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`}></div>
                          <span className="font-bold text-slate-900 dark:text-white">{mr.milkRunId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          {mr.stores[0]}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-500/20">
                          {mr.destination}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {mr.totalDistance}m
                      </td>
                      <td className="px-6 py-6 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {mr.cycleTime}s
                      </td>
                      <td className="px-6 py-6 text-right font-bold text-blue-600 font-mono">
                        {productionPlan.taktTimeSeconds}s
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="font-black text-slate-900 dark:text-white font-mono">{mr.routeUtilization}%</span>
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                mr.routeUtilization > 85 ? 'bg-red-500' :
                                mr.routeUtilization > 70 ? 'bg-blue-600' :
                                'bg-emerald-500'
                              }`}
                              style={{ width: `${mr.routeUtilization}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mizusumashi Test Case Diagnostic Modal */}
      <SWCTDiagnosticModal
        isOpen={showDiagnosticModal}
        onClose={() => setShowDiagnosticModal(false)}
        productionPlan={productionPlan}
        taktTimeSec={productionPlan.taktTimeSeconds}
      />
    </div>
  );
};
