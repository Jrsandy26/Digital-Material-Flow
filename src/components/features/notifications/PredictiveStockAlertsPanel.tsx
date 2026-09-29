import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Flame,
  Clock,
  Truck,
  Zap,
  CheckCircle2,
  Search,
  Volume2,
  VolumeX,
  X,
  Sliders,
  TrendingDown,
  Layers,
  MapPin,
  Activity,
  ShieldCheck,
  Package,
  Plus,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculatePartMetrics, getPocSpaceTrolleysMax, getInitialStockUnits } from '../../../utils/calculations';
import { playAlertChime } from '../../../utils/audioAlerts';
import { PartMaster, TransportMode } from '../../../types/manufacturing';

export interface PredictiveAlertItem {
  partNo: string;
  description: string;
  modelNo: string;
  pocPoint: string;
  stationName: string;
  storeLocation: string;
  transportMode: TransportMode;
  binCapacity: number;
  currentStockUnits: number;
  currentStockTrolleys: number;
  maxPocTrolleys: number;
  hourlyConsumption: number;
  consumptionPerMin: number;
  oneTrolleyCoverageMins: number;
  taktTimeSec: number;
  timeToRunoutMin: number;
  predictedRunoutTimestamp: string;
  predictedRunoutDate: Date;
  replenishmentCycleTimeMin: number;
  leadTimeDeficitMin: number;
  severity: 'critical' | 'warning' | 'watch' | 'nominal';
  inTransitTrip: {
    tripId: string;
    operatorName: string;
    status: string;
    trolleyQty: number;
    totalUnits: number;
    etaTimestamp: string;
    etaMinutes: number;
    willArriveInTime: boolean;
    marginMinutes: number;
  } | null;
  suggestedDispatchTrolleys: number;
  suggestedDispatchUnits: number;
  acknowledged: boolean;
}

interface PredictiveStockAlertsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  mode?: 'drawer' | 'embedded';
  className?: string;
}

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const PredictiveStockAlertsPanel: React.FC<PredictiveStockAlertsPanelProps> = ({
  isOpen = true,
  onClose,
  mode = 'embedded',
  className = '',
}) => {
  const {
    parts,
    inventoryStates,
    trips,
    productionPlan,
    modeConfigs,
    dispatchEmergencyTrip,
    triggerManualReplenishment,
    isSimulating,
    simulationSpeed,
    toggleSimulation,
    operatorName,
  } = useMaterialFlow();

  // Local component states
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'IN_TRANSIT'>('ALL');
  const [trackFilter, setTrackFilter] = useState<'ALL' | 'PL' | 'ML'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'TTR_ASC' | 'STOCK_ASC' | 'CONSUMPTION_DESC' | 'POC_ASC'>('TTR_ASC');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('tvs_predictive_sound') !== 'false';
  });

  const [acknowledgedPartNos, setAcknowledgedPartNos] = useState<Set<string>>(new Set());
  const [lastDispatchedPart, setLastDispatchedPart] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live ticking timer for precise countdown calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('tvs_predictive_sound', String(next));
    if (next) {
      playAlertChime('warning');
    }
  };

  // Compute predictive alerts dynamically based on current simulation state
  const predictiveAlerts = useMemo<PredictiveAlertItem[]>(() => {
    const now = currentTime.getTime();
    const taktTime = productionPlan.taktTimeSeconds || 27.9;
    const vph = productionPlan.hourlyPlanVehicles || (3600 / taktTime);

    return parts.map((part) => {
      const initUnits = getInitialStockUnits(part);
      const invState = inventoryStates.find((s) => s.partNo === part.partNo) || {
        partNo: part.partNo,
        pocPoint: part.pocPoint,
        openingStockUnits: initUnits,
        deliveredQuantityUnits: 0,
        consumedQuantityUnits: 0,
        currentStockUnits: initUnits,
        closingStockUnits: initUnits,
        coverageHours: 2.5,
        riskLevel: 'Green',
        lastReplenishedAt: '07:00 AM',
        nextDeliveryScheduledAt: '08:00 AM',
      };

      const metrics = calculatePartMetrics(part, vph, productionPlan.shiftPlanVehicles, modeConfigs);
      const binCap = part.binCapacity > 0 ? part.binCapacity : 10;
      
      // PREDICTIVE FIX: Dynamically calculate maxPocTrolleys
      const minTrolleysRequiredToSurviveCycle = Math.ceil(((metrics.hourlyConsumption / 60) * 15) / binCap);
      const maxPocTrolleys = Math.max(part.pocSpaceTrolleysMax || 2, minTrolleysRequiredToSurviveCycle);

      const currentStockUnits = Math.max(0, invState.currentStockUnits);
      const currentStockTrolleys = Number((currentStockUnits / binCap).toFixed(1));

      // Consumption calculations
      const hourlyConsumption = metrics.hourlyConsumption;
      const consumptionPerMin = Number((hourlyConsumption / 60).toFixed(2));
      
      // Calculate 1 Trolley Batch Coverage explicitly (Part Minutes Breakdown matching SWCT)
      const oneTrolleyCoverageMins = consumptionPerMin > 0 ? Number((binCap / consumptionPerMin).toFixed(2)) : 0;

      // Calculate Theoretical Deficit (how many parts we tried to consume but couldn't)
      const theoreticalStockUnits = invState.openingStockUnits + invState.deliveredQuantityUnits - invState.consumedQuantityUnits;
      const starvedUnits = theoreticalStockUnits < 0 ? Math.abs(theoreticalStockUnits) : 0;

      // Time to runout (minutes). Negative if starved.
      let timeToRunoutMin = 999.0;
      if (starvedUnits > 0 && consumptionPerMin > 0) {
        timeToRunoutMin = -(starvedUnits / consumptionPerMin);
      } else if (consumptionPerMin > 0) {
        timeToRunoutMin = Number((currentStockUnits / consumptionPerMin).toFixed(1));
      }

      // Predicted runout timestamp
      const runoutDate = new Date(now + timeToRunoutMin * 60 * 1000);
      const predictedRunoutTimestamp = runoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Replenishment lead time
      const replenishmentCycleTimeMin = Number((metrics.cycleTimeMin || 12.0).toFixed(1));
      const leadTimeDeficitMin = Number((timeToRunoutMin - replenishmentCycleTimeMin).toFixed(1));

      // Look up active in-transit trip for this part
      const activeTrip = trips.find(
        (t) => t.partNo === part.partNo && (t.status === 'Started' || t.status === 'In Progress' || t.status === 'Delayed')
      );

      let inTransitTripData = null;
      if (activeTrip) {
        // ETA logic based on actual metrics
        const totalCycle = metrics.cycleTimeMin;
        const minsPerStep = totalCycle / 8; // 8 total steps in a milk run
        const stepsRemainingToPoc = Math.max(0, 5 - activeTrip.currentStep); // POC delivery happens at step 5
        const etaMinutes = activeTrip.status === 'Delayed' 
          ? totalCycle + 4 
          : Math.max(1, stepsRemainingToPoc * minsPerStep);
          
        const etaDate = new Date(now + etaMinutes * 60 * 1000);
        const etaTimestamp = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const willArriveInTime = etaMinutes <= timeToRunoutMin;
        const marginMinutes = Number((timeToRunoutMin - etaMinutes).toFixed(1));

        inTransitTripData = {
          tripId: activeTrip.id,
          operatorName: activeTrip.assignedOperatorName || operatorName,
          status: activeTrip.status,
          trolleyQty: activeTrip.trolleyQuantity || 2,
          totalUnits: activeTrip.totalUnits || activeTrip.trolleyQuantity * binCap,
          etaTimestamp,
          etaMinutes: Math.round(etaMinutes),
          willArriveInTime,
          marginMinutes,
        };
      }

      // Severity classification
      let severity: 'critical' | 'warning' | 'watch' | 'nominal' = 'nominal';
      const isTripSafe = inTransitTripData && inTransitTripData.willArriveInTime && inTransitTripData.marginMinutes >= 1.0;

      if ((timeToRunoutMin < 15.0 || timeToRunoutMin <= replenishmentCycleTimeMin) && !isTripSafe) {
        severity = 'critical';
      } else if (timeToRunoutMin < 45.0) {
        severity = 'warning';
      } else if (timeToRunoutMin < 90.0) {
        severity = 'watch';
      } else {
        severity = 'nominal';
      }

      // Suggested replenishment calculation
      const targetBufferUnits = Math.round(hourlyConsumption * 1.2);
      const deficitUnits = Math.max(0, targetBufferUnits - currentStockUnits);
      const suggestedDispatchTrolleys = Math.max(1, Math.min(maxPocTrolleys, Math.ceil(deficitUnits / binCap)));
      const suggestedDispatchUnits = suggestedDispatchTrolleys * binCap;

      return {
        partNo: part.partNo,
        description: part.description,
        modelNo: part.modelNo || 'TVS Model',
        pocPoint: part.pocPoint,
        stationName: part.stationName || part.pocPoint,
        storeLocation: part.storeLocation || 'Store Main',
        transportMode: part.transportMode,
        binCapacity: binCap,
        currentStockUnits,
        currentStockTrolleys,
        maxPocTrolleys,
        hourlyConsumption,
        consumptionPerMin,
        oneTrolleyCoverageMins,
        taktTimeSec: taktTime,
        timeToRunoutMin,
        predictedRunoutTimestamp,
        predictedRunoutDate: runoutDate,
        replenishmentCycleTimeMin,
        leadTimeDeficitMin,
        severity,
        inTransitTrip: inTransitTripData,
        suggestedDispatchTrolleys,
        suggestedDispatchUnits,
        acknowledged: acknowledgedPartNos.has(part.partNo),
      };
    });
  }, [parts, inventoryStates, trips, productionPlan, modeConfigs, currentTime, operatorName, acknowledgedPartNos]);

  // Trigger sound alert when new critical alerts appear
  const criticalCount = useMemo(() => {
    return predictiveAlerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
  }, [predictiveAlerts]);

  const prevCriticalCountRef = React.useRef(criticalCount);
  useEffect(() => {
    if (soundEnabled && criticalCount > prevCriticalCountRef.current && criticalCount > 0) {
      playAlertChime('critical');
    }
    prevCriticalCountRef.current = criticalCount;
  }, [criticalCount, soundEnabled]);

  // Filtered & Sorted items
  const filteredAlerts = useMemo(() => {
    return predictiveAlerts
      .filter((alert) => {
        // Track Filter
        const pocUpper = alert.pocPoint.toUpperCase();
        const isPL = pocUpper.startsWith('PL') || pocUpper.includes('PRE');
        const isML = pocUpper.startsWith('ML') || pocUpper.includes('MAIN');

        if (trackFilter === 'PL' && !isPL) return false;
        if (trackFilter === 'ML' && !isML) return false;

        // Severity Filter
        if (severityFilter === 'CRITICAL' && alert.severity !== 'critical') return false;
        if (severityFilter === 'WARNING' && alert.severity !== 'warning') return false;
        if (severityFilter === 'IN_TRANSIT' && !alert.inTransitTrip) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            alert.partNo.toLowerCase().includes(q) ||
            alert.description.toLowerCase().includes(q) ||
            alert.pocPoint.toLowerCase().includes(q) ||
            alert.storeLocation.toLowerCase().includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'TTR_ASC') return a.timeToRunoutMin - b.timeToRunoutMin;
        if (sortBy === 'STOCK_ASC') return a.currentStockUnits - b.currentStockUnits;
        if (sortBy === 'CONSUMPTION_DESC') return b.hourlyConsumption - a.hourlyConsumption;
        if (sortBy === 'POC_ASC') return a.pocPoint.localeCompare(b.pocPoint, undefined, { numeric: true });
        return 0;
      });
  }, [predictiveAlerts, trackFilter, severityFilter, searchQuery, sortBy]);

  // Aggregate stats
  const stats = useMemo(() => {
    const critical = predictiveAlerts.filter((a) => a.severity === 'critical').length;
    const warning = predictiveAlerts.filter((a) => a.severity === 'warning').length;
    const watch = predictiveAlerts.filter((a) => a.severity === 'watch').length;
    const inTransit = predictiveAlerts.filter((a) => !!a.inTransitTrip).length;

    return { critical, warning, watch, inTransit };
  }, [predictiveAlerts]);

  // Quick action handlers
  const handleQuickDispatch = (partNo: string) => {
    setLastDispatchedPart(partNo);
    dispatchEmergencyTrip(partNo);
    playAlertChime('dispatch');
    setTimeout(() => setLastDispatchedPart(null), 3000);
  };

  const handleQuickReplenish = (partNo: string, trolleyQty: number = 2) => {
    triggerManualReplenishment(partNo, trolleyQty);
    playAlertChime('dispatch');
  };

  const handleAcknowledge = (partNo: string) => {
    setAcknowledgedPartNos((prev) => {
      const next = new Set(prev);
      if (next.has(partNo)) {
        next.delete(partNo);
      } else {
        next.add(partNo);
      }
      return next;
    });
  };

  const handleAcknowledgeAll = () => {
    const allPartNos = new Set(predictiveAlerts.map((a) => a.partNo));
    setAcknowledgedPartNos(allPartNos);
  };

  const formatCountdown = (minutes: number) => {
    if (minutes >= 999) return 'Safe (Stocked)';
    if (minutes <= 0) {
      const lostMins = Math.floor(Math.abs(minutes));
      const lostSecs = Math.floor((Math.abs(minutes) * 60) % 60);
      return `LINE STOPPED (Lost: ${lostMins}m ${lostSecs.toString().padStart(2, '0')}s)`;
    }
    const totalSeconds = Math.max(0, Math.floor(minutes * 60));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins >= 60) {
      const hrs = (mins / 60).toFixed(1);
      return `${hrs}h left`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  if (parts.length === 0) {
    if (mode === 'drawer') return null;
    return <ExcelRequiredPlaceholder />;
  }

  const content = (
    <div className={`space-y-4 text-slate-800 dark:text-slate-200 ${className}`}>
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-4 sm:p-5 shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Predictive Stock-Out & Low-Inventory Alerts
                </h2>
                {stats.critical > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-red-600 text-white font-extrabold font-mono animate-bounce shadow-xs">
                    {stats.critical} CRITICAL
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Auto-Mizusumashi ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Real-time depletion forecasting from live line consumption rates ({productionPlan.hourlyPlanVehicles} vph @ {productionPlan.taktTimeSeconds}s takt). Automated trips are dispatched based on safe margin thresholds.
              </p>
            </div>
          </div>

          {/* Quick Header Toolbar */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {/* Audio Toggle */}
            <button
              id="btn-toggle-sound-alerts"
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                soundEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
              title={soundEnabled ? 'Sound Alerts: ENABLED (Click to Mute)' : 'Sound Alerts: MUTED (Click to Enable)'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
            </button>

            {/* Acknowledge All */}
            <button
              id="btn-ack-all-alerts"
              onClick={handleAcknowledgeAll}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Acknowledge all current warnings"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ack All</span>
            </button>

            {/* Close Button in Drawer mode */}
            {mode === 'drawer' && onClose && (
              <button
                id="btn-close-predictive-panel"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Close Panel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 5 Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-red-700 dark:text-red-400 font-bold uppercase tracking-wider">Starvation Imminent</span>
              <Flame className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-xl font-extrabold text-red-700 dark:text-red-300 font-mono mt-1">{stats.critical}</div>
            <p className="text-[10px] text-red-600/80 dark:text-red-400/80 mt-0.5">&lt;15m buffer / lead deficit</p>
          </div>

          <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">Low Stock Warning</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xl font-extrabold text-amber-700 dark:text-amber-300 font-mono mt-1">{stats.warning}</div>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">15m to 45m runway</p>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider">In-Transit Buffer</span>
              <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300 font-mono mt-1">{stats.inTransit}</div>
            <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">Active trips on route</p>
          </div>

          <div className="bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">Watchlist Buffer</span>
              <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xl font-extrabold text-purple-700 dark:text-purple-300 font-mono mt-1">{stats.watch}</div>
            <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5">45m to 90m runway</p>
          </div>

          <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Line Health</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono mt-1">
              {stats.critical === 0 ? '100% OK' : 'ACTION REQ'}
            </div>
            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Zero Stoppage Target</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-3.5 shadow-sm space-y-3">
        {/* Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-predictive-search"
            type="text"
            placeholder="Search Part No, Description, POC station (e.g. KE121530, PL-03)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Tabs & Sort Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setSeverityFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  severityFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({predictiveAlerts.length})
              </button>
              <button
                onClick={() => setSeverityFilter('CRITICAL')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  severityFilter === 'CRITICAL'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-600 dark:text-red-400 hover:text-red-700'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Critical ({stats.critical})</span>
              </button>
              <button
                onClick={() => setSeverityFilter('WARNING')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  severityFilter === 'WARNING'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Warn ({stats.warning})</span>
              </button>
              <button
                onClick={() => setSeverityFilter('IN_TRANSIT')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  severityFilter === 'IN_TRANSIT'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-600 dark:text-blue-400 hover:text-blue-700'
                }`}
              >
                <Truck className="w-3 h-3" />
                <span>In-Transit ({stats.inTransit})</span>
              </button>
            </div>

            {/* Track Filter */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <button
                onClick={() => setTrackFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  trackFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Tracks
              </button>
              <button
                onClick={() => setTrackFilter('PL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  trackFilter === 'PL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                PL (Pre-Line)
              </button>
              <button
                onClick={() => setTrackFilter('ML')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  trackFilter === 'ML'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ML (Main Line)
              </button>
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shrink-0">
            <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              id="select-predictive-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer border-0 p-0 text-xs"
            >
              <option value="TTR_ASC" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Shortest Runout (Urgent First)</option>
              <option value="STOCK_ASC" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Lowest Stock Units</option>
              <option value="CONSUMPTION_DESC" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Highest Consumption</option>
              <option value="POC_ASC" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">POC Station Order</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Feed Cards List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-8 text-center shadow-md">
            <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Matching Predictive Alerts</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              All line stations are operating within safe safety coverage parameters for the active filter.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';
            const isRecentlyDispatched = lastDispatchedPart === alert.partNo;

            // Border & Card Styling
            let cardBorderClass = 'border-slate-200 dark:border-[#2a2a2e]';
            let cardBgClass = 'bg-white dark:bg-[#121216]';
            let iconBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

            if (isCritical) {
              cardBorderClass = 'border-red-300 dark:border-red-800/80';
              cardBgClass = 'bg-red-50/20 dark:bg-red-950/15';
              iconBadgeClass = 'bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 border-red-300 dark:border-red-700';
            } else if (isWarning) {
              cardBorderClass = 'border-amber-300 dark:border-amber-800/80';
              cardBgClass = 'bg-amber-50/20 dark:bg-amber-950/15';
              iconBadgeClass = 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 border-amber-300 dark:border-amber-700';
            }

            const targetUnits = alert.hourlyConsumption * 2;
            const stockPercent = Math.min(100, Math.round((alert.currentStockUnits / Math.max(1, targetUnits)) * 100));

            return (
              <motion.div
                key={alert.partNo}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`border rounded-2xl p-4 sm:p-5 shadow-md transition-all ${cardBorderClass} ${cardBgClass} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                {/* 1. Card Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className={`p-2 rounded-xl border shrink-0 ${iconBadgeClass}`}>
                      {isCritical ? (
                        <Flame className="w-4 h-4 animate-pulse text-red-600 dark:text-red-400" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-wide">
                          {alert.partNo}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {alert.pocPoint}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Store: {alert.storeLocation}
                        </span>
                        {alert.acknowledged && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            ACKNOWLEDGED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stockout Countdown Badge on Header Right */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      ETA {alert.predictedRunoutTimestamp}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold shadow-xs ${
                      isCritical
                        ? 'bg-red-600 text-white animate-pulse'
                        : isWarning
                        ? 'bg-amber-500 text-white'
                        : 'bg-blue-600 text-white'
                    }`}>
                      {formatCountdown(alert.timeToRunoutMin)}
                    </span>
                  </div>
                </div>

                {/* 2. Card Middle: Specs & Depletion Telemetry */}
                <div className="py-3 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 font-sans">
                      {alert.description} <span className="text-slate-500 dark:text-slate-400 font-normal">({alert.modelNo})</span>
                    </h4>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono flex-wrap">
                      <span>Mode: <strong className="text-slate-700 dark:text-slate-300">{alert.transportMode}</strong></span>
                      <span>•</span>
                      <span>Takt: <strong className="text-slate-700 dark:text-slate-300">{alert.taktTimeSec}s</strong></span>
                      <span>•</span>
                      <span>Rate: <strong className="text-slate-700 dark:text-slate-300">{alert.consumptionPerMin} pcs/min</strong></span>
                      <span>•</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700" title="Calculated Batch Coverage (mins) matching SWCT Empty Return Standard calculations">
                        Batch Coverage: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{alert.oneTrolleyCoverageMins}m / Trolley</strong>
                      </span>
                    </div>
                  </div>

                  {/* Depletion Level Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 dark:text-slate-400">
                        POC Stock: <strong className="text-slate-900 dark:text-white font-bold">{alert.currentStockUnits} units</strong> ({alert.currentStockTrolleys} / {alert.maxPocTrolleys} Trl)
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        Lead Time: <strong className="text-slate-900 dark:text-white font-bold">{alert.replenishmentCycleTimeMin} min</strong>
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 hidden sm:inline">
                        Hourly Cons: <strong className="text-slate-900 dark:text-white font-bold">{alert.hourlyConsumption} pcs/h</strong>
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          isCritical
                            ? 'bg-red-500'
                            : isWarning
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(4, stockPercent)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* In-Transit Status Pill */}
                  {alert.inTransitTrip ? (
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-blue-700 dark:text-blue-300 font-mono">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-bounce shrink-0" />
                        <span>
                          <strong>Trip #{alert.inTransitTrip.tripId.slice(-6)}</strong> in progress by <strong>{alert.inTransitTrip.operatorName}</strong> (+{alert.inTransitTrip.totalUnits} pcs)
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold self-start sm:self-auto ${
                        alert.inTransitTrip.willArriveInTime
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      }`}>
                        {alert.inTransitTrip.willArriveInTime ? `ETA in ${alert.inTransitTrip.etaMinutes}m (Safe Buffer)` : `ETA in ${alert.inTransitTrip.etaMinutes}m (LATE)`}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-red-700 dark:text-red-300 font-mono">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>No trip active. Auto-Mizusumashi engine will automatically dispatch milk-run when threshold triggers.</span>
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400 self-start sm:self-auto uppercase">AWAITING TRIGGER</span>
                    </div>
                  )}
                </div>

                {/* 3. Card Bottom Action Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Suggested Replenishment: <strong className="text-slate-800 dark:text-slate-200">+{alert.suggestedDispatchTrolleys} Trolley ({alert.suggestedDispatchUnits} pcs)</strong>
                  </div>

                  {/* Action Buttons Group */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Emergency Quick Dispatch */}
                    <button
                      id={`btn-emergency-dispatch-${alert.partNo}`}
                      onClick={() => handleQuickDispatch(alert.partNo)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                        isRecentlyDispatched
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
                      }`}
                      title="Force manual dispatch before auto-trigger"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isRecentlyDispatched ? 'Dispatched!' : 'Expedite Manual Dispatch'}</span>
                    </button>

                    {/* Quick +1 Trolley */}
                    <button
                      id={`btn-replenish-1trolley-${alert.partNo}`}
                      onClick={() => handleQuickReplenish(alert.partNo, 1)}
                      className="px-3 py-2 rounded-xl text-xs font-bold font-mono bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                      title={`Directly replenish 1 trolley (+${alert.binCapacity} units)`}
                    >
                      +1 Trl
                    </button>

                    {/* Quick +Suggested Trolleys */}
                    <button
                      id={`btn-replenish-suggested-${alert.partNo}`}
                      onClick={() => handleQuickReplenish(alert.partNo, alert.suggestedDispatchTrolleys)}
                      className="px-3 py-2 rounded-xl text-xs font-bold font-mono bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
                      title={`Replenish suggested ${alert.suggestedDispatchTrolleys} trolleys (+${alert.suggestedDispatchUnits} units)`}
                    >
                      +{alert.suggestedDispatchTrolleys} Trl ({alert.suggestedDispatchUnits} pcs)
                    </button>

                    {/* Acknowledge Toggle */}
                    <button
                      id={`btn-ack-alert-${alert.partNo}`}
                      onClick={() => handleAcknowledge(alert.partNo)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 transition-colors cursor-pointer"
                      title={alert.acknowledged ? 'Mark as Unacknowledged' : 'Acknowledge Alert'}
                    >
                      <CheckCircle2 className={`w-4 h-4 ${alert.acknowledged ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Simulation Engine Footer Info */}
      <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <span>
            Simulation Engine: <strong className="text-slate-900 dark:text-white">{isSimulating ? `Active (${simulationSpeed}x Speed)` : 'Paused'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSimulation}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {isSimulating ? 'Pause Engine' : 'Resume Engine'}
          </button>
          <span className="text-slate-400 dark:text-slate-600">•</span>
          <span>Target Takt: <strong className="text-slate-800 dark:text-white">{productionPlan.taktTimeSeconds}s</strong></span>
        </div>
      </div>

    </div>
  );

  if (mode === 'drawer') {
    if (!isOpen) return null;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
          />

          {/* Slide-over Drawer with Spacious Width */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-screen max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl bg-slate-50 dark:bg-[#0a0a0c] border-l border-slate-200 dark:border-[#2a2a2e] shadow-2xl p-4 sm:p-6 overflow-y-auto"
            >
              {content}
            </motion.div>
          </div>
        </div>
      </AnimatePresence>
    );
  }

  return content;
};
