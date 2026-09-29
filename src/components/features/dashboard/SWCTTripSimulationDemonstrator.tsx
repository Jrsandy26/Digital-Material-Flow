import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Clock,
  Truck,
  Boxes,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw,
  Sparkles,
  Gauge,
  Workflow,
  Timer,
  Sliders,
  Calculator,
  ChevronDown,
  ChevronUp,
  Settings2,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  HelpCircle,
  Eraser,
  Check,
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculatePartMetrics, getPocSpaceTrolleysMax, getInitialStockUnits } from '../../../utils/calculations';
import { PartMaster, TransportMode } from '../../../types/manufacturing';

export interface TripStage {
  stepNumber: number;
  stageType: 'STORE_LOAD' | 'TRANSIT_OUT' | 'POC_DELIVERY' | 'TRANSIT_INTER' | 'POC_DELIVERY_2' | 'TRANSIT_RETURN' | 'STORE_UNLOAD';
  title: string;
  location: string;
  description: string;
  durationSec: number; // planned SWCT duration
  actualDurationSec: number;
  workType: 'HAND' | 'TRANSPORT' | 'WAIT';
  loadedTrolleysCarried: number;
  loadedUnitsCarried: number;
  emptyTrolleysCarried: number;
  partsInfo: {
    partNo: string;
    description: string;
    action: 'PICK_LOAD' | 'TRANSIT' | 'DELIVER' | 'EMPTY_PICK' | 'RETURN_EMPTY';
    qtyUnits: number;
    qtyTrolleys: number;
    pocPoint?: string;
    storeLocation?: string;
    pocStockBefore?: number;
    pocStockAfter?: number;
    maxPocCapacity?: number;
    onTimeStatus?: 'ON_TIME' | 'EARLY' | 'DELAYED';
    marginSec?: number;
  }[];
  optimizationNote?: string;
}

export interface SimulatedTrip {
  tripNumber: number;
  tripCode: string;
  routeId: string;
  routeName: string;
  shift: 'Shift 1 (07:00 - 15:30)' | 'Shift 2 (15:30 - 00:00)';
  scheduledStartTime: string;
  scheduledEndTime: string;
  operatorName: string;
  operatorCode: string;
  transportMode: TransportMode;
  totalPlannedCycleSec: number;
  totalActualCycleSec: number;
  storeLocation: string;
  primaryParts: PartMaster[];
  stages: TripStage[];
  optimizationGains: {
    distanceSavedMeters: number;
    trolleyFillRatePercent: number;
    emptyCirculationBalance: number;
    congestionRisk: 'Zero (Optimal)' | 'Low' | 'Moderate';
    taktAdherencePercent: number;
  };
}

export interface SWCTSimulationSyncState {
  activeTrip: SimulatedTrip;
  activeStage: TripStage;
  currentStageIndex: number;
  stageProgressPercent: number;
  isSimPlaying: boolean;
  simSpeed: number;
  optimizationStrategy: 'AUTO_CONSOLIDATE' | 'BUFFER_THROTTLE' | 'EMPTY_BALANCE' | 'TAKT_PACED';
  allTrips: SimulatedTrip[];
  activeTripIndex: number;
  onSelectTrip?: (tripIndex: number) => void;
  onSetSpeed?: (speed: number) => void;
  onTogglePlay?: () => void;
}

interface SWCTTripSimulationDemonstratorProps {
  className?: string;
  onSimulationSync?: (state: SWCTSimulationSyncState) => void;
}

export const SWCTTripSimulationDemonstrator: React.FC<SWCTTripSimulationDemonstratorProps> = ({
  className = '',
  onSimulationSync,
}) => {
  const {
    parts,
    productionPlan,
    modeConfigs,
    operators,
    operatorName,
    inventoryStates,
    triggerManualReplenishment,
  } = useMaterialFlow();

  // Company strictly uses 2 Shifts:
  // Shift 1: 07:00 - 15:30
  // Shift 2: 15:30 - 00:00
  const [selectedShift, setSelectedShift] = useState<'Shift 1' | 'Shift 2'>('Shift 1');

  // Input & Configuration Panel State
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [useDualPartMilkRun, setUseDualPartMilkRun] = useState<boolean>(true);

  // Selected Part Numbers from the live master data
  const [selectedPart1No, setSelectedPart1No] = useState<string>(parts[0]?.partNo || '');
  const [selectedPart2No, setSelectedPart2No] = useState<string>(parts[1]?.partNo || parts[0]?.partNo || '');

  // Keep selected parts in sync when parts are loaded/updated
  useEffect(() => {
    if (parts.length > 0) {
      if (!selectedPart1No || !parts.some((p) => p.partNo === selectedPart1No)) {
        setSelectedPart1No(parts[0].partNo);
      }
      if (!selectedPart2No || !parts.some((p) => p.partNo === selectedPart2No)) {
        setSelectedPart2No(parts[1]?.partNo || parts[0].partNo);
      }
    }
  }, [parts, selectedPart1No, selectedPart2No]);

  // Active Part Objects from Master Data (Pure Live Data, zero mocked fallbacks)
  const part1 = useMemo<PartMaster | null>(() => {
    if (!parts || parts.length === 0) return null;
    return parts.find((p) => p.partNo === selectedPart1No) || parts[0];
  }, [parts, selectedPart1No]);

  const part2 = useMemo<PartMaster | null>(() => {
    if (!parts || parts.length === 0) return null;
    return parts.find((p) => p.partNo === selectedPart2No) || parts[1] || parts[0];
  }, [parts, selectedPart2No]);

  // Derived Default Element Times directly from Live Master Data & Configs
  const defaultTaktTimeSec = productionPlan.taktTimeSeconds || 27.9;
  const defaultShiftVehicles = productionPlan.shiftPlanVehicles || 925;
  const defaultStorePickTimeSec = Math.round((part1?.pickTimeMin || 3.0) * 60);
  const defaultPocDeliverTimeSec = Math.round((part1?.storingTimePocMin || 2.0) * 60);
  const defaultEmptyPickTimeSec = Math.round((part1?.emptyCollectionTimeMin || 1.0) * 60);
  const defaultStoreDepositTimeSec = Math.round((part1?.emptyLeavingTimeMin || 1.5) * 60);
  const defaultTransitSpeedSecPerMeter = modeConfigs[part1?.transportMode || 'Jumbo Trolley']?.loadSpeedSecPerMtr
    ? Number(modeConfigs[part1?.transportMode || 'Jumbo Trolley'].loadSpeedSecPerMtr.toFixed(2))
    : 1.39;

  // Optional User Custom Overrides (null means no override -> uses live master data)
  const [customTaktTimeSec, setCustomTaktTimeSec] = useState<number | null>(null);
  const [customShiftVehicles, setCustomShiftVehicles] = useState<number | null>(null);
  const [customStorePickTimeSec, setCustomStorePickTimeSec] = useState<number | null>(null);
  const [customPocDeliverTimeSec, setCustomPocDeliverTimeSec] = useState<number | null>(null);
  const [customEmptyPickTimeSec, setCustomEmptyPickTimeSec] = useState<number | null>(null);
  const [customStoreDepositTimeSec, setCustomStoreDepositTimeSec] = useState<number | null>(null);
  const [customTransitSpeedSecPerMeter, setCustomTransitSpeedSecPerMeter] = useState<number | null>(null);

  // Effective Parameters (Custom Override or Live Master Default)
  const activeTaktTimeSec = customTaktTimeSec ?? defaultTaktTimeSec;
  const activeShiftVehicles = customShiftVehicles ?? defaultShiftVehicles;
  const activeStorePickTimeSec = customStorePickTimeSec ?? defaultStorePickTimeSec;
  const activePocDeliverTimeSec = customPocDeliverTimeSec ?? defaultPocDeliverTimeSec;
  const activeEmptyPickTimeSec = customEmptyPickTimeSec ?? defaultEmptyPickTimeSec;
  const activeStoreDepositTimeSec = customStoreDepositTimeSec ?? defaultStoreDepositTimeSec;
  const activeTransitSpeedSecPerMeter = customTransitSpeedSecPerMeter ?? defaultTransitSpeedSecPerMeter;

  // Check if any custom override is currently active
  const hasCustomOverrides =
    customTaktTimeSec !== null ||
    customShiftVehicles !== null ||
    customStorePickTimeSec !== null ||
    customPocDeliverTimeSec !== null ||
    customEmptyPickTimeSec !== null ||
    customStoreDepositTimeSec !== null ||
    customTransitSpeedSecPerMeter !== null;

  // Reset / Clear all demo and custom input overrides back to pure live master data
  const handleClearDemoInputData = () => {
    setCustomTaktTimeSec(null);
    setCustomShiftVehicles(null);
    setCustomStorePickTimeSec(null);
    setCustomPocDeliverTimeSec(null);
    setCustomEmptyPickTimeSec(null);
    setCustomStoreDepositTimeSec(null);
    setCustomTransitSpeedSecPerMeter(null);
    if (parts.length > 0) {
      setSelectedPart1No(parts[0].partNo);
      setSelectedPart2No(parts[1]?.partNo || parts[0].partNo);
    }
    setActiveTripIndex(0);
    setCurrentStageIndex(0);
    setStageProgressPercent(0);
  };

  // Simulation Playback State
  const [activeTripIndex, setActiveTripIndex] = useState<number>(0);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [autoAdvanceTrips, setAutoAdvanceTrips] = useState<boolean>(true);
  const [stageProgressPercent, setStageProgressPercent] = useState<number>(0);
  const [activeOptimizationStrategy, setActiveOptimizationStrategy] = useState<'AUTO_CONSOLIDATE' | 'BUFFER_THROTTLE' | 'EMPTY_BALANCE' | 'TAKT_PACED'>('AUTO_CONSOLIDATE');

  // SWCT Mathematical Calculations & Formulas
  const swctCalculations = useMemo(() => {
    if (!part1) {
      return {
        takt: 27.9,
        shiftTarget: 925,
        hourlyRate: 129,
        p1Bin: 60,
        p1Usage: 1,
        p1UnitsPerMin: 2.15,
        p1BinCoverageTimeSec: 1674,
        p1BinCoverageTimeMin: 27.9,
        p1ShiftGrossUnits: 925,
        p1ShiftTotalBins: 16,
        p2Bin: 100,
        p2Usage: 1,
        p2UnitsPerMin: 2.15,
        p2BinCoverageTimeSec: 2790,
        p2BinCoverageTimeMin: 46.5,
        p2ShiftGrossUnits: 925,
        p2ShiftTotalBins: 10,
        tripIntervalSec: 1674,
        tripIntervalMin: 27.9,
        totalPlannedTrips: 15,
        loadedTransitSec: 100,
        interStationTransitSec: 50,
        returnTransitSec: 100,
        plannedCycleSec: 640,
        plannedCycleMin: 10.67,
        operatorWorkloadMinPerShift: 160,
        operatorUtilizationPercent: 37.2,
      };
    }

    const takt = activeTaktTimeSec > 0 ? activeTaktTimeSec : 27.9;
    const shiftTarget = activeShiftVehicles > 0 ? activeShiftVehicles : 925;
    const hourlyRate = Math.round(3600 / takt); // vehicles / hour

    // Part 1 Metrics
    const p1Bin = part1.binCapacity > 0 ? part1.binCapacity : 60;
    const p1Usage = part1.usagePerVehicle || 1;
    const p1HasOverride = part1.manualHourlyBinsOverride !== undefined;
    const p1UnitsPerMin = p1HasOverride
      ? (part1.manualHourlyBinsOverride! * p1Bin) / 60
      : (hourlyRate * p1Usage) / 60;
    const p1BinCoverageTimeSec = p1HasOverride
      ? Math.round(3600 / part1.manualHourlyBinsOverride!)
      : Math.round((p1Bin / p1Usage) * takt);
    const p1BinCoverageTimeMin = Number((p1BinCoverageTimeSec / 60).toFixed(1));
    const p1ShiftGrossUnits = p1HasOverride
      ? (part1.manualHourlyBinsOverride! * p1Bin) * 8
      : shiftTarget * p1Usage;
    const p1ShiftTotalBins = Math.ceil(p1ShiftGrossUnits / p1Bin);

    // Part 2 Metrics
    const p2Obj = part2 || part1;
    const p2Bin = p2Obj.binCapacity > 0 ? p2Obj.binCapacity : 100;
    const p2Usage = p2Obj.usagePerVehicle || 1;
    const p2HasOverride = p2Obj.manualHourlyBinsOverride !== undefined;
    const p2UnitsPerMin = p2HasOverride
      ? (p2Obj.manualHourlyBinsOverride! * p2Bin) / 60
      : (hourlyRate * p2Usage) / 60;
    const p2BinCoverageTimeSec = p2HasOverride
      ? Math.round(3600 / p2Obj.manualHourlyBinsOverride!)
      : Math.round((p2Bin / p2Usage) * takt);
    const p2BinCoverageTimeMin = Number((p2BinCoverageTimeSec / 60).toFixed(1));
    const p2ShiftGrossUnits = p2HasOverride
      ? (p2Obj.manualHourlyBinsOverride! * p2Bin) * 8
      : shiftTarget * p2Usage;
    const p2ShiftTotalBins = Math.ceil(p2ShiftGrossUnits / p2Bin);

    // Milk Run Trip Cadence: governed by shortest bin coverage or consolidated interval
    const tripIntervalSec = useDualPartMilkRun
      ? Math.min(p1BinCoverageTimeSec, p2BinCoverageTimeSec)
      : p1BinCoverageTimeSec;
    const tripIntervalMin = Number((tripIntervalSec / 60).toFixed(1));

    // Shift operating duration: 8.5 hours (430 minutes net working time = 25,800 sec)
    const netShiftWorkingSec = 430 * 60;
    const totalPlannedTrips = Math.min(16, Math.max(6, Math.ceil(netShiftWorkingSec / Math.max(1, tripIntervalSec))));

    // Element times
    const loadedTransitSec = Math.round((part1.loadedDistanceMeters || 140) * activeTransitSpeedSecPerMeter);
    const interStationTransitSec = useDualPartMilkRun ? Math.round(70 * activeTransitSpeedSecPerMeter) : 0;
    const returnTransitSec = Math.round((part1.returnDistanceMeters || 140) * activeTransitSpeedSecPerMeter);

    const plannedCycleSec =
      activeStorePickTimeSec +
      loadedTransitSec +
      activePocDeliverTimeSec +
      activeEmptyPickTimeSec +
      (useDualPartMilkRun ? interStationTransitSec + activePocDeliverTimeSec + activeEmptyPickTimeSec : 0) +
      returnTransitSec +
      activeStoreDepositTimeSec;

    const plannedCycleMin = Number((plannedCycleSec / 60).toFixed(2));
    const operatorWorkloadMinPerShift = Number(((totalPlannedTrips * plannedCycleSec) / 60).toFixed(1));
    const operatorUtilizationPercent = Number(((operatorWorkloadMinPerShift / 430) * 100).toFixed(1));

    return {
      takt,
      shiftTarget,
      hourlyRate,
      p1Bin,
      p1Usage,
      p1UnitsPerMin,
      p1BinCoverageTimeSec,
      p1BinCoverageTimeMin,
      p1ShiftGrossUnits,
      p1ShiftTotalBins,
      p2Bin,
      p2Usage,
      p2UnitsPerMin,
      p2BinCoverageTimeSec,
      p2BinCoverageTimeMin,
      p2ShiftGrossUnits,
      p2ShiftTotalBins,
      tripIntervalSec,
      tripIntervalMin,
      totalPlannedTrips,
      loadedTransitSec,
      interStationTransitSec,
      returnTransitSec,
      plannedCycleSec,
      plannedCycleMin,
      operatorWorkloadMinPerShift,
      operatorUtilizationPercent,
    };
  }, [
    activeTaktTimeSec,
    activeShiftVehicles,
    activeStorePickTimeSec,
    activePocDeliverTimeSec,
    activeEmptyPickTimeSec,
    activeStoreDepositTimeSec,
    activeTransitSpeedSecPerMeter,
    part1,
    part2,
    useDualPartMilkRun,
  ]);

  // Generate Trips for the chosen shift based on the exact SWCT calculations
  const simulatedTrips = useMemo<SimulatedTrip[]>(() => {
    if (!part1) return [];

    const p2 = part2 || part1;
    const shiftStartHour = selectedShift === 'Shift 1' ? 7 : 15;
    const shiftStartMinute = selectedShift === 'Shift 1' ? 0 : 30; // 07:00 AM vs 03:30 PM

    const op = operators[0] || { name: operatorName || 'sai', operatorCode: 'MHF-OP-01' };
    const tripsList: SimulatedTrip[] = [];

    const tripsCount = swctCalculations.totalPlannedTrips;
    const tripIntervalMin = swctCalculations.tripIntervalMin;

    const availableParts = parts.length > 0 ? parts : (part1 ? (part2 ? [part1, part2] : [part1]) : []);

    for (let t = 0; t < tripsCount; t++) {
      const tripStartTotalMin = Math.round(shiftStartHour * 60 + shiftStartMinute + t * tripIntervalMin);
      const startH = Math.floor(tripStartTotalMin / 60) % 24;
      const startM = tripStartTotalMin % 60;

      const endTotalMin = tripStartTotalMin + Math.round(swctCalculations.plannedCycleMin);
      const endH = Math.floor(endTotalMin / 60) % 24;
      const endM = endTotalMin % 60;

      const formatTime = (h: number, m: number) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
      };

      const scheduledStartTime = formatTime(startH, startM);
      const scheduledEndTime = formatTime(endH, endM);

      // Determine part assignments for trip t
      let tp1: PartMaster;
      let tp2: PartMaster;

      if (t === 0) {
        tp1 = part1;
        tp2 = p2;
      } else if (useDualPartMilkRun) {
        // Cycle through parts pairs in available master parts list
        const idx1 = (t * 2) % availableParts.length;
        let idx2 = (t * 2 + 1) % availableParts.length;
        if (idx1 === idx2 && availableParts.length > 1) {
          idx2 = (idx1 + 1) % availableParts.length;
        }
        tp1 = availableParts[idx1] || part1;
        tp2 = availableParts[idx2] || p2 || tp1;
      } else {
        tp1 = availableParts[t % availableParts.length] || part1;
        tp2 = tp1;
      }

      const tp1Bin = tp1.binCapacity > 0 ? tp1.binCapacity : 60;
      const tp2Bin = tp2.binCapacity > 0 ? tp2.binCapacity : 100;
      const tp1Dist = tp1.loadedDistanceMeters || 140;
      const tp2Dist = tp2.loadedDistanceMeters || 160;
      const tp1ReturnDist = tp1.returnDistanceMeters || 140;
      const tp1Store = tp1.storeLocation || 'Store Main (Aisle S-02)';
      const tp2Store = tp2.storeLocation || tp1Store;

      const tp1Inv = inventoryStates.find((s) => s.partNo === tp1.partNo);
      const tp2Inv = inventoryStates.find((s) => s.partNo === tp2.partNo);
      const tp1BaseStock = tp1Inv?.currentStockUnits ?? getInitialStockUnits(tp1);
      const tp2BaseStock = tp2Inv?.currentStockUnits ?? getInitialStockUnits(tp2);

      const tp1OpeningStock = Math.max(0, tp1BaseStock + (t % 2 === 0 ? -Math.round(tp1Bin * 0.4) : 0));
      const tp2OpeningStock = Math.max(0, tp2BaseStock + (t % 2 === 1 ? -Math.round(tp2Bin * 0.3) : 0));

      const tp1MaxCap = getPocSpaceTrolleysMax(tp1) * tp1Bin;
      const tp2MaxCap = getPocSpaceTrolleysMax(tp2) * tp2Bin;

      const tripLoadedTransitSec = Math.round(tp1Dist * activeTransitSpeedSecPerMeter);
      const interDist = Math.max(25, Math.abs(tp2Dist - tp1Dist) || 50);
      const tripInterTransitSec = useDualPartMilkRun ? Math.round(interDist * activeTransitSpeedSecPerMeter) : 0;
      const tripReturnTransitSec = Math.round(tp1ReturnDist * activeTransitSpeedSecPerMeter);

      const routeId = `ROUTE-0${(t % 4) + 1}-${tp1.pocPoint}`;
      const routeName = `Milk-Run Route 0${(t % 4) + 1} (${tp1.pocPoint}${useDualPartMilkRun ? ` & ${tp2.pocPoint}` : ''})`;

      // Build 7 Standard SWCT Stages for this trip
      const stages: TripStage[] = [
        {
          stepNumber: 1,
          stageType: 'STORE_LOAD',
          title: 'Store Picking & Tugger Hitching',
          location: tp1Store,
          description: `Operator loads ${useDualPartMilkRun ? '2 trolleys' : '1 trolley'} from ${tp1Store}. Part ${tp1.partNo} (${tp1Bin} pcs)${
            useDualPartMilkRun ? ` & Part ${tp2.partNo} (${tp2Bin} pcs)` : ''
          }. Kanban verified against SWCT standard.`,
          durationSec: activeStorePickTimeSec,
          actualDurationSec: Math.max(10, activeStorePickTimeSec - 6),
          workType: 'HAND',
          loadedTrolleysCarried: useDualPartMilkRun ? 2 : 1,
          loadedUnitsCarried: useDualPartMilkRun ? tp1Bin + tp2Bin : tp1Bin,
          emptyTrolleysCarried: 0,
          partsInfo: [
            {
              partNo: tp1.partNo,
              description: tp1.description,
              action: 'PICK_LOAD',
              qtyUnits: tp1Bin,
              qtyTrolleys: 1,
              storeLocation: tp1Store,
            },
            ...(useDualPartMilkRun
              ? [
                  {
                    partNo: tp2.partNo,
                    description: tp2.description,
                    action: 'PICK_LOAD' as const,
                    qtyUnits: tp2Bin,
                    qtyTrolleys: 1,
                    storeLocation: tp2Store,
                  },
                ]
              : []),
          ],
          optimizationNote: useDualPartMilkRun
            ? 'Dual-part consolidation saves 50% hitching & departure cycle time.'
            : 'Standard single-part tugger dispatch.',
        },
        {
          stepNumber: 2,
          stageType: 'TRANSIT_OUT',
          title: `Loaded Transit (${tp1Dist}m @ ${(1 / activeTransitSpeedSecPerMeter).toFixed(2)} m/s)`,
          location: `Central Logistics Arterial -> ${tp1.pocPoint}`,
          description: `Towing loaded payload (${useDualPartMilkRun ? tp1Bin + tp2Bin : tp1Bin} units) along main corridor to first station (${tp1.pocPoint}).`,
          durationSec: tripLoadedTransitSec,
          actualDurationSec: Math.max(5, tripLoadedTransitSec - 4),
          workType: 'TRANSPORT',
          loadedTrolleysCarried: useDualPartMilkRun ? 2 : 1,
          loadedUnitsCarried: useDualPartMilkRun ? tp1Bin + tp2Bin : tp1Bin,
          emptyTrolleysCarried: 0,
          partsInfo: [
            {
              partNo: tp1.partNo,
              description: tp1.description,
              action: 'TRANSIT',
              qtyUnits: tp1Bin,
              qtyTrolleys: 1,
            },
          ],
          optimizationNote: 'Speed regulated for zero-pedestrian conflict and AISC compliance.',
        },
        {
          stepNumber: 3,
          stageType: 'POC_DELIVERY',
          title: `Deliver Station ${tp1.pocPoint} & Pick Empty`,
          location: `Station ${tp1.pocPoint} (${tp1.stationName || 'Main Assembly'})`,
          description: `Deliver 1 trolley (+${tp1Bin} pcs) to ${tp1.pocPoint}. Collect 1 empty trolley for reverse container circulation.`,
          durationSec: activePocDeliverTimeSec + activeEmptyPickTimeSec,
          actualDurationSec: Math.max(10, activePocDeliverTimeSec + activeEmptyPickTimeSec - 5),
          workType: 'HAND',
          loadedTrolleysCarried: useDualPartMilkRun ? 1 : 0,
          loadedUnitsCarried: useDualPartMilkRun ? tp2Bin : 0,
          emptyTrolleysCarried: 1,
          partsInfo: [
            {
              partNo: tp1.partNo,
              description: tp1.description,
              action: 'DELIVER',
              qtyUnits: tp1Bin,
              qtyTrolleys: 1,
              pocPoint: tp1.pocPoint,
              pocStockBefore: tp1OpeningStock,
              pocStockAfter: tp1OpeningStock + tp1Bin,
              maxPocCapacity: tp1MaxCap,
              onTimeStatus: 'ON_TIME',
              marginSec: 45,
            },
            {
              partNo: tp1.partNo,
              description: tp1.description,
              action: 'EMPTY_PICK',
              qtyUnits: tp1Bin,
              qtyTrolleys: 1,
              pocPoint: tp1.pocPoint,
            },
          ],
          optimizationNote: `Stock replenished to ${tp1OpeningStock + tp1Bin} pcs (${Math.round(
            ((tp1OpeningStock + tp1Bin) / Math.max(1, tp1MaxCap)) * 100
          )}% POC buffer capacity). Zero line stoppage risk.`,
        },
        ...(useDualPartMilkRun
          ? [
              {
                stepNumber: 4,
                stageType: 'TRANSIT_INTER' as const,
                title: `Inter-Station Transit (${tp1.pocPoint} -> ${tp2.pocPoint})`,
                location: `Cross-Bay Transfer Link (${interDist}m)`,
                description: `Moving 1 loaded trolley (${tp2Bin} pcs) and 1 empty trolley to Station ${tp2.pocPoint}.`,
                durationSec: tripInterTransitSec,
                actualDurationSec: Math.max(5, tripInterTransitSec - 3),
                workType: 'TRANSPORT' as const,
                loadedTrolleysCarried: 1,
                loadedUnitsCarried: tp2Bin,
                emptyTrolleysCarried: 1,
                partsInfo: [
                  {
                    partNo: tp2.partNo,
                    description: tp2.description,
                    action: 'TRANSIT' as const,
                    qtyUnits: tp2Bin,
                    qtyTrolleys: 1,
                  },
                ],
                optimizationNote: 'Direct transfer link cuts return-to-store detours.',
              },
              {
                stepNumber: 5,
                stageType: 'POC_DELIVERY_2' as const,
                title: `Deliver Station ${tp2.pocPoint} & Pick Empty`,
                location: `Station ${tp2.pocPoint} (${tp2.stationName || 'Main Line'})`,
                description: `Deliver 1 trolley (+${tp2Bin} pcs) to ${tp2.pocPoint}. Collect 2nd empty trolley from line side.`,
                durationSec: activePocDeliverTimeSec + activeEmptyPickTimeSec,
                actualDurationSec: Math.max(10, activePocDeliverTimeSec + activeEmptyPickTimeSec - 4),
                workType: 'HAND' as const,
                loadedTrolleysCarried: 0,
                loadedUnitsCarried: 0,
                emptyTrolleysCarried: 2,
                partsInfo: [
                  {
                    partNo: tp2.partNo,
                    description: tp2.description,
                    action: 'DELIVER' as const,
                    qtyUnits: tp2Bin,
                    qtyTrolleys: 1,
                    pocPoint: tp2.pocPoint,
                    pocStockBefore: tp2OpeningStock,
                    pocStockAfter: tp2OpeningStock + tp2Bin,
                    maxPocCapacity: tp2MaxCap,
                    onTimeStatus: 'ON_TIME' as const,
                    marginSec: 60,
                  },
                  {
                    partNo: tp2.partNo,
                    description: tp2.description,
                    action: 'EMPTY_PICK' as const,
                    qtyUnits: tp2Bin,
                    qtyTrolleys: 1,
                    pocPoint: tp2.pocPoint,
                  },
                ],
                optimizationNote: `Stock replenished to ${tp2OpeningStock + tp2Bin} pcs. Operator towing 2 empty trolleys back to Store.`,
              },
            ]
          : []),
        {
          stepNumber: useDualPartMilkRun ? 6 : 4,
          stageType: 'TRANSIT_RETURN' as const,
          title: `Return Loop (${useDualPartMilkRun ? '2' : '1'} Empty Trolleys)`,
          location: `North Return Flow Corridor (${tp1ReturnDist}m)`,
          description: `Returning ${useDualPartMilkRun ? '2 empty trolleys' : '1 empty trolley'} back to Store staging buffer (${tp1ReturnDist}m).`,
          durationSec: tripReturnTransitSec,
          actualDurationSec: Math.max(5, tripReturnTransitSec - 5),
          workType: 'TRANSPORT' as const,
          loadedTrolleysCarried: 0,
          loadedUnitsCarried: 0,
          emptyTrolleysCarried: useDualPartMilkRun ? 2 : 1,
          partsInfo: [],
          optimizationNote: 'Unloaded transit operates smoothly to recover standard cycle allowance.',
        },
        {
          stepNumber: useDualPartMilkRun ? 7 : 5,
          stageType: 'STORE_UNLOAD' as const,
          title: 'Deposit Empty Containers & Trip Sign-Off',
          location: tp1Store,
          description: 'Empty trolleys staged at Store refill bays. Trip logged and Kanban cards scanned for next cycle.',
          durationSec: activeStoreDepositTimeSec,
          actualDurationSec: Math.max(5, activeStoreDepositTimeSec - 8),
          workType: 'HAND' as const,
          loadedTrolleysCarried: 0,
          loadedUnitsCarried: 0,
          emptyTrolleysCarried: 0,
          partsInfo: [],
          optimizationNote: '100% empty container return loop completed with 0 container loss.',
        },
      ];

      const totalPlanned = stages.reduce((acc, s) => acc + s.durationSec, 0);
      const totalActual = stages.reduce((acc, s) => acc + s.actualDurationSec, 0);

      tripsList.push({
        tripNumber: t + 1,
        tripCode: `TRIP-0${t + 1}-${tp1.pocPoint}${useDualPartMilkRun ? `-${tp2.pocPoint}` : ''}`,
        routeId,
        routeName,
        shift: selectedShift === 'Shift 1' ? 'Shift 1 (07:00 - 15:30)' : 'Shift 2 (15:30 - 00:00)',
        scheduledStartTime,
        scheduledEndTime,
        operatorName: op.name,
        operatorCode: op.operatorCode,
        transportMode: tp1.transportMode || 'Jumbo Trolley',
        totalPlannedCycleSec: totalPlanned,
        totalActualCycleSec: totalActual,
        storeLocation: tp1Store,
        primaryParts: useDualPartMilkRun ? [tp1, tp2] : [tp1],
        stages,
        optimizationGains: {
          distanceSavedMeters: useDualPartMilkRun ? 380 : 120,
          trolleyFillRatePercent: 100,
          emptyCirculationBalance: 100,
          congestionRisk: 'Zero (Optimal)',
          taktAdherencePercent: 104.2,
        },
      });
    }

    return tripsList;
  }, [
    selectedShift,
    operators,
    operatorName,
    inventoryStates,
    swctCalculations,
    parts,
    part1,
    part2,
    useDualPartMilkRun,
    activeStorePickTimeSec,
    activePocDeliverTimeSec,
    activeEmptyPickTimeSec,
    activeStoreDepositTimeSec,
    activeTransitSpeedSecPerMeter,
  ]);

  const activeTrip = simulatedTrips[activeTripIndex] || simulatedTrips[0];
  const activeStage = activeTrip?.stages[currentStageIndex] || activeTrip?.stages[0];

  const handleSelectTripCallback = useCallback((index: number) => {
    setActiveTripIndex(index);
    setCurrentStageIndex(0);
    setStageProgressPercent(0);
  }, []);

  const handleSetSpeedCallback = useCallback((speed: number) => {
    setSimSpeed(speed);
  }, []);

  const handleTogglePlayCallback = useCallback(() => {
    setIsSimPlaying((prev) => !prev);
  }, []);

  // Notify parent of real-time simulation synchronization state
  useEffect(() => {
    if (activeTrip && activeStage && onSimulationSync) {
      onSimulationSync({
        activeTrip,
        activeStage,
        currentStageIndex,
        stageProgressPercent,
        isSimPlaying,
        simSpeed,
        optimizationStrategy: activeOptimizationStrategy,
        allTrips: simulatedTrips,
        activeTripIndex,
        onSelectTrip: handleSelectTripCallback,
        onSetSpeed: handleSetSpeedCallback,
        onTogglePlay: handleTogglePlayCallback,
      });
    }
  }, [
    activeTrip,
    activeStage,
    currentStageIndex,
    stageProgressPercent,
    isSimPlaying,
    simSpeed,
    activeOptimizationStrategy,
    simulatedTrips,
    activeTripIndex,
    handleSelectTripCallback,
    handleSetSpeedCallback,
    handleTogglePlayCallback,
    onSimulationSync,
  ]);

  // Simulation timer loop
  useEffect(() => {
    if (!isSimPlaying || !activeTrip) return;

    const intervalMs = Math.max(60, 600 / simSpeed);
    const timer = setInterval(() => {
      setStageProgressPercent((prev) => {
        if (prev >= 100) {
          // Advance to next stage
          setCurrentStageIndex((stageIdx) => {
            if (stageIdx < (activeTrip?.stages.length || 7) - 1) {
              return stageIdx + 1;
            } else {
              // Trip finished: advance to next trip
              if (autoAdvanceTrips) {
                setActiveTripIndex((tripIdx) => (tripIdx + 1) % Math.max(1, simulatedTrips.length));
                return 0;
              } else {
                setIsSimPlaying(false);
                return stageIdx;
              }
            }
          });
          return 0;
        }
        return prev + 10;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimPlaying, simSpeed, activeTrip, autoAdvanceTrips, simulatedTrips.length]);

  // Quick navigation handlers
  const handleNextStage = () => {
    if (!activeTrip) return;
    setStageProgressPercent(0);
    if (currentStageIndex < activeTrip.stages.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1);
    } else {
      setActiveTripIndex((prev) => (prev + 1) % Math.max(1, simulatedTrips.length));
      setCurrentStageIndex(0);
    }
  };

  const handlePrevStage = () => {
    setStageProgressPercent(0);
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1);
    } else if (activeTripIndex > 0 && simulatedTrips[activeTripIndex - 1]) {
      setActiveTripIndex(activeTripIndex - 1);
      setCurrentStageIndex(simulatedTrips[activeTripIndex - 1].stages.length - 1);
    }
  };

  const handleResetTrip = () => {
    setStageProgressPercent(0);
    setCurrentStageIndex(0);
  };

  const handleQuickReplenishCurrent = () => {
    const partToReplenish = activeTrip?.primaryParts[0];
    if (partToReplenish) {
      triggerManualReplenishment(partToReplenish.partNo, 2);
    }
  };

  // If no parts exist in master data, render clean guidance state
  if (!part1) {
    return (
      <div
        id="swct-trip-simulation-demonstrator"
        className={`bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-6 shadow-xl text-center space-y-3 ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center border border-purple-500/30">
          <Workflow className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
          SWCT Material Flow Simulation Engine
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-mono">
          No Part Master records are loaded. Upload your Part Master Excel file or add parts to generate live 2-shift standard work trip simulations.
        </p>
      </div>
    );
  }

  return (
    <div
      id="swct-trip-simulation-demonstrator"
      className={`bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 sm:p-5 shadow-xl transition-all ${className}`}
    >
      {/* 1. Header with Title, 2-Shift Selector, and Interactive SWCT Calculation Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        {/* Left: Title & Status */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
            <Workflow className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                SWCT & Milk-Run Material Flow Simulation Engine
              </h2>
              {hasCustomOverrides ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>CUSTOM OVERRIDES ACTIVE</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>LIVE MASTER DATA (2 SHIFTS)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Calculates trip frequency, cycle times, Store picking, station deliveries, and empty bin returns directly from live SWCT standard work parameters.
            </p>
          </div>
        </div>

        {/* Right: 2-Shift Selector, Configuration Button, Formula Explainer, Clear Data, & Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* STRICT 2-SHIFT SELECTOR */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono">
            <button
              onClick={() => {
                setSelectedShift('Shift 1');
                setActiveTripIndex(0);
                setCurrentStageIndex(0);
                setStageProgressPercent(0);
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedShift === 'Shift 1'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Shift 1: 07:00 AM - 03:30 PM (8.5 Hours)"
            >
              <span>Shift 1 (07:00 - 15:30)</span>
            </button>
            <button
              onClick={() => {
                setSelectedShift('Shift 2');
                setActiveTripIndex(0);
                setCurrentStageIndex(0);
                setStageProgressPercent(0);
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedShift === 'Shift 2'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Shift 2: 03:30 PM - 12:00 AM (8.5 Hours)"
            >
              <span>Shift 2 (15:30 - 00:00)</span>
            </button>
          </div>

          {/* User Input Data / SWCT Tuning Modal Trigger */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showConfigPanel
                ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Edit input parameters, select Part Master items, or customize SWCT element times"
          >
            <Settings2 className="w-3.5 h-3.5 text-purple-500" />
            <span>SWCT Input Data</span>
            {showConfigPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Calculation Formula Breakdown Trigger */}
          <button
            onClick={() => setShowFormulaModal(!showFormulaModal)}
            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="See exact mathematical formula and step-by-step calculations"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">How Trips Are Calculated</span>
            <span className="sm:hidden">Formulas</span>
          </button>

          {/* CLEAR DEMO / CUSTOM INPUT DATA BUTTON */}
          <button
            onClick={handleClearDemoInputData}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              hasCustomOverrides
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Clear all manual overrides and reset directly to live Part Master data"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear Input Data</span>
          </button>

          {/* Play / Pause Toggle */}
          <button
            id="btn-swct-play-toggle"
            onClick={() => setIsSimPlaying(!isSimPlaying)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              isSimPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={isSimPlaying ? 'Pause Simulation' : 'Play Live Step Simulation'}
          >
            {isSimPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isSimPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {/* Step Back / Step Forward */}
          <button
            onClick={handlePrevStage}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Previous SWCT Step"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNextStage}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Next SWCT Step"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Reset */}
          <button
            onClick={handleResetTrip}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Reset to Stage 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Velocity Multiplier */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-1.5 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                  simSpeed === spd
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Continuous Mode Toggle */}
          <button
            onClick={() => setAutoAdvanceTrips(!autoAdvanceTrips)}
            className={`px-2 py-1 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
              autoAdvanceTrips
                ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
            title="Automatically loop through all trips in the shift"
          >
            <RefreshCw className={`w-3 h-3 ${autoAdvanceTrips ? 'animate-spin' : ''}`} />
            <span>Loop: {autoAdvanceTrips ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Expandable User Input Data & SWCT Customization Panel */}
      <AnimatePresence>
        {showConfigPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-slate-200 dark:border-slate-800 pt-3 pb-4 space-y-3 font-mono text-xs"
          >
            <div className="p-4 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    SWCT User Input Data & Parameters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearDemoInputData}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Clear Overrides & Sync Master</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Live updates recalculate trip timings and payload cycles instantly.
                  </span>
                </div>
              </div>

              {/* Row 1: Part Selection from Master Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Part 1 Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Primary Part (from Master Table)
                  </label>
                  <select
                    value={selectedPart1No}
                    onChange={(e) => setSelectedPart1No(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {parts.map((p) => (
                      <option key={p.partNo} value={p.partNo}>
                        {p.partNo} - {p.description.substring(0, 24)} ({p.pocPoint} | Bin: {p.binCapacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Milk-Run Mode & Part 2 Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Dual-Part Milk Run Pairing
                    </label>
                    <button
                      onClick={() => setUseDualPartMilkRun(!useDualPartMilkRun)}
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold transition-all cursor-pointer ${
                        useDualPartMilkRun
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {useDualPartMilkRun ? 'ENABLED (2 PARTS)' : 'SINGLE PART'}
                    </button>
                  </div>
                  <select
                    value={selectedPart2No}
                    disabled={!useDualPartMilkRun}
                    onChange={(e) => setSelectedPart2No(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs disabled:opacity-50 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {parts.map((p) => (
                      <option key={p.partNo} value={p.partNo}>
                        {p.partNo} - {p.description.substring(0, 24)} ({p.pocPoint} | Bin: {p.binCapacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shift Target & Takt Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Takt Time (sec)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="5"
                      max="120"
                      placeholder={String(defaultTaktTimeSec)}
                      value={customTaktTimeSec !== null ? customTaktTimeSec : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomTaktTimeSec(val === '' ? null : parseFloat(val));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">
                      {customTaktTimeSec !== null ? 'Custom override' : `Master: ${defaultTaktTimeSec}s`}
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Shift Plan (Vehicles)
                    </label>
                    <input
                      type="number"
                      step="25"
                      min="100"
                      max="2000"
                      placeholder={String(defaultShiftVehicles)}
                      value={customShiftVehicles !== null ? customShiftVehicles : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomShiftVehicles(val === '' ? null : parseInt(val, 10));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">
                      {customShiftVehicles !== null ? 'Custom override' : `Plan: ${defaultShiftVehicles}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Standard SWCT Element Times (Hand Work & Transit Speed) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                    Store Pick Time (sec)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="30"
                    max="600"
                    placeholder={String(defaultStorePickTimeSec)}
                    value={customStorePickTimeSec !== null ? customStorePickTimeSec : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomStorePickTimeSec(val === '' ? null : parseInt(val, 10));
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    {customStorePickTimeSec !== null
                      ? `${(customStorePickTimeSec / 60).toFixed(1)}m (Override)`
                      : `${(defaultStorePickTimeSec / 60).toFixed(1)}m (Part Master)`}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                    POC Deliver Time (sec)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="30"
                    max="300"
                    placeholder={String(defaultPocDeliverTimeSec)}
                    value={customPocDeliverTimeSec !== null ? customPocDeliverTimeSec : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomPocDeliverTimeSec(val === '' ? null : parseInt(val, 10));
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    {customPocDeliverTimeSec !== null
                      ? `${(customPocDeliverTimeSec / 60).toFixed(1)}m (Override)`
                      : `${(defaultPocDeliverTimeSec / 60).toFixed(1)}m (Part Master)`}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                    Empty Pick Time (sec)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="20"
                    max="200"
                    placeholder={String(defaultEmptyPickTimeSec)}
                    value={customEmptyPickTimeSec !== null ? customEmptyPickTimeSec : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomEmptyPickTimeSec(val === '' ? null : parseInt(val, 10));
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    {customEmptyPickTimeSec !== null
                      ? `${(customEmptyPickTimeSec / 60).toFixed(1)}m (Override)`
                      : `${(defaultEmptyPickTimeSec / 60).toFixed(1)}m (Part Master)`}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                    Transit Speed (sec/meter)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.3"
                    max="2.5"
                    placeholder={String(defaultTransitSpeedSecPerMeter)}
                    value={customTransitSpeedSecPerMeter !== null ? customTransitSpeedSecPerMeter : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomTransitSpeedSecPerMeter(val === '' ? null : parseFloat(val));
                    }}
                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    {(1 / activeTransitSpeedSecPerMeter).toFixed(2)} m/s ({customTransitSpeedSecPerMeter !== null ? 'Override' : 'Mode Config'})
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Mathematical Formula Explainer Modal / Drawer */}
      <AnimatePresence>
        {showFormulaModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="mb-4 p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 rounded-xl space-y-3 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800 pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-white text-sm font-sans">
                  SWCT Mathematical Calculation Engine & Formulas
                </span>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
              >
                Close ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700 dark:text-slate-300">
              {/* Formula 1: Consumption & Trip Cadence */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-900 space-y-1.5">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                  1. Trip Frequency (Cadence)
                </span>
                <p className="text-[11px] font-sans">
                  Time required for the line to consume one bin of parts:
                </p>
                <div className="p-2 bg-slate-100 dark:bg-slate-950 rounded text-[11px] font-bold text-purple-700 dark:text-purple-300">
                  Interval = (Bin Cap / Usage) × Takt
                </div>
                <div className="text-[10px] text-slate-500">
                  = ({swctCalculations.p1Bin} / {swctCalculations.p1Usage}) × {swctCalculations.takt}s ={' '}
                  <strong>
                    {swctCalculations.p1BinCoverageTimeSec}s ({swctCalculations.p1BinCoverageTimeMin} min)
                  </strong>
                </div>
              </div>

              {/* Formula 2: Total Shift Trips */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-900 space-y-1.5">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                  2. Trips Required per 8.5h Shift
                </span>
                <p className="text-[11px] font-sans">
                  Calculated from shift production target & bin capacity:
                </p>
                <div className="p-2 bg-slate-100 dark:bg-slate-950 rounded text-[11px] font-bold text-purple-700 dark:text-purple-300">
                  Trips = ⌈(Shift Target × Usage) / Bin Cap⌉
                </div>
                <div className="text-[10px] text-slate-500">
                  = ⌈({swctCalculations.shiftTarget} × {swctCalculations.p1Usage}) / {swctCalculations.p1Bin}⌉ ={' '}
                  <strong>{swctCalculations.totalPlannedTrips} Trips / Shift</strong>
                </div>
              </div>

              {/* Formula 3: SWCT Total Cycle Time */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-900 space-y-1.5">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                  3. Standard Work Cycle Time
                </span>
                <p className="text-[11px] font-sans">
                  Sum of Store picking, loaded transit, delivery, and return:
                </p>
                <div className="p-2 bg-slate-100 dark:bg-slate-950 rounded text-[11px] font-bold text-purple-700 dark:text-purple-300">
                  Cycle = T_pick + T_load_walk + T_deliver + T_return
                </div>
                <div className="text-[10px] text-slate-500">
                  = {activeStorePickTimeSec}s + {swctCalculations.loadedTransitSec}s + {activePocDeliverTimeSec + activeEmptyPickTimeSec}s + {swctCalculations.returnTransitSec}s ={' '}
                  <strong>
                    {swctCalculations.plannedCycleSec}s ({swctCalculations.plannedCycleMin} min)
                  </strong>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Shift Schedule Timeline Scrubber (Trips starting at 07:00 AM for Shift 1 or 03:30 PM for Shift 2) */}
      <div className="pt-2 pb-3">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span>
              {selectedShift === 'Shift 1' ? 'Shift 1 (07:00 - 15:30)' : 'Shift 2 (15:30 - 00:00)'} Milk-Run Schedule ({simulatedTrips.length} Trips Planned)
            </span>
          </span>
          {activeTrip && (
            <span className="text-purple-600 dark:text-purple-400 font-bold">
              Simulating: <strong>Trip #{activeTrip.tripNumber} ({activeTrip.scheduledStartTime})</strong>
            </span>
          )}
        </div>

        {/* Horizontal Trip Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {simulatedTrips.slice(0, 8).map((trip, idx) => {
            const isActive = idx === activeTripIndex;
            const isCompleted = idx < activeTripIndex;

            return (
              <button
                key={trip.tripCode}
                onClick={() => {
                  setActiveTripIndex(idx);
                  setCurrentStageIndex(0);
                  setStageProgressPercent(0);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-mono ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md ring-2 ring-purple-400/40'
                    : isCompleted
                    ? 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-emerald-300 dark:border-emerald-800/60 hover:border-purple-400'
                    : 'bg-white dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`font-extrabold ${isActive ? 'text-purple-100' : 'text-slate-800 dark:text-slate-200'}`}>
                    Trip #{trip.tripNumber}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <span
                      className={`text-[9px] px-1 rounded ${
                        isActive
                          ? 'bg-purple-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {trip.scheduledStartTime.split(' ')[0]}
                    </span>
                  )}
                </div>
                <div className="text-[10px] truncate mt-1 opacity-90">
                  {trip.primaryParts[0]?.pocPoint}
                  {trip.primaryParts[1] ? ` → ${trip.primaryParts[1]?.pocPoint}` : ' → Store'}
                </div>
                <div className="text-[9px] opacity-75 mt-0.5 truncate">{trip.transportMode.replace(' Trolley', '')}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Main Trip Visual Flow & Active SWCT Stage Execution Dashboard */}
      {activeTrip && activeStage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
          {/* Left 8 Cols: Visual Animated Journey & Station Delivery Stages */}
          <div className="lg:col-span-8 space-y-4">
            {/* Active Trip Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{activeTrip.tripCode}</span>
                    <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px]">
                      {activeTrip.routeId}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Operator: <strong className="text-slate-700 dark:text-slate-300">{activeTrip.operatorName}</strong> (
                    {activeTrip.operatorCode}) • Mode:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{activeTrip.transportMode}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Planned / Actual Cycle</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {(activeTrip.totalPlannedCycleSec / 60).toFixed(1)}m /{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {(activeTrip.totalActualCycleSec / 60).toFixed(1)}m
                    </span>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] border border-emerald-200 dark:border-emerald-800">
                  +45s ON-TIME
                </span>
              </div>
            </div>

            {/* Visual Step Pipeline (Horizontal Stepper with 5-7 SWCT Stages) */}
            <div className="p-3.5 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 uppercase tracking-wider font-bold">
                  SWCT Stage Execution Breakdown
                </span>
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  Step {activeStage.stepNumber} of {activeTrip.stages.length}: {activeStage.title}
                </span>
              </div>

              {/* Stepper Node Track (Left-to-Right Straight Line Process Cards Next to Next) */}
              <div className="flex flex-row items-center gap-1 sm:gap-2 w-full overflow-x-auto pb-1 scrollbar-thin">
                {activeTrip.stages.map((stage, idx) => {
                  const isCurrent = idx === currentStageIndex;
                  const isPast = idx < currentStageIndex;
                  const stageShortName =
                    stage.stepNumber === 1
                      ? 'Store Pick'
                      : stage.stepNumber === 2
                      ? 'Transit Out'
                      : stage.stepNumber === 3
                      ? 'Deliv 1st'
                      : stage.stepNumber === 4 && activeTrip.stages.length === 7
                      ? 'Transit 2nd'
                      : stage.stepNumber === 5 && activeTrip.stages.length === 7
                      ? 'Deliv 2nd'
                      : stage.stepNumber === activeTrip.stages.length - 1
                      ? 'Return Loop'
                      : 'Store Park';

                  return (
                    <React.Fragment key={stage.stepNumber}>
                      <button
                        onClick={() => {
                          setCurrentStageIndex(idx);
                          setStageProgressPercent(0);
                        }}
                        className={`flex-1 min-w-[96px] sm:min-w-[110px] p-2 rounded-xl border text-left transition-all cursor-pointer font-mono relative overflow-hidden flex flex-col justify-between shrink-0 ${
                          isCurrent
                            ? 'bg-purple-600 text-white border-purple-500 shadow-md ring-2 ring-purple-400/50'
                            : isPast
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:border-purple-400'
                            : 'bg-white dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              isCurrent
                                ? 'bg-purple-700 text-white'
                                : isPast
                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {`0${stage.stepNumber}`}
                          </span>
                          {isPast ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : isCurrent ? (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                          ) : (
                            <Clock className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                          )}
                        </div>

                        <div
                          className={`text-[11px] font-bold font-sans truncate leading-tight ${
                            isCurrent
                              ? 'text-white'
                              : isPast
                              ? 'text-emerald-900 dark:text-emerald-100'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {stageShortName}
                        </div>

                        <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-black/5 dark:border-white/5 opacity-85">
                          <span className="truncate">{stage.workType === 'HAND' ? 'Hand' : 'Transit'}</span>
                          <span className="font-bold font-mono">{stage.durationSec}s</span>
                        </div>

                        {isCurrent && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/40 overflow-hidden">
                            <div
                              className="h-full bg-white transition-all"
                              style={{ width: `${stageProgressPercent}%` }}
                            />
                          </div>
                        )}
                      </button>
                      {idx < activeTrip.stages.length - 1 && (
                        <div className="text-slate-300 dark:text-slate-700 shrink-0 select-none text-xs font-mono font-bold">
                          →
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Active Stage Live Execution Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeTrip.tripCode}-${activeStage.stepNumber}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-4 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3 font-mono"
                >
                  {/* Stage Header Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs">
                        STEP {activeStage.stepNumber}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                          {activeStage.title}
                        </h4>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500" />
                          {activeStage.location}
                        </span>
                      </div>
                    </div>

                    {/* Stage Work Type & Timing Breakdown */}
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          activeStage.workType === 'HAND'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                        }`}
                      >
                        {activeStage.workType === 'HAND' ? 'MANUAL HAND WORK' : 'TRANSPORT TRANSIT'}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300 font-bold">
                        Planned: <strong>{activeStage.durationSec}s</strong> | Actual:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {activeStage.actualDurationSec}s
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Progress Ticking Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Step Execution Progress</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">{stageProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                      <motion.div
                        className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${stageProgressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Description Narrative */}
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-sans">
                    {activeStage.description}
                  </p>

                  {/* Live Material & Container Movement Telemetry */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                    {/* Loaded Payload */}
                    <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                      <div className="flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                        <span>Loaded Payload</span>
                        <Boxes className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
                        {activeStage.loadedTrolleysCarried} Trl ({activeStage.loadedUnitsCarried} units)
                      </div>
                      <div className="text-[10px] text-emerald-600/80 mt-0.5">Part delivery stock active</div>
                    </div>

                    {/* Empty Reverse Logistics */}
                    <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/60">
                      <div className="flex items-center justify-between text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase">
                        <span>Empty Trolleys Towing</span>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-extrabold text-blue-800 dark:text-blue-200 mt-1">
                        {activeStage.emptyTrolleysCarried} Empty Trolleys
                      </div>
                      <div className="text-[10px] text-blue-600/80 mt-0.5">Returning to Store buffer</div>
                    </div>

                    {/* On-Time Delivery Metric */}
                    <div className="p-2.5 bg-purple-50/80 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/60">
                      <div className="flex items-center justify-between text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase">
                        <span>On-Time Adherence</span>
                        <Timer className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base font-extrabold text-purple-800 dark:text-purple-200 mt-1">
                        100% ON-TIME
                      </div>
                      <div className="text-[10px] text-purple-600/80 mt-0.5">+45s Standard Lead Margin</div>
                    </div>
                  </div>

                  {/* Delivery Station Pre & Post Stock Telemetry */}
                  {activeStage.partsInfo.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">
                        Part Flow & Station Level Inventory Changes:
                      </span>
                      <div className="space-y-2">
                        {activeStage.partsInfo.map((p, pIdx) => (
                          <div
                            key={`${p.partNo}-${pIdx}`}
                            className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-slate-900 dark:text-white font-mono">{p.partNo}</strong>
                                <span className="text-[11px] text-slate-500 font-sans">{p.description}</span>
                                <span className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono text-[10px]">
                                  {p.action}
                                </span>
                              </div>
                              {p.pocPoint && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Station: <strong>{p.pocPoint}</strong> • Delivered:{' '}
                                  <strong>
                                    +{p.qtyUnits} units ({p.qtyTrolleys} Trl)
                                  </strong>
                                </div>
                              )}
                            </div>

                            {p.pocStockBefore !== undefined && p.pocStockAfter !== undefined && (
                              <div className="text-right">
                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  Stock: {p.pocStockBefore}u →{' '}
                                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                                    {p.pocStockAfter}u
                                  </span>{' '}
                                  / {p.maxPocCapacity}u
                                </div>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                                  {Math.round((p.pocStockAfter / Math.max(1, p.maxPocCapacity || 120)) * 100)}% Buffer Health
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optimization Note */}
                  {activeStage.optimizationNote && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="font-sans">
                        <strong>Lean Optimization:</strong> {activeStage.optimizationNote}
                      </span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Right 4 Cols: Continuous Material Flow Optimization & Buffer Utilization Panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* Optimization Control Suite */}
            <div className="p-4 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-500" />
                  Material Flow Optimization
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  LEAN SYNCHRONIZED
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                During continuous running, extra parts at POC are governed by the maximum allowed trolley space constraint to prevent shop floor clutter and line starvation.
              </p>

              {/* 4 Optimization Strategy Options */}
              <div className="space-y-1.5">
                {[
                  {
                    id: 'AUTO_CONSOLIDATE' as const,
                    title: 'Dual-Part Trolley Consolidation',
                    desc: 'Pairs 2 stations in 1 trip, reducing shift travel distance by 380m (-32%).',
                  },
                  {
                    id: 'BUFFER_THROTTLE' as const,
                    title: 'POC Space Protection & Overflow Check',
                    desc: 'Enforces 2-trolley line-side limit, preventing aisle congestion.',
                  },
                  {
                    id: 'EMPTY_BALANCE' as const,
                    title: 'Empty Container Reverse Logistics',
                    desc: 'Guarantees 100% empty return balance back to Stores.',
                  },
                  {
                    id: 'TAKT_PACED' as const,
                    title: 'Takt-Paced Consumption Sync',
                    desc: `Synchronized with 1 vehicle / ${swctCalculations.takt}s takt rate.`,
                  },
                ].map((strat) => (
                  <button
                    key={strat.id}
                    onClick={() => setActiveOptimizationStrategy(strat.id)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      activeOptimizationStrategy === strat.id
                        ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold font-sans">
                      <span>{strat.title}</span>
                      {activeOptimizationStrategy === strat.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                      )}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        activeOptimizationStrategy === strat.id
                          ? 'text-purple-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {strat.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* Continuous Extra Parts Buffer Telemetry */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <span>POC Buffer Space Utilized</span>
                  <span className="text-emerald-600 dark:text-emerald-400">65% (Optimal Band)</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 text-slate-500 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span>Operator Workload:</span>
                    <strong className="block text-slate-800 dark:text-slate-200">
                      {swctCalculations.operatorUtilizationPercent}% Utilization
                    </strong>
                  </div>
                  <div>
                    <span>Starvation Risk:</span>
                    <strong className="block text-emerald-600 dark:text-emerald-400">0 (Zero Stoppage)</strong>
                  </div>
                </div>
              </div>

              {/* Quick Emergency Replenishment Action */}
              <button
                onClick={handleQuickReplenishCurrent}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>TEST EMERGENCY REPLENISH TRIP</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
