/**
 * Manufacturing Calculation Engine
 * Industrial Engineering Formulas & Stock Calculations
 */

import {
  AssemblyLineCode,
  DetailedJumboTrip,
  PartMaster,
  PlantAlert,
  ProductionPlan,
  RealTimeInventoryState,
  RiskLevel,
  RouteMasterItem,
  SimulationTimelineEvent,
  StoreDistanceEntry,
  SWCTRecord,
  TransportMode,
  TransportModeConfig,
  TripPlan,
  TripStatus,
  TripStopDetail,
  TripTrolleyDetail,
} from '../types/manufacturing';
import {
  STATION_GAP_METERS,
  POC_MAX_TROLLEYS_PER_STATION,
  DELIVERY_TOLERANCE_MINUTES,
  DELIVERY_TOLERANCE_SECONDS,
  calculateInterStationDistance,
  calculateStoreToStationDistance,
  sortPocStations,
  getPartPocSpaceLimit,
  checkPocSpaceViolation,
} from './pocSorter';

export interface CalculatedPartMetrics {
  partNo: string;
  hourlyConsumption: number;
  shiftConsumption: number;
  trolleyReqPerHour: number;
  trolleyDemandPerHour: number; // Part Consumption Per Hour / Qty Per Trolley
  trolleyCoverageTimeMin: number; // Qty Per Trolley / Part Consumption Per Minute
  roundedTrolleysPerHour: number;
  roundedQuantityPerHour: number;
  shiftTrolleysReq: number;
  initialPocUnits: number;
  initialPocTrolleys: number;
  netShiftTrolleysReq: number;
  carryingCapacity: number;
  tripsRequiredPerHour: number;
  grossTripsRequiredPerShift: number;
  tripsRequiredPerShift: number; // Optimized net trips per 8.5-hr shift
  tripsRequiredPerDay: number; // Total trips per 16-hr day (2 shifts)
  loadedTravelSec: number;
  returnTravelSec: number;
  totalTravelMin: number;
  handlingTimeMin: number;
  cycleTimeMin: number;
  mhfRequired: number;
  deliveryFrequencyMins: number;
  loadSpeedSecPerMtr: number;
  emptySpeedSecPerMtr: number;
  // Single Operator Delivery & Usage Parameters
  singleOperatorDeliveryCapacityUnits: number;
  singleOperatorWorkloadMinPerShift: number;
  singleOperatorUtilizationPercent: number;
  singleOperatorMaxTripsPerShift: number;
  pocSpaceTrolleysMax: number;
  pocSpaceViolation: boolean;
  stockoutTimeFormatted: string;
  coverageMinutes: number;
  isCover?: boolean;
  packetDemandPerHour?: number;
  packetDemandPerShift?: number;
}

export const DEFAULT_TRANSPORT_MODE_CONFIGS: Record<TransportMode, TransportModeConfig> = {
  'Jumbo Trolley': {
    mode: 'Jumbo Trolley',
    loadSpeedSecPerMtr: 1 / 0.72, // 0.72 m/s -> 1.3889 sec/meter
    emptySpeedSecPerMtr: 1 / 0.72, // 0.72 m/s -> 1.3889 sec/meter
    carryingCapacityTrolleys: 3, // Exactly 3 trolleys per trip
    pickTimeSec: 10, // 10s per trolley
    storingTimeSec: 10, // 10s per trolley
    emptyHandlingTimeSec: 10, // 10s per trolley
    emptyDropTimeSec: 10, // 10s per trolley
  },
  'BOV (Battery Vehicle)': {
    mode: 'BOV (Battery Vehicle)',
    loadSpeedSecPerMtr: 1 / 0.50,
    emptySpeedSecPerMtr: 1 / 0.50,
    carryingCapacityTrolleys: 3,
    pickTimeSec: 10,
    storingTimeSec: 10,
    emptyHandlingTimeSec: 10,
    emptyDropTimeSec: 10,
  },
  'Manual Handling': {
    mode: 'Manual Handling',
    loadSpeedSecPerMtr: 1.65,
    emptySpeedSecPerMtr: 1.20,
    carryingCapacityTrolleys: 1,
    pickTimeSec: 10,
    storingTimeSec: 10,
    emptyHandlingTimeSec: 10,
    emptyDropTimeSec: 10,
  },
  'Hand Pallet Truck': {
    mode: 'Hand Pallet Truck',
    loadSpeedSecPerMtr: 2.00,
    emptySpeedSecPerMtr: 1.00,
    carryingCapacityTrolleys: 1,
    pickTimeSec: 10,
    storingTimeSec: 10,
    emptyHandlingTimeSec: 10,
    emptyDropTimeSec: 10,
  },
};

export const DEFAULT_STORE_DISTANCES: StoreDistanceEntry[] = [
  { fromStore: 'E 03,04', toStore: 'E 05,06', distanceMeters: 0 },
  { fromStore: 'E 03,04', toStore: 'E 07,09', distanceMeters: 0 },
  { fromStore: 'E 03,04', toStore: 'B 15,16', distanceMeters: 0 },
  { fromStore: 'E 05,06', toStore: 'E 07,09', distanceMeters: 0 },
  { fromStore: 'E 05,06', toStore: 'B 15,16', distanceMeters: 0 },
  { fromStore: 'E 07,09', toStore: 'B 15,16', distanceMeters: 0 },
];

export function getStoreDistance(
  fromStore: string,
  toStore: string,
  customDistances?: StoreDistanceEntry[]
): number {
  if (!fromStore || !toStore || fromStore === toStore) return 0;
  const list = customDistances || DEFAULT_STORE_DISTANCES;
  const match = list.find(
    (d) =>
      (d.fromStore === fromStore && d.toStore === toStore) ||
      (d.fromStore === toStore && d.toStore === fromStore)
  );
  return match ? match.distanceMeters : 0;
}

export function formatSecondsToTime(
  secondsFromShiftStart: number,
  startHour: number = 7,
  startMinute: number = 0
): string {
  const totalSeconds = startHour * 3600 + startMinute * 60 + Math.round(secondsFromShiftStart);
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getPocSpaceTrolleysMax(part?: PartMaster): number {
  return getPartPocSpaceLimit(part);
}

/**
 * Extracts and validates initial stock units for a part.
 * Guarantees that if stock is configured it is used;
 * Defaults to 1 full trolley/bin/carton/cover (= binCapacity) if undefined or 0,
 * matching standard POC shift carryover (docs/CALCULATION.md).
 */
export function getInitialStockUnits(part: PartMaster): number {
  const stock = part.initialPocTrolleyStock;
  if (stock !== undefined && stock !== null && !isNaN(stock) && stock > 0) {
    return stock;
  }
  return part.binCapacity > 0 ? part.binCapacity : 1;
}

/**
 * Calculates part consumption rate in units per minute based on vehicle production plan,
 * part usage per vehicle, and any manual overrides.
 */
export function getPartConsumptionRatePerMinute(part: PartMaster, plan: ProductionPlan): number {
  if (part.manualHourlyBinsOverride !== undefined && part.manualHourlyBinsOverride > 0) {
    return (part.manualHourlyBinsOverride * (part.binCapacity || 1)) / 60;
  }
  const usage = part.usagePerVehicle || 1;
  const hourlyVehicles = plan.hourlyPlanVehicles || (plan.taktTimeSeconds > 0 ? 3600 / plan.taktTimeSeconds : 129);
  return (hourlyVehicles * usage) / 60;
}

/**
 * Calculates how many minutes a given quantity of units will last at line-side POC.
 */
export function getPartCoverageMinutes(units: number, part: PartMaster, plan: ProductionPlan): number {
  const ratePerMin = getPartConsumptionRatePerMinute(part, plan);
  return ratePerMin > 0 ? Number((units / ratePerMin).toFixed(2)) : 0;
}

/**
 * Calculates how many finished vehicles can be assembled from a given quantity of part units.
 */
export function getVehiclesDemandCovered(units: number, part: PartMaster): number {
  const usage = part.usagePerVehicle || 1;
  return Number((units / usage).toFixed(1));
}

/**
 * Calculates part level consumption, trolley, cycle time, and fleet requirements
 * strictly matching algorithm.md formulas.
 */
export function calculatePartMetrics(
  part: PartMaster,
  hourlyPlanVehicles: number,
  shiftPlanVehicles: number,
  customModeConfigs?: Partial<Record<TransportMode, TransportModeConfig>>
): CalculatedPartMetrics {
  const usage = part.usagePerVehicle || 1;
  const hourlyConsumption = hourlyPlanVehicles * usage;
  const shiftConsumption = shiftPlanVehicles * usage;

  const binCap = part.binCapacity > 0 ? part.binCapacity : 1;
  const isCover = part.binOrTrolley === 'Cover';
  const isModular = part.binOrTrolley === 'Bin' || part.binOrTrolley === 'Carton';

  // For Cover packets (e.g. CABLE ASSY BRAKE with 50 pcs/cover):
  // User: "eg CABLE ASSY BRAKE it has been inside the cover has qty of 50. so per hour need 129 so we consider 3 packet of cover
  // it has been placed on any trolley it is no issue for the cover packet. so dont consider this part need trolley like wise for all"
  const packetDemandPerHour = isCover ? Math.ceil(hourlyConsumption / binCap) : undefined;
  const packetDemandPerShift = isCover ? Math.ceil(shiftConsumption / binCap) : undefined;

  // Trolley Demand Per Hour: for Cover, dedicated trolley demand is 0 (freely placed on any trolley)
  const calculatedTrolleyDemand = isCover ? 0 : Number((hourlyConsumption / binCap).toFixed(3));
  const trolleyDemandPerHour =
    part.manualHourlyBinsOverride !== undefined ? part.manualHourlyBinsOverride : calculatedTrolleyDemand;

  const trolleyReqPerHour = trolleyDemandPerHour;
  const roundedTrolleysPerHour =
    part.manualHourlyBinsOverride !== undefined
      ? part.manualHourlyBinsOverride
      : isCover
      ? 0
      : Math.ceil(hourlyConsumption / binCap); // Physical full trolleys needed for hourly plan
  const roundedQuantityPerHour = roundedTrolleysPerHour * binCap;

  const effectiveHourlyConsumption =
    part.manualHourlyBinsOverride !== undefined
      ? part.manualHourlyBinsOverride * binCap
      : hourlyConsumption;

  // Part Consumption Per Minute = Part Consumption Per Hour / 60
  const partConsumptionPerMinute = effectiveHourlyConsumption / 60;

  // Initial Stock Carryover at POC (0 if not specified)
  const initialPocUnits = getInitialStockUnits(part);
  const initialPocTrolleys = isCover ? 0 : Number((initialPocUnits / binCap).toFixed(2));

  // Trolley Coverage Time (min) = Initial POC Units / Part Consumption Per Minute
  const coverageMinutes =
    partConsumptionPerMinute > 0 && initialPocUnits > 0
      ? Number((initialPocUnits / partConsumptionPerMinute).toFixed(2))
      : 0;
  // Dynamic fix for single trolley consumption life: Qty Per Trolley / Part Consumption Per Minute
  const trolleyCoverageTimeMin = partConsumptionPerMinute > 0
    ? Number((binCap / partConsumptionPerMinute).toFixed(2))
    : 0;

  const stockoutSecondsFrom0700 = coverageMinutes * 60;
  const stockoutTimeFormatted = initialPocUnits > 0 ? formatSecondsToTime(stockoutSecondsFrom0700, 7, 0) : '07:00:00';

  // Shift Trolleys Req: 0 dedicated trolleys for Cover parts
  const calculatedShiftTrolleysReq = isCover ? 0 : Number((shiftConsumption / binCap).toFixed(2));
  const shiftTrolleysReq =
    part.manualHourlyBinsOverride !== undefined
      ? Number((part.manualHourlyBinsOverride * 8.0).toFixed(2))
      : calculatedShiftTrolleysReq;

  const effectiveShiftConsumption =
    part.manualHourlyBinsOverride !== undefined
      ? shiftTrolleysReq * binCap
      : shiftConsumption;

  // Net Shift Replenishment Required (Gross shift consumption minus initial POC carryover stock)
  const netShiftUnitsReq = Math.max(0, effectiveShiftConsumption - initialPocUnits);
  const netShiftTrolleysReq = isCover ? 0 : Number((netShiftUnitsReq / binCap).toFixed(2));

  // Retrieve mode configuration or default
  const defaultConfig =
    DEFAULT_TRANSPORT_MODE_CONFIGS[part.transportMode] ||
    DEFAULT_TRANSPORT_MODE_CONFIGS['Jumbo Trolley'];
  const userConfig = customModeConfigs?.[part.transportMode];

  const loadSpeed = userConfig?.loadSpeedSecPerMtr ?? defaultConfig.loadSpeedSecPerMtr;
  const emptySpeed = userConfig?.emptySpeedSecPerMtr ?? defaultConfig.emptySpeedSecPerMtr;
  const carryingCapacity =
    userConfig?.carryingCapacityTrolleys ?? defaultConfig.carryingCapacityTrolleys;

  // POC Space Constraints check
  const pocSpaceTrolleysMax = getPocSpaceTrolleysMax(part);
  const pocSpaceViolation = !isCover && initialPocTrolleys > pocSpaceTrolleysMax;

  // Container capacity
  // Modular units: Bins (stored in bins on platform trolley) and Cartons (pre-packed inside carton box placed on platform trolley)
  // 4 modular units fit on 1 platform trolley. Dedicated trolleys (e.g. Frame, Wheel) take 1 dedicated trolley slot.
  // Cover packets take 0 dedicated trolley slots (ride along freely on any trolley).
  const containerMultiplier = isCover ? 0 : isModular ? 4 : 1;
  const containerCapacity = isCover ? 1 : Math.max(1, carryingCapacity * containerMultiplier);

  // Handling times per trolley: 10s pick + 10s drop + 10s empty pick + 10s empty drop = 40s per trolley
  // For carryingCapacity (3 trolleys) = 120s (2.0 minutes)
  const pickTimeSec = (userConfig?.pickTimeSec ?? defaultConfig.pickTimeSec) * carryingCapacity;
  const storingTimeSec = (userConfig?.storingTimeSec ?? defaultConfig.storingTimeSec) * carryingCapacity;
  const emptyHandlingTimeSec =
    (userConfig?.emptyHandlingTimeSec ?? defaultConfig.emptyHandlingTimeSec) * carryingCapacity;
  const emptyDropTimeSec =
    ((userConfig as any)?.emptyDropTimeSec ?? (defaultConfig as any).emptyDropTimeSec) * carryingCapacity;

  // Travel time calculation using exact distances: Distance / 0.72 m/s
  const loadedTravelSec = part.loadedDistanceMeters * loadSpeed;
  const returnTravelSec = part.returnDistanceMeters * emptySpeed;
  const totalTravelSec = loadedTravelSec + returnTravelSec;
  const totalTravelMin = totalTravelSec / 60;

  // Handling time per trip
  const handlingSecPerTrip = pickTimeSec + storingTimeSec + emptyHandlingTimeSec + emptyDropTimeSec;
  const handlingTimeMin = handlingSecPerTrip / 60;

  // Total cycle time per trip
  const cycleTimeMin = totalTravelMin + handlingTimeMin;

  // Trips calculations: 0 dedicated trips for Cover parts since they piggyback on any trolley
  const tripsRequiredPerHour = isCover ? 0 : Math.ceil(trolleyDemandPerHour / containerCapacity);
  const grossTripsRequiredPerShift = isCover ? 0 : Math.ceil(shiftTrolleysReq / containerCapacity);
  const tripsRequiredPerShift = isCover ? 0 : Math.ceil(netShiftTrolleysReq / containerCapacity);
  const tripsRequiredPerDay = tripsRequiredPerShift * 2;

  // Total available operator time per 8-hour shift = 480 min
  const effectiveOperatorMinPerShift = 480;
  const totalTripTimeMinPerShift = isCover ? 0 : tripsRequiredPerShift * cycleTimeMin;
  const mhfRequired = isCover ? 0 : Number((totalTripTimeMinPerShift / effectiveOperatorMinPerShift).toFixed(2));

  // Delivery frequency
  const deliveryFrequencyMins = isCover ? 0 : Number((480 / Math.max(1, tripsRequiredPerShift)).toFixed(1));

  // Single Operator Delivery Parameters
  const singleOperatorDeliveryCapacityUnits = isCover ? 0 : containerCapacity * binCap;
  const singleOperatorWorkloadMinPerShift = isCover ? 0 : Number(totalTripTimeMinPerShift.toFixed(1));
  const singleOperatorUtilizationPercent = isCover ? 0 : Number(
    ((totalTripTimeMinPerShift / effectiveOperatorMinPerShift) * 100).toFixed(1)
  );
  const singleOperatorMaxTripsPerShift = isCover ? 0 : Math.floor(
    effectiveOperatorMinPerShift / Math.max(0.1, cycleTimeMin)
  );

  return {
    partNo: part.partNo,
    hourlyConsumption: effectiveHourlyConsumption,
    shiftConsumption: effectiveShiftConsumption,
    trolleyReqPerHour,
    trolleyDemandPerHour,
    trolleyCoverageTimeMin,
    roundedTrolleysPerHour,
    roundedQuantityPerHour,
    shiftTrolleysReq,
    initialPocUnits,
    initialPocTrolleys,
    netShiftTrolleysReq,
    carryingCapacity,
    tripsRequiredPerHour,
    grossTripsRequiredPerShift,
    tripsRequiredPerShift,
    tripsRequiredPerDay,
    loadedTravelSec: Number(loadedTravelSec.toFixed(1)),
    returnTravelSec: Number(returnTravelSec.toFixed(1)),
    totalTravelMin: Number(totalTravelMin.toFixed(2)),
    handlingTimeMin: Number(handlingTimeMin.toFixed(2)),
    cycleTimeMin: Number(cycleTimeMin.toFixed(2)),
    mhfRequired,
    deliveryFrequencyMins,
    loadSpeedSecPerMtr: loadSpeed,
    emptySpeedSecPerMtr: emptySpeed,
    singleOperatorDeliveryCapacityUnits,
    singleOperatorWorkloadMinPerShift,
    singleOperatorUtilizationPercent,
    singleOperatorMaxTripsPerShift,
    pocSpaceTrolleysMax,
    pocSpaceViolation,
    stockoutTimeFormatted,
    coverageMinutes,
    isCover,
    packetDemandPerHour,
    packetDemandPerShift,
  };
}

export interface HourlyCarryoverStep {
  hourIndex: number; // 1 to 9
  timeRange: string; // e.g. "07:00 - 08:00"
  openingStockUnits: number;
  openingStockTrolleys: number;
  hourlyConsumptionUnits: number;
  replenishmentDeliveredUnits: number;
  replenishmentTripsTriggered: number;
  endingStockUnits: number;
  endingStockTrolleys: number;
  coverageHours: number;
  riskLevel: RiskLevel;
  pocSpaceViolation: boolean;
  pocSpaceTrolleysMax: number;
}

export interface ShiftCarryoverStep {
  shiftName: string; // "Shift 1 (07:00 - 15:30)", "Shift 2 (15:30 - 00:00)"
  openingCarryoverUnits: number;
  openingCarryoverTrolleys: number;
  grossShiftDemandUnits: number;
  netReplenishmentNeededUnits: number;
  netTripsRequired: number;
  grossTripsRequired: number;
  tripsSaved: number;
  endingCarryoverUnits: number;
  endingCarryoverTrolleys: number;
  pocSpaceViolation: boolean;
  pocSpaceTrolleysMax: number;
}

export interface CarryoverOptimizationResult {
  partNo: string;
  partDescription: string;
  taktTimeSec: number;
  vph: number; // Vehicles Per Hour = 3600 / taktTimeSec
  shiftTargetVehicles: number; // vph * 8.0 hr work
  binCapacity: number;
  usagePerVehicle: number;
  carryingCapacity: number;
  transportMode: TransportMode;
  hourlyConsumptionUnits: number;
  shiftConsumptionUnits: number;
  initialCarryoverUnits: number;
  initialCarryoverTrolleys: number;
  hourlySimulation: HourlyCarryoverStep[];
  shiftSimulation: ShiftCarryoverStep[];
  totalShiftTripsSaved: number;
  totalDailyTripsSaved: number;
}

/**
 * Calculates precise hourly and shift-based carryover stock optimization
 * based on a target Takt Time (e.g. 27.9s) and initial POC stock.
 */
export function calculateHourlyAndShiftCarryover(
  part: PartMaster,
  taktTimeSec: number = 27.9,
  customModeConfigs?: Partial<Record<TransportMode, TransportModeConfig>>
): CarryoverOptimizationResult {
  const safeTaktTime = taktTimeSec > 0 ? taktTimeSec : 27.9;
  const vph = Number((3600 / safeTaktTime).toFixed(2));
  const shiftTargetVehicles = Math.round(vph * 8); // 8.0 hours effective shift

  const usage = part.usagePerVehicle || 1;
  const binCap = part.binCapacity > 0 ? part.binCapacity : 1;
  const hourlyConsumptionUnits = Math.round(vph * usage);
  const shiftConsumptionUnits = shiftTargetVehicles * usage;

  const defaultConfig = DEFAULT_TRANSPORT_MODE_CONFIGS[part.transportMode] || DEFAULT_TRANSPORT_MODE_CONFIGS['Jumbo Trolley'];
  const userConfig = customModeConfigs?.[part.transportMode];
  const carryingCapacity = userConfig?.carryingCapacityTrolleys ?? defaultConfig.carryingCapacityTrolleys;
  const batchDeliveryUnits = carryingCapacity * binCap;

  const initialCarryoverUnits = getInitialStockUnits(part);
  const initialCarryoverTrolleys = Number((initialCarryoverUnits / binCap).toFixed(2));
  const maxAllowedTrolleys = getPocSpaceTrolleysMax(part);

  // --- 1. Hourly Carryover Simulation (07:00 AM to 15:30 PM - 9 Intervals with Lunch) ---
  const hourlySimulation: HourlyCarryoverStep[] = [];
  const hourLabels = [
    '07:00 - 08:00 (Hr 1)',
    '08:00 - 09:00 (Hr 2)',
    '09:00 - 10:00 (Hr 3)',
    '10:00 - 11:00 (Hr 4)',
    '11:00 - 11:45 (Hr 5)',
    '11:45 - 12:15 (LUNCH)',
    '12:15 - 13:15 (Hr 6)',
    '13:15 - 14:15 (Hr 7)',
    '14:15 - 15:30 (Hr 8)',
  ];
  const hourFactors = [1.0, 1.0, 1.0, 1.0, 0.75, 0.0, 1.0, 1.0, 1.25];

  let currentStock = initialCarryoverUnits;

  for (let h = 0; h < 9; h++) {
    const factor = hourFactors[h];
    const openingStockUnits = Math.round(currentStock);
    const openingStockTrolleys = Number((openingStockUnits / binCap).toFixed(2));
    const currentHourConsumption = Math.round(vph * factor * usage);

    // Determine replenishment needed in this hour if current stock minus consumption falls below 0.5 hour buffer
    const safetyBufferUnits = Math.round(hourlyConsumptionUnits * 0.5);
    let tripsTriggered = 0;
    let deliveredUnits = 0;

    // Only replenish if it's not lunch and we fall below the safety buffer
    if (factor > 0 && openingStockUnits - currentHourConsumption < safetyBufferUnits) {
      const deficit = (currentHourConsumption + safetyBufferUnits) - openingStockUnits;
      tripsTriggered = Math.max(1, Math.ceil(deficit / batchDeliveryUnits));
      deliveredUnits = tripsTriggered * batchDeliveryUnits;
    }

    const endingStockUnits = Math.max(0, openingStockUnits + deliveredUnits - currentHourConsumption);
    const endingStockTrolleys = Number((endingStockUnits / binCap).toFixed(2));
    
    // Coverage hours based on standard hourly consumption
    const coverageHours = Number((endingStockUnits / Math.max(1, hourlyConsumptionUnits)).toFixed(2));
    const riskLevel = getRiskLevel(coverageHours);

    // POC Space constraints violation check
    const deliveredTrolleys = tripsTriggered * carryingCapacity;
    const peakStockTrolleys = openingStockTrolleys + deliveredTrolleys;
    const pocSpaceViolation = peakStockTrolleys > maxAllowedTrolleys;

    hourlySimulation.push({
      hourIndex: h + 1,
      timeRange: hourLabels[h],
      openingStockUnits,
      openingStockTrolleys,
      hourlyConsumptionUnits: currentHourConsumption,
      replenishmentDeliveredUnits: deliveredUnits,
      replenishmentTripsTriggered: tripsTriggered,
      endingStockUnits,
      endingStockTrolleys,
      coverageHours,
      riskLevel,
      pocSpaceViolation,
      pocSpaceTrolleysMax: maxAllowedTrolleys,
    });

    currentStock = endingStockUnits;
  }

  // --- 2. 2-Shift Carryover Matrix Simulation ---
  const shiftNames = [
    'Shift 1 (07:00 - 15:30) [Day]',
    'Shift 2 (15:30 - 00:00) [Night]',
  ];

  const shiftSimulation: ShiftCarryoverStep[] = [];
  let shiftOpeningCarryover = initialCarryoverUnits;
  let totalShiftTripsSaved = 0;

  for (let s = 0; s < 2; s++) {
    const grossShiftDemandUnits = shiftConsumptionUnits;
    const grossTripsRequired = Math.ceil(grossShiftDemandUnits / batchDeliveryUnits);

    const netReplenishmentNeededUnits = Math.max(0, grossShiftDemandUnits - shiftOpeningCarryover);
    const netTripsRequired = Math.ceil(netReplenishmentNeededUnits / batchDeliveryUnits);
    const tripsSaved = Math.max(0, grossTripsRequired - netTripsRequired);

    totalShiftTripsSaved += tripsSaved;

    const deliveredUnitsInShift = netTripsRequired * batchDeliveryUnits;
    const endingCarryoverUnits = shiftOpeningCarryover + deliveredUnitsInShift - grossShiftDemandUnits;
    const endingCarryoverTrolleys = Number((Math.max(0, endingCarryoverUnits) / binCap).toFixed(2));

    const openingTrolleys = Number((shiftOpeningCarryover / binCap).toFixed(2));
    const peakShiftTrolleys = openingTrolleys + (netTripsRequired * carryingCapacity);
    const pocSpaceViolation = peakShiftTrolleys > maxAllowedTrolleys;

    shiftSimulation.push({
      shiftName: shiftNames[s],
      openingCarryoverUnits: shiftOpeningCarryover,
      openingCarryoverTrolleys: openingTrolleys,
      grossShiftDemandUnits,
      netReplenishmentNeededUnits,
      netTripsRequired,
      grossTripsRequired,
      tripsSaved,
      endingCarryoverUnits: Math.max(0, endingCarryoverUnits),
      endingCarryoverTrolleys,
      pocSpaceViolation,
      pocSpaceTrolleysMax: maxAllowedTrolleys,
    });

    // Pass ending carryover as opening to next shift
    shiftOpeningCarryover = Math.max(0, endingCarryoverUnits);
  }

  return {
    partNo: part.partNo,
    partDescription: part.description,
    taktTimeSec: safeTaktTime,
    vph,
    shiftTargetVehicles,
    binCapacity: binCap,
    usagePerVehicle: usage,
    carryingCapacity,
    transportMode: part.transportMode,
    hourlyConsumptionUnits,
    shiftConsumptionUnits,
    initialCarryoverUnits,
    initialCarryoverTrolleys,
    hourlySimulation,
    shiftSimulation,
    totalShiftTripsSaved: shiftSimulation[0]?.tripsSaved || 0,
    totalDailyTripsSaved: totalShiftTripsSaved,
  };
}

/**
 * Classifies inventory risk based on coverage hours
 * Green: Coverage > 2 Hours
 * Yellow: Coverage 1 to 2 Hours
 * Red: Coverage < 1 Hour
 */
export function getRiskLevel(coverageHours: number): RiskLevel {
  if (coverageHours > 2) return 'Green';
  if (coverageHours >= 1) return 'Yellow';
  return 'Red';
}

/**
 * Computes current stock and coverage given opening stock, delivered, and consumed
 */
export function computeInventoryState(
  part: PartMaster,
  openingStock: number,
  deliveredQty: number,
  consumedQty: number,
  hourlyConsumption: number,
  lastReplenishedAt: string
): RealTimeInventoryState {
  const currentStockUnits = Math.max(0, openingStock + deliveredQty - consumedQty);
  const hourlyCons = hourlyConsumption > 0 ? hourlyConsumption : 1;
  const coverageHours = Number((currentStockUnits / hourlyCons).toFixed(2));
  const riskLevel = getRiskLevel(coverageHours);

  // Closing stock forecast for end of 8-hour shift
  const totalShiftDemand = hourlyCons * 8;
  const projectedClosingStock = Math.max(0, currentStockUnits + (deliveredQty > 0 ? 0 : 0) - (totalShiftDemand - consumedQty));

  const now = new Date();
  const nextDeliveryDate = new Date(now.getTime() + Math.max(15, coverageHours * 60 * 0.5) * 60000);
  const nextDeliveryScheduledAt = nextDeliveryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Lean Kanban Restock Calculations
  const consumptionPerMin = hourlyCons / 60;
  // Safety buffer: standard 2.0 minutes or minSafetyCoverageHours
  const safetyBufferMins = Math.max(2.0, (part.minSafetyCoverageHours || 0.25) * 60);
  const leadTimeMins = (part.pickTimeMin || 3.5) + ((part.loadedDistanceMeters || 120) * 1.3889 / 60) + (part.storingTimePocMin || 2.5);
  
  const safetyStockUnits = Math.max(1, Math.ceil(safetyBufferMins * consumptionPerMin));
  const reorderPointUnits = Math.max(safetyStockUnits + 1, Math.ceil((leadTimeMins + safetyBufferMins) * consumptionPerMin));
  const restockTriggered = currentStockUnits <= reorderPointUnits;

  let restockStatus: 'Normal' | 'Restock Triggered' | 'Critical Low' | 'In Transit' | 'Delivered' = 'Normal';
  if (currentStockUnits <= safetyStockUnits) {
    restockStatus = 'Critical Low';
  } else if (currentStockUnits <= reorderPointUnits) {
    restockStatus = 'Restock Triggered';
  } else {
    restockStatus = 'Normal';
  }

  return {
    partNo: part.partNo,
    pocPoint: part.pocPoint,
    openingStockUnits: openingStock,
    deliveredQuantityUnits: deliveredQty,
    consumedQuantityUnits: consumedQty,
    currentStockUnits,
    closingStockUnits: projectedClosingStock,
    coverageHours,
    riskLevel,
    lastReplenishedAt,
    nextDeliveryScheduledAt,
    safetyStockUnits,
    reorderPointUnits,
    restockTriggered,
    restockStatus,
  };
}

/**
 * SWCT Aggregation helper
 */
export function calculateSWCTSummary(records: SWCTRecord[], taktTimeSec: number = 27.9) {
  const totalPick = records.reduce((acc, r) => acc + r.pickTimeSec, 0);
  const totalTravel = records.reduce((acc, r) => acc + (r.travelTimeSec + r.emptyReturnTimeSec), 0);
  const totalUnload = records.reduce((acc, r) => acc + (r.unloadingTimeSec + r.emptyCollectionTimeSec), 0);
  const totalWait = records.reduce((acc, r) => acc + r.waitingTimeSec, 0);
  const totalWaste = records.reduce((acc, r) => acc + r.wasteTimeSec, 0);
  const totalCycle = records.reduce((acc, r) => acc + r.totalCycleTimeSec, 0);

  return {
    totalPick,
    totalTravel,
    totalUnload,
    totalWait,
    totalWaste,
    totalCycle,
    taktTimeSec,
  };
}

/**
 * Automated Stock Carry-Forward Logic
 * Shift 1 Closing -> Shift 2 Opening
 * Shift 2 Closing -> Next Day Shift 1 Opening
 */
export function carryForwardStock(
  currentStates: RealTimeInventoryState[],
  nextShiftName: string
): RealTimeInventoryState[] {
  return currentStates.map((state) => ({
    ...state,
    openingStockUnits: state.closingStockUnits,
    deliveredQuantityUnits: 0,
    consumedQuantityUnits: 0,
    currentStockUnits: state.closingStockUnits,
    closingStockUnits: state.closingStockUnits,
    coverageHours: state.coverageHours,
    lastReplenishedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));
}

export interface MilkRunGroup {
  groupId: string;
  groupName: string;
  pocPoint: string;
  storeLocations: string[];
  parts: Array<{
    part: PartMaster;
    hourlyTrolleys: number;
    loadQty: number;
  }>;
  totalTrolleys: number;
  cycleTimeMin: number;
  transportMode: TransportMode;
  tripsHr?: number;
  tripsShift?: number;
  tripsDay?: number;
  freqMins?: number;
  routeName?: string;
  assignedOperator?: string;
  highestRisk?: string;
}

/**
 * Generates the definitive Jumbo Milk-Run Trips matching algorithm.md:
 * - Strictly 3 trolleys per trip
 * - Backward deadline calculation from consumption stockout timestamps
 * - Dynamic priority replenishment
 * - POC capacity constraints & physical occupancy
 * - Exact distances & 0.72 m/s travel time
 */
export function generateDetailedJumboTrips(
  parts: PartMaster[],
  productionPlan: ProductionPlan,
  customModeConfigs?: Partial<Record<TransportMode, TransportModeConfig>>,
  customStoreDistances?: StoreDistanceEntry[],
  simulationHours: number = 8
): DetailedJumboTrip[] {
  // 1. Filter active parts
  const activeParts = parts.filter(
    (p) => p.isActive !== false
  );
  if (activeParts.length === 0) return [];

  const taktTime = productionPlan.taktTimeSeconds || 27.9;
  const vph = productionPlan.hourlyPlanVehicles || Math.round(3600 / taktTime);
  const totalVehicles = vph * simulationHours;

  // Capacity of Jumbo is strictly 3 loaded trolleys per trip
  const jumboCapacity = 3;
  const operatorSpeedMps = 0.72; // 0.72 m/s

  // Tracking dynamic stock and occupancy
  const deliveredTrolleys: Record<string, number> = {};
  const totalTrolleysNeeded: Record<string, number> = {};

  activeParts.forEach((p) => {
    const binCap = p.binCapacity || 1;
    deliveredTrolleys[p.partNo] = 0;
    if (p.binOrTrolley === 'Cover') {
      totalTrolleysNeeded[p.partNo] = 0;
    } else {
      const hourlyBinsNeeded = p.manualHourlyBinsOverride !== undefined
        ? p.manualHourlyBinsOverride
        : (vph * (p.usagePerVehicle || 1)) / binCap;
      totalTrolleysNeeded[p.partNo] = Math.ceil(hourlyBinsNeeded * simulationHours);
    }
  });

  // Total replenishment trolleys required
  const totalReplenishmentTrolleys = activeParts.reduce((sum, p) => {
    const needed = totalTrolleysNeeded[p.partNo];
    const initial = Math.ceil(getInitialStockUnits(p) / p.binCapacity);
    return sum + Math.max(0, needed - initial);
  }, 0);

  const totalTripsCount = Math.max(
    1,
    Math.ceil(totalReplenishmentTrolleys / jumboCapacity)
  );
  const trips: DetailedJumboTrip[] = [];

  let lastJumboAvailableTimeSec = 0;

  for (let tripIdx = 0; tripIdx < totalTripsCount; tripIdx++) {
    // 1. Determine earliest stockout time to pace the departure
    let earliestStockoutSec = Infinity;
    let mostUrgentPart: PartMaster | null = null;

    activeParts.forEach((p) => {
      const binCap = p.binCapacity || 1;
      const usage = p.usagePerVehicle || 1;
      const ratePerSec = p.manualHourlyBinsOverride !== undefined
        ? (p.manualHourlyBinsOverride * binCap) / 3600
        : (usage / taktTime);
      const totalNeeded = totalTrolleysNeeded[p.partNo];
      const initialBins = Math.ceil(getInitialStockUnits(p) / binCap);
      const stillNeeded = Math.max(0, totalNeeded - initialBins) - (deliveredTrolleys[p.partNo] || 0);

      if (stillNeeded > 0) {
        const currentStock = getInitialStockUnits(p) + (deliveredTrolleys[p.partNo] || 0) * binCap;
        const timeToStockout = ratePerSec > 0 ? currentStock / ratePerSec : Infinity;
        if (timeToStockout < earliestStockoutSec) {
          earliestStockoutSec = timeToStockout;
          mostUrgentPart = p;
        }
      }
    });

    // Fallback if none are "needed" but we still generate trips
    if (!mostUrgentPart) {
      earliestStockoutSec = Infinity;
      activeParts.forEach((p) => {
        const binCap = p.binCapacity || 1;
        const usage = p.usagePerVehicle || 1;
        const ratePerSec = p.manualHourlyBinsOverride !== undefined
          ? (p.manualHourlyBinsOverride * binCap) / 3600
          : (usage / taktTime);
        const currentStock = getInitialStockUnits(p) + (deliveredTrolleys[p.partNo] || 0) * binCap;
        const timeToStockout = ratePerSec > 0 ? currentStock / ratePerSec : Infinity;
        if (timeToStockout < earliestStockoutSec) {
          earliestStockoutSec = timeToStockout;
          mostUrgentPart = p;
        }
      });
    }

    if (!mostUrgentPart) {
      mostUrgentPart = activeParts[0];
    }

    // Lead time to POC for most urgent part
    const urgentPartDist = mostUrgentPart.loadedDistanceMeters || calculateStoreToStationDistance(mostUrgentPart.pocPoint);
    const estLeadTime = 30 + (urgentPartDist / operatorSpeedMps);

    // Departure targeting 2 mins (-120s) arrival tolerance before stockout
    const targetArrivalSec = Math.max(0, earliestStockoutSec - 120);
    const departureSec = Math.max(0, targetArrivalSec - estLeadTime);
    const actualDepartureSec = Math.max(lastJumboAvailableTimeSec, departureSec);

    // 2. Select exactly 3 trolleys dynamically using greedy allocation at actualDepartureSec
    const loadedTrolleys: Array<{ part: PartMaster; sequence: number }> = [];

    for (let slot = 0; slot < jumboCapacity; slot++) {
      let slotUrgentPart: PartMaster | null = null;
      let slotEarliestStockoutSec = Infinity;

      activeParts.forEach((p) => {
        const binCap = p.binCapacity || 1;
        const usage = p.usagePerVehicle || 1;
        const ratePerSec = p.manualHourlyBinsOverride !== undefined
          ? (p.manualHourlyBinsOverride * binCap) / 3600
          : (usage / taktTime);

        // Approximate arrival time of this slot
        const travelDist = p.loadedDistanceMeters || calculateStoreToStationDistance(p.pocPoint);
        const approxArrivalSec = actualDepartureSec + (slot + 1) * 10 + (travelDist / operatorSpeedMps);

        const consumed = ratePerSec * approxArrivalSec;
        const delivered = getInitialStockUnits(p) + (deliveredTrolleys[p.partNo] || 0) * binCap;
        const netStock = delivered - consumed;

        const timeToStockout = ratePerSec > 0 ? netStock / ratePerSec : Infinity;
        const stockoutTime = approxArrivalSec + timeToStockout;

        const totalNeeded = totalTrolleysNeeded[p.partNo];
        const initialBins = Math.ceil(getInitialStockUnits(p) / binCap);
        const stillNeeded = Math.max(0, totalNeeded - initialBins) - (deliveredTrolleys[p.partNo] || 0);

        if (stillNeeded > 0) {
          if (stockoutTime < slotEarliestStockoutSec) {
            slotEarliestStockoutSec = stockoutTime;
            slotUrgentPart = p;
          }
        }
      });

      // Fallback
      if (!slotUrgentPart) {
        let fallbackEarliest = Infinity;
        activeParts.forEach((p) => {
          const binCap = p.binCapacity || 1;
          const usage = p.usagePerVehicle || 1;
          const ratePerSec = p.manualHourlyBinsOverride !== undefined
            ? (p.manualHourlyBinsOverride * binCap) / 3600
            : (usage / taktTime);
          const travelDist = p.loadedDistanceMeters || calculateStoreToStationDistance(p.pocPoint);
          const approxArrivalSec = actualDepartureSec + (slot + 1) * 10 + (travelDist / operatorSpeedMps);
          const consumed = ratePerSec * approxArrivalSec;
          const delivered = getInitialStockUnits(p) + (deliveredTrolleys[p.partNo] || 0) * binCap;
          const netStock = delivered - consumed;
          const timeToStockout = ratePerSec > 0 ? netStock / ratePerSec : Infinity;
          const stockoutTime = approxArrivalSec + timeToStockout;

          if (stockoutTime < fallbackEarliest) {
            fallbackEarliest = stockoutTime;
            slotUrgentPart = p;
          }
        });
      }

      if (slotUrgentPart) {
        loadedTrolleys.push({ part: slotUrgentPart, sequence: slot + 1 });
        deliveredTrolleys[slotUrgentPart.partNo] = (deliveredTrolleys[slotUrgentPart.partNo] || 0) + 1;
      }
    }

    // 3. Multi-stop routing sequence
    const uniquePocs = Array.from(new Set(loadedTrolleys.map(t => t.part.pocPoint).filter(Boolean)));
    const sortedPocPoints = sortPocStations(uniquePocs.map(p => ({ pocPoint: p }))).map(item => item.pocPoint);

    let tripDistanceMeters = 0;
    let routeDesc = '';
    const routeSeq: string[] = ['Central Stores'];

    if (sortedPocPoints.length > 0) {
      const firstPoc = sortedPocPoints[0];
      const firstPocParts = loadedTrolleys.filter(t => t.part.pocPoint === firstPoc);
      const firstDist = firstPocParts.length > 0
        ? Math.max(...firstPocParts.map(t => t.part.loadedDistanceMeters || 0))
        : 0;
      const initialDist = firstDist > 0 ? firstDist : calculateStoreToStationDistance(firstPoc);

      let interStationTravelMeters = 0;
      for (let i = 0; i < sortedPocPoints.length - 1; i++) {
        interStationTravelMeters += calculateInterStationDistance(sortedPocPoints[i], sortedPocPoints[i + 1]);
      }

      const lastPoc = sortedPocPoints[sortedPocPoints.length - 1];
      const lastPocParts = loadedTrolleys.filter(t => t.part.pocPoint === lastPoc);
      const lastDist = lastPocParts.length > 0
        ? Math.max(...lastPocParts.map(t => t.part.returnDistanceMeters || 0))
        : 0;
      const returnDist = lastDist > 0 ? lastDist : calculateStoreToStationDistance(lastPoc);

      tripDistanceMeters = initialDist + interStationTravelMeters + returnDist;
      routeSeq.push(...sortedPocPoints, 'Central Stores');
      const interDesc = interStationTravelMeters > 0 ? ` (${interStationTravelMeters}m) -> ` : ' -> ';
      routeDesc = `Stores -> ${sortedPocPoints.join(interDesc)} -> Stores`;
    } else {
      routeSeq.push('Central Stores');
      tripDistanceMeters = 0;
      routeDesc = 'Stores -> Stores';
    }

    // Co-loaded store locations inside-store travel
    const uniqueStores = Array.from(new Set(loadedTrolleys.map(t => t.part.storeLocation).filter(Boolean)));
    let insideStoreDist = 0;
    for (let i = 0; i < uniqueStores.length - 1; i++) {
      insideStoreDist += getStoreDistance(uniqueStores[i], uniqueStores[i + 1], customStoreDistances);
    }
    tripDistanceMeters += insideStoreDist;

    // Travel time & handling times
    const travelTimeSec = tripDistanceMeters / operatorSpeedMps;
    const pickTimeSec = loadedTrolleys.length * 10;
    const dropTimeSec = loadedTrolleys.length * 10;
    const emptyPickSec = loadedTrolleys.length * 10;
    const emptyDropSec = loadedTrolleys.length * 10;
    const handlingTimeSec = pickTimeSec + dropTimeSec + emptyPickSec + emptyDropSec;
    const totalTripDurationSec = travelTimeSec + handlingTimeSec;

    const arrivalPocSec = actualDepartureSec + pickTimeSec + (tripDistanceMeters - (sortedPocPoints.length > 0 ? calculateStoreToStationDistance(sortedPocPoints[sortedPocPoints.length - 1]) : 0)) / operatorSpeedMps;
    const returnStoresSec = actualDepartureSec + totalTripDurationSec;
    lastJumboAvailableTimeSec = returnStoresSec;

    const safetyMarginSec = Math.round(earliestStockoutSec - arrivalPocSec);
    const latestDepartureSec = Math.max(0, earliestStockoutSec - estLeadTime - 120);

    // 4. Trolley Details
    const trolleyDetails: TripTrolleyDetail[] = loadedTrolleys.map((t, slotIdx) => {
      const p = t.part;
      const binCap = p.binCapacity || 1;
      const usage = p.usagePerVehicle || 1;

      const invBefore = Math.max(0, getInitialStockUnits(p) + ((deliveredTrolleys[p.partNo] || 0) - 1) * binCap - Math.round((actualDepartureSec / taktTime) * usage));
      const occBefore = Math.ceil(invBefore / binCap);

      const invAfter = invBefore + binCap;
      const occAfter = Math.ceil(invAfter / binCap);

      return {
        sequence: slotIdx + 1,
        partNo: p.partNo,
        partName: p.description,
        storeLocation: p.storeLocation,
        pocPoint: p.pocPoint,
        quantity: binCap,
        pickupTime: formatSecondsToTime(actualDepartureSec + slotIdx * 10),
        dropTime: formatSecondsToTime(arrivalPocSec + slotIdx * 10),
        inventoryBefore: Math.round(invBefore),
        inventoryAfter: Math.round(invAfter),
        pocOccupancyBefore: Math.min(2, occBefore),
        pocOccupancyAfter: Math.min(2, occAfter),
      };
    });

    // 5. Dynamic Stop Details
    const stops: TripStopDetail[] = [
      {
        stopSequence: 1,
        type: 'Store Pick',
        location: uniqueStores.join(' & '),
        partNos: loadedTrolleys.map((t) => t.part.partNo),
        arrivalTime: formatSecondsToTime(actualDepartureSec),
        departureTime: formatSecondsToTime(actualDepartureSec + pickTimeSec),
        durationSeconds: pickTimeSec,
      },
    ];

    let currentLegStartSec = actualDepartureSec + pickTimeSec;
    let prevPoc: string | undefined = undefined;

    sortedPocPoints.forEach((poc, idx) => {
      const pocParts = loadedTrolleys.filter(t => t.part.pocPoint === poc);
      const legDist = prevPoc
        ? calculateInterStationDistance(prevPoc, poc)
        : (pocParts.length > 0 && pocParts[0].part.loadedDistanceMeters > 0
            ? pocParts[0].part.loadedDistanceMeters
            : calculateStoreToStationDistance(poc));

      const arrSec = currentLegStartSec + legDist / operatorSpeedMps;
      const dropSec = pocParts.length * 20;

      stops.push({
        stopSequence: stops.length + 1,
        type: 'POC Drop',
        location: `Line Station ${poc}`,
        pocPoint: poc,
        partNos: pocParts.map((t) => t.part.partNo),
        arrivalTime: formatSecondsToTime(arrSec),
        departureTime: formatSecondsToTime(arrSec + dropSec),
        durationSeconds: dropSec,
      });

      currentLegStartSec = arrSec + dropSec;
      prevPoc = poc;
    });

    stops.push({
      stopSequence: stops.length + 1,
      type: 'Empty Return',
      location: 'Central Stores Return Bay',
      partNos: loadedTrolleys.map((t) => t.part.partNo),
      arrivalTime: formatSecondsToTime(returnStoresSec - emptyDropSec),
      departureTime: formatSecondsToTime(returnStoresSec),
      durationSeconds: emptyDropSec,
    });

    trips.push({
      tripId: `TRIP-T${String(tripIdx + 1).padStart(3, '0')}`,
      tripNumber: tripIdx + 1,
      startTime: formatSecondsToTime(actualDepartureSec),
      expectedArrivalPoc: formatSecondsToTime(arrivalPocSec),
      expectedReturnStores: formatSecondsToTime(returnStoresSec),
      durationMinutes: Number((totalTripDurationSec / 60).toFixed(2)),
      durationSeconds: Math.round(totalTripDurationSec),
      totalDistanceMeters: Math.round(tripDistanceMeters),
      routeDescription: routeDesc,
      routeSequence: routeSeq,
      operatorName: 'Suresh Kumar',
      jumboId: 'JUMBO-01',
      trolleyCount: loadedTrolleys.length,
      trolleys: trolleyDetails,
      stops,
      status: 'Planned',
      deadlineTime: formatSecondsToTime(latestDepartureSec),
      safetyMarginSeconds: safetyMarginSec,
      criticalPartNo: mostUrgentPart.partNo,
      isFeasible: safetyMarginSec >= 0,
      feasibilityIssues:
        safetyMarginSec < 0
          ? [`Stockout risk for ${mostUrgentPart.partNo}`]
          : [],
    });
  }

  return trips;
}

/**
 * Generates continuous vehicle-by-vehicle simulation events
 * showing exact production timestamps, replenishment drops, and inventory changes.
 */
export function generateSimulationTimeline(
  parts: PartMaster[],
  productionPlan: ProductionPlan,
  trips: DetailedJumboTrip[],
  simulationHours: number = 1
): SimulationTimelineEvent[] {
  const events: SimulationTimelineEvent[] = [];
  const taktTime = productionPlan.taktTimeSeconds || 27.9;
  const vph = productionPlan.hourlyPlanVehicles || Math.round(3600 / taktTime);
  const totalVehicles = vph * simulationHours;

  const activeParts = parts.filter(
    (p) => p.isActive !== false && p.partNo !== 'KE121530'
  );

  // Initialize stock
  const currentStock: Record<string, number> = {};
  const currentOccupancy: Record<string, number> = {};

  activeParts.forEach((p) => {
    const initialUnits = getInitialStockUnits(p);
    currentStock[p.partNo] = initialUnits;
    currentOccupancy[p.partNo] = initialUnits > 0 ? Math.ceil(initialUnits / (p.binCapacity || 1)) : 0;
  });

  // Track pending trip events
  const pendingTripDrops: Array<{
    timestampSeconds: number;
    tripId: string;
    partNo: string;
    pocPoint: string;
    quantity: number;
  }> = [];

  trips.forEach((t) => {
    t.trolleys.forEach((tr) => {
      // Calculate drop timestamp in seconds from 07:00:00
      const [h, m, s] = tr.dropTime.split(':').map(Number);
      const dropSec = (h - 7) * 3600 + m * 60 + s;
      pendingTripDrops.push({
        timestampSeconds: dropSec,
        tripId: t.tripId,
        partNo: tr.partNo,
        pocPoint: tr.pocPoint,
        quantity: tr.quantity,
      });
    });
  });

  // Sort drops chronologically
  pendingTripDrops.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  // Vehicle by vehicle simulation
  let dropIdx = 0;
  for (let v = 1; v <= totalVehicles; v++) {
    const vehicleTimeSec = v * taktTime;

    // Check if any replenishment arrives before or at this vehicle
    while (
      dropIdx < pendingTripDrops.length &&
      pendingTripDrops[dropIdx].timestampSeconds <= vehicleTimeSec
    ) {
      const drop = pendingTripDrops[dropIdx];
      currentStock[drop.partNo] += drop.quantity;
      const part = activeParts.find((p) => p.partNo === drop.partNo);

      events.push({
        id: `EV-DROP-${drop.tripId}-${drop.partNo}-${dropIdx}`,
        time: formatSecondsToTime(drop.timestampSeconds),
        timestampSeconds: drop.timestampSeconds,
        type: 'Trolley Drop',
        partNo: drop.partNo,
        pocPoint: drop.pocPoint,
        tripId: drop.tripId,
        message: `${drop.tripId} delivered 1 trolley of ${part?.description || drop.partNo} (${drop.quantity} pcs) to ${drop.pocPoint}. New Stock: ${currentStock[drop.partNo]} pcs.`,
        severity: 'info',
        inventorySnapshot: Object.fromEntries(
          activeParts.map((p) => [
            p.partNo,
            {
              stock: currentStock[p.partNo],
              occupancy: currentOccupancy[p.partNo],
            },
          ])
        ),
      });
      dropIdx++;
    }

    // Consume 1 unit of each active part
    let stockoutDetected = false;
    activeParts.forEach((p) => {
      currentStock[p.partNo] -= p.usagePerVehicle || 1;
      if (currentStock[p.partNo] <= 0) {
        stockoutDetected = true;
      }
    });

    if (v === 1 || v % 10 === 0 || v === totalVehicles || stockoutDetected) {
      events.push({
        id: `EV-VEH-${v}`,
        time: formatSecondsToTime(vehicleTimeSec),
        timestampSeconds: vehicleTimeSec,
        type: stockoutDetected ? 'Stockout' : 'Production Vehicle',
        vehicleNumber: v,
        message: stockoutDetected
          ? `CRITICAL: Stockout on Vehicle #${v} at ${formatSecondsToTime(vehicleTimeSec)}!`
          : `Vehicle #${v} produced on Line 1. Takt: ${taktTime}s.`,
        severity: stockoutDetected ? 'critical' : 'info',
        inventorySnapshot: Object.fromEntries(
          activeParts.map((p) => [
            p.partNo,
            {
              stock: currentStock[p.partNo],
              occupancy: currentOccupancy[p.partNo],
            },
          ])
        ),
      });
    }
  }

  return events;
}

export function getMilkRunGroups(
  parts: PartMaster[],
  productionPlan: ProductionPlan,
  customModeConfigs?: Record<TransportMode, TransportModeConfig>,
  inventoryStates?: RealTimeInventoryState[],
  simulationHours: number = 8
): MilkRunGroup[] {
  const jumboTrips = generateDetailedJumboTrips(
    parts,
    productionPlan,
    customModeConfigs,
    undefined,
    simulationHours
  );

  const groups: MilkRunGroup[] = jumboTrips.map((jt, idx) => {
    const uniqueStores = Array.from(
      new Set(jt.trolleys.map((t) => t.storeLocation))
    );
    const uniquePocs = Array.from(new Set(jt.trolleys.map((t) => t.pocPoint)));
    const pocLabel = uniquePocs.sort().join(' & ');

    const partMap: Record<
      string,
      { part: PartMaster; hourlyTrolleys: number; loadQty: number }
    > = {};
    jt.trolleys.forEach((t) => {
      const p = parts.find((part) => part.partNo === t.partNo);
      if (p) {
        if (!partMap[p.partNo]) {
          partMap[p.partNo] = { part: p, hourlyTrolleys: 3, loadQty: 0 };
        }
        partMap[p.partNo].loadQty += 1;
      }
    });

    return {
      groupId: `MR-COMB-${String(idx + 1).padStart(3, '0')}`,
      groupName: `${pocLabel} Co-Loaded Run (${jt.tripId})`,
      pocPoint: pocLabel,
      storeLocations: uniqueStores,
      parts: Object.values(partMap),
      totalTrolleys: jt.trolleyCount,
      cycleTimeMin: jt.durationMinutes,
      transportMode: 'Jumbo Trolley',
      tripsHr: 3,
      tripsShift: 24,
      tripsDay: 48,
      freqMins: 20.0,
      routeName: jt.routeDescription,
      assignedOperator: jt.operatorName,
      highestRisk: 'Green',
    };
  });

  return groups;
}

/**
 * Calculates Bin Consumption Time in seconds:
 * How long a single bin (trolley) lasts on the assembly line based on the takt time and usage per vehicle.
 */
export function getBinConsumptionTimeSec(binCapacity: number, usagePerVehicle: number, taktTimeSec: number): number {
  const usage = usagePerVehicle || 1;
  const safeTakt = taktTimeSec || 27.9;
  const consumptionRatePerSec = usage / safeTakt;
  return consumptionRatePerSec > 0 ? binCapacity / consumptionRatePerSec : 3600;
}

/**
 * Calculates remaining Stock-Out Time in seconds:
 * How long the current inventory will last based on the takt time and consumption rate.
 */
export function getStockOutTimeSec(currentStockUnits: number, usagePerVehicle: number, taktTimeSec: number): number {
  const usage = usagePerVehicle || 1;
  const safeTakt = taktTimeSec || 27.9;
  const consumptionRatePerSec = usage / safeTakt;
  return consumptionRatePerSec > 0 ? currentStockUnits / consumptionRatePerSec : 36000;
}

export interface ShiftTripHandoverPartItem {
  sNo: number;
  modelNo: string;
  partNo: string;
  description: string;
  binOrTrolley: string;
  qtyPerTrolley: number;
  loadTrolleysPerTrip: string;
  store: string;
  pocPoint: string;
  hourlyTripIds: number[];
  oneCycleTripIdsFormatted: string;
  shiftTripIds: number[];
  shiftTripIdsFormatted: string;
  hourlyTripsCount: number;
  trolleyLoadCounts: number[];
  shiftTripsCount: number;
  hourlyDeliveredUnits: number;
  shiftDeliveredUnits: number;
  totalTripsInHourlyCycle: number;
}

export interface ShiftTripManifestItem {
  partNo: string;
  modelNo: string;
  description: string;
  store: string;
  pocPoint: string;
  trolleysLoaded: number;
  qtyPerTrolley: number;
  totalUnitsLoaded: number;
  loadSummary: string;
}

export interface ShiftTripManifest {
  tripNumber: number;
  shiftHour: number;
  hourlyTripIndex: number;
  items: ShiftTripManifestItem[];
  totalTrolleys: number;
  totalUnits: number;
  vehicleCapacity: number;
  utilizationPercent: number;
  pickupStores: string[];
  dropPocs: string[];
  summaryText: string;
}

/**
 * Computes shift trip mapping output for Shift Handover report
 * Generates trip dispatch numbers across 8-hour shift cycles based on takt time and co-loading groups,
 * along with the exact trip-by-trip pick quantity manifests for operators.
 */
export function getShiftTripHandoverMapping(
  parts: PartMaster[],
  productionPlan: ProductionPlan,
  customModeConfigs?: Record<TransportMode, TransportModeConfig>,
  hoursInShift: number = 8,
  startHour: number = 0,
  selected1HrSlot: number = 0
) {
  const groups = getMilkRunGroups(parts, productionPlan, customModeConfigs);
  const jumboGroups = groups.filter((g) => g.groupId.startsWith('MR-COMB-'));
  const totalShiftTrips = jumboGroups.length > 0 ? jumboGroups.length : 1;
  const totalTripsInHourlyCycle = Math.max(1, Math.ceil(totalShiftTrips / 8));

  // Determine slice for active 1-hour cycle slot
  const startSlotGroupIdx = Math.min(jumboGroups.length, selected1HrSlot * totalTripsInHourlyCycle);
  const endSlotGroupIdx = Math.min(jumboGroups.length, (selected1HrSlot + 1) * totalTripsInHourlyCycle);
  const active1HrGroups = jumboGroups.slice(startSlotGroupIdx, Math.max(startSlotGroupIdx + 1, endSlotGroupIdx));

  // Total trips count for active timeframe
  const activeTimeframeTrips = hoursInShift === 1 ? active1HrGroups.length : totalShiftTrips;

  // 1. Compute Part Master Handover Items with Qty per Trolley and Deliveries
  const items: ShiftTripHandoverPartItem[] = parts.map((part, index) => {
    const hourlyTripIds: number[] = [];
    let hourlyTrolleysDelivered = 0;
    const trolleyLoadCounts: number[] = [];

    active1HrGroups.forEach((g, gIdx) => {
      const foundPart = g.parts.find((p) => p.part.partNo === part.partNo);
      if (foundPart) {
        const globalTripNum = startSlotGroupIdx + gIdx + 1;
        hourlyTripIds.push(globalTripNum);
        hourlyTrolleysDelivered += foundPart.loadQty;
        trolleyLoadCounts.push(foundPart.loadQty);
      }
    });

    const isJumbo = part.transportMode === 'Jumbo Trolley' || part.transportMode === 'BOV (Battery Vehicle)';
    if (hourlyTripIds.length === 0 && !isJumbo) {
      hourlyTripIds.push(startSlotGroupIdx + 1);
      hourlyTrolleysDelivered = 1;
      trolleyLoadCounts.push(1);
    }

    const shiftTripIds: number[] = [];
    if (hoursInShift === 1) {
      for (const tId of hourlyTripIds) {
        shiftTripIds.push(tId);
      }
    } else {
      jumboGroups.forEach((g, gIdx) => {
        const foundPart = g.parts.find((p) => p.part.partNo === part.partNo);
        if (foundPart) {
          const tripNum = (gIdx + 1) + startHour * totalTripsInHourlyCycle;
          shiftTripIds.push(tripNum);
        }
      });
    }

    const shiftTripIdsFormatted = shiftTripIds.length > 0
      ? shiftTripIds.map((t) => `T${t}`).join(', ')
      : 'No Trips';

    const oneCycleTripIdsFormatted = hourlyTripIds.length > 0
      ? hourlyTripIds.map((t) => `T${t}`).join(', ')
      : 'No Trips';

    const minLoad = Math.min(...trolleyLoadCounts);
    const maxLoad = Math.max(...trolleyLoadCounts);
    const binCap = part.binCapacity || (part.partNo === 'KE121530' ? 6 : 10);

    const containerLabel = part.binOrTrolley === 'Cover' ? 'Cover' : part.binOrTrolley === 'Carton' ? 'Carton' : part.binOrTrolley === 'Bin' ? 'Bin' : 'Trolley';
    let loadTrolleysPerTrip = '';
    if (part.binOrTrolley === 'Cover') {
      loadTrolleysPerTrip = `${minLoad > 0 ? minLoad : 1} Cover Packet(s) (${(minLoad > 0 ? minLoad : 1) * binCap} pcs) [Piggybacked]`;
    } else if (minLoad === maxLoad) {
      loadTrolleysPerTrip = `${minLoad} ${containerLabel}${minLoad !== 1 ? 's' : ''} (${minLoad * binCap} pcs)`;
    } else {
      loadTrolleysPerTrip = `${minLoad}-${maxLoad} ${containerLabel}s (${minLoad * binCap}-${maxLoad * binCap} pcs)`;
    }

    const hourlyDeliveredUnits = hourlyTrolleysDelivered * binCap;
    let shiftDeliveredUnits = 0;
    if (hoursInShift === 1) {
      shiftDeliveredUnits = hourlyDeliveredUnits;
    } else {
      let totalShiftTrolleys = 0;
      jumboGroups.forEach((g) => {
        const found = g.parts.find((p) => p.part.partNo === part.partNo);
        if (found) totalShiftTrolleys += found.loadQty;
      });
      shiftDeliveredUnits = totalShiftTrolleys * binCap;
    }

    return {
      sNo: index + 1,
      modelNo: part.modelNo || 'IQube',
      partNo: part.partNo,
      description: part.description,
      binOrTrolley: part.binOrTrolley || 'Trolley',
      qtyPerTrolley: binCap,
      loadTrolleysPerTrip,
      store: part.storeLocation,
      pocPoint: part.pocPoint,
      hourlyTripIds,
      oneCycleTripIdsFormatted,
      shiftTripIds,
      shiftTripIdsFormatted,
      trolleyLoadCounts,
      hourlyTripsCount: hourlyTripIds.length,
      shiftTripsCount: shiftTripIds.length,
      hourlyDeliveredUnits,
      shiftDeliveredUnits,
      totalTripsInHourlyCycle,
    };
  });

  // 2. Generate Trip-by-Trip Manifest for selected timeframe
  const allShiftTrips: ShiftTripManifest[] = [];
  const vehicleCapacity = 3; // Jumbo Trolley Capacity

  const activeManifestGroups = hoursInShift === 1 ? active1HrGroups : jumboGroups;

  activeManifestGroups.forEach((g, gIdx) => {
    const hourlyTripIndex = gIdx + 1;
    const tripNumber = hoursInShift === 1 ? (startSlotGroupIdx + gIdx + 1) : (hourlyTripIndex + startHour * totalTripsInHourlyCycle);
    const shiftHour = hoursInShift === 1 ? (selected1HrSlot + 1 + startHour) : (Math.floor(gIdx / totalTripsInHourlyCycle) + 1 + startHour);

    const tripManifestItems: ShiftTripManifestItem[] = g.parts.map((p) => {
      const binCap = p.part.binCapacity || (p.part.partNo === 'KE121530' ? 6 : 10);
      const totalUnitsLoaded = p.loadQty * binCap;
      const isCoverPart = p.part.binOrTrolley === 'Cover';
      const containerLabel = isCoverPart ? 'Cover Packet' : p.part.binOrTrolley === 'Carton' ? 'Carton' : p.part.binOrTrolley === 'Bin' ? 'Bin' : 'Trolley';
      return {
        partNo: p.part.partNo,
        modelNo: p.part.modelNo || 'IQube',
        description: p.part.description,
        store: p.part.storeLocation,
        pocPoint: p.part.pocPoint,
        trolleysLoaded: isCoverPart ? 0 : p.loadQty,
        qtyPerTrolley: binCap,
        totalUnitsLoaded,
        loadSummary: isCoverPart
          ? `${p.loadQty} Cover Packet${p.loadQty > 1 ? 's' : ''} (${totalUnitsLoaded} pcs) [Piggybacked]`
          : `${p.loadQty} ${containerLabel}${p.loadQty > 1 ? 's' : ''} (${totalUnitsLoaded} pcs)`,
      };
    });

    const modularLoadedTotal = tripManifestItems.filter(item => {
      const p = parts.find(part => part.partNo === item.partNo);
      return p?.binOrTrolley === 'Bin' || p?.binOrTrolley === 'Carton';
    }).reduce((sum, item) => sum + item.trolleysLoaded, 0);

    const dedicatedTrolleyLoadedTotal = tripManifestItems.filter(item => {
      const p = parts.find(part => part.partNo === item.partNo);
      return p?.binOrTrolley !== 'Bin' && p?.binOrTrolley !== 'Carton' && p?.binOrTrolley !== 'Cover';
    }).reduce((sum, item) => sum + item.trolleysLoaded, 0);

    const totalTrolleys = dedicatedTrolleyLoadedTotal + Math.ceil(modularLoadedTotal / 4);
    const totalUnits = tripManifestItems.reduce((sum, item) => sum + item.totalUnitsLoaded, 0);
    const pickupStores = Array.from(new Set(tripManifestItems.map((i) => i.store)));
    const dropPocs = Array.from(new Set(tripManifestItems.map((i) => i.pocPoint)));

    const summaryParts = tripManifestItems.map((i) => {
      const shortName = i.description
        .replace(/ SUB ASSY.*$/i, '')
        .replace(/ COMP.*$/i, '')
        .replace(/, SCOOTER.*$/i, '')
        .replace(/ DISC.*$/i, '')
        .trim()
        .toUpperCase();
      const p = parts.find(part => part.partNo === i.partNo);
      const containerLabel = p?.binOrTrolley === 'Cover' ? 'Cover' : p?.binOrTrolley === 'Carton' ? 'Carton' : p?.binOrTrolley === 'Bin' ? 'Bin' : 'Trolley';
      return `${shortName}: ${i.trolleysLoaded} ${containerLabel}${i.trolleysLoaded > 1 ? 's' : ''} (${i.totalUnitsLoaded} Qty)`;
    });

    allShiftTrips.push({
      tripNumber,
      shiftHour,
      hourlyTripIndex,
      items: tripManifestItems,
      totalTrolleys,
      totalUnits,
      vehicleCapacity,
      utilizationPercent: Math.min(100, Math.round((totalTrolleys / vehicleCapacity) * 100)),
      pickupStores,
      dropPocs,
      summaryText: summaryParts.join(' + '),
    });
  });

  // 3. Generate Formatted Output Text
  const textLines = items.map((item) => {
    const shortDesc = item.description
      .replace(/ SUB ASSY.*$/i, '')
      .replace(/ COMP.*$/i, '')
      .replace(/, SCOOTER.*$/i, '')
      .replace(/ DISC.*$/i, '')
      .trim()
      .toUpperCase();

    return `${shortDesc}: ${item.shiftTripIdsFormatted}`;
  });

  const formattedTextOutput = textLines.join('\n\n');

  // 4. Generate Trip Pick Manifest Text Output
  const tripManifestLines = allShiftTrips.slice(0, totalTripsInHourlyCycle).map((trip) => {
    const partsDetail = trip.items
      .map((item) => {
        const short = item.description
          .replace(/ SUB ASSY.*$/i, '')
          .replace(/ COMP.*$/i, '')
          .replace(/, SCOOTER.*$/i, '')
          .replace(/ DISC.*$/i, '')
          .trim();
        return `${short} (${item.trolleysLoaded} Trl = ${item.totalUnitsLoaded} pcs @ Store ${item.store} -> POC ${item.pocPoint})`;
      })
      .join(' + ');

    return `TRIP #${trip.tripNumber} [Load: ${trip.totalTrolleys}/${trip.vehicleCapacity} Trolleys, ${trip.totalUnits} Units]:\n  ➔ ${partsDetail}`;
  });

  const formattedTripManifestOutput = tripManifestLines.join('\n\n');

  return {
    items,
    allShiftTrips,
    totalTripsInHourlyCycle,
    totalShiftTripsCount: totalTripsInHourlyCycle * hoursInShift,
    formattedTextOutput,
    formattedTripManifestOutput,
  };
}

/**
 * Assembly Line Helpers for multi-line filtering across the application
 */
export const getPartLineCode = (
  part?: PartMaster,
  pocPoint?: string,
  assemblyLineOverride?: string
): AssemblyLineCode => {
  if (
    assemblyLineOverride &&
    (assemblyLineOverride === '1VCON100' ||
      assemblyLineOverride === '1VCON200' ||
      assemblyLineOverride === '1VCON300')
  ) {
    return assemblyLineOverride as AssemblyLineCode;
  }
  if (part?.assemblyLine) return part.assemblyLine;
  const poc = (pocPoint || part?.pocPoint || '').toUpperCase();
  if (poc.includes('300') || poc.includes('PL-3') || poc.includes('ML-3') || poc.includes('CON300')) {
    return '1VCON300';
  }
  if (poc.includes('200') || poc.includes('PL-2') || poc.includes('ML-2') || poc.includes('CON200')) {
    return '1VCON200';
  }
  return '1VCON100';
};

export const filterPartsByLine = (
  parts: PartMaster[],
  selectedLine: AssemblyLineCode
): PartMaster[] => {
  if (selectedLine === 'ALL') return parts;
  return parts.filter((p) => getPartLineCode(p) === selectedLine);
};

export const filterInventoryByLine = (
  inventoryStates: RealTimeInventoryState[],
  parts: PartMaster[],
  selectedLine: AssemblyLineCode
): RealTimeInventoryState[] => {
  if (selectedLine === 'ALL') return inventoryStates;
  return inventoryStates.filter((s) => {
    const part = parts.find((p) => p.partNo === s.partNo);
    return getPartLineCode(part, s.pocPoint) === selectedLine;
  });
};

export const filterTripsByLine = (
  trips: TripPlan[],
  parts: PartMaster[],
  selectedLine: AssemblyLineCode
): TripPlan[] => {
  if (selectedLine === 'ALL') return trips;
  return trips.filter((t) => {
    const part = parts.find((p) => p.partNo === t.partNo);
    if (part) return getPartLineCode(part) === selectedLine;
    return true; // if no part, don't filter out by default or maybe filter out? Let's just return false if strict, but true is safer for mock data. Let's return false. Wait, no, returning true is safer. Let's return `selectedLine === '1VCON100'` as fallback.
  });
};

export const filterAlertsByLine = (
  alerts: PlantAlert[],
  parts: PartMaster[],
  selectedLine: AssemblyLineCode
): PlantAlert[] => {
  if (selectedLine === 'ALL') return alerts;
  return alerts.filter((a) => {
    const part = parts.find((p) => p.partNo === a.partNo);
    return getPartLineCode(part, a.pocPoint) === selectedLine;
  });
};

export const filterRoutesByLine = (
  routes: RouteMasterItem[],
  parts: PartMaster[],
  selectedLine: AssemblyLineCode
): RouteMasterItem[] => {
  if (selectedLine === 'ALL') return routes;
  return routes.filter((r) => {
    const routeParts = parts.filter((p) => r.partsCarried.includes(p.partNo));
    if (routeParts.length === 0) return true;
    return routeParts.some((p) => getPartLineCode(p) === selectedLine);
  });
};

