import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Users,
  Truck,
  Clock,
  Shield,
  User,
  Edit3,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Package,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Zap,
  ChevronRight,
  BarChart2,
  Download,
  FileText,
  Sparkles,
  TrendingDown,
  ShieldCheck,
  Activity,
  Award,
  UploadCloud
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { calculatePartMetrics, getMilkRunGroups, MilkRunGroup, DEFAULT_TRANSPORT_MODE_CONFIGS } from '../../../utils/calculations';
import { calculateInterStationDistance, calculateStoreToStationDistance, sortPocStations, STATION_GAP_METERS, POC_MAX_TROLLEYS_PER_STATION } from '../../../utils/pocSorter';
import { AssemblyLineCode } from '../../../types/manufacturing';
import { MultiExcelOperatorUpload } from './MultiExcelOperatorUpload';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const OperatorManagementView: React.FC = () => {
  const {
    operatorName,
    setOperatorName,
    operators,
    setOperators,
    parts,
    productionPlan,
    updateProductionPlan,
    selectedAssemblyLine,
    setSelectedAssemblyLine,
    modeConfigs,
    inventoryStates,
  } = useMaterialFlow();

  const [activeTab, setActiveTab] = useState<'roster' | 'timetable' | 'timeline'>('roster');
  const [routeMode, setRouteMode] = useState<'standard' | 'milkrun'>('milkrun');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHour, setSelectedHour] = useState<number>(1);
  const [showUploadEngine, setShowUploadEngine] = useState<boolean>(true);

  const primaryOperator = operators[0] || {
    id: 'MHF-OP-01',
    name: operatorName || 'Sandeep Kumar',
    operatorCode: 'MHF-SINGLE-01',
    assignedRouteId: 'ROUTE-01-MAIN',
    transportMode: 'Jumbo Trolley',
    completedTripsCount: 14,
    utilizationPercent: 88.5,
    status: 'Active',
  };

  const handleStatusChange = (newStatus: any) => {
    setOperators((prev) =>
      prev.map((o, idx) => (idx === 0 ? { ...o, status: newStatus } : o))
    );
  };

  // Filter parts by assembly line & search
  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      const matchesSearch =
        part.partNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.modelNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.pocPoint.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedAssemblyLine === 'ALL') return true;

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
  }, [parts, searchQuery, selectedAssemblyLine]);

  // Generate standard part roster metrics
  const partRosterData = useMemo(() => {
    return filteredParts.map((part) => {
      const metrics = calculatePartMetrics(
        part,
        productionPlan.hourlyPlanVehicles || 125,
        productionPlan.shiftPlanVehicles || 1000,
        modeConfigs
      );

      const carryingCapacity = metrics.carryingCapacity;
      const hourlyTrips = metrics.tripsRequiredPerHour;
      const binCap = part.binCapacity || 10;
      const totalShiftTrips = metrics.tripsRequiredPerShift;
      const totalDailyTrips = metrics.tripsRequiredPerDay;
      const shiftTotalUnits = metrics.shiftConsumption;
      const cycleTimeMin = Number((metrics.cycleTimeMin || 4.5).toFixed(1));
      const shiftWorkloadMin = Number((totalShiftTrips * cycleTimeMin).toFixed(1));
      const distanceMeters = part.loadedDistanceMeters || 194;

      return {
        part,
        metrics,
        hourlyTrips,
        binCap,
        carryingCapacity,
        totalShiftTrips,
        totalDailyTrips,
        shiftTotalUnits,
        cycleTimeMin,
        shiftWorkloadMin,
        distanceMeters,
        pickStore: part.storeLocation || 'Store-A',
        dropPoc: part.pocPoint || 'PL-01',
      };
    });
  }, [filteredParts, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs]);

  // Dynamic Milk-Run groupings
  const milkRunGroups = useMemo(() => {
    return getMilkRunGroups(filteredParts, productionPlan, modeConfigs, inventoryStates);
  }, [filteredParts, productionPlan, modeConfigs, inventoryStates]);

  // Overall Totals (Calculated dynamically based on active routeMode)
  const totalHourlyTrips = useMemo(() => {
    if (routeMode === 'milkrun') {
      return milkRunGroups.reduce((acc, g) => acc + 1, 0); // Each milk run groups fires once/hr
    }
    return partRosterData.reduce((acc, p) => acc + p.hourlyTrips, 0);
  }, [routeMode, partRosterData, milkRunGroups]);

  const totalShiftTripsCount = useMemo(() => {
    return totalHourlyTrips * 8; // 8-hour shift multiplier
  }, [totalHourlyTrips]);

  const totalDailyTripsCount = useMemo(() => {
    return totalShiftTripsCount * 2; // 2 shifts daily target
  }, [totalShiftTripsCount]);

  const totalShiftUnitsDelivered = useMemo(() => {
    return partRosterData.reduce((acc, p) => acc + p.shiftTotalUnits, 0);
  }, [partRosterData]);

  const totalShiftWorkloadMinutes = useMemo(() => {
    if (routeMode === 'milkrun') {
      // Sum of group cycle times times 8 hours
      const hourlySum = milkRunGroups.reduce((acc, g) => acc + g.cycleTimeMin, 0);
      return Number((hourlySum * 8).toFixed(1));
    }
    return partRosterData.reduce((acc, p) => acc + p.shiftWorkloadMin, 0);
  }, [routeMode, partRosterData, milkRunGroups]);

  const operatorUtilizationPct = useMemo(() => {
    return Math.round((totalShiftWorkloadMinutes / 480) * 100);
  }, [totalShiftWorkloadMinutes]);

  // Hours array for 8-hour shift starting at shift start time
  const shiftHours = useMemo(() => {
    let startHour = 7;
    if (productionPlan.shift.includes('Shift 2') || productionPlan.shift.includes('2nd Shift')) {
      startHour = 15;
    }

    return Array.from({ length: 8 }).map((_, idx) => {
      const h1 = (startHour + idx) % 24;
      const h2 = (startHour + idx + 1) % 24;
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        hourNum: idx + 1,
        label: `${pad(h1)}:00 - ${pad(h2)}:00`,
        startHour: h1,
        startMinute: 0,
      };
    });
  }, [productionPlan.shift]);

  // Standard part-wise master sequential log
  const standardTimelineTrips = useMemo(() => {
    const tripsList: Array<{
      tripNo: number;
      hourLabel: string;
      timeStr: string;
      partNo: string;
      description: string;
      pickStore: string;
      dropPoc: string;
      loadQty: number;
      reloadAction: string;
      cycleTimeMin: number;
      transportMode: string;
    }> = [];

    let overallTripCounter = 1;

    shiftHours.forEach((hr) => {
      partRosterData.forEach((pData) => {
        const nTrips = pData.hourlyTrips;
        if (nTrips <= 0) return;

        const intervalMins = 60 / nTrips;

        for (let t = 0; t < nTrips; t++) {
          const minuteOffset = Math.round(t * intervalMins);
          const rawHour = hr.startHour;
          const displayHour = rawHour > 12 ? rawHour - 12 : rawHour === 0 ? 12 : rawHour;
          const ampm = rawHour >= 12 ? 'PM' : 'AM';
          const timeStr = `${String(displayHour).padStart(2, '0')}:${String(minuteOffset).padStart(2, '0')} ${ampm}`;

          tripsList.push({
            tripNo: overallTripCounter++,
            hourLabel: hr.label,
            timeStr,
            partNo: pData.part.partNo,
            description: pData.part.description,
            pickStore: pData.pickStore,
            dropPoc: pData.dropPoc,
            loadQty: pData.binCap,
            reloadAction: `LOAD full trolley (${pData.binCap} units) @ ${pData.pickStore} → DROP @ ${pData.dropPoc} & RELOAD empty trolley`,
            cycleTimeMin: pData.cycleTimeMin,
            transportMode: pData.part.transportMode,
          });
        }
      });
    });

    return tripsList;
  }, [partRosterData, shiftHours]);

  // Grouped milk-run master sequential log
  const milkRunTimelineTrips = useMemo(() => {
    const tripsList: Array<{
      tripNo: number;
      hourLabel: string;
      timeStr: string;
      groupName: string;
      pocPoint: string;
      storeLocations: string[];
      totalTrolleys: number;
      parts: Array<{
        partNo: string;
        description: string;
        storeLocation: string;
        hourlyTrolleys: number;
        loadQty?: number;
      }>;
      cycleTimeMin: number;
      transportMode: string;
    }> = [];

    let overallTripCounter = 1;

    shiftHours.forEach((hr) => {
      const spacingMins = Math.floor(60 / Math.max(1, milkRunGroups.length));

      milkRunGroups.forEach((group, gIdx) => {
        const minuteOffset = gIdx * spacingMins;
        const rawHour = hr.startHour;
        const displayHour = rawHour > 12 ? rawHour - 12 : rawHour === 0 ? 12 : rawHour;
        const ampm = rawHour >= 12 ? 'PM' : 'AM';
        const timeStr = `${String(displayHour).padStart(2, '0')}:${String(minuteOffset).padStart(2, '0')} ${ampm}`;

        tripsList.push({
          tripNo: overallTripCounter++,
          hourLabel: hr.label,
          timeStr,
          groupName: group.groupName,
          pocPoint: group.pocPoint,
          storeLocations: group.storeLocations,
          totalTrolleys: group.totalTrolleys,
          parts: group.parts.map((p) => ({
            partNo: p.part.partNo,
            description: p.part.description,
            storeLocation: p.part.storeLocation,
            hourlyTrolleys: p.hourlyTrolleys,
            loadQty: p.loadQty,
          })),
          cycleTimeMin: group.cycleTimeMin,
          transportMode: group.transportMode,
        });
      });
    });

    return tripsList;
  }, [milkRunGroups, shiftHours]);

  // Continuous hour-wise operator activity generator
  const continuousHourActivities = useMemo(() => {
    return shiftHours.map((hr) => {
      const startHour = hr.startHour;
      const startMinute = hr.startMinute || 0;

      // Collect all trips scheduled for this hour
      interface ScheduledTrip {
        tripId: string;
        name: string;
        poc: string;
        distanceMeters: number;
        transportMode: string;
        partsList: Array<{ partNo: string; description: string; storeLocation: string; qty: number }>;
      }

      const hourTrips: ScheduledTrip[] = [];

      if (routeMode === 'milkrun') {
        // Milk-run mode: Each group runs once per hour
        milkRunGroups.forEach((g, idx) => {
          const maxDist = routeMode === 'milkrun'
            ? Math.max(...g.parts.map(p => p.part.loadedDistanceMeters || 200))
            : 200;

          hourTrips.push({
            tripId: `MILK-${g.groupId}-${hr.hourNum}`,
            name: g.groupName,
            poc: g.pocPoint,
            distanceMeters: maxDist,
            transportMode: g.transportMode || 'Jumbo Trolley',
            partsList: g.parts.map((p) => ({
              partNo: p.part.partNo,
              description: p.part.description,
              storeLocation: p.part.storeLocation || 'Store-A',
              qty: p.loadQty,
            })),
          });
        });
      } else {
        // Standard mode: Collect parts and their hourly frequency
        partRosterData.forEach((pData, pIdx) => {
          const tripsCount = pData.hourlyTrips;
          for (let t = 0; t < tripsCount; t++) {
            hourTrips.push({
              tripId: `STD-${pData.part.partNo}-${hr.hourNum}-${t + 1}`,
              name: `Single delivery: ${pData.part.partNo}`,
              poc: pData.dropPoc,
              distanceMeters: pData.distanceMeters,
              transportMode: pData.part.transportMode,
              partsList: [{
                partNo: pData.part.partNo,
                description: pData.part.description,
                storeLocation: pData.pickStore,
                qty: pData.binCap,
              }],
            });
          }
        });
      }

      // We have the hourTrips list. Let's space them over 3600 seconds of the hour.
      const activities: Array<{
        id: string;
        type: 'initial' | 'pickup' | 'movement_to_poc' | 'unloading' | 'empty_loading' | 'movement_to_stores' | 'standby';
        title: string;
        location: string;
        startTimeStr: string;
        endTimeStr: string;
        durationSeconds: number;
        details?: string;
        meta?: any;
      }> = [];

      let runningSeconds = 0; // relative to start of this hour (0 to 3600)

      const getFormattedTime = (secondsOffset: number) => {
        const totalSecs = startHour * 3600 + startMinute * 60 + secondsOffset;
        const h = Math.floor(totalSecs / 3600) % 24;
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        const displayHour = h % 12 === 0 ? 12 : h % 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(displayHour)}:${pad(m)}:${pad(s)} ${ampm}`;
      };

      // 1. Initial State: At shift start time, operator is at Stores location
      if (hr.hourNum === 1) {
        activities.push({
          id: `INIT-${hr.hourNum}`,
          type: 'initial',
          title: 'Shift Initialization & Safety Check',
          location: 'Stores Logistical Hub',
          startTimeStr: getFormattedTime(0),
          endTimeStr: getFormattedTime(60),
          durationSeconds: 60,
          details: `At ${getFormattedTime(0)}, operator ${primaryOperator.name} reporting for active duty at the Stores location. Completed trolley inspection and safety checklist.`,
        });
        runningSeconds = 60;
      }

      if (hourTrips.length > 0) {
        hourTrips.forEach((trip, tIdx) => {
          // Get active standard part roster item matching this trip if not in milkrun
          const standardPartItem = routeMode !== 'milkrun'
            ? partRosterData.find((p) => p.part.partNo === trip.partsList[0]?.partNo)
            : null;

          // Calculate total trolleys being carried in this trip
          const totalTrolleys = routeMode === 'milkrun'
            ? (trip.partsList.reduce((acc, p) => acc + p.qty, 0) || 1)
            : (standardPartItem?.carryingCapacity || 1);

          // Inside each trip, we perform sequential pickups as requested:
          const store1 = trip.partsList[0]?.storeLocation || 'Store-A';
          const part1 = trip.partsList[0]?.partNo || 'PART-01';
          const qty1 = trip.partsList[0]?.qty || 1;

          const store2 = trip.partsList[1]?.storeLocation || `${store1} (Zone 2)`;
          const part2 = trip.partsList[1]?.partNo || part1;
          const qty2 = trip.partsList[1]?.qty || qty1;

          const store3 = trip.partsList[2]?.storeLocation || `${store1} (Zone 3)`;
          const part3 = trip.partsList[2]?.partNo || part1;
          const qty3 = trip.partsList[2]?.qty || qty1;

          // 1. Single Consolidated Pickup at Stores (Refined to remove redundant steps)
          const pickDuration = totalTrolleys * 10;
          const pickStart = runningSeconds;
          const pickEnd = pickStart + pickDuration;
          
          activities.push({
            id: `PICK-MAIN-${trip.tripId}-${tIdx}`,
            type: 'pickup',
            title: `Material Pickup: ${trip.partsList.map(p => p.partNo).join(' + ')}`,
            location: store1,
            startTimeStr: getFormattedTime(pickStart),
            endTimeStr: getFormattedTime(pickEnd),
            durationSeconds: pickDuration,
            details: `Located and loaded co-loaded parts (${totalTrolleys} trolleys total) from rack. Finished consolidated loading and secured lashing straps for transit.`,
            meta: { partCount: trip.partsList.length, trolleyCount: totalTrolleys },
          });
          runningSeconds = pickEnd;

          // 2. Movement from Stores to POCs (Multi-stop logic)
          const transportModeConfig = modeConfigs[trip.transportMode] || DEFAULT_TRANSPORT_MODE_CONFIGS['Jumbo Trolley'];
          const loadSpeed = (transportModeConfig as any).loadSpeedSecPerMtr || 1.3889;
          const emptySpeed = (transportModeConfig as any).emptySpeedSecPerMtr || 1.3889;
          const unloadTimeBase = transportModeConfig.storingTimeSec || 10;
          const emptyTimeBase = transportModeConfig.emptyHandlingTimeSec || 10;
          const emptyDropTimeBase = (transportModeConfig as any).emptyDropTimeSec || 10;

          // For timeline visualization, sort stops sequentially along assembly line conveyor flow
          const sortedStops = [...trip.partsList].sort((a, b) => {
             const pA = parts.find(p => p.partNo === a.partNo);
             const pB = parts.find(p => p.partNo === b.partNo);
             const sorted = sortPocStations([{ pocPoint: pA?.pocPoint }, { pocPoint: pB?.pocPoint }]);
             return sorted[0].pocPoint === pA?.pocPoint ? -1 : 1;
          });

          // First leg: Stores to First POC (based on calculated or master distance)
          const firstPart = parts.find(p => p.partNo === sortedStops[0].partNo);
          const firstDist = firstPart?.loadedDistanceMeters || calculateStoreToStationDistance(firstPart?.pocPoint);
          const firstLegDuration = Math.round(firstDist * loadSpeed);
          const firstLegStart = runningSeconds;
          const firstLegEnd = firstLegStart + firstLegDuration;
          
          activities.push({
            id: `MOV-POC1-${trip.tripId}-${tIdx}`,
            type: 'movement_to_poc',
            title: `Movement Stores → POC ${firstPart?.pocPoint || trip.poc}`,
            location: `Transit: Stores → ${firstPart?.pocPoint || trip.poc}`,
            startTimeStr: getFormattedTime(firstLegStart),
            endTimeStr: getFormattedTime(firstLegEnd),
            durationSeconds: firstLegDuration,
            details: `Driving loaded ${trip.transportMode} from Stores to first drop-off point. Distance: ${firstDist}m.`,
          });
          runningSeconds = firstLegEnd;

          // Process each stop (Unload, Load Empty, and Move to next if any)
          sortedStops.forEach((stop, sIdx) => {
            const stopPart = parts.find(p => p.partNo === stop.partNo);
            const stopPoc = stopPart?.pocPoint || trip.poc;
            
            // Simultaneous Unload & Load Empty Step (POC constraint: Max 2 trolleys)
            const exchangeDuration = stop.qty * Math.max(unloadTimeBase, emptyTimeBase);
            const exchangeStart = runningSeconds;
            const exchangeEnd = exchangeStart + exchangeDuration;
            activities.push({
              id: `EXCHANGE-${trip.tripId}-${sIdx}`,
              type: 'unloading',
              title: `Simultaneous Exchange at ${stopPoc}`,
              location: stopPoc,
              startTimeStr: getFormattedTime(exchangeStart),
              endTimeStr: getFormattedTime(exchangeEnd),
              durationSeconds: exchangeDuration,
              details: `Unloading ${stop.qty} full trolleys while simultaneously loading ${stop.qty} empty trolleys back onto tugger (maintaining max 2 trolleys at POC).`,
            });
            runningSeconds = exchangeEnd;

            // Move to next stop if exists using exact 2m station gap rule
            if (sIdx < sortedStops.length - 1) {
              const nextPart = parts.find(p => p.partNo === sortedStops[sIdx+1].partNo);
              const distBetween = calculateInterStationDistance(stopPart?.pocPoint, nextPart?.pocPoint);
              if (distBetween > 0) {
                const hopDuration = Math.max(1, Math.round(distBetween * loadSpeed));
                const hopStart = runningSeconds;
                const hopEnd = hopStart + hopDuration;
                
                activities.push({
                  id: `MOV-HOP-${trip.tripId}-${sIdx}`,
                  type: 'movement_to_poc',
                  title: `Movement ${stopPoc} → ${nextPart?.pocPoint}`,
                  location: `Transit: ${stopPoc} → ${nextPart?.pocPoint}`,
                  startTimeStr: getFormattedTime(hopStart),
                  endTimeStr: getFormattedTime(hopEnd),
                  durationSeconds: hopDuration,
                  details: `Moving to next POC station along assembly line conveyor (2m gap rule: ${distBetween}m gap).`,
                });
                runningSeconds = hopEnd;
              }
            }
          });

          // 8. Return Movement from LAST POC back to Stores
          const lastStopPart = parts.find(p => p.partNo === sortedStops[sortedStops.length - 1].partNo);
          const returnDist = lastStopPart?.returnDistanceMeters || firstDist;
          const travelToStoresDuration = Math.round(returnDist * emptySpeed);
          const travelToStoresStart = runningSeconds;
          const travelToStoresEnd = travelToStoresStart + travelToStoresDuration;
          activities.push({
            id: `MOV-STORES-${trip.tripId}-${tIdx}`,
            type: 'movement_to_stores',
            title: `Return Transit to Stores`,
            location: `Transit: Line → Stores`,
            startTimeStr: getFormattedTime(travelToStoresStart),
            endTimeStr: getFormattedTime(travelToStoresEnd),
            durationSeconds: travelToStoresDuration,
            details: `Driving empty trolley/tugs back to Stores logistics center to reset cycle. One-way return distance: ${returnDist}m.`,
          });
          runningSeconds = travelToStoresEnd;

          // 9. Empty Trolley Drop at Stores (Final Step)
          const dropDuration = totalTrolleys * emptyDropTimeBase;
          const dropStart = runningSeconds;
          const dropEnd = dropStart + dropDuration;
          activities.push({
            id: `DROP-EMPTY-${trip.tripId}-${tIdx}`,
            type: 'empty_loading', // Re-using type for styling
            title: `Empty Trolley Drop at Stores`,
            location: store1,
            startTimeStr: getFormattedTime(dropStart),
            endTimeStr: getFormattedTime(dropEnd),
            durationSeconds: dropDuration,
            details: `Unloading ${totalTrolleys} empty trolleys at the store drop zone. Finalizing Mizusumashi cycle.`,
          });
          runningSeconds = dropEnd;

          // 9. Skip Standby / Inventory Check as it is not needed, but keep runningSeconds aligned with the interval start
        });
      }

      return {
        hourNum: hr.hourNum,
        hourLabel: hr.label,
        activities,
      };
    });
  }, [shiftHours, routeMode, milkRunGroups, partRosterData, primaryOperator.name]);

  // Active chronological trips mapping based on toggle
  const activeTimelineTrips = useMemo(() => {
    return routeMode === 'milkrun' ? milkRunTimelineTrips : standardTimelineTrips;
  }, [routeMode, milkRunTimelineTrips, standardTimelineTrips]);

  // Download Excel Export
  const downloadOperatorRosterExcel = () => {
    const wb = XLSX.utils.book_new();

    if (routeMode === 'milkrun') {
      // Milk Run Co-Loaded Roster
      const rosterSheetData = [
        [
          'S.NO',
          'Milk Run Group ID',
          'Milk Run Group Name',
          'Delivery POC Target',
          'Store Area Source(s)',
          'Total Co-Loaded Bins',
          'Cycle Time (Mins)',
          'Combined Co-Loaded Materials & Quantities',
        ],
        ...milkRunGroups.map((g, idx) => [
          idx + 1,
          g.groupId,
          g.groupName,
          g.pocPoint,
          g.storeLocations.join(', '),
          g.totalTrolleys,
          g.cycleTimeMin.toFixed(1),
          g.parts.map((p) => `${p.part.partNo} (${p.loadQty} bin)`).join(' + '),
        ]),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(rosterSheetData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Milk-Run Grouped Roster');

      const timetableSheetData = [
        [
          'Group Name',
          'POC Drop',
          'Source Stores',
          'Bins/Trip',
          ...shiftHours.map((h) => `Hr ${h.hourNum} (${h.label})`),
          'Total Trips / Shift',
        ],
        ...milkRunGroups.map((g) => [
          g.groupName,
          g.pocPoint,
          g.storeLocations.join(', '),
          g.totalTrolleys,
          ...shiftHours.map(() => '1 Trip'),
          8,
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(timetableSheetData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Milk-Run Hourly Grid');

      const logSheetData = [
        [
          'Trip #',
          'Hour Window',
          'Dispatch Time',
          'Group Route Name',
          'Drop Target',
          'Total Co-Loads',
          'Materials Loaded',
          'Cycle Time (Min)',
          'Transport Mode',
        ],
        ...milkRunTimelineTrips.map((t) => [
          t.tripNo,
          t.hourLabel,
          t.timeStr,
          t.groupName,
          t.pocPoint,
          t.totalTrolleys,
          t.parts.map((p) => `${p.partNo} (${p.loadQty ?? 1} bin)`).join(', '),
          t.cycleTimeMin.toFixed(1),
          t.transportMode,
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(logSheetData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Milk-Run Chronological Log');
    } else {
      // Standard Part-Wise Roster
      const rosterSheetData = [
        [
          'S.NO',
          'Part No',
          'Description',
          'Model No',
          'Pick Location (Store)',
          'Drop Location (POC)',
          'Trolley Capacity (Units)',
          'Hourly Trips (Trips/Hr)',
          '8-Hour Shift Trips',
          'Shift Total Qty Delivered',
          'Cycle Time (Mins)',
          'Load Protocol (Pick Store)',
          'Unload & Reload Protocol (Drop POC)',
        ],
        ...partRosterData.map((row, idx) => [
          idx + 1,
          row.part.partNo,
          row.part.description,
          row.part.modelNo,
          row.pickStore,
          row.dropPoc,
          row.binCap,
          row.hourlyTrips,
          row.totalShiftTrips,
          row.shiftTotalUnits,
          row.cycleTimeMin,
          `LOAD full trolley (${row.binCap} Qty) at ${row.pickStore}`,
          `UNLOAD full trolley & RELOAD empty trolley at ${row.dropPoc}`,
        ]),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(rosterSheetData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Part-Wise Roster');

      const timetableSheetData = [
        [
          'Part No',
          'Description',
          'Model',
          'Pick Store',
          'Drop POC',
          'Trips/Hr',
          ...shiftHours.map((h) => `Hr ${h.hourNum} (${h.label})`),
          'Total 8-Hr Trips',
        ],
        ...partRosterData.map((row) => [
          row.part.partNo,
          row.part.description,
          row.part.modelNo,
          row.pickStore,
          row.dropPoc,
          row.hourlyTrips,
          ...shiftHours.map(() => `${row.hourlyTrips} trips`),
          row.totalShiftTrips,
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(timetableSheetData);
      XLSX.utils.book_append_sheet(wb, ws2, '8-Hour Hourly Matrix');

      const masterLogSheetData = [
        [
          'Trip #',
          'Hour Window',
          'Dispatch Time',
          'Part No',
          'Description',
          'Pick Location',
          'Drop Location',
          'Load Qty',
          'Load & Reload Protocol',
          'Cycle Time (Min)',
          'Transport Mode',
        ],
        ...standardTimelineTrips.map((t) => [
          t.tripNo,
          t.hourLabel,
          t.timeStr,
          t.partNo,
          t.description,
          t.pickStore,
          t.dropPoc,
          t.loadQty,
          t.reloadAction,
          t.cycleTimeMin,
          t.transportMode,
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(masterLogSheetData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Sequential Shift Trip Log');
    }

    // Add Continuous Operational Activity Sheet (for BOTH modes)
    const activitySheetData = [
      [
        'Hour Window',
        'Step Type',
        'Operational Step / Title',
        'Location Visited',
        'Start Time',
        'End Time',
        'Duration (Seconds)',
        'Operational Activity Detail Log',
      ],
      ...continuousHourActivities.flatMap((hourData) =>
        hourData.activities.map((act) => [
          hourData.hourLabel,
          act.type.toUpperCase(),
          act.title,
          act.location,
          act.startTimeStr,
          act.endTimeStr,
          act.durationSeconds,
          act.details || '',
        ])
      ),
    ];
    const wsAct = XLSX.utils.aoa_to_sheet(activitySheetData);
    XLSX.utils.book_append_sheet(wb, wsAct, 'Continuous Operational Log');

    const cleanName = (operatorName || 'Operator').replace(/\s+/g, '_');
    XLSX.writeFile(wb, `TVS_MHF_Roster_${cleanName}_${routeMode}_Mode.xlsx`);
  };

  // Download PDF Export
  const downloadOperatorRosterPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('TVS MOTOR COMPANY - DIGITAL MATERIAL FLOW Roster', 14, 15);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Active Shift: ${productionPlan.shift} | Operator: ${operatorName} | Target Line: ${selectedAssemblyLine}`, 14, 21);
    doc.text(`Optimization Mode: ${routeMode === 'milkrun' ? 'MILK-RUN CO-LOADING (RECOMMENDED)' : 'STANDARD PART-WISE'}`, 14, 26);

    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('8.5-Hour Operator Timetable Matrix', 14, 34);

    if (routeMode === 'milkrun') {
      autoTable(doc, {
        startY: 38,
        head: [
          ['Group Name', 'POC Drop Drop-off', 'Stores Source', 'Bins/Trip', 'Frequency', 'Shift Total']
        ],
        body: milkRunGroups.map((g) => [
          g.groupName,
          g.pocPoint,
          g.storeLocations.join(', '),
          `${g.totalTrolleys} bins`,
          'Hourly (Every Hour)',
          '8 Trips',
        ]),
        styles: { fontSize: 8, cellPadding: 4, halign: 'center' },
        headStyles: { fillColor: [30, 41, 59], textColor: [56, 189, 248], fontStyle: 'bold' },
      });
    } else {
      autoTable(doc, {
        startY: 38,
        head: [
          ['Part No', 'Pick -> Drop', 'Trips/Hr', ...shiftHours.map((h) => `Hr ${h.hourNum}`), 'Total Trips']
        ],
        body: partRosterData.map((r) => [
          r.part.partNo,
          `${r.pickStore} -> ${r.dropPoc}`,
          `${r.hourlyTrips}`,
          ...shiftHours.map(() => `${r.hourlyTrips}`),
          `${r.totalShiftTrips}`,
        ]),
        styles: { fontSize: 8, cellPadding: 4, halign: 'center' },
        headStyles: { fillColor: [15, 23, 42], textColor: [56, 189, 248], fontStyle: 'bold' },
      });
    }

    // Add Selected Hour Continuous Activity Page
    doc.addPage();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Hour ${selectedHour} Continuous Operational Log (${continuousHourActivities[selectedHour - 1]?.hourLabel})`, 14, 15);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Operator: ${operatorName} | Detailed sequence of activities for the selected hour`, 14, 21);

    autoTable(doc, {
      startY: 25,
      head: [
        ['Start Time', 'End Time', 'Duration', 'Activity / Step', 'Location Visited', 'Details']
      ],
      body: (continuousHourActivities[selectedHour - 1]?.activities || []).map((act) => [
        act.startTimeStr,
        act.endTimeStr,
        `${act.durationSeconds}s`,
        act.title,
        act.location,
        act.details || '',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    });

    const cleanName = (operatorName || 'Operator').replace(/\s+/g, '_');
    doc.save(`Operator_Roster_${cleanName}_${routeMode}_${selectedAssemblyLine}.pdf`);
  };

  // Download Shift Master Log (Selected Hour) Excel
  const downloadSelectedHourExcel = (hourNum: number) => {
    const hrData = continuousHourActivities[hourNum - 1];
    if (!hrData) return;
    const wb = XLSX.utils.book_new();
    const sheetData = [
      [
        'Start Time',
        'End Time',
        'Duration (Seconds)',
        'Activity / Step',
        'Location Visited',
        'Operational Activity Detail Log',
      ],
      ...hrData.activities.map((act) => [
        act.startTimeStr,
        act.endTimeStr,
        act.durationSeconds,
        act.title,
        act.location,
        act.details || '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, `Hour ${hourNum} Log`);
    const cleanName = (operatorName || 'Operator').replace(/\s+/g, '_');
    XLSX.writeFile(wb, `TVS_MHF_MasterLog_Hr${hourNum}_${cleanName}.xlsx`);
  };

  // Download Shift Master Log (All Hours separate sheets) Excel
  const downloadAllHoursExcel = () => {
    const wb = XLSX.utils.book_new();
    continuousHourActivities.forEach((hrData) => {
      const sheetData = [
        [
          'Start Time',
          'End Time',
          'Duration (Seconds)',
          'Activity / Step',
          'Location Visited',
          'Operational Activity Detail Log',
        ],
        ...hrData.activities.map((act) => [
          act.startTimeStr,
          act.endTimeStr,
          act.durationSeconds,
          act.title,
          act.location,
          act.details || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, `Hour ${hrData.hourNum} Log`);
    });
    const cleanName = (operatorName || 'Operator').replace(/\s+/g, '_');
    XLSX.writeFile(wb, `TVS_MHF_ShiftMasterLog_All_Hours_${cleanName}.xlsx`);
  };

  // Download Shift Master Log (Selected Hour) PDF
  const downloadSelectedHourPDF = (hourNum: number) => {
    const hrData = continuousHourActivities[hourNum - 1];
    if (!hrData) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TVS MOTOR COMPANY - Shift Master Log (Hour ${hourNum})`, 14, 15);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Active Shift: ${productionPlan.shift} | Operator: ${operatorName} | Time Window: ${hrData.hourLabel}`, 14, 21);
    doc.text(`Optimization Mode: ${routeMode === 'milkrun' ? 'MILK-RUN CO-LOADING' : 'STANDARD PART-WISE'}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [
        ['Start Time', 'End Time', 'Duration', 'Activity / Step', 'Location Visited', 'Details']
      ],
      body: hrData.activities.map((act) => [
        act.startTimeStr,
        act.endTimeStr,
        `${act.durationSeconds}s`,
        act.title,
        act.location,
        act.details || '',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    });

    const cleanName = (operatorName || 'Operator').replace(/\s+/g, '_');
    doc.save(`TVS_MHF_MasterLog_Hr${hourNum}_${cleanName}.pdf`);
  };

  // Download Shift Master Log (All Hours separate pages) PDF
  const downloadAllHoursPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    continuousHourActivities.forEach((hrData, idx) => {
      if (idx > 0) {
        doc.addPage();
      }
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`TVS MOTOR COMPANY - Shift Master Log (Hour ${hrData.hourNum})`, 14, 15);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Active Shift: ${productionPlan.shift} | Operator: ${operatorName} | Time Window: ${hrData.hourLabel}`, 14, 21);
      doc.text(`Optimization Mode: ${routeMode === 'milkrun' ? 'MILK-RUN CO-LOADING' : 'STANDARD PART-WISE'}`, 14, 26);

      autoTable(doc, {
        startY: 32,
        head: [
          ['Start Time', 'End Time', 'Duration', 'Activity / Step', 'Location Visited', 'Details']
        ],
        body: hrData.activities.map((act) => [
          act.startTimeStr,
          act.endTimeStr,
          `${act.durationSeconds}s`,
          act.title,
          act.location,
          act.details || '',
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      });
    });

    const cleanName = (operatorName || 'Operator').replace(/\s+/g, '_');
    doc.save(`TVS_MHF_ShiftMasterLog_All_Hours_${cleanName}.pdf`);
  };

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="operator-management-view" className="space-y-6 font-sans">

      {/* 1. HEADER BANNER WITH SHIFT SELECTOR & DOWNLOAD BUTTONS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono uppercase tracking-wider">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Operator Shift Roster & Logistics Execution
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Optimize and visualize material transport schedules using the active TVS Motor Company plant standards
          </p>
        </div>

        {/* Controls: Shift Selector, Assembly Line & Download Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          
          {/* Shift Selector Buttons */}
          <div className="bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              SHIFT:
            </span>
            {[
              { id: 'Shift 1 (07:00 - 15:30)', label: 'Shift 1' },
              { id: 'Shift 2 (15:30 - 00:00)', label: 'Shift 2' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => updateProductionPlan({ shift: s.id as any })}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-bold text-[11px] ${
                  productionPlan.shift === s.id
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Assembly Line Filter Toggle */}
          <div className="bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              LINE:
            </span>
            {(['ALL', '1VCON300', '1VCON200', '1VCON100'] as const).map((lineCode) => (
              <button
                key={lineCode}
                onClick={() => setSelectedAssemblyLine(lineCode as any)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                  selectedAssemblyLine === lineCode
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {lineCode}
              </button>
            ))}
          </div>

          {/* Download & Upload Buttons */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowUploadEngine(!showUploadEngine)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow ${
                showUploadEngine
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white'
              }`}
              title="Toggle Multi-Excel Upload & Sheet Switcher Engine"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>UPLOAD DATASETS</span>
            </button>

            <button
              onClick={downloadOperatorRosterExcel}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow"
              title="Download Operator Roster in Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>EXCEL</span>
            </button>

            <button
              onClick={downloadOperatorRosterPDF}
              className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow"
              title="Download Operator Roster in PDF (.pdf)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* MULTI-FILE & MULTI-PAGE EXCEL OPERATOR IMPORT ENGINE */}
      {showUploadEngine && (
        <MultiExcelOperatorUpload onClose={() => setShowUploadEngine(false)} />
      )}

      {/* 2. OPERATOR DUTY PROFILE & KPI RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono text-xs">
        {/* Production Target */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block uppercase flex items-center justify-between">
            <span>Shift Target</span>
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
          </span>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400">{productionPlan.shiftPlanVehicles.toLocaleString()} Units</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Takt Time: <strong className="text-emerald-600 dark:text-emerald-400">{productionPlan.taktTimeSeconds}s</strong></span>
        </div>

        {/* Trips / Hour Required */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block uppercase flex items-center justify-between">
            <span>Trips / Hour</span>
            <Truck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          </span>
          <div className="text-lg font-black text-cyan-600 dark:text-cyan-400">{totalHourlyTrips} Trips/Hr</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Frequency: every {Math.round(60 / Math.max(1, totalHourlyTrips))} mins</span>
        </div>

        {/* Total 8-Hour Shift Trips */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block uppercase flex items-center justify-between">
            <span>Total Shift Trips</span>
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalShiftTripsCount} Trips</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Total volume: {totalShiftUnitsDelivered} Units</span>
        </div>

        {/* Total Daily Trips */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl space-y-1 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block uppercase flex items-center justify-between">
            <span>Daily Trips (2 Shifts)</span>
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </span>
          <div className="text-lg font-black text-purple-600 dark:text-purple-400">{totalDailyTripsCount} Trips</div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Planned: {(productionPlan.shiftPlanVehicles * 2).toLocaleString()} Units</span>
        </div>

        {/* Shift Workload Feasibility */}
        <div className={`p-3.5 rounded-2xl space-y-1 shadow-sm border ${
          operatorUtilizationPct > 100
            ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold block uppercase flex items-center justify-between">
            <span>Operator Workload</span>
            <Clock className={`w-3.5 h-3.5 ${operatorUtilizationPct > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
          </span>
          <div className={`text-lg font-black ${operatorUtilizationPct > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {totalShiftWorkloadMinutes}m / 480m
          </div>
          <span className={`text-[10px] font-bold block ${operatorUtilizationPct > 100 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {operatorUtilizationPct}% Workload Capacity {operatorUtilizationPct > 100 ? '(OVERLOAD)' : ''}
          </span>
        </div>
      </div>

      {/* 3. OPTIMIZATION SWITCHER & TABS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xl space-y-4">
        
        {/* Row with Tabs + Grouping Switcher */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          
          {/* Roster Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start">
            <button
              onClick={() => setRouteMode('standard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all font-mono ${
                routeMode === 'standard'
                  ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Separate Trips (Individual Parts)
            </button>
            <button
              onClick={() => setRouteMode('milkrun')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all font-mono flex items-center gap-1.5 ${
                routeMode === 'milkrun'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-300 animate-pulse" />
              Milk-Run Grouping (Co-Loaded)
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Duty Roster
            </button>

            <button
              onClick={() => setActiveTab('timetable')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'timetable'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              8.5H Timetable Grid
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Shift Master log ({activeTimelineTrips.length} Trips)
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64 self-end xl:self-auto">
            <input
              type="text"
              placeholder="Search part no, store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-3 py-1.5 pl-8 rounded-xl focus:outline-none focus:border-emerald-500 text-xs font-mono"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Optimization Savings Details Panel */}
        {routeMode === 'milkrun' && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center border border-blue-200 dark:border-blue-500/30 shrink-0">
                <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-slate-900 dark:text-white font-bold uppercase tracking-wider">Milk-Run Consolidation Live</div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">The operator groups multiple parts from adjacent stores onto a single Jumbo Trolley per trip.</div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 text-right shadow-sm shrink-0">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Trips Reduced</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                  {standardTimelineTrips.length} → {milkRunTimelineTrips.length} / Shift
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Workload</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">
                  {totalShiftWorkloadMinutes} Mins ({operatorUtilizationPct}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Active Tab View Body */}

        {/* TAB 1: DUTY ROSTER */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            {routeMode === 'milkrun' ? (
              /* Milk-Run Grouped Roster Table */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <th className="px-4 py-3">Group ID</th>
                      <th className="px-4 py-3">Consolidated Route Name</th>
                      <th className="px-4 py-3 text-center">Line Drop POC</th>
                      <th className="px-4 py-3 text-center">Source Stores</th>
                      <th className="px-4 py-3 text-right text-cyan-600 dark:text-cyan-400">Co-Loaded Bins</th>
                      <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Shift Trips (8H)</th>
                      <th className="px-4 py-3 text-right">Cycle Time</th>
                      <th className="px-4 py-3">Co-Loaded Materials Bay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {milkRunGroups.map((g, idx) => (
                      <tr key={g.groupId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{g.groupId}</td>
                        
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">{g.groupName}</div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">Mode: {g.transportMode}</span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                            {g.pocPoint}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300 font-medium">
                          {g.storeLocations.join(', ')}
                        </td>

                        <td className="px-4 py-3 text-right text-cyan-700 dark:text-cyan-400 font-extrabold text-sm bg-cyan-50/50 dark:bg-cyan-950/10">
                          {g.totalTrolleys} / 3 Bins
                        </td>

                        <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-extrabold text-sm bg-emerald-50/50 dark:bg-emerald-950/10">
                          8 Trips
                        </td>

                        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400 font-bold">
                          {g.cycleTimeMin.toFixed(1)} mins
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1 max-w-sm">
                            {g.parts.map((p) => (
                              <div key={p.part.partNo} className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px]">
                                <span className="text-slate-800 dark:text-slate-300 font-bold">{p.part.partNo}</span>
                                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px] font-sans">{p.part.description}</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{p.loadQty} bin</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Standard Part-Wise Roster Table */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Part No & Description</th>
                      <th className="px-3 py-3 text-center">Store → Line POC</th>
                      <th className="px-3 py-3 text-center">Mode & Capacity</th>
                      <th className="px-3 py-3 text-right text-cyan-600 dark:text-cyan-400">Trips / Hr</th>
                      <th className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400">Shift Trips (8H)</th>
                      <th className="px-3 py-3 text-right">Cycle Time</th>
                      <th className="px-3 py-3">Load & Delivery Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {partRosterData.map((row, idx) => (
                      <tr key={`${row.part.partNo}-${row.dropPoc}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-3 py-3 text-slate-400 dark:text-slate-500 font-bold">{idx + 1}</td>
                        
                        <td className="px-3 py-3">
                          <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{row.part.partNo}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[180px]">
                            {row.part.description}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{row.pickStore} → {row.dropPoc}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Dist: {row.distanceMeters}m</div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className="inline-block bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-[11px] font-bold">
                            {row.part.transportMode}
                          </span>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                            Cap: {row.carryingCapacity} bins ({row.binCap} qty)
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right font-black text-sm">
                          <div className="text-cyan-600 dark:text-cyan-400 font-extrabold">{row.hourlyTrips} trips/hr</div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-normal font-mono">
                            ({row.metrics.trolleyDemandPerHour.toFixed(0)} bins / {row.carryingCapacity} cap)
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400 font-black text-sm bg-emerald-50/50 dark:bg-emerald-950/20">
                          {row.totalShiftTrips} trips/shift
                        </td>

                        <td className="px-3 py-3 text-right text-amber-700 dark:text-amber-400 font-bold">
                          {row.cycleTimeMin} mins
                        </td>

                        <td className="px-3 py-3 text-[11px] font-sans">
                          <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-0.5">
                            <div className="text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span>PICK: {row.carryingCapacity} x Trolley ({row.carryingCapacity * row.binCap} Units) at {row.pickStore}</span>
                            </div>
                            <div className="text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>UNLOAD & RELOAD: Deliver at {row.dropPoc} ({row.distanceMeters}m roundtrip)</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIMETABLE GRID */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            {routeMode === 'milkrun' ? (
              /* Milk Run 8-Hour matrix */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <th className="px-3 py-3">Milk Run Route</th>
                      <th className="px-3 py-3 text-center">Stores → POCs</th>
                      <th className="px-3 py-3 text-center">Load Status</th>
                      {shiftHours.map((hr) => (
                        <th key={hr.hourNum} className="px-2 py-3 text-center bg-slate-50 dark:bg-slate-900/80 text-emerald-600 dark:text-emerald-400 font-bold min-w-[100px] border-x border-slate-200 dark:border-slate-800/40">
                          <div>Hr {hr.hourNum}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 normal-case font-medium">{hr.label}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right bg-slate-200 dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 font-black">Shift Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {milkRunGroups.map((g) => (
                      <tr key={g.groupId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                          <div>{g.groupName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">{g.transportMode}</div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{g.storeLocations.join(', ')}</span>
                          <span className="text-slate-400 dark:text-slate-500 px-1">↓</span>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{g.pocPoint}</span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-slate-950 border border-amber-200 dark:border-slate-800 text-amber-700 dark:text-amber-300 font-bold">
                            {g.totalTrolleys} Bins
                          </span>
                        </td>

                        {shiftHours.map((hr) => (
                          <td key={hr.hourNum} className="px-2 py-3 text-center bg-slate-50/50 dark:bg-slate-950/40 border-x border-slate-200 dark:border-slate-800/40">
                            <div className="bg-white dark:bg-slate-950 p-2 rounded border border-blue-200 dark:border-blue-500/30 space-y-1 shadow-2xs">
                              <span className="text-blue-600 dark:text-blue-400 font-black text-xs block">1 Trip</span>
                              <div className="text-[8px] text-slate-500 dark:text-slate-400 text-left space-y-0.5">
                                {g.parts.map((p) => (
                                  <div key={p.part.partNo} className="truncate">
                                    ● {p.part.partNo} ({p.loadQty} bin)
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        ))}

                        <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400 font-black text-base bg-slate-100 dark:bg-slate-950">
                          8 Trips
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Standard Part-wise matrix */
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <th className="px-3 py-3 min-w-[160px]">Part No</th>
                      <th className="px-3 py-3 text-center">Pick → Drop</th>
                      <th className="px-3 py-3 text-right text-cyan-600 dark:text-cyan-400">Trips/Hr</th>
                      {shiftHours.map((hr) => (
                        <th key={hr.hourNum} className="px-2 py-3 text-center bg-slate-50 dark:bg-slate-900/80 text-emerald-600 dark:text-emerald-400 font-bold min-w-[100px] border-x border-slate-200 dark:border-slate-800/40">
                          <div>Hour {hr.hourNum}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 normal-case font-medium">{hr.label}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400 font-black bg-slate-200 dark:bg-slate-950 font-mono">Total 8-Hr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {partRosterData.map((row, idx) => (
                      <tr key={`${row.part.partNo}-${row.dropPoc}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                          <div>{row.part.partNo}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">{row.part.modelNo}</div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{row.pickStore}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">↓</div>
                          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{row.dropPoc}</div>
                        </td>

                        <td className="px-3 py-3 text-right text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">
                          {row.hourlyTrips}
                        </td>

                        {shiftHours.map((hr) => (
                          <td key={hr.hourNum} className="px-2 py-3 text-center bg-slate-50/50 dark:bg-slate-950/40 border-x border-slate-200 dark:border-slate-800/40">
                            <div className="bg-white dark:bg-slate-950 px-1.5 py-1 rounded border border-emerald-200 dark:border-emerald-500/30 space-y-0.5 shadow-2xs">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs block">{row.hourlyTrips} Trips</span>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-sans">
                                {row.hourlyTrips * row.binCap} Qty
                              </span>
                            </div>
                          </td>
                        ))}

                        <td className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400 font-black text-base bg-slate-100 dark:bg-slate-950 font-mono">
                          {row.totalShiftTrips}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MASTER LOG TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-6" id="operator-continuous-timeline">
            
            {/* Header / Subtitle */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Continuous Operational Activity Tracking
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
                  Real-time hour-wise sequential timeline tracking showing precise material pickups, movement, unloading, and loading cycles in seconds.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 font-mono shadow-sm">
                  Active Mode: <strong className="text-cyan-600 dark:text-cyan-400">{routeMode.toUpperCase()}</strong>
                </span>

                {/* Master Log Hourly Download Options */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-100/60 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold px-1.5 font-mono uppercase">
                    HOURLY LOGS:
                  </span>
                  
                  {/* Current Selected Hour Downloads */}
                  <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
                    <button
                      onClick={() => downloadSelectedHourExcel(selectedHour)}
                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow"
                      title={`Download Hour ${selectedHour} Log (Excel)`}
                    >
                      <FileSpreadsheet className="w-3 h-3 text-emerald-100" />
                      <span>HR {selectedHour} (XLSX)</span>
                    </button>
                    <button
                      onClick={() => downloadSelectedHourPDF(selectedHour)}
                      className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow"
                      title={`Download Hour ${selectedHour} Log (PDF)`}
                    >
                      <FileText className="w-3 h-3 text-rose-100" />
                      <span>HR {selectedHour} (PDF)</span>
                    </button>
                  </div>

                  {/* All 8 Hours Downloads */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={downloadAllHoursExcel}
                      className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow"
                      title="Download All 8 Hours (Separate Sheets in 1 Excel File)"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-teal-100" />
                      <span>ALL HOURS (XLSX)</span>
                    </button>
                    <button
                      onClick={downloadAllHoursPDF}
                      className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow"
                      title="Download All 8 Hours (Separate Pages in 1 PDF)"
                    >
                      <FileText className="w-3 h-3 text-red-100" />
                      <span>ALL HOURS (PDF)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hour Selector Buttons */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono block">
                Select Shift Hour for Detailed Log:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {continuousHourActivities.map((hourData) => {
                  const isSelected = selectedHour === hourData.hourNum;
                  return (
                    <button
                      key={hourData.hourNum}
                      onClick={() => setSelectedHour(hourData.hourNum)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-mono shadow-sm ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-slate-800 border-emerald-500 dark:border-emerald-500 text-slate-900 dark:text-white shadow-md'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>HR {hourData.hourNum}</span>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <div className="text-[10px] font-semibold mt-1 truncate">{hourData.hourLabel.replace(' - ', '→')}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Hour Detailed Activity List */}
            <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                    LOG TIMELINE FOR HOUR {selectedHour}: <span className="text-slate-900 dark:text-white font-black">{continuousHourActivities[selectedHour - 1]?.hourLabel}</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {continuousHourActivities[selectedHour - 1]?.activities.length} consecutive steps tracked
                </div>
              </div>

              <div className="relative pl-4 sm:pl-8 space-y-6 border-l border-slate-200 dark:border-slate-800">
                {continuousHourActivities[selectedHour - 1]?.activities.map((act, index) => {
                  // Icon & Color based on activity type
                  let icon = <Package className="w-4 h-4" />;
                  let colorClass = 'bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-500 text-cyan-600 dark:text-cyan-400';
                  let typeLabel = 'Material Pickup';

                  if (act.type === 'initial') {
                    icon = <Users className="w-4 h-4" />;
                    colorClass = 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400';
                    typeLabel = 'Shift Initialization';
                  } else if (act.type === 'movement_to_poc') {
                    icon = <Truck className="w-4 h-4" />;
                    colorClass = 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-500 text-blue-600 dark:text-blue-400';
                    typeLabel = 'Stores to POC Transit';
                  } else if (act.type === 'unloading') {
                    icon = <Layers className="w-4 h-4" />;
                    colorClass = 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-500 text-amber-600 dark:text-amber-400';
                    typeLabel = 'Material Unloading';
                  } else if (act.type === 'empty_loading') {
                    icon = <RefreshCw className="w-4 h-4" />;
                    colorClass = 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-500 text-purple-600 dark:text-purple-400';
                    typeLabel = 'Empty Trolley Loading';
                  } else if (act.type === 'movement_to_stores') {
                    icon = <ArrowRight className="w-4 h-4" />;
                    colorClass = 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400';
                    typeLabel = 'POC to Stores Transit';
                  } else if (act.type === 'standby') {
                    icon = <Clock className="w-4 h-4" />;
                    colorClass = 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400';
                    typeLabel = 'Standby / Inventory Check';
                  }

                  return (
                    <div key={`${act.id}-${index}`} className="relative group">
                      
                      {/* Timeline node circle */}
                      <div className={`absolute -left-[25px] sm:-left-[41px] top-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full border flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${colorClass}`}>
                        <span className="scale-75 sm:scale-90">{icon}</span>
                      </div>

                      {/* Content Card */}
                      <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                        
                        {/* Title and Descriptions */}
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                              {typeLabel}
                            </span>
                            {act.meta?.countNum && (
                              <span className="text-[10px] font-bold bg-emerald-100/50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 px-1.5 py-0.5 rounded">
                                Pickup {act.meta.countNum} of 3
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{act.title}</span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed mt-1">
                            {act.details}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-sans">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                              Location: <strong className="text-slate-700 dark:text-slate-200">{act.location}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                              Duration: <strong className="text-cyan-600 dark:text-cyan-400">{act.durationSeconds}s</strong>
                            </span>
                          </div>
                        </div>

                        {/* Timing Block (Right Side) */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2.5 rounded-xl text-right shrink-0 min-w-[150px] space-y-1 shadow-inner">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Timestamps:</div>
                          <div className="text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 flex items-center justify-end gap-1">
                            <span>{act.startTimeStr.split(' ')[0]}</span>
                            <span className="text-slate-400 dark:text-slate-500 font-normal">→</span>
                            <span>{act.endTimeStr.split(' ')[0]}</span>
                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-normal">{act.startTimeStr.split(' ')[1]}</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-sans">
                            Total: <strong className="text-emerald-600 dark:text-emerald-400">{Math.round(act.durationSeconds / 60 * 10) / 10} min</strong>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
};
