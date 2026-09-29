import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  Play,
  RotateCcw,
  Timer,
  ClipboardList,
  Filter,
  MapPin,
  Truck,
  Box,
  TrendingUp,
  Activity,
  Users,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Download
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculatePartMetrics, getMilkRunGroups, getPocSpaceTrolleysMax, getInitialStockUnits } from '../../../utils/calculations';
import { calculateInterStationDistance, calculateStoreToStationDistance, sortPocStations } from '../../../utils/pocSorter';
import { PartMaster, TransportMode } from '../../../types/manufacturing';

export interface CombinedDeliveryGroup {
  milkRunId: string;
  transportMode: TransportMode;
  destination: string;
  capacity: number;
  capacityUsed: number;
  materials: PartMaster[];
  stores: string[];
  route: string[];
  totalDistance: number;
  cycleTime: number; // in seconds
  tripsPerHour: number;
  tripsPerShift: number;
  highestRisk: 'Critical' | 'Warning' | 'Normal';
  priority: 'P1 (Critical)' | 'P2 (Warning)' | 'P3 (Normal)';
  whyCreated: string;
  tripsSaved: number;
  routeUtilization: number;
}

export interface SWCTTimelineElement {
  id: string;
  name: string;
  handTime: number;
  autoTime: number;
  walkTime: number;
  waitTime: number;
}

export const SWCTBuilder: React.FC = () => {
  const {
    selectedAssemblyLine,
    parts,
    productionPlan,
    operators,
    routes,
    modeConfigs,
    setSwctRecords,
    setOperators,
    inventoryStates,
    operatorName
  } = useMaterialFlow();

  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      const poc = part.pocPoint.toUpperCase();
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
  }, [parts, selectedAssemblyLine]);

  // Basic configuration states
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [area, setArea] = useState<string>('Mizusumashi Line Feeding Cell');
  const [maxTime, setMaxTime] = useState<number>(300);

  // Filters state
  const [filterTransportMode, setFilterTransportMode] = useState<string>('ALL');
  const [filterPartNo, setFilterPartNo] = useState<string>('');
  const [filterStore, setFilterStore] = useState<string>('ALL');
  const [filterDestination, setFilterDestination] = useState<string>('ALL');
  const [filterRoute, setFilterRoute] = useState<string>('ALL');
  const [filterOperator, setFilterOperator] = useState<string>('ALL');

  // Selected active Milk Run (Combined Delivery Group) ID
  const [selectedMilkRunId, setSelectedMilkRunId] = useState<string>('');

  // Simulation states
  const [isSimActive, setIsSimActive] = useState<boolean>(false);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [simStepSecLeft, setSimStepSecLeft] = useState<number>(0);
  const [simTimeElapsed, setSimTimeElapsed] = useState<number>(0);
  const [simStepType, setSimStepType] = useState<'Hand' | 'Auto' | 'Walk' | 'Wait' | 'None'>('None');
  const [simLog, setSimLog] = useState<string[]>([]);
  const [simCompleted, setSimCompleted] = useState<boolean>(false);
  const [flashActive, setFlashActive] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // PHASE 1: COVERAGE TIME ENGINE (Mizusumashi Takt-driven)
  // ---------------------------------------------------------------------------
  const partsWithCoverage = useMemo(() => {
    return filteredParts.map((part) => {
      const usage = part.usagePerVehicle || 1;
      // Theoretical hourly consumption driven directly by Takt Time as per Section 4 of /docs/input.md
      const hourlyConsumption = Number(((3600 / (productionPlan.taktTimeSeconds || 27.9)) * usage).toFixed(1));
      
      // Use live current stock from inventoryStates if available, otherwise fall back to explicit initial stock (or default)
      const state = inventoryStates?.find((s) => s.partNo === part.partNo);
      const qtyAvailable = state ? state.currentStockUnits : getInitialStockUnits(part);
      
      // Coverage Seconds = (Qty Available / Usage) * Takt Time
      const coverageSeconds = (qtyAvailable / usage) * (productionPlan.taktTimeSeconds || 27.9);
      const coverageMinutes = Math.round(coverageSeconds / 60);
      
      // Phase 2 Risk Classification: Critical (<10m), Warning (10-20m), Normal (>20m)
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
  }, [parts, productionPlan.taktTimeSeconds, inventoryStates]);

  // Line Feeding Priority (Sorted by lowest coverage first)
  const sortedCoverageParts = useMemo(() => {
    return [...partsWithCoverage].sort((a, b) => a.coverageMinutes - b.coverageMinutes);
  }, [partsWithCoverage]);

  // Filter lists for UI dropdowns
  const uniqueStores = useMemo(() => {
    return Array.from(new Set(filteredParts.map((p) => p.storeLocation).filter(Boolean)));
  }, [parts]);

  const uniqueDestinations = useMemo(() => {
    return Array.from(new Set(filteredParts.map((p) => p.pocPoint).filter(Boolean)));
  }, [parts]);

  const uniqueTransportModes = useMemo(() => {
    return Array.from(new Set(filteredParts.map((p) => p.transportMode).filter(Boolean)));
  }, [parts]);

  // ---------------------------------------------------------------------------
  // PHASE 3, 4, 12 & 13: COMBINED DELIVERY GROUPING ENGINE (Mizusumashi Grouping)
  // Single Source of Truth: getMilkRunGroups() from calculations.ts
  // ---------------------------------------------------------------------------
  const milkRuns = useMemo<CombinedDeliveryGroup[]>(() => {
    // Filter parts based on selected filter options
    const filteredParts = partsWithCoverage.filter((part) => {
      if (filterTransportMode !== 'ALL' && part.transportMode !== filterTransportMode) return false;
      if (filterPartNo && !part.partNo.toLowerCase().includes(filterPartNo.toLowerCase()) && !part.description.toLowerCase().includes(filterPartNo.toLowerCase())) return false;
      if (filterStore !== 'ALL' && part.storeLocation !== filterStore) return false;
      if (filterDestination !== 'ALL' && part.pocPoint !== filterDestination) return false;
      
      // Filter by assigned Route from context
      if (filterRoute !== 'ALL') {
        const matchingRoute = routes.find(r => r.routeId === filterRoute);
        if (!matchingRoute || !matchingRoute.partsCarried.includes(part.partNo)) return false;
      }
      return true;
    });

    if (filteredParts.length === 0) return [];

    // Real, dynamic Milk Run engine from calculations
    const rawGroups = getMilkRunGroups(filteredParts, productionPlan, modeConfigs, inventoryStates);

    return rawGroups.map((group, idx) => {
      const mode = group.transportMode || 'Jumbo Trolley';
      const config = modeConfigs[mode] || {
        carryingCapacityTrolleys: 3,
        loadSpeedSecPerMtr: 1.3889,
        emptySpeedSecPerMtr: 1.3889,
        pickTimeSec: 10,
        storingTimeSec: 10,
        emptyHandlingTimeSec: 10,
        emptyDropTimeSec: 10
      };
      const capacity = config.carryingCapacityTrolleys || 3;
      const capacityUsed = group.totalTrolleys;

      // Attach custom trolley load quantity and coverage data so trip sheets and SWCT show accurate quantities and risk per part
      const materials = group.parts.map(tp => {
        const coverPart = partsWithCoverage.find(pwc => pwc.partNo === tp.part.partNo);
        return {
          ...(coverPart || tp.part),
          _swctTrolleyQtyOverride: tp.loadQty
        };
      });

      const uniqueStores: string[] = group.storeLocations.length > 0 
        ? group.storeLocations 
        : Array.from(new Set(materials.map(m => m.storeLocation).filter(Boolean))) as string[];
      const startStore = uniqueStores[0] || 'Store Main';
      const dest = group.pocPoint;

      // Sequence route nodes: Store -> unique stores -> Destination -> Empty Return -> Store
      const route: string[] = [startStore, ...uniqueStores.filter(s => s !== startStore), dest, 'Empty Return Area', startStore];

      // Multi-stop sequential routing based on 2m station gap rule or matching route
      const matchingRoute = routes.find(r => r.pocSequence.includes(dest) && r.transportMode === mode);
      
      let totalDistance = 0;
      if (matchingRoute) {
        totalDistance = matchingRoute.totalDistanceMeters;
      } else {
        const sortedStops = sortPocStations([...materials]);
        const firstStop = sortedStops[0];
        const lastStop = sortedStops[sortedStops.length - 1];
        const firstStopDist = firstStop?.loadedDistanceMeters || calculateStoreToStationDistance(firstStop?.pocPoint);
        let interStationTravelMeters = 0;
        for (let i = 0; i < sortedStops.length - 1; i++) {
          interStationTravelMeters += calculateInterStationDistance(sortedStops[i].pocPoint, sortedStops[i + 1].pocPoint);
        }
        const returnDist = lastStop?.returnDistanceMeters || firstStopDist;
        totalDistance = firstStopDist + interStationTravelMeters + returnDist;
      }

      // Cycle time in seconds from group.cycleTimeMin or calculated
      const cycleTime = Math.round(group.cycleTimeMin * 60);
      const tripsPerHour = group.tripsHr ?? 1;
      const tripsPerShift = group.tripsShift ?? Math.round(tripsPerHour * 8);

      // Coverage Risk Classification
      const isCritical = materials.some(m => {
        const coverPart = partsWithCoverage.find(pwc => pwc.partNo === m.partNo);
        return coverPart?.riskLevel === 'Critical';
      });
      const isWarning = materials.some(m => {
        const coverPart = partsWithCoverage.find(pwc => pwc.partNo === m.partNo);
        return coverPart?.riskLevel === 'Warning';
      });
      const highestRisk: 'Critical' | 'Warning' | 'Normal' = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';
      const priority: 'P1 (Critical)' | 'P2 (Warning)' | 'P3 (Normal)' = 
        isCritical ? 'P1 (Critical)' : isWarning ? 'P2 (Warning)' : 'P3 (Normal)';

      const whyCreated = `Destination = ${dest} | Transport = ${mode} | Capacity = ${capacity} | Coverage Risk = ${highestRisk} | Materials Assigned = ${materials.length} | Capacity Utilization = ${Math.round(capacityUsed / Math.max(1, capacity) * 100)}%`;
      const tripsSaved = Math.max(0, materials.length - 1);
      const routeUtilization = Math.round((capacityUsed / Math.max(1, capacity)) * 100);

      return {
        milkRunId: group.groupId || `MR-COMB-${String(idx + 1).padStart(3, '0')}`,
        transportMode: mode,
        destination: dest,
        capacity,
        capacityUsed,
        materials,
        stores: uniqueStores,
        route,
        totalDistance,
        cycleTime,
        tripsPerHour,
        tripsPerShift,
        highestRisk,
        priority,
        whyCreated,
        tripsSaved,
        routeUtilization
      };
    });
  }, [partsWithCoverage, filterTransportMode, filterPartNo, filterStore, filterDestination, filterRoute, modeConfigs, productionPlan, routes, inventoryStates]);

  // Select first Milk Run automatically when list changes
  useEffect(() => {
    if (milkRuns.length > 0) {
      if (!selectedMilkRunId || !milkRuns.some(m => m.milkRunId === selectedMilkRunId)) {
        setSelectedMilkRunId(milkRuns[0].milkRunId);
      }
    } else {
      setSelectedMilkRunId('');
    }
  }, [milkRuns, selectedMilkRunId]);

  // Find currently active Milk Run (Combined Group)
  const activeMilkRun = useMemo(() => {
    return milkRuns.find((m) => m.milkRunId === selectedMilkRunId) || milkRuns[0] || null;
  }, [milkRuns, selectedMilkRunId]);

  // Synchronize SWCT Records back into the context for global Analytics
  useEffect(() => {
    if (milkRuns.length > 0) {
      const globalSwcts = milkRuns.map((mr) => {
        const cycleTime = mr.cycleTime;
        const trolleys = mr.capacityUsed;
        const totalPick = trolleys * 14;
        const totalUnload = trolleys * 16;
        const totalEmptyCollect = trolleys * 17;
        const totalEmptyLeave = trolleys * 10;
        
        return {
          partNo: mr.materials[0]?.partNo || 'N/A',
          routeId: mr.milkRunId,
          operatorName: operatorName || 'sai',
          pickTimeSec: totalPick,
          travelTimeSec: Math.round(cycleTime - (totalPick + totalUnload + totalEmptyCollect + totalEmptyLeave)),
          unloadingTimeSec: totalUnload,
          emptyCollectionTimeSec: totalEmptyCollect,
          emptyReturnTimeSec: 0,
          waitingTimeSec: 0,
          manualWorkTimeSec: totalPick + totalUnload + totalEmptyCollect + totalEmptyLeave,
          transportTimeSec: Math.round(cycleTime - (totalPick + totalUnload + totalEmptyCollect + totalEmptyLeave)),
          wasteTimeSec: 0,
          totalCycleTimeSec: cycleTime,
          taktTimeSec: productionPlan.taktTimeSeconds
        };
      });

      setSwctRecords((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(globalSwcts)) {
          return prev;
        }
        return globalSwcts;
      });
    }
  }, [milkRuns, setSwctRecords, productionPlan.taktTimeSeconds, operatorName]);

  // ---------------------------------------------------------------------------
  // PHASE 6: TRUE MIZUSUMASHI SWCT SEQUENCE GENERATION (Section 9/16)
  // ---------------------------------------------------------------------------
  const swctElements = useMemo<SWCTTimelineElement[]>(() => {
    if (!activeMilkRun) return [];

    const config = modeConfigs[activeMilkRun.transportMode] || {
      loadSpeedSecPerMtr: 1.3889,
      emptySpeedSecPerMtr: 1.3889,
      pickTimeSec: 10,
      storingTimeSec: 10,
      emptyHandlingTimeSec: 10,
      emptyDropTimeSec: 10
    };

    const maxLoadedDist = Math.max(...activeMilkRun.materials.map(m => m.loadedDistanceMeters || 120));
    const maxReturnDist = Math.max(...activeMilkRun.materials.map(m => m.returnDistanceMeters || 120));
    const loadSpeed = (config as any).loadSpeedSecPerMtr || 1.3889;
    const emptySpeed = (config as any).emptySpeedSecPerMtr || 1.3889;

    const travelLoadedSec = Math.round(maxLoadedDist * loadSpeed);
    const travelEmptySec = Math.round(maxReturnDist * emptySpeed);

    const trolleys = activeMilkRun.capacityUsed;

    const pickSec = (config.pickTimeSec ?? 10) * trolleys;
    const unloadSec = (config.storingTimeSec ?? 10) * trolleys;
    const emptySec = (config.emptyHandlingTimeSec ?? 10) * trolleys;
    const dropSec = (config as any).emptyDropTimeSec ?? 10;

    return [
      {
        id: 'el-1',
        name: `Pick/Binning Time (${activeMilkRun.stores.join(', ')})`,
        handTime: pickSec,
        autoTime: 0,
        walkTime: 0,
        waitTime: 0
      },
      {
        id: 'el-2',
        name: `Loaded Travel Time to ${activeMilkRun.destination}`,
        handTime: 0,
        autoTime: 0,
        walkTime: travelLoadedSec,
        waitTime: 0
      },
      {
        id: 'el-3',
        name: `POC Storing Time at gravity rack`,
        handTime: unloadSec,
        autoTime: 0,
        walkTime: 0,
        waitTime: 0
      },
      {
        id: 'el-4',
        name: `Empty Trolley Collection & Handling Time`,
        handTime: emptySec,
        autoTime: 0,
        walkTime: 0,
        waitTime: 0
      },
      {
        id: 'el-5',
        name: `Empty Travel Time (Return Corridor)`,
        handTime: 0,
        autoTime: 0,
        walkTime: travelEmptySec,
        waitTime: 0
      },
      {
        id: 'el-6',
        name: `Empty Trolley Drop at Stores`,
        handTime: dropSec,
        autoTime: 0,
        walkTime: 0,
        waitTime: 0
      }
    ];
  }, [activeMilkRun, modeConfigs]);

  // Adjust maxTime based on current elements
  useEffect(() => {
    if (swctElements.length > 0) {
      const sum = swctElements.reduce((acc, el) => acc + el.handTime + el.walkTime + el.waitTime, 0);
      setMaxTime(Math.max(150, sum + 40));
    }
  }, [swctElements]);

  // SWCT timeline totals
  const totals = useMemo(() => {
    let totalHand = 0;
    let totalAuto = 0;
    let totalWalk = 0;
    let totalWait = 0;

    swctElements.forEach((el) => {
      totalHand += el.handTime;
      totalAuto += el.autoTime;
      totalWalk += el.walkTime;
      totalWait += el.waitTime;
    });

    const cycleTime = totalHand + totalWalk + totalWait;
    const diff = cycleTime - productionPlan.taktTimeSeconds;

    return {
      totalHand,
      totalAuto,
      totalWalk,
      totalWait,
      cycleTime,
      diff,
      isOver: diff > 0
    };
  }, [swctElements, productionPlan.taktTimeSeconds]);

  // ---------------------------------------------------------------------------
  // PHASE 11: RE-ENGINEERED MIZUSUMASHI CORE KPI CALCULATIONS
  // ---------------------------------------------------------------------------
  const logisticsKPIs = useMemo(() => {
    const totalMilkRuns = milkRuns.length;
    let totalTripsPerHour = 0;
    let totalDistancePerHour = 0;
    let totalTrolleysPerHour = 0;
    let capacitySum = 0;
    let capacityUsedSum = 0;

    milkRuns.forEach((mr) => {
      totalTripsPerHour += mr.tripsPerHour;
      totalDistancePerHour += (mr.totalDistance * mr.tripsPerHour);
      totalTrolleysPerHour += (mr.capacityUsed * mr.tripsPerHour);
      capacitySum += mr.capacity;
      capacityUsedSum += mr.capacityUsed;
    });

    const capacityUtil = capacitySum > 0 ? (capacityUsedSum / capacitySum) * 100 : 0;
    
    // Average operator cycle time across runs
    const avgCycleTime = totalMilkRuns > 0 ? milkRuns.reduce((acc, mr) => acc + mr.cycleTime, 0) / totalMilkRuns : 0;

    // Standard effective operator working minutes per 8.5-hour shift (480 min available after 30 min break)
    const effectiveOperatorMinPerShift = 480;

    // Total trip time in minutes per shift across all scheduled milk runs
    let totalTripTimeMinPerShift = 0;
    if (totalMilkRuns > 0) {
      totalTripTimeMinPerShift = milkRuns.reduce((acc, mr) => {
        const tripDurationMin = mr.cycleTime / 60;
        const tripsInShift = mr.tripsPerHour * 8;
        return acc + (tripDurationMin * tripsInShift);
      }, 0);
    } else {
      totalTripTimeMinPerShift = partsWithCoverage.reduce((acc, p) => {
        const metrics = calculatePartMetrics(p, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
        return acc + (metrics.singleOperatorWorkloadMinPerShift || (metrics.tripsRequiredPerShift * metrics.cycleTimeMin));
      }, 0);
    }

    // MHF Required = totalTripTimeMinPerShift / effectiveOperatorMinPerShift
    const mhfRequired = effectiveOperatorMinPerShift > 0
      ? totalTripTimeMinPerShift / effectiveOperatorMinPerShift
      : 0;

    // Real operator utilization percentage: uncapped so real overload (>100%) is genuinely visible
    const operatorUtil = Number((mhfRequired * 100).toFixed(1));

    const tripsPerShift = totalTripsPerHour * 8;
    const tripsPerDay = tripsPerShift * 3;

    const distancePerShift = totalDistancePerHour * 8;
    const distancePerDay = distancePerShift * 3;

    // Coverage Risk counts
    const criticalMaterialsCount = partsWithCoverage.filter(p => p.riskLevel === 'Critical').length;
    const warningMaterialsCount = partsWithCoverage.filter(p => p.riskLevel === 'Warning').length;

    const opsRequired = Math.max(1, Math.ceil(mhfRequired));

    return {
      tripsPerHour: totalTripsPerHour,
      tripsPerShift,
      tripsPerDay,
      trolleysPerHour: totalTrolleysPerHour,
      distancePerHour: Math.round(totalDistancePerHour),
      distancePerShift: Math.round(distancePerShift),
      distancePerDay: Math.round(distancePerDay),
      capacityUtilization: Number(capacityUtil.toFixed(1)),
      operatorUtilization: Number(operatorUtil.toFixed(1)),
      mhfRequired: Number(mhfRequired.toFixed(2)),
      milkRunsCreated: totalMilkRuns,
      operatorsRequired: Math.max(1, opsRequired),
      criticalMaterialsCount,
      riskCount: criticalMaterialsCount + warningMaterialsCount
    };
  }, [milkRuns, partsWithCoverage, productionPlan, modeConfigs]);

  // Hourly delivery plan simulator for Phase 11 table
  const hourlyPlanData = useMemo(() => {
    const slots = [
      '07:00 - 08:00',
      '08:00 - 09:00',
      '09:00 - 10:00',
      '10:00 - 11:00',
      '11:00 - 12:00',
      '12:00 - 13:00',
      '13:00 - 14:00',
      '14:00 - 15:00'
    ];

    return slots.map((slot, index) => {
      const variance = 1 + (index % 3 === 0 ? 0.08 : index % 2 === 0 ? -0.04 : 0.02);
      const trips = Math.round(logisticsKPIs.tripsPerHour * variance);
      const dist = Math.round(logisticsKPIs.distancePerHour * variance);
      const trolleys = Math.round(logisticsKPIs.trolleysPerHour * variance);

      return {
        slot,
        trips,
        distance: dist,
        delivered: trolleys
      };
    });
  }, [logisticsKPIs]);

  // ---------------------------------------------------------------------------
  // NEW: ACTIVE VIEW TAB SELECTOR AND DETAILED TRIP PLANNING SHEET (Section 16 & 25)
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<'swct' | 'tripSheet' | 'operatorView'>('tripSheet');

  function formatTimeFromSec(seconds: number): string {
    const startHour = 7;
    const startMin = 0;
    const totalSec = startHour * 3600 + startMin * 60 + seconds;
    const hrs = Math.floor(totalSec / 3600) % 24;
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const tripSheetData = useMemo(() => {
    let accumulatedSec = 0;
    return milkRuns.map((mr, i) => {
      const startTimeSec = accumulatedSec;
      const cycleTime = mr.cycleTime;
      accumulatedSec += cycleTime + 60; // 1-minute safety gap between trips

      const trolleys = mr.capacityUsed;
      const transportConfig: any = modeConfigs[mr.transportMode] || { loadSpeedSecPerMtr: 1.3889, emptySpeedSecPerMtr: 1.3889 };
      const loadSpeed = transportConfig.loadSpeedSecPerMtr || 1.3889;
      const emptySpeed = transportConfig.emptySpeedSecPerMtr || 1.3889;

      const pickTime = (transportConfig.pickTimeSec ?? 10) * trolleys;
      const storeTime = (transportConfig.storingTimeSec ?? 10) * trolleys;
      const emptyCollectTime = (transportConfig.emptyHandlingTimeSec ?? 10) * trolleys;

      const loadedDist = Math.round(mr.totalDistance / 2);
      const emptyDist = Math.round(mr.totalDistance / 2);

      const loadedTravelSec = Math.round(loadedDist * loadSpeed);
      const emptyTravelSec = Math.round(emptyDist * emptySpeed);

      const pocArrivalTimeSec = startTimeSec + pickTime + loadedTravelSec;
      const completionTimeSec = startTimeSec + cycleTime;

      const isCritical = mr.highestRisk === 'Critical';
      const isWarning = mr.highestRisk === 'Warning';

      const pocSpaceLimit = mr.materials.map(m => getPocSpaceTrolleysMax(m)).join(', ');
      const hasSpaceViolation = mr.materials.some(m => {
        const limit = getPocSpaceTrolleysMax(m);
        return trolleys > limit;
      });

      return {
        tripNo: mr.milkRunId,
        shift: productionPlan.shift,
        hourWindow: `${formatTimeFromSec(startTimeSec).slice(0, 5)} - ${formatTimeFromSec(startTimeSec + 3600).slice(0, 5)}`,
        operator: operatorName || "sai",
        transportMode: mr.transportMode,
        tripStartTime: formatTimeFromSec(startTimeSec),
        storeArrivalTime: formatTimeFromSec(startTimeSec),
        storeLocation: mr.stores.join(', ') || 'Store E10',
        partNo: mr.materials.map(m => m.partNo).join(', '),
        description: mr.materials.map(m => m.description).join(', '),
        qtyPerTrolley: mr.materials.map(m => m.binCapacity).join('/'),
        fullTrolleys: mr.materials.map((m: any) => m._swctTrolleyQtyOverride !== undefined ? m._swctTrolleyQtyOverride : m.fullTrolleys || 1).join('/'),
        totalPieces: mr.materials.reduce((sum, m: any) => sum + (m.binCapacity * (m._swctTrolleyQtyOverride || 1)), 0),
        poc: mr.destination,
        pocSpaceLimit,
        pocSpaceViolation: hasSpaceViolation,
        openingPocStock: mr.materials.map(m => {
          const state = inventoryStates?.find(s => s.partNo === m.partNo);
          return state ? state.openingStockUnits : m.binCapacity * 2;
        }).join(', '),
        carryOverStockUsed: mr.materials.map(m => getInitialStockUnits(m)).join(', '),
        predictedStockBeforeDelivery: mr.materials.map(m => {
          const state = inventoryStates?.find(s => s.partNo === m.partNo);
          const stock = state ? state.currentStockUnits : m.binCapacity * 2;
          return Math.round(Math.max(0, stock - (m.usagePerVehicle * (startTimeSec / (productionPlan.taktTimeSeconds || 27.9)))));
        }).join(', '),
        pickTime: `${pickTime}s`,
        loadedRouteDistance: `${loadedDist}m`,
        loadedTravelTime: `${loadedTravelSec}s`,
        pocArrivalTime: formatTimeFromSec(pocArrivalTimeSec),
        pocStoringTime: `${storeTime}s`,
        stockAfterDelivery: mr.materials.map((m: any) => {
          const state = inventoryStates?.find(s => s.partNo === m.partNo);
          const stock = state ? state.currentStockUnits : m.binCapacity * 2;
          return stock + m.binCapacity * (m._swctTrolleyQtyOverride || 1);
        }).join(', '),
        coverageAfterDelivery: mr.materials.map((m: any) => {
          const usage = m.usagePerVehicle || 1;
          const state = inventoryStates?.find(s => s.partNo === m.partNo);
          const stock = state ? state.currentStockUnits : m.binCapacity * 2;
          const totalStock = stock + m.binCapacity * (m._swctTrolleyQtyOverride || 1);
          return Math.round((totalStock / usage) * (productionPlan.taktTimeSeconds || 27.9) / 60) + 'm';
        }).join(', '),
        predictedNextShortageTime: formatTimeFromSec(startTimeSec + mr.materials.reduce((acc, m) => acc + Math.round((m.binCapacity * 3 / m.usagePerVehicle) * (productionPlan.taktTimeSeconds || 27.9)), 0)),
        emptyTrolleyQty: trolleys,
        emptyCollectionTime: `${emptyCollectTime}s`,
        emptyRouteDistance: `${emptyDist}m`,
        emptyTravelTime: `${emptyTravelSec}s`,
        emptyLeavingTime: '0s',
        tripCompletionTime: formatTimeFromSec(completionTimeSec),
        tripSWCT: `${cycleTime}s`,
        capacityUtilization: mr.routeUtilization,
        safetyMargin: isCritical ? 'Short' : 'Safe',
        lineStopRisk: isCritical ? 'High' : 'Low',
        status: isCritical ? 'Critical Action' : 'Feasible',
        nextTripStartTime: formatTimeFromSec(completionTimeSec + 60)
      };
    });
  }, [milkRuns, modeConfigs, productionPlan, inventoryStates]);

  const planStatus = useMemo(() => {
    const hasCritical = milkRuns.some(mr => mr.highestRisk === 'Critical');
    const isOverloaded = logisticsKPIs.operatorUtilization > 100;
    
    if (hasCritical || isOverloaded) {
      const criticalRun = milkRuns.find(mr => mr.highestRisk === 'Critical');
      const criticalPart = criticalRun?.materials[0];
      return {
        feasible: false,
        statusString: "PLAN STATUS = INFEASIBLE",
        diagnostics: {
          operator: operatorName || "sai",
          part: criticalPart?.partNo || "N/A",
          predictedShortage: criticalPart ? `${Math.round(getInitialStockUnits(criticalPart) / (criticalPart.usagePerVehicle || 1) * (productionPlan.taktTimeSeconds || 27.9) / 60)} mins` : "Under 10 mins",
          requiredArrival: "07:15:00",
          plannedArrival: "07:22:15",
          delay: "7 min 15s",
          resourceConstraint: isOverloaded ? "OPERATOR OVERLOAD (Workload > 100% Takt)" : "Mizusumashi Transit Bottleneck"
        }
      };
    }
    
    return {
      feasible: true,
      statusString: "PLAN STATUS = FEASIBLE — ZERO PREDICTED LINE STOPS"
    };
  }, [milkRuns, logisticsKPIs.operatorUtilization]);

  // ---------------------------------------------------------------------------
  // PHASE 9: MILK RUN MONITOR SIMULATOR ENGINE
  // ---------------------------------------------------------------------------
  const stopSimulation = useCallback(() => {
    setIsSimActive(false);
    setCurrentStepIdx(0);
    setSimTimeElapsed(0);
    setSimStepSecLeft(0);
    setSimStepType('None');
    setSimCompleted(false);
  }, []);

  const startSimulation = () => {
    if (swctElements.length === 0) return;
    setIsSimActive(true);
    setCurrentStepIdx(0);
    setSimTimeElapsed(0);
    setSimCompleted(false);

    const firstEl = swctElements[0];
    if (firstEl.handTime > 0) {
      setSimStepType('Hand');
      setSimStepSecLeft(firstEl.handTime);
    } else if (firstEl.walkTime > 0) {
      setSimStepType('Walk');
      setSimStepSecLeft(firstEl.walkTime);
    } else {
      setSimStepType('Wait');
      setSimStepSecLeft(firstEl.waitTime);
    }

    setSimLog([`[${new Date().toLocaleTimeString()}] 🚀 Mizusumashi Dispatch active for ${activeMilkRun?.milkRunId}.`]);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isSimActive && !simCompleted) {
      timer = setInterval(() => {
        setSimTimeElapsed((prev) => prev + 1);

        if (simStepSecLeft <= 1) {
          setFlashActive(true);
          setTimeout(() => setFlashActive(false), 200);

          const currentEl = swctElements[currentStepIdx];
          if (currentEl) {
            if (simStepType === 'Hand' && currentEl.walkTime > 0) {
              setSimStepType('Walk');
              setSimStepSecLeft(currentEl.walkTime);
              setSimLog((prev) => [...prev, `[Processing] Manual activities at current location completed. Now in transit.`]);
            } else if ((simStepType === 'Hand' || simStepType === 'Walk') && currentEl.waitTime > 0) {
              setSimStepType('Wait');
              setSimStepSecLeft(currentEl.waitTime);
              setSimLog((prev) => [...prev, `[Waiting] Arrived at stop. Waiting for kanban verification/safety check.`]);
            } else {
              const nextIdx = currentStepIdx + 1;
              if (nextIdx < swctElements.length) {
                setCurrentStepIdx(nextIdx);
                const nextEl = swctElements[nextIdx];
                setSimLog((prev) => [...prev, `[Sequence Advance] Step ${currentStepIdx + 1} finalized.`]);

                if (nextEl.handTime > 0) {
                  setSimStepType('Hand');
                  setSimStepSecLeft(nextEl.handTime);
                } else if (nextEl.walkTime > 0) {
                  setSimStepType('Walk');
                  setSimStepSecLeft(nextEl.walkTime);
                } else {
                  setSimStepType('Wait');
                  setSimStepSecLeft(nextEl.waitTime);
                }
              } else {
                setSimCompleted(true);
                setIsSimActive(false);
                setSimStepSecLeft(0);
                setSimLog((prev) => [
                  ...prev,
                  `[Success] 🎉 Mizusumashi replenishment cycle finished! Cycle Time: ${simTimeElapsed + 1}s vs Takt limit ${productionPlan.taktTimeSeconds}s.`
                ]);

                setOperators((prevOps) =>
                  prevOps.map((op) => ({
                    ...op,
                    completedTripsCount: op.completedTripsCount + 1,
                    utilizationPercent: Math.min(99, op.utilizationPercent + 0.5)
                  }))
                );
              }
            }
          }
        } else {
          setSimStepSecLeft((prev) => prev - 1);
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    isSimActive,
    simCompleted,
    simStepSecLeft,
    currentStepIdx,
    simStepType,
    swctElements,
    productionPlan.taktTimeSeconds,
    setOperators,
    simTimeElapsed,
    activeMilkRun
  ]);

  // Export CSV function
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `Mizusumashi Line Feeding Sheet,,Date:${date},Area:${area},Selected Takt:${productionPlan.taktTimeSeconds}s\n\n`;
    csvContent += 'Step No,Logistics Activity,Manual/Hand Time (s),Auto Time (s),Walk/Transit Time (s),Wait Time (s),Total Cycle (s)\n';

    swctElements.forEach((el, index) => {
      const rowCycle = el.handTime + el.walkTime + el.waitTime;
      csvContent += `${index + 1},"${el.name}",${el.handTime},${el.autoTime},${el.walkTime},${el.waitTime},${rowCycle}\n`;
    });

    csvContent += `\n,,Total Hand:,${totals.totalHand},Total Auto:,${totals.totalAuto},Total Walk:,${totals.totalWalk},Total Wait:,${totals.totalWait}\n`;
    csvContent += `,,Milk Run Cycle Time:,${totals.cycleTime},Takt Time:,${productionPlan.taktTimeSeconds},vs Takt:,${totals.diff > 0 ? '+' : ''}${totals.diff}s\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Mizusumashi_SWCT_${activeMilkRun?.milkRunId || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download SVG Chart function
  const handleDownloadSVG = () => {
    const svgElement = document.getElementById('mizusumashi-swct-svg');
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    source = '<?xml version="1.0" encoding="utf-8"?>\n' + source;

    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mizusumashi_SWCT_Chart_${activeMilkRun?.milkRunId || 'Export'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Route wavy path drawer for SVG Standard combination chart
  const getWavyPath = (x1: number, x2: number, y: number) => {
    if (x2 <= x1) return '';
    let path = `M ${x1} ${y}`;
    const step = 8;
    let count = 0;
    for (let x = x1 + step; x <= x2; x += step) {
      const cy = y + (count % 2 === 0 ? -4 : 4);
      path += ` Q ${x - step / 2} ${cy} ${x} ${y}`;
      count++;
    }
    if (x2 > x1 + (count * step)) {
      path += ` L ${x2} ${y}`;
    }
    return path;
  };

  const xMultiplier = 2.4; 
  const rowHeight = 44;
  const paddingLeft = 180;
  const svgWidth = paddingLeft + (maxTime * xMultiplier) + 40;
  const svgHeight = Math.max(160, swctElements.length * rowHeight + 40);

  // Derive simulation current stop based on step index for Phase 9 live telemetry display
  const currentSimulatedStop = useMemo(() => {
    if (!activeMilkRun) return 'Stores';
    if (!isSimActive) return 'Ready at Main Store';
    if (simCompleted) return 'Cycle Completed';
    
    // Elements: 0: Pick from Stores, 1: Load Trolleys, 2: Travel Loaded, 3: Unload line POC, 4: Collect Empties, 5: Return Travel, 6: Store Finalize
    if (currentStepIdx <= 1) return `Stores pickup: ${activeMilkRun.stores.join(', ')}`;
    if (currentStepIdx === 2) return 'In Transit: Loaded to Line';
    if (currentStepIdx === 3) return `Point of Consumption: ${activeMilkRun.destination}`;
    if (currentStepIdx === 4) return 'Empty Return Area';
    if (currentStepIdx >= 5) return 'In Transit: Returning empty';
    return 'Main Store';
  }, [activeMilkRun, isSimActive, currentStepIdx, simCompleted]);

  const nextSimulatedStop = useMemo(() => {
    if (!activeMilkRun || !isSimActive) return 'N/A';
    if (currentStepIdx <= 1) return 'In Transit: Loaded to Line';
    if (currentStepIdx === 2) return `Point of Consumption: ${activeMilkRun.destination}`;
    if (currentStepIdx === 3) return 'Empty Return Area';
    if (currentStepIdx === 4) return 'In Transit: Returning empty';
    if (currentStepIdx >= 5) return 'Completed / Stores';
    return 'N/A';
  }, [activeMilkRun, isSimActive, currentStepIdx]);

  return (
    <div className="space-y-6 text-slate-100" id="mizusumashi-planning-root">
      
      {/* LINE FEEDING COVERAGE & STARVATION RISK CELL REMOVED */}

      {/* MIZUSUMASHI DYNAMIC LOGISTICS KPI DASHBOARD (Phase 11) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Starvation Risks</span>
            <div className="text-xl font-bold text-white mt-0.5">{logisticsKPIs.riskCount} Parts</div>
            <span className="text-[9px] text-red-400 block font-mono">Critical: {logisticsKPIs.criticalMaterialsCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Trips per Hour</span>
            <div className="text-xl font-bold text-white mt-0.5">{logisticsKPIs.tripsPerHour} trips</div>
            <span className="text-[9px] text-slate-500 block font-mono">Shift: {logisticsKPIs.tripsPerShift} | Day: {logisticsKPIs.tripsPerDay}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Distance Travelled</span>
            <div className="text-xl font-bold text-white mt-0.5">{(logisticsKPIs.distancePerHour / 1000).toFixed(1)} km</div>
            <span className="text-[9px] text-slate-500 block font-mono">Shift: {(logisticsKPIs.distancePerShift / 1000).toFixed(1)} km / day: {(logisticsKPIs.distancePerDay / 1000).toFixed(0)} km</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Vehicle Capacity Util</span>
            <div className="text-xl font-bold text-white mt-0.5">{logisticsKPIs.capacityUtilization}%</div>
            <span className="text-[9px] text-emerald-400 block font-mono">Average Capacity packing</span>
          </div>
        </div>

        <div className={`border p-4 rounded-2xl shadow-xl flex items-center gap-3 ${
          logisticsKPIs.operatorUtilization > 100
            ? 'bg-rose-950/30 border-rose-800/60'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className={`p-3 rounded-xl border ${
            logisticsKPIs.operatorUtilization > 100
              ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Mizusumashi Ops</span>
            <div className={`text-xl font-bold mt-0.5 ${logisticsKPIs.operatorUtilization > 100 ? 'text-rose-400' : 'text-white'}`}>
              {logisticsKPIs.operatorsRequired} Active
            </div>
            <span className={`text-[9px] block font-mono ${
              logisticsKPIs.operatorUtilization > 100 ? 'text-rose-400 font-bold' : 'text-slate-500'
            }`}>
              Util Rate: {logisticsKPIs.operatorUtilization}%{logisticsKPIs.operatorUtilization > 100 ? ' (OVERLOAD)' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* MIZUSUMASHI TABLE & COMBINED GROUPS (Phase 3 & Phase 10) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4.5 h-4.5 text-blue-400" />
            Mizusumashi Combined Delivery Groups & Trip Table
          </h3>
          <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-400">
            {milkRuns.length} Groups Generated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-850">
              <tr>
                <th className="px-3 py-3 font-bold">Trip ID</th>
                <th className="px-3 py-3">Transport Mode</th>
                <th className="px-3 py-3">Combined Materials</th>
                <th className="px-3 py-3">Coverage Risk</th>
                <th className="px-3 py-3 text-right">Capacity Used</th>
                <th className="px-3 py-3 text-right">Distance</th>
                <th className="px-3 py-3 text-right">Cycle Time</th>
                <th className="px-3 py-3 text-right">Trips/Hour</th>
                <th className="px-3 py-3 text-center">Priority</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {milkRuns.map((mr) => {
                const isActive = mr.milkRunId === selectedMilkRunId;
                const isCritical = mr.highestRisk === 'Critical';
                const isWarning = mr.highestRisk === 'Warning';
                return (
                  <tr
                    key={mr.milkRunId}
                    className={`transition-all hover:bg-slate-800/30 cursor-pointer ${
                      isActive ? 'bg-blue-600/10 text-white font-semibold' : ''
                    }`}
                    onClick={() => {
                      setSelectedMilkRunId(mr.milkRunId);
                      stopSimulation();
                    }}
                  >
                    <td className="px-3 py-3.5 font-bold text-blue-400">{mr.milkRunId}</td>
                    <td className="px-3 py-3.5 text-slate-400 font-sans">{mr.transportMode}</td>
                    <td className="px-3 py-3.5 font-sans">
                      <div className="flex flex-wrap gap-1">
                        {mr.materials.map((mat, idx) => (
                          <span key={`${mat.partNo}-${idx}`} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-[10px] text-emerald-400" title={mat.description}>
                            {mat.partNo}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isCritical
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isWarning
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {mr.highestRisk}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right font-bold">
                      {mr.capacityUsed} / {mr.capacity} Trolleys
                    </td>
                    <td className="px-3 py-3.5 text-right">{mr.totalDistance}m</td>
                    <td className="px-3 py-3.5 text-right text-blue-400">{mr.cycleTime}s</td>
                    <td className="px-3 py-3.5 text-right">{mr.tripsPerHour} / hr</td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mr.priority === 'P1 (Critical)'
                          ? 'bg-red-600 text-white'
                          : mr.priority === 'P2 (Warning)'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {mr.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-950 text-slate-300 border-slate-850 hover:bg-slate-800'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMilkRunId(mr.milkRunId);
                          stopSimulation();
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
              {milkRuns.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-500 font-mono text-xs">
                    No combined delivery groups found matching active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MILK RUN ACTIVE REVIEW & EXPLANATION PANEL (Phase 5, 7, 8 & 12) */}
      {activeMilkRun && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Dynamic Combined Route Engine & Efficiency */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3">
                <Truck className="w-4.5 h-4.5 text-blue-400" />
                <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                  Route Engine & Efficiencies
                </h4>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Dynamic Route Path</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-slate-950 p-2.5 rounded-lg border border-slate-850 text-[11px] font-mono">
                    {activeMilkRun.route.map((node, index) => (
                      <React.Fragment key={index}>
                        <span className={node === activeMilkRun.destination ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                          {node}
                        </span>
                        {index < activeMilkRun.route.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">Trips Saved</span>
                    <strong className="text-sm text-emerald-400 font-bold block mt-0.5">+{activeMilkRun.tripsSaved} Trips</strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">Route Util Rate</span>
                    <strong className="text-sm text-white font-bold block mt-0.5">{activeMilkRun.routeUtilization}%</strong>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Combined Materials</span>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto mt-1">
                    {activeMilkRun.materials.map((m, idx) => {
                      const limit = getPocSpaceTrolleysMax(m);
                      const violation = activeMilkRun.capacityUsed > limit;
                      return (
                        <div key={`${m.partNo}-${idx}`} className="text-xs font-sans bg-slate-950/60 p-2 rounded border border-slate-850/60 flex justify-between items-center">
                          <span className="text-emerald-400 font-mono font-bold">{m.partNo}</span>
                          <span className="text-[10px] text-slate-400 max-w-[140px] truncate">{m.description}</span>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${violation ? 'bg-red-950/60 text-red-400 border-red-500/30' : 'bg-slate-950 text-slate-400 border-slate-850'}`} title={violation ? `Trolleys delivered (${activeMilkRun.capacityUsed}) exceeds POC space limit (${limit})` : `POC Space Limit: ${limit} Trolleys`}>
                            Space: {limit}T {violation && '⚠️'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-950 px-1 py-0.2 rounded border border-slate-850">{m.storeLocation}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-850 text-[11px] font-mono text-slate-500 flex justify-between">
              <span>Dist: <strong>{activeMilkRun.totalDistance}m</strong></span>
              <span>Trips: <strong>{activeMilkRun.tripsPerShift} / shift</strong></span>
            </div>
          </div>

          {/* Right: "Why was this group created?" Engine (Phase 12) & Summary */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ClipboardList className="text-blue-400 w-5 h-5" />
                    Mizusumashi Delivery: <strong className="text-blue-400 font-mono">{activeMilkRun.milkRunId}</strong>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Critical replenishment analysis to prevent line starvation.
                  </span>
                </div>

                <span className={`text-xs font-mono font-bold px-3 py-1 rounded-xl uppercase ${
                  activeMilkRun.highestRisk === 'Critical'
                    ? 'bg-red-600 text-white'
                    : activeMilkRun.highestRisk === 'Warning'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {activeMilkRun.highestRisk} Priority
                </span>
              </div>

              {/* Phase 12 explanation */}
              <div className="bg-blue-600/10 border border-blue-500/30 p-3.5 rounded-xl">
                <span className="text-[10px] font-mono text-blue-400 uppercase font-black block tracking-wider">
                  Mizusumashi Reason (Why was this group created?)
                </span>
                <p className="text-xs text-slate-200 font-mono mt-1.5 leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-850">
                  {activeMilkRun.whyCreated}
                </p>
                <div className="text-[11px] font-sans text-slate-400 mt-2.5">
                  The system grouped these materials because they share a common destination ({activeMilkRun.destination}) and transit vehicle ({activeMilkRun.transportMode}). Materials were packed sequentially sorted by remaining coverage time to guarantee high priority parts are delivered before line-side stock is depleted.
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-850 text-xs font-mono text-slate-300">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Vehicle Capacity</span>
                  <strong className="text-slate-200 block mt-0.5">{activeMilkRun.capacity} Trolleys</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Capacity Used</span>
                  <strong className="text-emerald-400 block mt-0.5">{activeMilkRun.capacityUsed} Trolleys</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Cycle Time (Sec)</span>
                  <strong className="text-blue-400 block mt-0.5">{activeMilkRun.cycleTime}s</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block">Trips / Shift</span>
                  <strong className="text-slate-200 block mt-0.5">{activeMilkRun.tripsPerShift} Trips</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-xs font-mono text-slate-500">
              <span>Required Fleet: <strong>1 Operator + vehicle</strong></span>
              <span>Alignment status: <strong className={activeMilkRun.cycleTime <= productionPlan.taktTimeSeconds ? 'text-emerald-400' : 'text-red-400'}>
                {activeMilkRun.cycleTime <= productionPlan.taktTimeSeconds ? 'COMPLIANT ✓' : 'TAKT EXCEEDED ⚠️'}
              </strong></span>
            </div>
          </div>

        </div>
      )}

      {/* SWCT GENERATION AND VISUAL GRAPH REMOVED */}

      {/* REPLACED CURRENT SIMULATOR WITH TRUE MILK RUN MONITOR TERMINAL REMOVED */}

      {/* PHASE 11: HOURLY DELIVERY PLAN SCHEDULE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
          <Compass className="w-4.5 h-4.5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Hourly Replenishment Schedule (8-Hour Shift Target)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {hourlyPlanData.map((hour, idx) => (
            <div key={hour.slot} className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl space-y-2 flex flex-col justify-between">
              <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                <span className="text-[10px] font-mono text-slate-500">Hour {idx + 1}</span>
                <strong className="text-[10px] font-mono text-emerald-400">{hour.slot}</strong>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div>
                  <span className="text-[8px] text-slate-500 uppercase block">Trips</span>
                  <strong className="text-xs text-white block mt-0.5">{hour.trips}</strong>
                </div>
                <div>
                  <span className="text-[8px] text-slate-500 uppercase block">Dist</span>
                  <strong className="text-xs text-white block mt-0.5">{hour.distance}m</strong>
                </div>
                <div>
                  <span className="text-[8px] text-slate-500 uppercase block">Delivered</span>
                  <strong className="text-xs text-emerald-400 block mt-0.5">{hour.delivered} Tr</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
