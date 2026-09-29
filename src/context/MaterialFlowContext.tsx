/**
 * Central State Management & Real-Time Simulation Engine Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  UserRole,
  PartMaster,
  RouteMasterItem,
  Operator,
  LineStation,
  ProductionPlan,
  RealTimeInventoryState,
  TripPlan,
  TripStatus,
  SWCTRecord,
  PlantAlert,
  VehicleModel,
  AssemblyLineCode,
  UploadedFileItem,
} from '../types/manufacturing';
import {
  INITIAL_VEHICLE_MODELS,
  INITIAL_PRODUCTION_PLAN,
  INITIAL_PARTS_MASTER,
  INITIAL_LINE_STATIONS,
  INITIAL_ROUTES,
  INITIAL_OPERATORS,
  INITIAL_SWCT_RECORDS,
} from '../data/initialData';
import {
  calculatePartMetrics,
  computeInventoryState,
  getRiskLevel,
  carryForwardStock,
  DEFAULT_TRANSPORT_MODE_CONFIGS,
  getInitialStockUnits,
} from '../utils/calculations';
import { TransportMode, TransportModeConfig } from '../types/manufacturing';

interface MaterialFlowContextType {
  // Assembly Line Selection (1VCON100, 1VCON200, 1VCON300, ALL)
  selectedAssemblyLine: AssemblyLineCode;
  setSelectedAssemblyLine: (line: AssemblyLineCode) => void;

  role: UserRole;
  setRole: (role: UserRole) => void;

  operatorName: string;
  setOperatorName: (name: string) => void;

  vehicleModels: VehicleModel[];
  productionPlan: ProductionPlan;
  updateProductionPlan: (newPlan: Partial<ProductionPlan>) => void;

  parts: PartMaster[];
  setParts: React.Dispatch<React.SetStateAction<PartMaster[]>>;
  updatePart: (partNo: string, updated: Partial<PartMaster>) => void;

  routes: RouteMasterItem[];
  setRoutes: React.Dispatch<React.SetStateAction<RouteMasterItem[]>>;

  operators: Operator[];
  setOperators: React.Dispatch<React.SetStateAction<Operator[]>>;

  stations: LineStation[];
  inventoryStates: RealTimeInventoryState[];
  trips: TripPlan[];
  swctRecords: SWCTRecord[];
  setSwctRecords: React.Dispatch<React.SetStateAction<SWCTRecord[]>>;
  alerts: PlantAlert[];

  // Transfer Mode Timing & Speed Settings
  modeConfigs: Record<TransportMode, TransportModeConfig>;
  updateModeConfig: (mode: TransportMode, updated: Partial<TransportModeConfig>) => void;

  // Simulation controls
  isSimulating: boolean;
  toggleSimulation: () => void;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  triggerManualReplenishment: (partNo: string, trolleyQty?: number) => void;
  advanceShift: () => void;
  resetToInitialData: () => void;
  acknowledgeAlert: (alertId: string) => void;

  // Trip execution workflow
  updateTripStep: (tripId: string, step: number, status?: TripStatus) => void;
  dispatchEmergencyTrip: (partNo: string, routeId?: string) => void;

  // Global mode toggle (Live vs Static)
  dashboardMode: 'live' | 'static';
  setDashboardMode: (mode: 'live' | 'static') => void;

  // Theme settings (Light, Dark, System)
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Selected TVS Plant State
  selectedPlant: string;
  setSelectedPlant: (plant: string) => void;

  // Excel Upload state
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (open: boolean) => void;
  uploadedFileName: string;
  setUploadedFileName: (name: string) => void;
  parsedCount: number;
  setParsedCount: (count: number) => void;
  uploadError: string | null;
  setUploadError: (error: string | null) => void;

  // Multi-Workbook & Multi-Sheet State
  uploadedWorkbooks: UploadedFileItem[];
  setUploadedWorkbooks: React.Dispatch<React.SetStateAction<UploadedFileItem[]>>;
  activeDatasetId: string;
  activeSheetName: string;
  switchActiveDataset: (fileId: string, sheetName?: string) => void;
  clearAllData: () => void;
}

const MaterialFlowContext = createContext<MaterialFlowContextType | undefined>(undefined);

export const MaterialFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedAssemblyLine, setSelectedAssemblyLine] = useState<AssemblyLineCode>('1VCON100');
  const [role, setRole] = useState<UserRole>('Admin');
  const [operatorName, setOperatorNameState] = useState<string>('sai');
  const [parts, setPartsState] = useState<PartMaster[]>(() => {
    try {
      const saved = localStorage.getItem('tvs_uploaded_workbooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allParts: PartMaster[] = [];
          parsed.forEach((f: any) => {
            f.sheets.forEach((s: any) => {
              allParts.push(...s.parsedParts);
            });
          });
          if (allParts.length > 0) {
            const partsMap = new Map<string, PartMaster>();
            allParts.forEach((pt) => partsMap.set(pt.partNo, pt));
            return Array.from(partsMap.values());
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved parts', e);
    }
    return []; // No uploaded excel file -> empty parts!
  });
  const [productionPlan, setProductionPlan] = useState<ProductionPlan>(INITIAL_PRODUCTION_PLAN);
  const [dashboardMode, setDashboardMode] = useState<'live' | 'static'>('live');
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as any) || 'dark';
  });

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let activeTheme = theme;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      activeTheme = systemTheme;
    }

    root.classList.add(activeTheme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
  };

  const [selectedPlant, setSelectedPlantState] = useState<string>(() => {
    return localStorage.getItem('tvs_plant') || 'Hosur Main Plant (Tamil Nadu)';
  });

  const setSelectedPlant = (plant: string) => {
    localStorage.setItem('tvs_plant', plant);
    setSelectedPlantState(plant);
  };

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Multi-Workbook & Multi-Sheet State
  const [uploadedWorkbooks, setUploadedWorkbooksState] = useState<UploadedFileItem[]>(() => {
    try {
      const saved = localStorage.getItem('tvs_uploaded_workbooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load saved workbooks', e);
    }
    return [];
  });

  const [activeDatasetId, setActiveDatasetId] = useState<string>('MERGED');
  const [activeSheetName, setActiveSheetName] = useState<string>('ALL');

  const setUploadedWorkbooks: React.Dispatch<React.SetStateAction<UploadedFileItem[]>> = (val) => {
    setUploadedWorkbooksState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('tvs_uploaded_workbooks', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save workbooks to localStorage', e);
      }
      return next;
    });
  };

  const switchActiveDataset = useCallback((fileId: string, sheetName?: string) => {
    setActiveDatasetId(fileId);
    setActiveSheetName(sheetName || 'ALL');

    if (fileId === 'MERGED' || fileId === 'ALL') {
      // Combine all files and sheets
      const allOps: Operator[] = [];
      const allParts: PartMaster[] = [];
      uploadedWorkbooks.forEach((f) => {
        f.sheets.forEach((s) => {
          allOps.push(...s.parsedOperators);
          allParts.push(...s.parsedParts);
        });
      });

      if (allOps.length > 0) {
        const opsMap = new Map<string, Operator>();
        allOps.forEach((op) => opsMap.set(op.operatorCode || op.id, op));
        setOperators(Array.from(opsMap.values()));
      }
      if (allParts.length > 0) {
        const partsMap = new Map<string, PartMaster>();
        allParts.forEach((pt) => partsMap.set(pt.partNo, pt));
        setParts(Array.from(partsMap.values()));
      }
      setUploadedFileName(`Merged Dataset (${uploadedWorkbooks.length} Files)`);
      return;
    }

    const targetFile = uploadedWorkbooks.find((f) => f.id === fileId);
    if (!targetFile) return;

    if (!sheetName || sheetName === 'ALL') {
      // Merge all sheets of target file
      const fileOps: Operator[] = [];
      const fileParts: PartMaster[] = [];
      targetFile.sheets.forEach((s) => {
        fileOps.push(...s.parsedOperators);
        fileParts.push(...s.parsedParts);
      });
      if (fileOps.length > 0) {
        const opsMap = new Map<string, Operator>();
        fileOps.forEach((op) => opsMap.set(op.operatorCode || op.id, op));
        setOperators(Array.from(opsMap.values()));
      }
      if (fileParts.length > 0) {
        const partsMap = new Map<string, PartMaster>();
        fileParts.forEach((pt) => partsMap.set(pt.partNo, pt));
        setParts(Array.from(partsMap.values()));
      }
      setUploadedFileName(`${targetFile.fileName} (All Sheets)`);
    } else {
      // Target specific sheet
      const targetSheet = targetFile.sheets.find((s) => s.sheetName === sheetName);
      if (targetSheet) {
        if (targetSheet.parsedOperators.length > 0) {
          setOperators(targetSheet.parsedOperators);
        }
        if (targetSheet.parsedParts.length > 0) {
          setParts(targetSheet.parsedParts);
        }
        setUploadedFileName(`${targetFile.fileName} [${targetSheet.sheetName}]`);
      }
    }
  }, [uploadedWorkbooks]);


  const vehicleModels = React.useMemo<VehicleModel[]>(() => {
    const modelsMap = new Map<string, VehicleModel>();
    INITIAL_VEHICLE_MODELS.forEach((m) => {
      modelsMap.set(m.code.trim().toLowerCase(), m);
      modelsMap.set(m.name.trim().toLowerCase(), m);
    });

    parts.forEach((p) => {
      if (p.modelNo) {
        const rawModel = p.modelNo.trim();
        const key = rawModel.toLowerCase();
        if (!modelsMap.has(key)) {
          const generatedModel: VehicleModel = {
            id: `MOD-${key.replace(/[^a-z0-9]/g, '-').toUpperCase()}`,
            name: rawModel.toLowerCase().includes('tvs') ? rawModel : `TVS ${rawModel}`,
            code: rawModel,
            dailyTarget: 3120,
            taktTimeSeconds: 27.9,
          };
          modelsMap.set(key, generatedModel);
        }
      }
    });

    return Array.from(new Set(modelsMap.values()));
  }, [parts]);
  const [stations] = useState<LineStation[]>(INITIAL_LINE_STATIONS);
  const [modeConfigs, setModeConfigs] = useState<Record<TransportMode, TransportModeConfig>>(DEFAULT_TRANSPORT_MODE_CONFIGS);

  const updateModeConfig = useCallback((mode: TransportMode, updated: Partial<TransportModeConfig>) => {
    setModeConfigs((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        ...updated,
      },
    }));
  }, []);

  // Helper generator functions for dynamic data syncing
  const generateRoutesFromParts = useCallback((partsList: PartMaster[], opName: string): RouteMasterItem[] => {
    const groups: Record<string, PartMaster[]> = {};
    partsList.forEach((p) => {
      const key = p.storeLocation || 'Store Main';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const routeItems = Object.entries(groups).map(([store, groupParts], idx) => {
      const routeId = `ROUTE-0${idx + 1}-${store.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
      const mode = groupParts[0]?.transportMode || 'Jumbo Trolley';
      const pocSeq = Array.from(new Set(groupParts.map((p) => p.pocPoint)));
      const avgDist = groupParts.reduce((acc, p) => acc + (p.loadedDistanceMeters + p.returnDistanceMeters), 0) / Math.max(1, groupParts.length);

      return {
        routeId,
        routeName: `Route 0${idx + 1} (${store})`,
        storeLocation: store,
        pocSequence: pocSeq,
        totalDistanceMeters: Math.round(avgDist),
        totalCycleTimeMin: 15.0,
        assignedOperatorId: 'MHF-OP-01',
        assignedOperatorName: opName,
        transportMode: mode,
        partsCarried: groupParts.map((p) => p.partNo),
      };
    });

    return routeItems;
  }, []);

  const generateInitialInventory = useCallback((partsList: PartMaster[], plan: ProductionPlan, currentModeConfigs?: Record<TransportMode, TransportModeConfig>) => {
    return partsList.map((part) => {
      const metrics = calculatePartMetrics(part, plan.hourlyPlanVehicles, plan.shiftPlanVehicles, currentModeConfigs || modeConfigs);
      
      // PREDICTIVE FIX: Ensure we start with enough stock to cover the first milk-run cycle
      const minTrolleysRequiredToSurviveCycle = Math.ceil(((metrics.hourlyConsumption / 60) * 15) / Math.max(1, part.binCapacity));
      const dynamicPocMax = Math.max(part.pocSpaceTrolleysMax || 2, minTrolleysRequiredToSurviveCycle);
      
      const openingStock = getInitialStockUnits(part);
      const delivered = part.binCapacity * 2;
      
      // Aim to start with 30-45 minutes of stock buffer for a realistic mid-shift simulation, preventing immediate 0-stock lock.
      const targetStartingStock = Math.round(metrics.hourlyConsumption * 0.6);
      const consumed = Math.max(0, openingStock + delivered - targetStartingStock);
      
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return computeInventoryState(part, openingStock, delivered, consumed, metrics.hourlyConsumption, now);
    });
  }, [modeConfigs]);

  const generateInitialTrips = useCallback((partsList: PartMaster[], routesList: RouteMasterItem[], opName: string, modeConfigsArg?: any) => {
    if (partsList.length === 0) return [];
    // Sort parts by predicted stock-out priority based on initial state assumptions
    const sortedParts = [...partsList].sort((a, b) => {
      const aStock = getInitialStockUnits(a);
      const bStock = getInitialStockUnits(b);
      const aUsage = a.usagePerVehicle || 1;
      const bUsage = b.usagePerVehicle || 1;
      return (aStock / aUsage) - (bStock / bUsage);
    });

    const trips: any[] = [];
    const now = new Date();
    let globalTripId = 1;

    const route01 = routesList[0] || { routeId: 'ROUTE-01' };
    
    // Find parts safely
    const framePart = partsList.find(p => p.partNo === 'KE121530') || partsList.find(p => p.description.toLowerCase().includes('frame') && !p.description.toLowerCase().includes('sub')) || partsList[0];
    const wheelPart = partsList.find(p => p.partNo === 'KE110470') || partsList.find(p => p.description.toLowerCase().includes('wheel')) || partsList[1] || partsList[0];
    const swingarmPart = partsList.find(p => p.partNo === 'K6121550') || partsList.find(p => p.description.toLowerCase().includes('swingarm') || p.description.toLowerCase().includes('swing arm')) || partsList[2] || partsList[0];
    const subframePart = partsList.find(p => p.partNo === 'G4120300') || partsList.find(p => p.description.toLowerCase().includes('sub')) || partsList[3] || partsList[0];

    const createTrip = (part: PartMaster | undefined, qty: number, status: TripStatus, step: number, dispatchOffsetMin: number, etaOffsetMin: number) => {
       if (!part) return null;
       const dispatchTime = new Date(now.getTime() + dispatchOffsetMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       const etaTime = new Date(now.getTime() + etaOffsetMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       return {
          id: `TRIP-MR-INIT-${globalTripId++}`,
          partNo: part.partNo,
          routeId: route01.routeId,
          assignedOperatorId: 'MHF-OP-01',
          assignedOperatorName: opName,
          transportMode: part.transportMode,
          trolleyQuantity: qty,
          totalUnits: part.binCapacity * qty,
          scheduledDispatchTime: dispatchTime,
          estimatedArrivalPoc: etaTime,
          status,
          currentStep: step,
          delayMinutes: status === 'Delayed' ? 6 : 0,
       };
    };

    // Trip 1 (Delivered)
    const t1_1 = createTrip(framePart, 2, 'Delivered', 5, -20, -12);
    const t1_2 = createTrip(wheelPart, 1, 'Delivered', 5, -20, -12);
    if (t1_1) trips.push(t1_1);
    if (t1_2) trips.push(t1_2);

    // Trip 2 (In Progress - Near Dropoff): 2 Frame (NO WHEEL because Wheel still has 13.95m buffer)
    const t2_1 = createTrip(framePart, 2, 'In Progress', 4, -8, 1);
    if (t2_1) trips.push(t2_1);

    // Trip 3 (In Progress - Near Pick): 1 Frame, 1 Swingarm, 1 Sub Frame
    const t3_1 = createTrip(framePart, 1, 'In Progress', 2, -2, 8);
    const t3_2 = createTrip(swingarmPart, 1, 'In Progress', 2, -2, 8);
    const t3_3 = createTrip(subframePart, 1, 'In Progress', 2, -2, 8);
    if (t3_1) trips.push(t3_1);
    if (t3_2) trips.push(t3_2);
    if (t3_3) trips.push(t3_3);

    // Trip 4 (Started - Just Dispatched): 2 Frame, 1 Wheel (Wheel buffer now depleted enough to restock)
    const t4_1 = createTrip(framePart, 2, 'Started', 1, 2, 14);
    const t4_2 = createTrip(wheelPart, 1, 'Started', 1, 2, 14);
    if (t4_1) trips.push(t4_1);
    if (t4_2) trips.push(t4_2);

    return trips;
  }, []);

  const generateSWCTRecordsFromParts = useCallback((partsList: PartMaster[], opName: string): SWCTRecord[] => {
    return partsList.map((part) => {
      const pickTimeSec = Math.round((part.pickTimeMin || 3.5) * 60);
      const loadSpeed = 1.2;
      const travelTimeSec = Math.round((part.loadedDistanceMeters || 200) / loadSpeed);
      const unloadingTimeSec = Math.round((part.storingTimePocMin || 2.5) * 60);
      const emptyCollectionTimeSec = Math.round((part.emptyCollectionTimeMin || 2.0) * 60);
      const emptyReturnTimeSec = Math.round((part.returnDistanceMeters || 200) / 1.5);
      const waitingTimeSec = 30;

      const manualWorkTimeSec = pickTimeSec + unloadingTimeSec + emptyCollectionTimeSec;
      const transportTimeSec = travelTimeSec + emptyReturnTimeSec;
      const wasteTimeSec = waitingTimeSec;
      const totalCycleTimeSec = manualWorkTimeSec + transportTimeSec + wasteTimeSec;

      return {
        partNo: part.partNo,
        routeId: `ROUTE-${(part.storeLocation || 'MAIN').replace(/[^a-zA-Z0-9]/g, '')}`,
        operatorName: opName,
        pickTimeSec,
        travelTimeSec,
        unloadingTimeSec,
        emptyCollectionTimeSec,
        emptyReturnTimeSec,
        waitingTimeSec,
        manualWorkTimeSec,
        transportTimeSec,
        wasteTimeSec,
        totalCycleTimeSec,
        taktTimeSec: 27.9,
      };
    });
  }, []);

  const [routes, setRoutes] = useState<RouteMasterItem[]>([]);
  const [operators, setOperators] = useState<Operator[]>(() => {
    try {
      const saved = localStorage.getItem('tvs_uploaded_workbooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const allOps: Operator[] = [];
          parsed.forEach((f: any) => {
            f.sheets.forEach((s: any) => {
              allOps.push(...s.parsedOperators);
            });
          });
          if (allOps.length > 0) {
            const opsMap = new Map<string, Operator>();
            allOps.forEach((op) => opsMap.set(op.operatorCode || op.id, op));
            return Array.from(opsMap.values());
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved operators from localStorage', e);
    }
    return []; // Empty by default
  });

  useEffect(() => {
    try {
      localStorage.setItem('tvs_operators', JSON.stringify(operators));
    } catch (e) {
      console.error('Failed to save operators to localStorage', e);
    }
  }, [operators]);
  const [swctRecords, setSwctRecords] = useState<SWCTRecord[]>([]);
  const [inventoryStates, setInventoryStates] = useState<RealTimeInventoryState[]>([]);
  const [trips, setTrips] = useState<TripPlan[]>([]);

  // Sync operatorName across all operator references
  const setOperatorName = useCallback((newName: string) => {
    setOperatorNameState(newName);
    setOperators((prev) =>
      prev.map((o) => ({ ...o, name: newName }))
    );
    setRoutes((prev) =>
      prev.map((r) => ({ ...r, assignedOperatorName: newName }))
    );
    setTrips((prev) =>
      prev.map((t) => ({ ...t, assignedOperatorName: newName }))
    );
    setSwctRecords((prev) =>
      prev.map((s) => ({ ...s, operatorName: newName }))
    );
  }, []);

  // Sync parts state
  const setParts = useCallback((newPartsOrFn: React.SetStateAction<PartMaster[]>) => {
    setPartsState(newPartsOrFn);
  }, []);

  // Sync assembly line selection and adjust production target accordingly
  const changeSelectedAssemblyLine = useCallback((line: AssemblyLineCode) => {
    setSelectedAssemblyLine(line);
    setProductionPlan((prev) => {
      let target = 1032;
      if (line === '1VCON300') target = 1032;
      else if (line === '1VCON200') target = 1032;
      else if (line === '1VCON100') target = 1032;
      else if (line === 'ALL') target = 3096;

      return {
        ...prev,
        shiftPlanVehicles: target,
        hourlyPlanVehicles: Math.round(target / 8),
        taktTimeSeconds: 27.9,
      };
    });
  }, []);

  const prevPartsLengthRef = useRef(parts.length);
  const prevPartsKeyRef = useRef(
    parts.map((p) => `${p.partNo}:${p.manualHourlyBinsOverride}:${p.binCapacity}:${p.usagePerVehicle}:${p.transportMode}:${p.isActive}`).join(',')
  );

  // A clean function to add stock to POC inventory state (without creating a trip log entry)
  const addPocStock = useCallback((partNo: string, trolleyQty: number) => {
    setInventoryStates((prev) =>
      prev.map((state) => {
        if (state.partNo === partNo) {
          const part = parts.find((p) => p.partNo === partNo);
          if (!part) return state;
          const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
          const addedQty = (part.binCapacity || 10) * trolleyQty;
          const newDelivered = state.deliveredQuantityUnits + addedQty;
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return computeInventoryState(
            part,
            state.openingStockUnits,
            newDelivered,
            state.consumedQuantityUnits,
            metrics.hourlyConsumption,
            now
          );
        }
        return state;
      })
    );
  }, [parts, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs]);

  // Synchronize derived states (routes, inventoryStates, trips, swctRecords) on structural parts change or productionPlan changes
  useEffect(() => {
    const currentPartsKey = parts
      .map(
        (p) =>
          `${p.partNo}:${p.manualHourlyBinsOverride}:${p.binCapacity}:${p.usagePerVehicle}:${p.transportMode}:${p.isActive}`
      )
      .join(',');
    const isNewUploadOrInit = currentPartsKey !== prevPartsKeyRef.current || parts.length !== prevPartsLengthRef.current;

    if (isNewUploadOrInit) {
      prevPartsLengthRef.current = parts.length;
      prevPartsKeyRef.current = currentPartsKey;

      const newRoutes = generateRoutesFromParts(parts, operatorName);
      const newInventory = generateInitialInventory(parts, productionPlan, modeConfigs);
      const newTrips = generateInitialTrips(parts, newRoutes, operatorName);
      const newSwct = generateSWCTRecordsFromParts(parts, operatorName);

      setRoutes(newRoutes);
      setInventoryStates(newInventory);
      setTrips(newTrips);
      setSwctRecords(newSwct);
    } else {
      // Recalculate inventory consumption & coverage based on the updated production plan
      setInventoryStates((prevInventory) => {
        return prevInventory.map((state) => {
          const part = parts.find((p) => p.partNo === state.partNo);
          if (!part) return state;
          const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
          const usage = part.usagePerVehicle || 1;
          const currentStock = state.currentStockUnits;
          const coverageSeconds = (currentStock / usage) * (productionPlan.taktTimeSeconds || 27.9);
          const coverageHours = Number((coverageSeconds / 3600).toFixed(2));
          
          let riskLevel = state.riskLevel;
          const coverageMin = coverageSeconds / 60;
          if (coverageMin < 10) riskLevel = 'Red';
          else if (coverageMin <= 20) riskLevel = 'Yellow';
          else riskLevel = 'Green';

          return {
            ...state,
            hourlyConsumptionUnits: metrics.hourlyConsumption,
            coverageHours,
            riskLevel,
          };
        });
      });
    }
  }, [
    parts,
    productionPlan.hourlyPlanVehicles,
    productionPlan.shiftPlanVehicles,
    productionPlan.taktTimeSeconds,
    operatorName,
    modeConfigs,
    generateRoutesFromParts,
    generateInitialInventory,
    generateInitialTrips,
    generateSWCTRecordsFromParts,
  ]);

  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);

  // Alerts state
  const [alerts, setAlerts] = useState<PlantAlert[]>([
    {
      id: 'ALT-101',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      severity: 'medium',
      partNo: 'P-PNL-618',
      pocPoint: 'POC-ST14',
      title: 'Low Stock Alert (1.0h)',
      message: 'Body Panel Set stock at POC-ST14 approaching safety limit (20 units remaining).',
      acknowledged: false,
      type: 'Stock Runout',
    },
    {
      id: 'ALT-102',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      severity: 'high',
      partNo: 'P-ENG-204',
      pocPoint: 'POC-ST05',
      title: 'Trolley Cycle Bottleneck',
      message: 'Route-02 Central loop experiencing 4.5 min pick time delay due to store binning queue.',
      acknowledged: false,
      type: 'Route Bottleneck',
    },
  ]);

  // Live simulation tick handler (runs every 3 seconds when enabled)
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // 1. Consume stock for all parts in the line
      let currentStates: RealTimeInventoryState[] = [];
      const newAlerts: PlantAlert[] = [];

      setInventoryStates((prevStates) => {
        const nextStates = prevStates.map((state) => {
          const part = parts.find((p) => p.partNo === state.partNo);
          if (!part) return state;

          const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
          // Consume a fraction of hourly consumption per tick
          const tickConsumption = Math.max(1, Math.round((metrics.hourlyConsumption / 120) * simulationSpeed));
          const newConsumed = state.consumedQuantityUnits + tickConsumption;

          const updatedState = computeInventoryState(
            part,
            state.openingStockUnits,
            state.deliveredQuantityUnits,
            newConsumed,
            metrics.hourlyConsumption,
            state.lastReplenishedAt
          );

          // Check if stock crossed critical thresholds to spawn auto alerts
          if (updatedState.coverageHours < 1 && state.coverageHours >= 1) {
            newAlerts.push({
              id: `ALT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              severity: 'high',
              partNo: state.partNo,
              pocPoint: state.pocPoint,
              title: 'CRITICAL LINE STOP RISK (<1.0 hr stock)',
              message: `POC ${state.pocPoint} stock dropped to ${updatedState.currentStockUnits} units (${updatedState.coverageHours}h left). Urgent replenishment needed!`,
              acknowledged: false,
              type: 'Stock Runout',
            });
          }

          return updatedState;
        });
        currentStates = nextStates;
        return nextStates;
      });

      if (newAlerts.length > 0) {
        setAlerts((prevAlerts) => [...newAlerts, ...prevAlerts].slice(0, 30));
      }

      // 2. Progress Active Trips & Perform Delivery Replenishments
      const partsToReplenish: { partNo: string; qty: number }[] = [];
      setTrips((prevTrips) => {
        return prevTrips.map((t) => {
          if (t.status === 'Completed') return t;

          // Process step increments on a steady rhythm
          if (Math.random() > 0.35) return t;

          const nextStep = t.currentStep + 1;
          if (nextStep > 8) {
            return { ...t, currentStep: 8, status: 'Completed' };
          }

          let status: TripStatus = t.status;
          if (nextStep === 1) status = 'Started';
          else if (nextStep >= 2 && nextStep <= 4) status = 'In Progress';
          else if (nextStep === 5) {
            status = 'Delivered';
            partsToReplenish.push({ partNo: t.partNo, qty: t.trolleyQuantity });
          } else if (nextStep >= 6) {
            status = 'Completed';
          }

          return { ...t, currentStep: nextStep, status };
        });
      });

      // Process any completed dropoffs to load quantities back into inventory
      if (partsToReplenish.length > 0) {
        partsToReplenish.forEach(({ partNo, qty }) => {
          addPocStock(partNo, qty);
        });
      }

      // 3. True Mizusumashi System: Create Milk Runs from "Predicted Stock-Out Time at POC"
      if (currentStates.length > 0) {
        // Find parts that are running low based on: Time-To-Stock-Out < (Estimated Milk Run Cycle Time + Safety Buffer)
        const lowStockParts = currentStates
          .map((state) => {
            const part = parts.find((p) => p.partNo === state.partNo);
            if (!part) return null;

            const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
            const hourlyConsumption = metrics.hourlyConsumption;
            const consumptionPerMin = hourlyConsumption / 60;
            
            const stockOutMins = consumptionPerMin > 0 ? (state.currentStockUnits / consumptionPerMin) : 999.0;
            const cycleTimeMins = metrics.cycleTimeMin;
            // From requirement: +- 2 mins to deliver
            const safetyBufferMins = 2.0;

            // Trigger if Time-To-Stock-Out < (Milk Run Cycle Time + Safety Buffer)
            const trigger = stockOutMins < (cycleTimeMins + safetyBufferMins);

            return { state, part, metrics, trigger, stockOutMins, cycleTimeMins };
          })
          .filter((item): item is { state: RealTimeInventoryState; part: PartMaster; metrics: any; trigger: boolean; stockOutMins: number; cycleTimeMins: number } => {
            return item !== null && item.trigger;
          });

        if (lowStockParts.length > 0) {
          setTrips((prevTrips) => {
            const activePartNos = new Set(
              prevTrips
                .filter((t) => t.status !== 'Completed' && t.status !== 'Delivered')
                .map((t) => t.partNo)
            );

            // Filter lowStockParts that don't have active trips
            const eligibleParts = lowStockParts
              .filter(({ part }) => part && !activePartNos.has(part.partNo))
              .sort((a, b) => a.stockOutMins - b.stockOutMins);

            if (eligibleParts.length > 0) {
              const primaryItem = eligibleParts[0];
              const pPart = primaryItem.part!;
              const pState = primaryItem.state;
              const pMetrics = primaryItem.metrics;

              // Max capacity is 3 trolleys for Jumbo/BOV, 1 for Manual
              const maxTrolleys = (pPart.transportMode === 'Jumbo Trolley' || pPart.transportMode === 'BOV (Battery Vehicle)') ? 3 : 1;
              let loadedTrolleys = 0;

              const coLoadedItems: Array<{ part: PartMaster; qty: number; metrics: any }> = [];

              // Load primary part (highest priority) respecting POC storage space limits
              const currentTrolleysAtPoc = Math.floor(pState.currentStockUnits / pPart.binCapacity);
              
              // PREDICTIVE FIX: dynamically increase POC space limit
              const minTrolleysRequiredToSurviveCycle = Math.ceil(((pMetrics.hourlyConsumption / 60) * pMetrics.cycleTimeMin) / Math.max(1, pPart.binCapacity));
              const dynamicPocMax = Math.max(pPart.pocSpaceTrolleysMax || 2, minTrolleysRequiredToSurviveCycle);
              
              const maxAllowedToDeliver = Math.max(1, dynamicPocMax - currentTrolleysAtPoc);
              const qtyToDeliverPrimary = Math.min(maxTrolleys, maxAllowedToDeliver);

              coLoadedItems.push({ part: pPart, qty: qtyToDeliverPrimary, metrics: pMetrics });
              loadedTrolleys += qtyToDeliverPrimary;

              // Co-load other low-stock parts if space allows, BUT ONLY if they won't survive the next cycle
              if (loadedTrolleys < maxTrolleys && maxTrolleys > 1) {
                for (let i = 1; i < eligibleParts.length; i++) {
                  const candidate = eligibleParts[i];
                  const cPart = candidate.part!;
                  const cState = candidate.state;
                  
                  // Fix: Instead of 1.5x cycle time, ensure we only co-load if it genuinely needs it 
                  // or if it's the exact same part type/route group that makes sense to pull together.
                  // The user screenshot showed:
                  // Trip 1: Frame + Wheel
                  // Trip 2: Frame + Wheel (but we want Frame only if Wheel has enough buffer)
                  // Let's tighten the threshold to basically "will it starve before we can do ANOTHER loop after this one?"
                  // 1 loop = cycleTimeMins. 2 loops = cycleTimeMins * 2. 
                  const survivalThreshold = candidate.cycleTimeMins * 0.5; 
                  
                  if (cPart.transportMode === pPart.transportMode && candidate.stockOutMins < survivalThreshold) {
                    const cTrolleysAtPoc = Math.floor(cState.currentStockUnits / cPart.binCapacity);
                    const cMaxAllowed = Math.max(1, (cPart.pocSpaceTrolleysMax || 2) - cTrolleysAtPoc);
                    const spaceLeft = maxTrolleys - loadedTrolleys;
                    const qtyToDeliverCandidate = Math.min(spaceLeft, cMaxAllowed);

                    if (qtyToDeliverCandidate > 0) {
                      coLoadedItems.push({ part: cPart, qty: qtyToDeliverCandidate, metrics: candidate.metrics });
                      loadedTrolleys += qtyToDeliverCandidate;
                    }
                  }

                  if (loadedTrolleys >= maxTrolleys) break;
                }
              }

              // Create co-loaded milk run trips
              const nowTime = new Date();
              const newTripsList: TripPlan[] = [];

              coLoadedItems.forEach((item, itemIdx) => {
                const assignedRoute = routes.find((r) => r.partsCarried.includes(item.part.partNo)) || routes[0] || { routeId: 'ROUTE-01' };
                const dispatchTimeStr = nowTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Real travel time based on distance/speed logic
                // ETA at POC = Dispatch Time + Pick Time (e.g. 1 min) + Loaded Travel Time
                const arrivalMins = Math.max(2, (item.metrics.loadedTravelSec / 60) + 1.0);
                const etaTimeStr = new Date(nowTime.getTime() + arrivalMins * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                newTripsList.push({
                  id: `TRIP-MR-${Date.now()}-${itemIdx}`,
                  partNo: item.part.partNo,
                  routeId: assignedRoute.routeId,
                  assignedOperatorId: 'MHF-OP-01',
                  assignedOperatorName: operatorName,
                  transportMode: item.part.transportMode,
                  trolleyQuantity: item.qty,
                  totalUnits: item.part.binCapacity * item.qty,
                  scheduledDispatchTime: dispatchTimeStr,
                  estimatedArrivalPoc: etaTimeStr,
                  status: 'Started',
                  currentStep: 1,
                  delayMinutes: 0,
                });
              });

              return [...newTripsList, ...prevTrips];
            }

            return prevTrips;
          });
        }
      }

      // 4. Increment completed production units
      setProductionPlan((prev) => ({
        ...prev,
        unitsCompleted: prev.unitsCompleted + Math.floor(1 * simulationSpeed),
      }));
    }, 3000 / Math.max(1, simulationSpeed));

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed, parts, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, routes, operatorName, addPocStock]);

  const updateProductionPlan = useCallback((newPlan: Partial<ProductionPlan>) => {
    setProductionPlan((prev) => {
      const updated = { ...prev, ...newPlan };
      if (newPlan.taktTimeSeconds !== undefined) {
        updated.hourlyPlanVehicles = Number((3600 / updated.taktTimeSeconds).toFixed(2));
        updated.shiftPlanVehicles = Math.round(updated.hourlyPlanVehicles * 8);
      } else if (newPlan.shift && newPlan.shift !== prev.shift) {
        updated.taktTimeSeconds = 27.9;
        updated.hourlyPlanVehicles = 129;
        updated.shiftPlanVehicles = 1032;
      }
      return updated;
    });
  }, []);

  const updatePart = useCallback((partNo: string, updated: Partial<PartMaster>) => {
    setParts((prevParts) =>
      prevParts.map((p) => (p.partNo === partNo ? { ...p, ...updated } : p))
    );
  }, []);

  const toggleSimulation = useCallback(() => {
    setIsSimulating((prev) => !prev);
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  }, []);

  // Instant replenishment action
  const triggerManualReplenishment = useCallback((partNo: string, trolleyQty: number = 2) => {
    const part = parts.find((p) => p.partNo === partNo);
    if (!part) return;

    const addedQty = (part.binCapacity || 10) * trolleyQty;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setInventoryStates((prev) =>
      prev.map((state) => {
        if (state.partNo === partNo) {
          const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
          const newDelivered = state.deliveredQuantityUnits + addedQty;
          return computeInventoryState(
            part,
            state.openingStockUnits,
            newDelivered,
            state.consumedQuantityUnits,
            metrics.hourlyConsumption,
            now
          );
        }
        return state;
      })
    );

    // Create a completed trip log entry
    const newTrip: TripPlan = {
      id: `TRIP-EXP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      partNo,
      routeId: 'ROUTE-EXPRESS',
      assignedOperatorId: 'MHF-OP-01',
      assignedOperatorName: 'Expedited Dispatch Team',
      transportMode: part.transportMode,
      trolleyQuantity: trolleyQty,
      totalUnits: addedQty,
      scheduledDispatchTime: now,
      estimatedArrivalPoc: now,
      status: 'Completed',
      currentStep: 8,
      delayMinutes: 0,
    };

    setTrips((prev) => [newTrip, ...prev]);
  }, [parts, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles]);

  // Dispatch emergency trip
  const dispatchEmergencyTrip = useCallback((partNo: string, routeId?: string) => {
    const part = parts.find((p) => p.partNo === partNo);
    if (!part) return;

    const assignedRoute = routes.find((r) => r.routeId === routeId || r.partsCarried.includes(partNo)) || routes[0];
    const op = operators.find((o) => o.id === assignedRoute.assignedOperatorId) || operators[0];
    const now = new Date();
    const dispatchTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const eta = new Date(now.getTime() + 10 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const emergencyTrip: TripPlan = {
      id: `EMG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      partNo,
      routeId: assignedRoute.routeId,
      assignedOperatorId: op.id,
      assignedOperatorName: op.name,
      transportMode: 'BOV (Battery Vehicle)',
      trolleyQuantity: 2,
      totalUnits: part.binCapacity * 2,
      scheduledDispatchTime: dispatchTime,
      estimatedArrivalPoc: eta,
      status: 'Started',
      currentStep: 1,
      delayMinutes: 0,
    };

    setTrips((prev) => [emergencyTrip, ...prev]);

    setAlerts((prev) => [
      {
        id: `ALT-EMG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: dispatchTime,
        severity: 'medium',
        partNo,
        pocPoint: part.pocPoint,
        title: 'Emergency BOV Replenishment Dispatched',
        message: `High speed BOV dispatched for ${part.description} to ${part.pocPoint}. Operator: ${op.name}`,
        acknowledged: false,
        type: 'Stock Runout',
      },
      ...prev,
    ]);
  }, [parts, routes, operators]);

  // Operator 8-Step execution workflow updater
  const updateTripStep = useCallback((tripId: string, step: number, customStatus?: TripStatus) => {
    setTrips((prevTrips) =>
      prevTrips.map((t) => {
        if (t.id === tripId) {
          let status: TripStatus = customStatus || t.status;
          if (step === 1) status = 'Started';
          else if (step >= 2 && step <= 4) status = 'In Progress';
          else if (step === 5) status = 'Delivered';
          else if (step >= 6 && step <= 8) status = 'Completed';

          // If step 5 (Confirm Delivery), trigger instant POC inventory stock update!
          if (step === 5 && t.status !== 'Delivered' && t.status !== 'Completed') {
            triggerManualReplenishment(t.partNo, t.trolleyQuantity);
          }

          return { ...t, currentStep: step, status };
        }
        return t;
      })
    );
  }, [triggerManualReplenishment]);

  // Automated Stock Carry Forward to next shift
  const advanceShift = useCallback(() => {
    setProductionPlan((prev) => {
      const nextShift = prev.shift.includes('Shift 1')
        ? 'Shift 2 (15:30 - 00:00)'
        : 'Shift 1 (07:00 - 15:30)';

      return {
        ...prev,
        shift: nextShift as any,
        unitsCompleted: 0,
        currentHour: 1,
      };
    });

    setInventoryStates((prevStates) => carryForwardStock(prevStates, 'Next Shift'));
  }, []);

  const resetToInitialData = useCallback(() => {
    setOperatorNameState('sai');
    setPartsState(INITIAL_PARTS_MASTER);
    const newRoutes = generateRoutesFromParts(INITIAL_PARTS_MASTER, 'sai');
    setRoutes(newRoutes);
    setOperators([
      {
        id: 'MHF-OP-01',
        name: 'sai',
        operatorCode: 'MHF-SINGLE-01',
        assignedRouteId: 'ROUTE-01-MAIN',
        transportMode: 'Jumbo Trolley',
        completedTripsCount: 14,
        utilizationPercent: 88.5,
        status: 'Active',
      },
    ]);
    setProductionPlan(INITIAL_PRODUCTION_PLAN);
    setInventoryStates(generateInitialInventory(INITIAL_PARTS_MASTER, INITIAL_PRODUCTION_PLAN));
    setTrips(generateInitialTrips(INITIAL_PARTS_MASTER, newRoutes, 'sai'));
    setSwctRecords(generateSWCTRecordsFromParts(INITIAL_PARTS_MASTER, 'sai'));
  }, [generateRoutesFromParts, generateInitialInventory, generateInitialTrips, generateSWCTRecordsFromParts]);

  const clearAllData = useCallback(() => {
    setPartsState([]);
    setUploadedWorkbooksState([]);
    setRoutes([]);
    setOperators([]);
    setInventoryStates([]);
    setTrips([]);
    setSwctRecords([]);
    setUploadedFileName('');
    setParsedCount(0);
    setUploadError(null);
    try {
      localStorage.removeItem('tvs_uploaded_workbooks');
      localStorage.removeItem('tvs_operators');
    } catch (e) {
      console.error('Failed to clear localStorage data', e);
    }
  }, []);

  const activeProductionPlan = React.useMemo(() => {
    if (dashboardMode === 'static') {
      return {
        ...productionPlan,
        unitsCompleted: productionPlan.shiftPlanVehicles,
      };
    }
    return productionPlan;
  }, [dashboardMode, productionPlan]);

  const activeInventoryStates = React.useMemo(() => {
    if (dashboardMode === 'static') {
      return inventoryStates.map((state) => {
        const part = parts.find((p) => p.partNo === state.partNo);
        const cap = part?.binCapacity || 100;
        return {
          ...state,
          currentStockUnits: cap * 2,
          deliveredQuantityUnits: cap * 2,
          consumedQuantityUnits: 0,
          coverageHours: 12.0,
          riskLevel: 'Green' as const,
          trend: 'Stable' as const,
          status: 'Safe' as const,
        };
      });
    }
    return inventoryStates;
  }, [dashboardMode, inventoryStates, parts]);

  const activeTrips = React.useMemo(() => {
    if (dashboardMode === 'static') {
      return trips.map((t) => ({
        ...t,
        status: 'Completed' as const,
        currentStep: 8,
        delayMinutes: 0,
      }));
    }
    return trips;
  }, [dashboardMode, trips]);

  const activeAlerts = React.useMemo(() => {
    if (dashboardMode === 'static') {
      return [];
    }
    return alerts;
  }, [dashboardMode, alerts]);

  const activeOperators = React.useMemo(() => {
    if (dashboardMode === 'static') {
      return operators.map((o) => ({
        ...o,
        completedTripsCount: 20,
        utilizationPercent: 92.4,
        status: 'Active' as const,
      }));
    }
    return operators;
  }, [dashboardMode, operators]);

  return (
    <MaterialFlowContext.Provider
      value={{
        selectedAssemblyLine,
        setSelectedAssemblyLine: changeSelectedAssemblyLine,
        role,
        setRole,
        operatorName,
        setOperatorName,
        vehicleModels,
        productionPlan: activeProductionPlan,
        updateProductionPlan,
        parts,
        setParts,
        updatePart,
        routes,
        setRoutes,
        operators: activeOperators,
        setOperators,
        stations,
        inventoryStates: activeInventoryStates,
        trips: activeTrips,
        swctRecords,
        setSwctRecords,
        alerts: activeAlerts,
        modeConfigs,
        updateModeConfig,
        isSimulating,
        toggleSimulation,
        simulationSpeed,
        setSimulationSpeed,
        triggerManualReplenishment,
        advanceShift,
        resetToInitialData,
        acknowledgeAlert,
        updateTripStep,
        dispatchEmergencyTrip,
        dashboardMode,
        setDashboardMode,
        theme,
        setTheme,
        selectedPlant,
        setSelectedPlant,
        isUploadModalOpen,
        setIsUploadModalOpen,
        uploadedFileName,
        setUploadedFileName,
        parsedCount,
        setParsedCount,
        uploadError,
        setUploadError,
        uploadedWorkbooks,
        setUploadedWorkbooks,
        activeDatasetId,
        activeSheetName,
        switchActiveDataset,
        clearAllData,
      }}
    >
      {children}
    </MaterialFlowContext.Provider>
  );
};

export const useMaterialFlow = () => {
  const context = useContext(MaterialFlowContext);
  if (!context) {
    throw new Error('useMaterialFlow must be used within a MaterialFlowProvider');
  }
  return context;
};
