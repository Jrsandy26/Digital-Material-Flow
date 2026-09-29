import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Truck,
  Store,
  MapPin,
  Layers,
  ArrowRight,
  Filter,
  Play,
  Pause,
  Package,
  Search,
  Route,
  Info,
  Building2,
  Navigation,
  Compass,
  AlertTriangle,
  Zap,
  Activity,
  CheckCircle2,
  Workflow,
} from 'lucide-react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';
import { PartMaster } from '../../types/manufacturing';
import { getMilkRunGroups } from '../../utils/calculations';
import { SWCTSimulationSyncState } from '../features/dashboard/SWCTTripSimulationDemonstrator';

export interface FactoryMapProps {
  linkedSwctState?: SWCTSimulationSyncState | null;
  className?: string;
}

export const FactoryMap: React.FC<FactoryMapProps> = ({ linkedSwctState, className = '' }) => {
  const {
    parts,
    inventoryStates,
    selectedAssemblyLine,
    setSelectedAssemblyLine,
    productionPlan,
    modeConfigs,
    operatorName
  } = useMaterialFlow();
  
  // Simulation and Selection States
  const [simulationMode, setSimulationMode] = useState<'LINKED_SWCT' | 'GROUPED' | 'STANDARD'>('LINKED_SWCT');
  const [hasUserManuallyChosenMode, setHasUserManuallyChosenMode] = useState<boolean>(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedPartNo, setSelectedPartNo] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<'ALL' | 'PL' | 'ML'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnimating, setIsAnimating] = useState(true);

  // Auto-switch to LINKED_SWCT whenever linked SWCT state is provided (unless user manually chose another tab)
  useEffect(() => {
    if (linkedSwctState && !hasUserManuallyChosenMode) {
      setSimulationMode('LINKED_SWCT');
    }
  }, [linkedSwctState, hasUserManuallyChosenMode]);

  // Filter parts by selected Assembly Line, Track & Search Query
  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      const matchesSearch =
        part.partNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.storeLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.pocPoint.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Track Filter (PL vs ML)
      const pocUpper = part.pocPoint.toUpperCase();
      const isPL = pocUpper.startsWith('PL') || pocUpper.includes('PRE');
      const isML = pocUpper.startsWith('ML') || pocUpper.includes('MAIN');

      if (selectedTrack === 'PL' && !isPL) return false;
      if (selectedTrack === 'ML' && !isML) return false;

      return true;
    });
  }, [parts, searchQuery, selectedTrack]);

  // Active highlighted part (Standard mode fallback)
  const activePart = useMemo(() => {
    if (!selectedPartNo) return filteredParts[0] || parts[0] || null;
    return parts.find((p) => p.partNo === selectedPartNo) || filteredParts[0] || null;
  }, [selectedPartNo, filteredParts, parts]);

  // Generate milk-run groups dynamically
  const milkRunGroups = useMemo(() => {
    return getMilkRunGroups(parts, productionPlan, modeConfigs, inventoryStates);
  }, [parts, productionPlan, modeConfigs, inventoryStates]);

  // Find the currently selected milk-run group
  const activeGroup = useMemo(() => {
    if (milkRunGroups.length === 0) return null;
    if (!selectedGroupId) return milkRunGroups[0];
    return milkRunGroups.find((g) => g.groupId === selectedGroupId) || milkRunGroups[0];
  }, [milkRunGroups, selectedGroupId]);

  // Helper for line station limits
  const getLineMaxStations = (lineCode: string) => {
    if (lineCode === '1VCON300') return { plMax: 31, mlMax: 37 };
    if (lineCode === '1VCON200') return { plMax: 31, mlMax: 37 };
    return { plMax: 29, mlMax: 48 }; // 1VCON100
  };

  // Helper for track bar Y position - Fixed permanently to real physical shopfloor coordinates
  const getTrackY = (lineCode: string, track: 'PL' | 'ML') => {
    if (lineCode === '1VCON300') {
      return track === 'ML' ? 100 : 145;
    } else if (lineCode === '1VCON200') {
      return track === 'ML' ? 250 : 295;
    } else {
      return track === 'ML' ? 400 : 445; // 1VCON100
    }
  };

  const getTrackYCenter = (lineCode: string, track: 'PL' | 'ML') => {
    return getTrackY(lineCode, track) + 12.5;
  };

  // Assembly Lines structure with PL and ML tracks (Fixed Physical Layout)
  const allLineConfigs = [
    { code: '1VCON300', label: '1VCON300 ASSEMBLY LINE', mlRange: 'ML-01 → ML-37', plRange: 'PL-31 → PL-01', y: 120, color: '#a855f7' },
    { code: '1VCON200', label: '1VCON200 ASSEMBLY LINE', plRange: 'PL-31 → PL-01', mlRange: 'ML-01 → ML-37', y: 270, color: '#06b6d4' },
    { code: '1VCON100', label: '1VCON100 ASSEMBLY LINE', plRange: 'PL-29 → PL-01', mlRange: 'ML-01 → ML-48', y: 420, color: '#10b981' },
  ];

  // All lines remain fixed at their designated plant positions
  const lineConfigsToRender = allLineConfigs;

  // Map POC points to Y & X coordinates on the Shop Floor
  // CRITICAL FIX: Group strictly by `lineCode` and `pocPoint` to completely eliminate duplicate "fake" stations
  const pocCoordinates = useMemo(() => {
    const coords: Record<string, { x: number; y: number; line: string; track: 'PL' | 'ML'; pocPoint: string; parts: string[] }> = {};

    parts.forEach((p) => {
      const poc = p.pocPoint.toUpperCase();
      const isML = poc.startsWith('ML') || poc.includes('MAIN');
      const track: 'PL' | 'ML' = isML ? 'ML' : 'PL';
      const numMatch = poc.match(/\d+/);
      const stationNum = numMatch ? parseInt(numMatch[0], 10) : 1;

      let lineCode = '1VCON100';
      if (p.assemblyLine) {
        lineCode = p.assemblyLine;
      } else if (poc.includes('300') || poc.includes('CON300')) {
        lineCode = '1VCON300';
      } else if (poc.includes('200') || poc.includes('CON200')) {
        lineCode = '1VCON200';
      } else {
        lineCode = '1VCON100';
      }

      const key = `${lineCode}-${p.pocPoint}`;

      if (!coords[key]) {
        const { plMax, mlMax } = getLineMaxStations(lineCode);
        let progress = 0;
        if (isML) {
          progress = Math.min(1, Math.max(0, (stationNum - 1) / (mlMax - 1 || 1)));
        } else {
          progress = Math.min(1, Math.max(0, (plMax - stationNum) / (plMax - 1 || 1)));
        }

        const x = 415 + Math.round(progress * 510);
        const y = getTrackYCenter(lineCode, track);

        coords[key] = {
          x,
          y,
          line: lineCode,
          track,
          pocPoint: p.pocPoint,
          parts: [p.partNo]
        };
      } else {
        if (!coords[key].parts.includes(p.partNo)) {
          coords[key].parts.push(p.partNo);
        }
      }
    });

    return coords;
  }, [parts]);

  // Stations visited by the active linked SWCT trip
  const linkedTripStations = useMemo(() => {
    if (!linkedSwctState?.activeTrip) return [];
    const stationsList: { pocPoint: string; coord: { x: number; y: number; line: string; track: 'PL' | 'ML'; pocPoint: string; parts: string[] } }[] = [];
    
    linkedSwctState.activeTrip.primaryParts.forEach((part) => {
      const poc = part.pocPoint.toUpperCase();
      let lineCode = '1VCON100';
      if (part.assemblyLine) {
        lineCode = part.assemblyLine;
      } else if (poc.includes('300') || poc.includes('CON300')) {
        lineCode = '1VCON300';
      } else if (poc.includes('200') || poc.includes('CON200')) {
        lineCode = '1VCON200';
      } else {
        lineCode = '1VCON100';
      }

      const key = `${lineCode}-${part.pocPoint}`;
      let coord = pocCoordinates[key];
      if (!coord) {
        const isML = poc.startsWith('ML') || poc.includes('MAIN');
        const numMatch = poc.match(/\d+/);
        const stationNum = numMatch ? parseInt(numMatch[0], 10) : 1;
        const { plMax, mlMax } = getLineMaxStations(lineCode);
        let progress = 0;
        if (isML) {
          progress = Math.min(1, Math.max(0, (stationNum - 1) / (mlMax - 1 || 1)));
        } else {
          progress = Math.min(1, Math.max(0, (plMax - stationNum) / (plMax - 1 || 1)));
        }
        const xPos = 415 + Math.round(progress * 510);
        coord = {
          x: Math.round(xPos),
          y: getTrackYCenter(lineCode, isML ? 'ML' : 'PL'),
          line: lineCode,
          track: isML ? 'ML' : 'PL',
          pocPoint: part.pocPoint,
          parts: [part.partNo],
        };
      }
      if (!stationsList.some((s) => s.pocPoint === part.pocPoint && s.coord.line === lineCode)) {
        stationsList.push({ pocPoint: part.pocPoint, coord });
      }
    });

    return stationsList;
  }, [linkedSwctState?.activeTrip, pocCoordinates]);

  // Synchronized path string for linked SWCT simulation
  const linkedPathD = useMemo(() => {
    const startX = 85;
    const startY = 52;
    const gangwayX = 309;

    if (linkedTripStations.length === 0) {
      return `M ${startX} ${startY} L ${gangwayX} ${startY}`;
    }

    let pathString = `M ${startX} ${startY} L ${gangwayX} ${startY}`;

    linkedTripStations.forEach(({ coord }) => {
      const targetY = coord.y;
      const targetX = coord.x - 35;
      pathString += ` L ${gangwayX} ${targetY} L ${targetX} ${targetY} L ${gangwayX} ${targetY}`;
    });

    pathString += ` L ${gangwayX} ${startY} L ${startX} ${startY}`;
    return pathString;
  }, [linkedTripStations]);

  // Synchronized real-time physical vehicle position on the map
  const linkedVehiclePos = useMemo(() => {
    const startX = 85;
    const startY = 52;
    const gangwayX = 309;

    if (!linkedSwctState || !linkedSwctState.activeTrip || !linkedSwctState.activeStage) {
      return { x: startX, y: startY, label: 'Stores Hub', isMoving: false };
    }

    const stage = linkedSwctState.activeStage;
    const pct = Math.min(100, Math.max(0, linkedSwctState.stageProgressPercent || 0)) / 100;
    const st1 = linkedTripStations[0]?.coord;
    const st2 = linkedTripStations[1]?.coord || st1;
    const targetX1 = st1 ? st1.x - 35 : 450;
    const targetY1 = st1 ? st1.y : 280;
    const targetX2 = st2 ? st2.x - 35 : 650;
    const targetY2 = st2 ? st2.y : 280;

    switch (stage.stageType) {
      case 'STORE_LOAD':
        return { x: startX, y: startY, label: 'Stores Picking' };

      case 'TRANSIT_OUT': {
        if (pct < 0.25) {
          const subPct = pct / 0.25;
          return {
            x: startX + (gangwayX - startX) * subPct,
            y: startY,
            label: 'Transit Corridor',
          };
        } else if (pct < 0.75) {
          const subPct = (pct - 0.25) / 0.5;
          return {
            x: gangwayX,
            y: startY + (targetY1 - startY) * subPct,
            label: 'Aisle Movement',
          };
        } else {
          const subPct = (pct - 0.75) / 0.25;
          return {
            x: gangwayX + (targetX1 - gangwayX) * subPct,
            y: targetY1,
            label: `Approaching ${st1?.pocPoint || 'POC-1'}`,
          };
        }
      }

      case 'POC_DELIVERY':
        return { x: targetX1, y: targetY1, label: `Delivering @ ${st1?.pocPoint || 'POC-1'}` };

      case 'TRANSIT_INTER': {
        if (pct < 0.3) {
          const subPct = pct / 0.3;
          return {
            x: targetX1 + (gangwayX - targetX1) * subPct,
            y: targetY1,
            label: 'Aisle Egress',
          };
        } else if (pct < 0.7) {
          const subPct = (pct - 0.3) / 0.4;
          return {
            x: gangwayX,
            y: targetY1 + (targetY2 - targetY1) * subPct,
            label: 'Transfer Gangway',
          };
        } else {
          const subPct = (pct - 0.7) / 0.3;
          return {
            x: gangwayX + (targetX2 - gangwayX) * subPct,
            y: targetY2,
            label: `Approaching ${st2?.pocPoint || 'POC-2'}`,
          };
        }
      }

      case 'POC_DELIVERY_2':
        return { x: targetX2, y: targetY2, label: `Delivering @ ${st2?.pocPoint || 'POC-2'}` };

      case 'TRANSIT_RETURN': {
        const lastX = linkedTripStations.length > 1 ? targetX2 : targetX1;
        const lastY = linkedTripStations.length > 1 ? targetY2 : targetY1;
        if (pct < 0.3) {
          const subPct = pct / 0.3;
          return {
            x: lastX + (gangwayX - lastX) * subPct,
            y: lastY,
            label: 'Return Aisle',
          };
        } else if (pct < 0.75) {
          const subPct = (pct - 0.3) / 0.45;
          return {
            x: gangwayX,
            y: lastY + (startY - lastY) * subPct,
            label: 'Return Gangway',
          };
        } else {
          const subPct = (pct - 0.75) / 0.25;
          return {
            x: gangwayX + (startX - gangwayX) * subPct,
            y: startY,
            label: 'Return to Stores',
          };
        }
      }

      case 'STORE_UNLOAD':
      default:
        return { x: startX, y: startY, label: 'Stores Parking / Empty Drop' };
    }
  }, [linkedSwctState, linkedTripStations]);

  // Unique list of active stations visited by the selected milk-run group
  const activeGroupStations = useMemo(() => {
    if (!activeGroup) return [];
    const stationsList: { pocPoint: string; coord: { x: number; y: number; line: string; track: 'PL' | 'ML'; pocPoint: string; parts: string[] } }[] = [];
    
    // Sort parts to optimize physical flow order along the line
    const sortedGroupParts = [...activeGroup.parts].sort((a, b) => {
      const pocA = a.part.pocPoint.match(/\d+/);
      const pocB = b.part.pocPoint.match(/\d+/);
      const numA = pocA ? parseInt(pocA[0], 10) : 0;
      const numB = pocB ? parseInt(pocB[0], 10) : 0;
      return numA - numB;
    });

    sortedGroupParts.forEach(({ part }) => {
      const poc = part.pocPoint.toUpperCase();
      let lineCode = '1VCON100';
      if (part.assemblyLine) {
        lineCode = part.assemblyLine;
      } else if (poc.includes('300') || poc.includes('CON300')) {
        lineCode = '1VCON300';
      } else if (poc.includes('200') || poc.includes('CON200')) {
        lineCode = '1VCON200';
      } else {
        lineCode = '1VCON100';
      }
      const key = `${lineCode}-${part.pocPoint}`;
      let coord = pocCoordinates[key];
      if (!coord) {
        const allCoords = Object.values(pocCoordinates) as { x: number; y: number; line: string; track: 'PL' | 'ML'; pocPoint: string; parts: string[] }[];
        coord = allCoords.find(
          (c) => c.pocPoint === part.pocPoint && (selectedAssemblyLine === 'ALL' || c.line === selectedAssemblyLine)
        );
      }
      if (!coord) {
        const isML = poc.startsWith('ML') || poc.includes('MAIN');
        const numMatch = poc.match(/\d+/);
        const stationNum = numMatch ? parseInt(numMatch[0], 10) : 1;
        const { plMax, mlMax } = getLineMaxStations(lineCode);
        const progress = isML
          ? Math.min(1, Math.max(0, (stationNum - 1) / (mlMax - 1 || 1)))
          : Math.min(1, Math.max(0, (plMax - stationNum) / (plMax - 1 || 1)));
        const xPos = 415 + Math.round(progress * 510);
        coord = {
          x: Math.round(xPos),
          y: getTrackYCenter(lineCode, isML ? 'ML' : 'PL'),
          line: lineCode,
          track: isML ? 'ML' : 'PL',
          pocPoint: part.pocPoint,
          parts: [part.partNo],
        };
      }
      if (coord && !stationsList.some((s) => s.pocPoint === part.pocPoint && s.coord.line === lineCode)) {
        stationsList.push({ pocPoint: part.pocPoint, coord });
      }
    });
    return stationsList;
  }, [activeGroup, pocCoordinates, selectedAssemblyLine]);

  // Combined path string for the multi-stop group delivery (Perfect transit loop!)
  const groupPathD = useMemo(() => {
    const startX = 85;
    const startY = 52;
    const gangwayX = 309;

    if (activeGroupStations.length === 0) {
      return `M ${startX} ${startY} L ${gangwayX} ${startY}`;
    }

    let pathString = `M ${startX} ${startY} L ${gangwayX} ${startY}`;

    // Travel to each station in sequence: corridor -> station -> back to corridor
    activeGroupStations.forEach(({ coord }) => {
      const targetY = coord.y;
      const targetX = coord.x - 30;
      pathString += ` L ${gangwayX} ${targetY} L ${targetX} ${targetY} L ${gangwayX} ${targetY}`;
    });

    // Finally, return safely back to the Stores Hub
    pathString += ` L ${gangwayX} ${startY} L ${startX} ${startY}`;
    return pathString;
  }, [activeGroupStations]);

  // Selected single-stop part route path (Standard mode)
  const singlePathD = useMemo(() => {
    if (!activePart) return '';
    const poc = activePart.pocPoint.toUpperCase();
    let lineCode = '1VCON100';
    if (activePart.assemblyLine) {
      lineCode = activePart.assemblyLine;
    } else if (poc.includes('300') || poc.includes('CON300')) {
      lineCode = '1VCON300';
    } else if (poc.includes('200') || poc.includes('CON200')) {
      lineCode = '1VCON200';
    } else {
      lineCode = '1VCON100';
    }
    let coord = pocCoordinates[`${lineCode}-${activePart.pocPoint}`];
    if (!coord) {
      const allCoords = Object.values(pocCoordinates) as { x: number; y: number; line: string; track: 'PL' | 'ML'; pocPoint: string; parts: string[] }[];
      coord = allCoords.find(
        (c) => c.pocPoint === activePart.pocPoint && (selectedAssemblyLine === 'ALL' || c.line === selectedAssemblyLine)
      );
    }
    if (!coord) {
      const isML = poc.startsWith('ML') || poc.includes('MAIN');
      const numMatch = poc.match(/\d+/);
      const stationNum = numMatch ? parseInt(numMatch[0], 10) : 1;
      const { plMax, mlMax } = getLineMaxStations(lineCode);
      const progress = isML
        ? Math.min(1, Math.max(0, (stationNum - 1) / (mlMax - 1 || 1)))
        : Math.min(1, Math.max(0, (plMax - stationNum) / (plMax - 1 || 1)));
      const xPos = 415 + Math.round(progress * 510);
      coord = {
        x: Math.round(xPos),
        y: getTrackYCenter(lineCode, isML ? 'ML' : 'PL'),
        line: lineCode,
        track: isML ? 'ML' : 'PL',
        pocPoint: activePart.pocPoint,
        parts: [activePart.partNo],
      };
    }
    if (!coord) return '';

    const startX = 85;
    const startY = 52;
    const gangwayX = 309;
    const targetY = coord.y;
    const targetX = coord.x - 30;

    return `M ${startX} ${startY} L ${gangwayX} ${startY} L ${gangwayX} ${targetY} L ${targetX} ${targetY} L ${gangwayX} ${targetY} L ${gangwayX} ${startY} L ${startX} ${startY}`;
  }, [activePart, pocCoordinates, selectedAssemblyLine]);

  // Compute travel paths list originating from Central Store (Only for standard mode reference)
  const travelPaths = useMemo(() => {
    return filteredParts.map((p, idx) => {
      return {
        id: `path-${p.partNo}-${idx}`,
        partNo: p.partNo,
        description: p.description,
        modelNo: p.modelNo,
        assemblyLine: p.assemblyLine,
        storeLocation: p.storeLocation || 'Main Store (Top-Left)',
        pocPoint: p.pocPoint || 'PL-01',
        distanceMeters: p.loadedDistanceMeters || 194,
        transportMode: p.transportMode,
        binCapacity: p.binCapacity,
        isSelected: activePart?.partNo === p.partNo,
      };
    });
  }, [filteredParts, activePart]);

  return (
    <div id="factory-material-flow-map" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl space-y-4 font-sans text-slate-800 dark:text-slate-100">
      
      {/* 1. MAP HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono uppercase tracking-wider">
            <Route className="w-5 h-5 text-emerald-400" />
            Central Store (Top-Left Hub) & Line Feeding Flow Map
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store situated at Top-Left dispatching to PL Lines (PL-01 to PL-29) and ML Lines (ML-01 to ML-48) across 1VCON100, 200, 300
          </p>
        </div>

        {/* Assembly Line & Track Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Playback & Speed Controls */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                if (linkedSwctState?.onTogglePlay) {
                  linkedSwctState.onTogglePlay();
                } else {
                  setIsAnimating(!isAnimating);
                }
              }}
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                (linkedSwctState ? linkedSwctState.isSimPlaying : isAnimating)
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={linkedSwctState ? (linkedSwctState.isSimPlaying ? 'Pause Simulation' : 'Play Simulation') : isAnimating ? 'Pause Simulation' : 'Play Simulation'}
            >
              {(linkedSwctState ? linkedSwctState.isSimPlaying : isAnimating) ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{(linkedSwctState ? linkedSwctState.isSimPlaying : isAnimating) ? 'Playing' : 'Paused'}</span>
            </button>

            {/* Speed Multipliers */}
            {([1, 2, 5, 10] as const).map((spd) => {
              const isActiveSpeed = linkedSwctState ? linkedSwctState.simSpeed === spd : spd === 1;
              return (
                <button
                  key={spd}
                  onClick={() => {
                    if (linkedSwctState?.onSetSpeed) {
                      linkedSwctState.onSetSpeed(spd);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                    isActiveSpeed
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              );
            })}
          </div>

          {/* Track Filter */}
          <div className="bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1.5">TRACK:</span>
            {(['ALL', 'PL', 'ML'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTrack(t)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-bold text-[11px] ${
                  selectedTrack === t ? 'bg-cyan-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'ALL' ? 'ALL TRACKS' : t === 'PL' ? 'PL (01-29)' : 'ML (01-48)'}
              </button>
            ))}
          </div>

          {/* Assembly Line Filter */}
          <div className="bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              LINE:
            </span>
            {(['ALL', '1VCON300', '1VCON200', '1VCON100'] as const).map((lineCode) => (
              <button
                key={lineCode}
                onClick={() => setSelectedAssemblyLine(lineCode as any)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-bold text-[11px] ${
                  selectedAssemblyLine === lineCode
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {lineCode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1.5 SIMULATION MODE TOGGLE (LINKED SWCT VS GROUPED VS PART-WISE) */}
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div>
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Workflow className="w-4 h-4 text-purple-500" />
            Material Flow Line Feeding Engine
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
            {simulationMode === 'LINKED_SWCT'
              ? 'Synchronized directly with the SWCT Standard Work Trip simulation execution above.'
              : simulationMode === 'GROUPED'
              ? 'Multi-stop grouped milk-run loops across line-side POC stations.'
              : 'Isolated single-part dispatch trajectory from Central Store.'}
          </span>
        </div>
        <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-800 flex-wrap gap-1">
          {linkedSwctState && (
            <button
              onClick={() => {
                setHasUserManuallyChosenMode(false);
                setSimulationMode('LINKED_SWCT');
              }}
              className={`px-3 py-1.5 rounded font-bold text-[11px] cursor-pointer transition-all flex items-center gap-1.5 ${
                simulationMode === 'LINKED_SWCT'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span>Linked SWCT Simulation</span>
            </button>
          )}
          <button
            onClick={() => {
              setHasUserManuallyChosenMode(true);
              setSimulationMode('GROUPED');
              if (milkRunGroups.length > 0 && !selectedGroupId) {
                setSelectedGroupId(milkRunGroups[0].groupId);
              }
            }}
            className={`px-3 py-1.5 rounded font-bold text-[11px] cursor-pointer transition-all ${
              simulationMode === 'GROUPED'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Grouped Milk-Runs
          </button>
          <button
            onClick={() => {
              setHasUserManuallyChosenMode(true);
              setSimulationMode('STANDARD');
            }}
            className={`px-3 py-1.5 rounded font-bold text-[11px] cursor-pointer transition-all ${
              simulationMode === 'STANDARD'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Isolated Part-wise Paths
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC DROPDOWN SELECTOR BAR */}
      <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        {simulationMode === 'LINKED_SWCT' && linkedSwctState ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 shrink-0">
              <Zap className="w-4 h-4 text-purple-500" />
              SELECT SWCT TRIP:
            </span>
            <select
              value={linkedSwctState.activeTripIndex}
              onChange={(e) => linkedSwctState.onSelectTrip?.(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500 w-full max-w-xl text-xs cursor-pointer shadow-sm"
            >
              {(linkedSwctState.allTrips && linkedSwctState.allTrips.length > 0
                ? linkedSwctState.allTrips
                : [linkedSwctState.activeTrip]
              ).map((t, idx) => (
                <option key={`${t.tripCode}-${idx}`} value={idx} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
                  Trip {t.tripNumber}: {t.tripCode} ({t.scheduledStartTime} - {t.scheduledEndTime}) — {t.primaryParts.map((p) => p.partNo).join(' + ')} [{t.primaryParts.map((p) => p.pocPoint).join(' & ')}]
                </option>
              ))}
            </select>
            <span className="text-[10px] px-2 py-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold shrink-0">
              {linkedSwctState.isSimPlaying ? `LIVE ${linkedSwctState.simSpeed}x` : 'PAUSED'}
            </span>
          </div>
        ) : simulationMode === 'GROUPED' ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 shrink-0">
              <Truck className="w-4 h-4 text-emerald-400" />
              SELECT TRIP (MILK-RUN):
            </span>
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 w-full max-w-xl text-xs cursor-pointer"
            >
              {milkRunGroups.map((mr) => (
                <option key={mr.groupId} value={mr.groupId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {mr.groupId} ({mr.transportMode}) — carrying {mr.parts.map((p) => `${p.part.partNo} x${p.loadQty}`).join(', ')}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1 shrink-0">
              <Package className="w-4 h-4 text-amber-500" />
              SELECT PART ROUTE:
            </span>
            <select
              value={activePart?.partNo || ''}
              onChange={(e) => setSelectedPartNo(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-amber-600 dark:text-amber-400 font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 w-full max-w-xl text-xs cursor-pointer"
            >
              {filteredParts.map((p, idx) => (
                <option key={`${p.partNo}-${p.pocPoint}-${idx}`} value={p.partNo} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {p.partNo} - {p.description} (Store Top-Left → {p.pocPoint})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="relative w-full md:w-60">
          <input
            type="text"
            placeholder="Search Store / POC / Part..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white px-3 py-1.5 pl-8 rounded-xl focus:outline-none focus:border-emerald-500 text-xs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Active Route Summary Bar */}
      {simulationMode === 'LINKED_SWCT' && linkedSwctState ? (
        <div className="bg-slate-900/95 border border-purple-500/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xl text-white">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-purple-600 text-white font-extrabold text-[10px] uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-300" />
              SWCT LINE FEEDING SYNC
            </span>
            <span className="text-white font-black text-sm">{linkedSwctState.activeTrip.tripCode}</span>
            <span className="text-purple-300 text-xs">
              ({linkedSwctState.activeTrip.scheduledStartTime} - {linkedSwctState.activeTrip.scheduledEndTime})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <div>
              <span className="text-slate-400">Current Stage: </span>
              <strong className="text-emerald-400 font-bold">
                0{linkedSwctState.activeStage.stepNumber}. {linkedSwctState.activeStage.title}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Location: </span>
              <strong className="text-cyan-400 font-bold">{linkedSwctState.activeStage.location}</strong>
            </div>
            <div>
              <span className="text-slate-400">Active Load: </span>
              <strong className="text-indigo-300 font-bold">
                {linkedSwctState.activeTrip.primaryParts.map((p) => p.partNo).join(' + ')}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Progress: </span>
              <strong className="text-amber-400 font-bold">{linkedSwctState.stageProgressPercent}%</strong>
            </div>
          </div>
        </div>
      ) : simulationMode === 'GROUPED' && activeGroup ? (
        <div className="bg-slate-50 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-extrabold border border-emerald-250 dark:border-emerald-500/30 text-[10px] uppercase">
              Grouped Milk-Run
            </span>
            <span className="text-slate-900 dark:text-white font-extrabold text-sm">{activeGroup.groupId}</span>
            <span className="text-slate-600 dark:text-slate-300 text-xs font-sans">({activeGroup.routeName})</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Assigned Operator: </span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{operatorName || activeGroup.assignedOperator}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Trolley Co-Load: </span>
              <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{activeGroup.parts.reduce((sum, p) => sum + p.loadQty, 0)} Bins</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Transport: </span>
              <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{activeGroup.transportMode}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Cycle Freq: </span>
              <strong className="text-amber-600 dark:text-amber-400 font-black">{activeGroup.freqMins || 20} min</strong>
            </div>
          </div>
        </div>
      ) : (
        activePart && (
          <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-250 dark:border-slate-700/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-md">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 font-extrabold border border-amber-250 dark:border-amber-500/30 text-[10px] uppercase">
                Isolated Part Path
              </span>
              <span className="text-slate-900 dark:text-white font-extrabold text-sm">{activePart.partNo}</span>
              <span className="text-slate-600 dark:text-slate-300 text-xs font-sans">({activePart.description})</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Target Station: </span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{activePart.pocPoint}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Mode: </span>
                <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{activePart.transportMode}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Trip Distance: </span>
                <strong className="text-amber-600 dark:text-amber-400 font-black">{activePart.loadedDistanceMeters || 194} Meters</strong>
              </div>
            </div>
          </div>
        )
      )}

      {/* 3. DYNAMIC SVG FACTORY MAP */}
      <div className="relative bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-2 min-h-[580px]">
        <svg viewBox="0 0 1000 600" className="w-full h-auto select-none">
          <defs>
            {/* Glow Filters */}
            <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowRed" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Path Gradient */}
            <linearGradient id="dispatchPathGradTL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Road Asphalt Gradients */}
            <linearGradient id="roadGradH" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#05120d" />
              <stop offset="50%" stopColor="#071811" />
              <stop offset="100%" stopColor="#05120d" />
            </linearGradient>
            <linearGradient id="roadGradV" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#071811" />
              <stop offset="50%" stopColor="#040e0a" />
              <stop offset="100%" stopColor="#030806" />
            </linearGradient>

            {/* Safety Hazard Warning Stripe Pattern */}
            <pattern id="hazardStripe" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <rect width="6" height="12" fill="#eab308" />
              <rect x="6" width="6" height="12" fill="#090d0b" />
            </pattern>

            {/* Plant Grid Pattern */}
            <pattern id="plantGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width="1000" height="600" fill="url(#plantGrid)" />

          {/* ------------------------------------------------------------------ */}
          {/* COMPLETE MASTER ROAD NETWORK & LOGISTICS HIGHWAYS                  */}
          {/* ------------------------------------------------------------------ */}
          
          {/* 1. PRIMARY LOGISTICS HIGHWAY (North Corridor + Central Spine - Unified Seamless Road) */}
          <g id="master-road-network">
            {/* Master Seamless Paved Road Surface */}
            <path
              d="M 148 32 L 328 32 L 328 585 L 290 585 L 290 72 L 148 72 Z"
              fill="url(#roadGradH)"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* Stores Hub Departure / Return Apron with Safety Hazard Striping */}
            <rect x="135" y="32" width="13" height="40" fill="url(#hazardStripe)" stroke="#10b981" strokeWidth="1.5" />
            <line x1="148" y1="32" x2="148" y2="72" stroke="#ffffff" strokeWidth="2.5" />

            {/* North Corridor Dashed Yellow Centerline */}
            <line x1="152" y1="52" x2="309" y2="52" stroke="#facc15" strokeWidth="1.5" strokeDasharray="7 5" />

            {/* Intersection Turn Guidance Curve into Vertical Spine */}
            <path d="M 280 52 Q 309 52 309 80" fill="none" stroke="#facc15" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />

            {/* Vertical Spine Dashed Yellow Centerline */}
            <line x1="309" y1="72" x2="309" y2="585" stroke="#facc15" strokeWidth="1.5" strokeDasharray="7 5" />

            {/* Directional Traffic Flow Chevron Arrows (Outbound Supply: East then South) */}
            <g fill="#10b981" opacity="0.75">
              {/* Eastbound on North Corridor */}
              <polygon points="195,49 202,52 195,55 197,52" />
              <polygon points="245,49 252,52 245,55 247,52" />
              
              {/* Southbound on Spine (Left Lane at x=299) */}
              <polygon points="296,115 299,122 302,115 299,117" />
              <polygon points="296,215 299,222 302,215 299,217" />
              <polygon points="296,355 299,362 302,355 299,357" />
              <polygon points="296,495 299,502 302,495 299,497" />
            </g>

            {/* Directional Traffic Flow Chevron Arrows (Inbound Return: North on Right Lane at x=319) */}
            <g fill="#38bdf8" opacity="0.75">
              <polygon points="316,502 319,495 322,502 319,500" />
              <polygon points="316,362 319,355 322,362 319,360" />
              <polygon points="316,222 319,215 322,222 319,220" />
              <polygon points="316,122 319,115 322,122 319,120" />
            </g>

            {/* Road Surface Street Labels */}
            <text
              x="215"
              y="44"
              fill="#34d399"
              fontSize="7.5"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="sans-serif"
              letterSpacing="1.2"
              opacity="0.9"
            >
              NORTH LOGISTICS CORRIDOR
            </text>

            <text
              x="309"
              y="310"
              fill="#ffffff"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="sans-serif"
              transform="rotate(-90 309 310)"
              letterSpacing="2"
              stroke="#030806"
              strokeWidth="3"
              paintOrder="stroke"
              strokeLinejoin="round"
              opacity="0.9"
            >
              MAIN LOGISTICS SPINE (DUAL-LANE)
            </text>
          </g>

          {/* ------------------------------------------------------------------ */}
          {/* 2. ASSEMBLY LINES, FEEDER ROADWAYS & LINE-SIDE DELIVERY AISLES      */}
          {/* ------------------------------------------------------------------ */}
          {lineConfigsToRender.map((lineItem) => {
            const isSelectedLine = selectedAssemblyLine === 'ALL' || selectedAssemblyLine === lineItem.code;

            const lineBoxY = lineItem.y - 10;
            const mlY = getTrackY(lineItem.code, 'ML');
            const plY = getTrackY(lineItem.code, 'PL');

            const corridorTop = mlY - 14;
            const corridorBottom = plY + 38;
            const corridorHeight = corridorBottom - corridorTop;
            const interTrackAisleY = mlY + 25;
            const interTrackAisleHeight = Math.max(12, plY - interTrackAisleY);
            const interTrackCenterY = interTrackAisleY + interTrackAisleHeight / 2;

            return (
              <g key={`line-group-${lineItem.code}`} opacity={isSelectedLine ? 1 : 0.25}>
                {/* 2a. Line Feeder Entrance Apron (Connects Vertical Spine x=328 to Line Entrance x=375) */}
                <rect
                  x="328"
                  y={corridorTop}
                  width="47"
                  height={corridorHeight}
                  fill="#05130d"
                  stroke="#059669"
                  strokeWidth="1.2"
                  rx="3"
                />

                {/* Operator Crosswalk Striping on Apron */}
                <line x1="332" y1={lineBoxY - 4} x2="370" y2={lineBoxY - 4} stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
                <line x1="332" y1={lineBoxY + 84} x2="370" y2={lineBoxY + 84} stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />

                {/* 2b. Line-Side Delivery Aisles Along the Entire Track (x: 375..975) */}
                {/* Upper Feeder Lane (Above ML Track) */}
                <rect
                  x="375"
                  y={corridorTop}
                  width="600"
                  height="14"
                  fill="#030a07"
                  stroke="#047857"
                  strokeWidth="0.8"
                  rx="2"
                />
                <text
                  x="675"
                  y={corridorTop + 7}
                  fill="#059669"
                  fontSize="6.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="sans-serif"
                  letterSpacing="1.2"
                  opacity="0.8"
                >
                  ML SUPPLY AISLE (PRIMARY FEEDER)
                </text>

                {/* Central Inter-Track Delivery Road (Between ML and PL) */}
                <rect
                  x="375"
                  y={interTrackAisleY}
                  width="600"
                  height={interTrackAisleHeight}
                  fill="#040e09"
                  stroke="#059669"
                  strokeWidth="1"
                  strokeDasharray="5 3"
                  rx="2"
                />
                {/* Delivery Road Center Guide Line */}
                <line
                  x1="375"
                  y1={interTrackCenterY}
                  x2="975"
                  y2={interTrackCenterY}
                  stroke="#34d399"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.65"
                />
                <text
                  x="675"
                  y={interTrackCenterY}
                  fill="#10b981"
                  fontSize="7"
                  fontWeight="black"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="sans-serif"
                  letterSpacing="2"
                  opacity="0.9"
                >
                  LINE FEEDING & SWCT TUGGER DELIVERY AISLE
                </text>

                {/* Lower Return Lane (Below PL Track) */}
                <rect
                  x="375"
                  y={plY + 25}
                  width="600"
                  height="14"
                  fill="#030a07"
                  stroke="#047857"
                  strokeWidth="0.8"
                  rx="2"
                />
                <text
                  x="675"
                  y={plY + 32}
                  fill="#059669"
                  fontSize="6.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="sans-serif"
                  letterSpacing="1.2"
                  opacity="0.8"
                >
                  PL RETURN & EMPTY TOTE AISLE
                </text>

                {/* End-of-Line Turnaround Loop (x: 975..990) */}
                <rect
                  x="975"
                  y={corridorTop}
                  width="14"
                  height={corridorHeight}
                  fill="#05130d"
                  stroke="#059669"
                  strokeWidth="1"
                  rx="3"
                />
                <path
                  d={`M 975 ${corridorTop + 7} Q 984 ${corridorTop + 7} 984 ${interTrackCenterY} Q 984 ${plY + 32} 975 ${plY + 32}`}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                  opacity="0.75"
                />

                {/* 2c. Vertical Assembly Line Code Control Pillar */}
                <g transform={`translate(334, ${corridorTop + 4})`}>
                  <rect x="0" y="0" width="36" height={corridorHeight - 8} fill="#040b08" stroke="#10b981" strokeWidth="2" rx="3" />
                  {/* Status Indicator LED */}
                  <circle cx="18" cy="11" r="3.5" fill="#10b981" filter="url(#glowGreen)" />
                  <text
                    x="18"
                    y={(corridorHeight - 8) / 2 + 5}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="monospace"
                    letterSpacing="1"
                    transform={`rotate(-90 18 ${(corridorHeight - 8) / 2 + 5})`}
                  >
                    {lineItem.code}
                  </text>
                </g>

                {/* 2d. ML TRACK BAR (Top Conveyor - Red/Amber Accents) */}
                <g transform={`translate(375, ${mlY})`}>
                  <rect x="0" y="0" width="590" height="25" fill="#150505" stroke="#ef4444" strokeWidth="2" rx="3" />
                  {/* Conveyor Roller Markings */}
                  <line x1="48" y1="12.5" x2="542" y2="12.5" stroke="#450a0a" strokeWidth="1" strokeDasharray="3 2" />
                  
                  {/* Left station box (ML-01) */}
                  <rect x="2" y="2" width="44" height="21" fill="#1e0a0a" stroke="#f97316" strokeWidth="1.2" rx="2.5" />
                  <text
                    x="24"
                    y="12.5"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="monospace"
                  >
                    ML-01
                  </text>
                  
                  {/* Right station box (ML-48 / ML-37) */}
                  <rect x="544" y="2" width="44" height="21" fill="#1e0a0a" stroke="#f97316" strokeWidth="1.2" rx="2.5" />
                  <text
                    x="566"
                    y="12.5"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="monospace"
                  >
                    {lineItem.code === '1VCON100' ? 'ML-48' : 'ML-37'}
                  </text>
                </g>

                {/* 2e. PL TRACK BAR (Bottom Conveyor - Emerald/Cyan Accents) */}
                <g transform={`translate(375, ${plY})`}>
                  <rect x="0" y="0" width="590" height="25" fill="#030806" stroke="#10b981" strokeWidth="2" rx="3" />
                  {/* Conveyor Roller Markings */}
                  <line x1="48" y1="12.5" x2="542" y2="12.5" stroke="#064e3b" strokeWidth="1" strokeDasharray="3 2" />
                  
                  {/* Left station box (PL-29 / PL-31) */}
                  <rect x="2" y="2" width="44" height="21" fill="#09140e" stroke="#10b981" strokeWidth="1.2" rx="2.5" />
                  <text
                    x="24"
                    y="12.5"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="monospace"
                  >
                    {lineItem.code === '1VCON100' ? 'PL-29' : 'PL-31'}
                  </text>
                  
                  {/* Right station box (PL-01) */}
                  <rect x="544" y="2" width="44" height="21" fill="#09140e" stroke="#10b981" strokeWidth="1.2" rx="2.5" />
                  <text
                    x="566"
                    y="12.5"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="monospace"
                  >
                    PL-01
                  </text>
                </g>
              </g>
            );
          })}

          {/* ------------------------------------------------------------------ */}
          {/* ACTIVE SIMULATION PATH (LINKED SWCT / GROUPED / STANDARD)          */}
          {/* ------------------------------------------------------------------ */}
          {(() => {
            const pathD =
              simulationMode === 'LINKED_SWCT'
                ? linkedPathD
                : simulationMode === 'GROUPED'
                ? groupPathD
                : singlePathD;
            if (!pathD) return null;

            // Determine if there's any critical shortage in the active items
            let isCriticalShortage = false;
            let displayDistance = 194;

            if (simulationMode === 'LINKED_SWCT' && linkedSwctState?.activeTrip) {
              displayDistance = linkedSwctState.activeTrip.optimizationGains.distanceSavedMeters ? 380 : 194;
            } else if (simulationMode === 'GROUPED' && activeGroup) {
              isCriticalShortage = activeGroup.highestRisk === 'Critical';
              const startX = 85;
              let currentY = 52;
              let totalDist = 0;
              activeGroupStations.forEach(({ coord }) => {
                const targetY = coord.y;
                const targetX = coord.x - 35;
                totalDist += Math.abs(309 - startX) + Math.abs(targetY - currentY) + Math.abs(targetX - 309) * 2;
                currentY = targetY;
              });
              totalDist += Math.abs(52 - currentY) + Math.abs(309 - startX);
              displayDistance = Math.round(totalDist);
            } else if (activePart) {
              const invState = inventoryStates.find((s) => s.partNo === activePart.partNo);
              isCriticalShortage = invState?.riskLevel === 'Red' || (invState?.coverageHours ?? 2) < 1.0;
              displayDistance = activePart.loadedDistanceMeters || 194;
            }

            const currentSimSpeed = linkedSwctState?.simSpeed || 1;
            const pathStrokeColor =
              simulationMode === 'LINKED_SWCT'
                ? '#c084fc'
                : isCriticalShortage
                ? '#f43f5e'
                : '#38bdf8';

            return (
              <g>
                {/* Outer Pulsing Glow Path */}
                <motion.g
                  initial={{ opacity: 0.6 }}
                  animate={
                    simulationMode === 'LINKED_SWCT'
                      ? { opacity: [0.5, 0.9, 0.5] }
                      : isCriticalShortage
                      ? { opacity: [0.35, 0.95, 0.35] }
                      : { opacity: 0.6 }
                  }
                  transition={{ duration: Math.max(0.2, 1.5 / Math.sqrt(currentSimSpeed)), repeat: Infinity, ease: 'easeInOut' }}
                >
                  <motion.path
                    d={pathD}
                    animate={{ d: pathD }}
                    transition={{ duration: Math.max(0.1, 0.6 / Math.sqrt(currentSimSpeed)), ease: [0.16, 1, 0.3, 1] }}
                    fill="none"
                    stroke={pathStrokeColor}
                    strokeWidth={isCriticalShortage ? 8 : 6}
                    filter={
                      simulationMode === 'LINKED_SWCT'
                        ? 'url(#glowCyan)'
                        : isCriticalShortage
                        ? 'url(#glowRed)'
                        : 'url(#glowCyan)'
                    }
                  />
                </motion.g>

                {/* Solid Active Path */}
                <motion.path
                  d={pathD}
                  animate={{ d: pathD }}
                  transition={{ duration: Math.max(0.1, 0.6 / Math.sqrt(currentSimSpeed)), ease: [0.16, 1, 0.3, 1] }}
                  fill="none"
                  stroke={isCriticalShortage ? '#f43f5e' : 'url(#dispatchPathGradTL)'}
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                />

                {/* Moving Delivery Trolley Marker */}
                {simulationMode === 'LINKED_SWCT' ? (
                  <motion.g
                    initial={false}
                    animate={{ x: linkedVehiclePos.x, y: linkedVehiclePos.y }}
                    transition={{ duration: Math.max(0.08, 0.4 / currentSimSpeed), ease: 'linear' }}
                  >
                    {/* Pulsing Beacon Halo */}
                    <circle r="15" fill="#a855f7" opacity="0.25" />
                    <circle r="9" fill="#8b5cf6" opacity="0.5" />

                    {/* Tugger Tractor Body */}
                    <rect x="-12" y="-7" width="14" height="14" rx="3" fill="#6d28d9" stroke="#e9d5ff" strokeWidth="1.5" />
                    {/* Trailer Cart */}
                    <rect x="-24" y="-6" width="9" height="12" rx="2" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.2" />
                    <line x1="-15" y1="0" x2="-12" y2="0" stroke="#c084fc" strokeWidth="2" />
                    {/* Directional Beacon */}
                    <circle cx="0" cy="0" r="2.5" fill="#38bdf8" />

                    {/* Floating Real-Time Stage Tooltip Tag (Smart Flip to avoid top corridor clipping) */}
                    <g transform={linkedVehiclePos.y < 85 ? 'translate(0, 24)' : 'translate(0, -18)'}>
                      <rect
                        x="-70"
                        y="-10"
                        width="140"
                        height="20"
                        rx="5"
                        fill="#09090b"
                        stroke="#a855f7"
                        strokeWidth="1.2"
                      />
                      <text
                        x="0"
                        y="0"
                        fill="#f3f4f6"
                        fontSize="8.5"
                        fontWeight="extrabold"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="monospace"
                      >
                        {linkedSwctState?.activeStage ? `0${linkedSwctState.activeStage.stepNumber}. ${linkedVehiclePos.label}` : 'Tugger'}
                      </text>
                    </g>
                  </motion.g>
                ) : (
                  isAnimating && pathD && (
                    <g key={`std-anim-${pathD}-${currentSimSpeed}-${isCriticalShortage}`}>
                      <g>
                        <circle
                          r="12"
                          fill={isCriticalShortage ? '#f43f5e' : '#10b981'}
                          opacity="0.3"
                          filter={isCriticalShortage ? 'url(#glowRed)' : 'url(#glowCyan)'}
                        />
                        <rect
                          x="-10"
                          y="-6"
                          width="12"
                          height="12"
                          rx="2.5"
                          fill={isCriticalShortage ? '#e11d48' : '#059669'}
                          stroke="#ffffff"
                          strokeWidth="1.2"
                        />
                        <rect
                          x="-20"
                          y="-5"
                          width="8"
                          height="10"
                          rx="2"
                          fill="#0f172a"
                          stroke={isCriticalShortage ? '#fda4af' : '#6ee7b7'}
                          strokeWidth="1"
                        />
                        <line x1="-12" y1="0" x2="-10" y2="0" stroke="#ffffff" strokeWidth="1.5" />
                        <circle cx="0" cy="0" r="2.5" fill="#38bdf8" />
                        <animateMotion
                          dur={`${(isCriticalShortage ? 2.5 : 4.5) / currentSimSpeed}s`}
                          repeatCount="indefinite"
                          path={pathD}
                        />
                      </g>
                    </g>
                  )
                )}

                {/* Distance & Info Telemetry HUD Callout (Positioned at Top-Right header area, away from Stores & Corridors) */}
                <g transform="translate(540, 22)">
                  <rect
                    x="0"
                    y="0"
                    width={simulationMode === 'LINKED_SWCT' ? 240 : isCriticalShortage ? 210 : 185}
                    height="26"
                    rx="6"
                    fill="#0a0a0c"
                    stroke={simulationMode === 'LINKED_SWCT' ? '#a855f7' : isCriticalShortage ? '#f43f5e' : '#38bdf8'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={simulationMode === 'LINKED_SWCT' ? 120 : isCriticalShortage ? 105 : 92.5}
                    y="13"
                    fill={simulationMode === 'LINKED_SWCT' ? '#e9d5ff' : isCriticalShortage ? '#fecdd3' : '#bae6fd'}
                    fontSize="9.5"
                    fontWeight="black"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="monospace"
                    letterSpacing="0.5"
                  >
                    {simulationMode === 'LINKED_SWCT'
                      ? `SWCT SYNC ⚡ ${displayDistance}M LOOP`
                      : isCriticalShortage
                      ? `CRITICAL SHORTAGE ⚡ ${displayDistance}M`
                      : `ACTIVE ROUTE 🚚 ${displayDistance}M`}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* ------------------------------------------------------------------ */}
          {/* STORES BOX & TEXT OVERLAYS */}
          {/* ------------------------------------------------------------------ */}
          {/* STORES BOX (TOP-LEFT) */}
          <g transform="translate(15, 15)">
            <rect
              x="0"
              y="0"
              width="135"
              height="85"
              fill="#030806"
              stroke={
                simulationMode === 'LINKED_SWCT' &&
                (linkedSwctState?.activeStage?.stageType === 'STORE_LOAD' ||
                  linkedSwctState?.activeStage?.stageType === 'STORE_UNLOAD')
                  ? '#a855f7'
                  : '#10b981'
              }
              strokeWidth={
                simulationMode === 'LINKED_SWCT' &&
                (linkedSwctState?.activeStage?.stageType === 'STORE_LOAD' ||
                  linkedSwctState?.activeStage?.stageType === 'STORE_UNLOAD')
                  ? 3.5
                  : 2.5
              }
              rx="4"
            />
            <text
              x="67.5"
              y="32"
              fill="#ffffff"
              fontSize="16"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="sans-serif"
            >
              Stores
            </text>
            <text
              x="67.5"
              y="60"
              fill={simulationMode === 'LINKED_SWCT' ? '#d8b4fe' : '#34d399'}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="sans-serif"
              letterSpacing="1.5"
            >
              CENTRAL HUB
            </text>
          </g>

          {/* POC STATIONS NODES (CRITICAL FIX: Fully unique non-overlapping badges with tooltips) */}
          {(Object.values(pocCoordinates) as { x: number; y: number; line: string; track: 'PL' | 'ML'; pocPoint: string; parts: string[] }[]).map((coord, idx) => {
            // Determine active highlight
            let isPocActive = false;
            let isDockingStation = false;

            if (simulationMode === 'LINKED_SWCT') {
              isPocActive = linkedTripStations.some((s) => s.pocPoint === coord.pocPoint && s.coord.line === coord.line);
              if (
                isPocActive &&
                (linkedSwctState?.activeStage?.stageType === 'POC_DELIVERY' ||
                  linkedSwctState?.activeStage?.stageType === 'POC_DELIVERY_2')
              ) {
                isDockingStation = true;
              }
            } else if (simulationMode === 'GROUPED') {
              isPocActive = activeGroupStations.some((s) => s.pocPoint === coord.pocPoint && s.coord.line === coord.line);
            } else {
              const lineCode = activePart?.assemblyLine || (selectedAssemblyLine !== 'ALL' ? selectedAssemblyLine : '1VCON100');
              isPocActive = activePart?.pocPoint === coord.pocPoint && coord.line === lineCode;
            }

            const isLineMatched = selectedAssemblyLine === 'ALL' || coord.line === selectedAssemblyLine;

            return (
              <g
                key={`poc-node-${coord.line}-${coord.pocPoint}-${idx}`}
                transform={`translate(${coord.x - 29}, ${coord.y - 11})`}
                opacity={isLineMatched ? 1 : 0.2}
              >
                {/* SVG Native Tooltip for parts co-loaded/assigned at this station */}
                <title>{`POC Station: ${coord.pocPoint}\nAssembly Line: ${coord.line}\nParts Assigned:\n${coord.parts.map((pNo) => `• ${pNo}`).join('\n')}`}</title>
                
                {isDockingStation && (
                  <rect
                    x="-3"
                    y="-3"
                    width="64"
                    height="28"
                    rx="6"
                    fill="#10b981"
                    opacity="0.3"
                    className="animate-pulse"
                  />
                )}

                <rect
                  x="0"
                  y="0"
                  width="58"
                  height="22"
                  rx="4"
                  fill={isDockingStation ? '#065f46' : isPocActive ? '#064e3b' : '#0b131e'}
                  stroke={isDockingStation ? '#34d399' : isPocActive ? '#34d399' : coord.track === 'PL' ? '#3b82f6' : '#a855f7'}
                  strokeWidth={isDockingStation ? 2.5 : isPocActive ? 2 : 1.2}
                  filter={isPocActive ? 'url(#glowGreen)' : undefined}
                />
                <text
                  x="29"
                  y="11"
                  fill={isDockingStation ? '#ffffff' : isPocActive ? '#34d399' : '#f3f4f6'}
                  fontSize="9.5"
                  fontWeight="extrabold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="monospace"
                  letterSpacing="0.5"
                >
                  {coord.pocPoint}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* MAP LEGEND & STATS PANEL */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#111827] border border-[#3b82f6]"></span>
            <span className="text-slate-500 dark:text-slate-400">PL Track Station (Parts Pre-Line)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#111827] border border-[#a855f7]"></span>
            <span className="text-slate-500 dark:text-slate-400">ML Track Station (Main-Line Assembly)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#064e3b] border-2 border-[#34d399] animate-pulse"></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Active Destination</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 border-t-2 border-dashed border-[#10b981]"></span>
            <span className="text-slate-500 dark:text-slate-400">Transit Path</span>
          </div>
        </div>

        <div className="text-slate-400 dark:text-slate-500 text-[11px]">
          *Hover over station nodes to inspect grouped parts assignment.
        </div>
      </div>

    </div>
  );
};
