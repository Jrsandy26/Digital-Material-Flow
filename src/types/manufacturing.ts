/**
 * Digital Material Flow & Line Feeding Management System
 * Core Types & Domain Interfaces
 */

export type TransportMode = 'Jumbo Trolley' | 'Manual Handling' | 'Hand Pallet Truck' | 'BOV (Battery Vehicle)';

export type ShiftType = 'Shift 1 (07:00 - 15:30)' | 'Shift 2 (15:30 - 00:00)';

export type RiskLevel = 'Green' | 'Yellow' | 'Red';

export type TripStatus = 'Planned' | 'Started' | 'In Progress' | 'Delivered' | 'Completed' | 'Delayed';

export type UserRole = 'Admin' | 'Planner' | 'Supervisor' | 'Operator';

export type AssemblyLineCode = '1VCON100' | '1VCON200' | '1VCON300' | 'ALL';

export interface TransportModeConfig {
  mode: TransportMode;
  loadSpeedSecPerMtr: number;
  emptySpeedSecPerMtr: number;
  carryingCapacityTrolleys: number;
  pickTimeSec: number;
  storingTimeSec: number;
  emptyHandlingTimeSec: number;
  emptyDropTimeSec: number;
}

export interface VehicleModel {
  id: string;
  name: string;
  code: string;
  dailyTarget: number;
  taktTimeSeconds: number; // e.g. 27.9 seconds
}

export interface PartMaster {
  partNo: string;
  description: string;
  modelNo: string;
  usagePerVehicle: number;
  transportMode: TransportMode;
  binCapacity: number;
  storeLocation: string;
  pocPoint: string; // e.g. PL-03, PL-13
  stationName: string;
  pickTimeMin: number; // Loaded pick/binning time
  storingTimePocMin: number;
  emptyCollectionTimeMin: number;
  emptyLeavingTimeMin: number;
  loadedDistanceMeters: number;
  returnDistanceMeters: number;
  initialPocTrolleyStock: number;
  minSafetyCoverageHours: number;
  hourlyTrolleysRequired?: number; // Parsed from input file: No of Trolley/bin QTY required for one hour based on takt time
  manualHourlyBinsOverride?: number; // User manually overrides hourly bins (for splitting across operators etc.)
  pocSpaceTrolleysMax?: number; // POC Space Constraint (No of Trolleys allowed at POC)
  binOrTrolley?: PackagingType;
  assemblyLine?: '1VCON100' | '1VCON200' | '1VCON300';
  isActive?: boolean;
}

export type PackagingType = 'Trolley' | 'Bin' | 'Carton' | 'Cover';

export interface PackagingTypeInfo {
  type: PackagingType;
  title: string;
  tagline: string;
  description: string;
  example: string;
  containerMultiplier: number; // e.g. 1 for dedicated trolley, 4 for bins or cartons placed above platform trolley, 0 for cover packets
  color: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderColor: string;
}

export const PACKAGING_TYPE_DEFINITIONS: Record<PackagingType, PackagingTypeInfo> = {
  Trolley: {
    type: 'Trolley',
    title: 'Trolley (Pre-loaded)',
    tagline: 'Parts pre-loaded in dedicated trolley',
    description: 'Parts are pre-loaded directly into/onto the specialized trolley (e.g. Frame = 6 parts loaded directly in the frame trolley; Wheel trolley = 30 wheels; Battery = 64).',
    example: 'Frame (6/trolley), Wheels (30/trolley), Battery (64/trolley)',
    containerMultiplier: 1,
    color: 'blue',
    bgLight: 'bg-blue-100 text-blue-800 border-blue-300',
    bgDark: 'dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700/60',
    textLight: 'text-blue-700',
    textDark: 'dark:text-blue-300',
    borderColor: 'border-blue-400',
  },
  Bin: {
    type: 'Bin',
    title: 'Bin (Platform Trolley)',
    tagline: 'Parts stored inside bins placed above platform trolley',
    description: 'Parts are stored inside standardized plastic bins/totes (e.g. Headlamp = 56 pcs/bin), and those bins are placed above a flat platform trolley for transport (4 bins per platform trolley).',
    example: 'Headlamp Assy (56/bin), Throttle switches, Brackets, Grips (4 Bins per platform trolley)',
    containerMultiplier: 4,
    color: 'emerald',
    bgLight: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    bgDark: 'dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60',
    textLight: 'text-emerald-700',
    textDark: 'dark:text-emerald-300',
    borderColor: 'border-emerald-400',
  },
  Carton: {
    type: 'Carton',
    title: 'Carton (Pre-packed Box)',
    tagline: 'Parts pre-packed inside carton box',
    description: 'Parts are pre-packed by vendor and placed directly inside corrugated carton boxes, which are moved and placed on platform trolleys/dollies (4 cartons per platform trolley).',
    example: 'Wiring Harness, Mirror Assy, Chargers (4 Cartons per platform trolley)',
    containerMultiplier: 4,
    color: 'amber',
    bgLight: 'bg-amber-100 text-amber-800 border-amber-300',
    bgDark: 'dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60',
    textLight: 'text-amber-700',
    textDark: 'dark:text-amber-300',
    borderColor: 'border-amber-400',
  },
  Cover: {
    type: 'Cover',
    title: 'Cover (Packet / Polybag)',
    tagline: 'Parts in covers/packets placed freely on any trolley',
    description: 'Parts are packed inside covers/packets (e.g. Cable Assy Brake with 50 pcs/cover). Packets are placed freely on top of any existing trolley with zero dedicated trolley demand.',
    example: 'Cable Assy Brake (50/cover), Speedo Cable, Small Wire Leads (Piggyback on any trolley)',
    containerMultiplier: 0,
    color: 'purple',
    bgLight: 'bg-purple-100 text-purple-800 border-purple-300',
    bgDark: 'dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-700/60',
    textLight: 'text-purple-700',
    textDark: 'dark:text-purple-300',
    borderColor: 'border-purple-400',
  },
};

export interface StoreDistanceEntry {
  fromStore: string;
  toStore: string;
  distanceMeters: number;
}

export interface JumboUnit {
  id: string;
  name: string;
  capacityTrolleys: number;
  speedMps: number;
  currentLocation: string;
  availableTime: string;
  operatorId: string;
  operatorName: string;
  status: 'Idle' | 'Loading' | 'On Route' | 'Delivering' | 'Returning';
}

export interface TripTrolleyDetail {
  sequence: number;
  partNo: string;
  partName: string;
  storeLocation: string;
  pocPoint: string;
  quantity: number;
  pickupTime: string;
  dropTime: string;
  inventoryBefore: number;
  inventoryAfter: number;
  pocOccupancyBefore: number;
  pocOccupancyAfter: number;
}

export interface TripStopDetail {
  stopSequence: number;
  type: 'Store Pick' | 'POC Drop' | 'Empty Return';
  location: string;
  pocPoint?: string;
  partNos: string[];
  arrivalTime: string;
  departureTime: string;
  durationSeconds: number;
}

export interface DetailedJumboTrip {
  tripId: string;
  tripNumber: number;
  startTime: string;
  expectedArrivalPoc: string;
  expectedReturnStores: string;
  durationMinutes: number;
  durationSeconds: number;
  totalDistanceMeters: number;
  routeDescription: string;
  routeSequence: string[];
  operatorName: string;
  jumboId: string;
  trolleyCount: number; // Exactly 3 in standard planning
  trolleys: TripTrolleyDetail[];
  stops: TripStopDetail[];
  status: TripStatus;
  deadlineTime: string;
  safetyMarginSeconds: number;
  criticalPartNo?: string;
  isFeasible: boolean;
  feasibilityIssues?: string[];
}

export interface SimulationTimelineEvent {
  id: string;
  time: string; // e.g. "07:13:57"
  timestampSeconds: number; // Seconds from shift start (07:00:00 = 0)
  type: 'Production Vehicle' | 'Stockout' | 'Trip Departure' | 'Store Pickup' | 'POC Arrival' | 'Trolley Drop' | 'Empty Return' | 'Alert';
  vehicleNumber?: number;
  partNo?: string;
  pocPoint?: string;
  tripId?: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  inventorySnapshot?: Record<string, { stock: number; occupancy: number }>;
}

export interface RouteMasterItem {
  routeId: string;
  routeName: string;
  storeLocation: string;
  pocSequence: string[]; // List of POC points in order
  totalDistanceMeters: number;
  totalCycleTimeMin: number;
  assignedOperatorId?: string;
  transportMode: TransportMode;
  partsCarried: string[]; // Part numbers
}

export interface Operator {
  id: string;
  name: string;
  operatorCode: string;
  assignedRouteId: string;
  transportMode: TransportMode;
  completedTripsCount: number;
  activeTripId?: string;
  utilizationPercent: number;
  status: 'Active' | 'On Route' | 'Loading' | 'On Break' | 'Offline';
}

export interface LineStation {
  pocPoint: string;
  stationName: string;
  assemblyZone: string;
  assignedParts: string[]; // Part numbers
  operatorCount: number;
}

export interface RealTimeInventoryState {
  partNo: string;
  pocPoint: string;
  openingStockUnits: number;
  deliveredQuantityUnits: number;
  consumedQuantityUnits: number;
  currentStockUnits: number;
  closingStockUnits: number;
  coverageHours: number;
  riskLevel: RiskLevel;
  lastReplenishedAt: string;
  nextDeliveryScheduledAt: string;
  assemblyLine?: '1VCON100' | '1VCON200' | '1VCON300';
  safetyStockUnits?: number;
  reorderPointUnits?: number;
  restockTriggered?: boolean;
  restockStatus?: 'Normal' | 'Restock Triggered' | 'Critical Low' | 'In Transit' | 'Delivered';
  lastDeliveryAt?: string;
}

export interface TripPlan {
  id: string;
  partNo: string;
  routeId: string;
  assignedOperatorId: string;
  assignedOperatorName: string;
  transportMode: TransportMode;
  trolleyQuantity: number;
  totalUnits: number;
  scheduledDispatchTime: string;
  estimatedArrivalPoc: string;
  status: TripStatus;
  currentStep: number; // 1 to 8
  delayMinutes: number;
}

export interface SWCTRecord {
  partNo: string;
  routeId: string;
  operatorName: string;
  pickTimeSec: number;
  travelTimeSec: number;
  unloadingTimeSec: number;
  emptyCollectionTimeSec: number;
  emptyReturnTimeSec: number;
  waitingTimeSec: number;
  manualWorkTimeSec: number;
  transportTimeSec: number;
  wasteTimeSec: number;
  totalCycleTimeSec: number;
  taktTimeSec: number; // default 27.9s
}

export interface ProductionPlan {
  date: string;
  shift: ShiftType;
  selectedModelId: string;
  shiftPlanVehicles: number; // e.g. 1000 units per 8 hr shift
  hourlyPlanVehicles: number; // e.g. 129 units / hr
  taktTimeSeconds: number; // 27.9s
  productionStatus: 'Running' | 'Paused' | 'Line Stopped' | 'Completed';
  currentHour: number; // 1 to 8
  unitsCompleted: number;
  hourlyBreakdown?: Array<{ hourSlot: string; targetVehicles: number; actualVehicles?: number }>;
}

export interface PlantAlert {
  id: string;
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
  partNo: string;
  pocPoint: string;
  title: string;
  message: string;
  acknowledged: boolean;
  type: 'Stock Runout' | 'Delivery Delay' | 'Route Bottleneck' | 'Operator Idle';
}

export interface ExcelMaterialRow {
  modeOfTransport: string;
  modelNo: string;
  partNo: string;
  description: string;
  binCapacity: number;
  storeLocation: string;
  pocPoint: string;
  usagesPerVehicle: number;
  shiftPlan: number;
  hourlyPlan: number;
  trolleyReqPerHour: number;
  roundedQuantity: number;
  pickBinningTime: number;
  storingTimeAtPoc: number;
  emptyCollectionTime: number;
  emptyLeavingTime: number;
  mhfRequired: number;
  tripsRequired: number;
  loadedDistance: number;
  returnDistance: number;
  initialPocStock: number;
  pocSpaceTrolleysMax?: number;
}

export interface ParsedSheet {
  sheetName: string;
  type: 'operator' | 'part' | 'unknown';
  rowCount: number;
  columns: string[];
  parsedOperators: Operator[];
  parsedParts: PartMaster[];
  rawData: Record<string, any>[];
}

export interface UploadedFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  sheets: ParsedSheet[];
  activeSheetIndex: number;
}

