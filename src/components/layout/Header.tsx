import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  GitFork,
  Calendar,
  Clock,
  Play,
  Pause,
  Download,
  User,
  Shield,
  Bell,
  BellRing,
  Menu,
  ChevronDown,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Radio,
  RefreshCw,
  RotateCcw,
  Boxes,
  Truck,
  Activity,
  Layers,
  Sparkles,
  Plus,
  UploadCloud,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';
import { UserRole, ShiftType, AssemblyLineCode } from '../../types/manufacturing';
import { downloadSampleExcelTemplate, parseUploadedExcel } from '../../utils/excelParser';
import { ShiftSelectorRadio } from '../common/ShiftSelectorRadio';
import { TvsLogo } from './TvsLogo';
import { MultiExcelUploadModal } from '../common/MultiExcelUploadModal';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onOpenNotifications }) => {
  const {
    selectedAssemblyLine,
    setSelectedAssemblyLine,
    role,
    setRole,
    operatorName,
    setOperatorName,
    productionPlan,
    updateProductionPlan,
    isSimulating,
    toggleSimulation,
    simulationSpeed,
    setSimulationSpeed,
    alerts,
    inventoryStates,
    parts,
    setParts,
    trips,
    dashboardMode,
    setDashboardMode,
    resetToInitialData,
    selectedPlant,
    setSelectedPlant,
    setIsUploadModalOpen,
    uploadedFileName,
    setUploadedFileName,
    setParsedCount,
    setUploadError,
    uploadedWorkbooks,
    switchActiveDataset,
    activeDatasetId,
    activeSheetName,
    clearAllData,
  } = useMaterialFlow();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isMultiUploadOpen, setIsMultiUploadOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Live ticking time for "Last sync: HH:MM:SS AM/PM"
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLastSyncTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Force manual sync
  const handleManualSync = () => {
    setIsSyncing(true);
    const now = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    setLastSyncTime(now);
    setTimeout(() => {
      setIsSyncing(false);
      setUploadStatus(`Telemetry feed refreshed & synced at ${now}`);
      setTimeout(() => setUploadStatus(null), 3000);
    }, 500);
  };

  // Reset to factory benchmark
  const handleResetBenchmark = () => {
    resetToInitialData();
    setUploadStatus('Reset to TVS standard benchmark parts catalog (5 parts)');
    setTimeout(() => setUploadStatus(null), 3000);
  };

  // Predictive low-stock count
  const criticalLowStockCount = inventoryStates
    ? inventoryStates.filter((s) => s.riskLevel === 'Red' || s.coverageHours < 1.0).length
    : 0;
  const alertBadgeCount = criticalLowStockCount > 0 ? criticalLowStockCount : (alerts?.length > 0 ? alerts.length : 3);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadError(null);
    setIsUploadModalOpen(true);

    try {
      setUploadStatus('Processing Excel file...');
      const parsedParts = await parseUploadedExcel(file);
      if (parsedParts.length > 0) {
        setParts(parsedParts);
        setParsedCount(parsedParts.length);
        setUploadStatus(`Success! Imported ${parsedParts.length} parts from Excel.`);
        setTimeout(() => setUploadStatus(null), 4000);
      } else {
        setUploadError('No valid part records found in Excel file');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Invalid Excel format');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Active animated dropdown popup tracker ('plant' | 'line' | 'shift' | 'role' | 'file' | null)
  const [openDropdown, setOpenDropdown] = useState<'plant' | 'line' | 'shift' | 'role' | 'file' | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Close dropdowns when multi upload modal opens
  useEffect(() => {
    if (isMultiUploadOpen) {
      setOpenDropdown(null);
    }
  }, [isMultiUploadOpen]);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const roles: UserRole[] = ['Admin', 'Planner', 'Supervisor', 'Operator'];

  const plantOptions = [
    {
      id: 'Hosur Main Plant (Tamil Nadu)',
      name: 'Hosur Main Plant',
      location: 'Tamil Nadu, India',
      code: 'TVS-HOS-01',
      badge: 'Main Facility',
    },
    {
      id: 'Hosur Plant II',
      name: 'Hosur Plant II',
      location: 'Tamil Nadu, India',
      code: 'TVS-HOS-02',
      badge: 'EV & Powertrain',
    },
    {
      id: 'Mysuru Plant (Karnataka)',
      name: 'Mysuru Plant',
      location: 'Karnataka, India',
      code: 'TVS-MYS-01',
      badge: 'Scooter Assembly',
    },
    {
      id: 'Nalagarh Plant (Himachal Pradesh)',
      name: 'Nalagarh Plant',
      location: 'Himachal Pradesh, India',
      code: 'TVS-NAL-01',
      badge: 'Northern Hub',
    },
    {
      id: 'Karawang Plant (Indonesia)',
      name: 'Karawang Plant',
      location: 'West Java, Indonesia',
      code: 'TVS-IDN-01',
      badge: 'ASEAN Assembly',
    },
  ];

  const currentPlantObj =
    plantOptions.find((p) => p.id === selectedPlant || p.name === selectedPlant) || plantOptions[0];

  const lineOptions = [
    { id: '1VCON100' as AssemblyLineCode, name: '1VCON100', desc: 'Main Scooter Assembly Line', badge: 'Active' },
    { id: '1VCON200' as AssemblyLineCode, name: '1VCON200', desc: 'Engine & Powertrain Sub-Line', badge: 'Parallel' },
    { id: '1VCON300' as AssemblyLineCode, name: '1VCON300', desc: 'Final Trim, Electrical & PDI', badge: 'Inspection' },
    { id: 'ALL' as AssemblyLineCode, name: 'All Lines', desc: 'Plant-Wide Aggregated View', badge: 'Overview' },
  ];

  const currentLineObj = lineOptions.find((l) => l.id === selectedAssemblyLine) || lineOptions[0];

  const shiftOptions = [
    {
      id: 'Shift 1 (07:00 - 15:30)' as ShiftType,
      name: '1st Shift',
      time: '07:00 – 15:30',
      desc: 'Morning Operation (8.5 hrs)',
    },
    {
      id: 'Shift 2 (15:30 - 00:00)' as ShiftType,
      name: '2nd Shift',
      time: '15:30 – 00:00',
      desc: 'Evening Operation (8.5 hrs)',
    },
  ];

  const currentShiftObj =
    shiftOptions.find((s) => s.id === productionPlan.shift) ||
    shiftOptions.find((s) => productionPlan.shift?.includes('1')) ||
    shiftOptions[0];

  const roleOptions: { id: UserRole; name: string; desc: string; badge: string }[] = [
    { id: 'Admin', name: 'Admin', desc: 'Full System Control & Simulation', badge: 'All Access' },
    { id: 'Planner', name: 'Planner', desc: 'Material Flow & Shift Allocation', badge: 'Planning' },
    { id: 'Supervisor', name: 'Supervisor', desc: 'Floor Monitoring & Logistics Track', badge: 'Floor' },
    { id: 'Operator', name: 'Operator', desc: 'Step Execution & Buffer Status', badge: 'Execution' },
  ];

  return (
    <header
      ref={headerRef}
      id="control-tower-header"
      className="bg-white dark:bg-[#0f0f12] border border-slate-200/90 dark:border-[#2a2a2e] rounded-2xl m-2 sm:m-3 p-2.5 sm:p-3 text-slate-800 dark:text-[#e0e0e0] shadow-xs transition-colors duration-300 relative z-50 overflow-visible"
    >
      {/* ======================= ROW 1: OPERATIONAL CONTEXT & SIMULATION CONTROLS ======================= */}
      <div className={`w-full flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 sm:gap-3 relative ${['plant', 'line', 'shift'].includes(openDropdown || '') ? 'z-50' : 'z-20'}`}>
        
        {/* Left Elements: TVS Logo + Plant + Line + Shift + Takt Time */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 lg:gap-3.5 min-w-0">
          
          {/* Mobile Sidebar Toggle Button */}
          {onToggleSidebar && (
            <button
              id="btn-mobile-sidebar-toggle"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1f] dark:hover:bg-[#25252b] text-slate-800 dark:text-[#e0e0e0] border border-slate-200 dark:border-[#2a2a2e] transition-colors flex md:hidden items-center justify-center cursor-pointer shadow-xs shrink-0"
              title="Toggle Mobile Navigation"
              aria-label="Toggle Mobile Navigation"
            >
              <Menu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
          )}

          {/* TVS Brand Wordmark + Horse + Subtitle */}
          <div className="shrink-0">
            <TvsLogo showText={true} className="h-4.5 sm:h-5 md:h-5.5" />
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* 1. PLANT Dropdown */}
          <div className={`relative shrink-0 ${openDropdown === 'plant' ? 'z-50' : 'z-20'}`}>
            <button
              id="header-plant-dropdown"
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'plant' ? null : 'plant')}
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left ${
                openDropdown === 'plant'
                  ? 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-700/80 shadow-xs ring-2 ring-red-500/20'
                  : 'bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs'
              }`}
              aria-expanded={openDropdown === 'plant'}
              aria-haspopup="listbox"
              title="Select Manufacturing Facility"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-red-100/80 dark:bg-red-950/70 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0 pr-0.5">
                <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-slate-400 dark:text-slate-500 leading-none font-sans">
                  PLANT
                </span>
                <span className="text-xs sm:text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight font-sans truncate mt-0.5">
                  {currentPlantObj.name}
                </span>
              </div>
              <motion.span
                animate={{
                  rotate: openDropdown === 'plant' ? 180 : 0,
                  scale: openDropdown === 'plant' ? 1.15 : 1,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="inline-flex shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
            </button>

            {/* Animated Dropdown Popover */}
            <AnimatePresence>
              {openDropdown === 'plant' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/70 p-2 ring-1 ring-black/5 dark:ring-white/5"
                >
                  <div className="px-2.5 py-1.5 mb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold tracking-wider uppercase font-sans">
                        Manufacturing Facilities
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-bold border border-red-200/50 dark:border-red-900/50">
                      {plantOptions.length} Plants
                    </span>
                  </div>
                  <div className="space-y-1">
                    {plantOptions.map((p) => {
                      const isSelected = selectedPlant === p.id || selectedPlant === p.name;
                      return (
                        <motion.button
                          key={p.id}
                          type="button"
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedPlant(p.id);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-300 font-semibold border border-red-300/60 dark:border-red-700/60 shadow-2xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold tracking-tight font-sans truncate">{p.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                                {p.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-tight truncate mt-0.5">
                              {p.location} • {p.code}
                            </span>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* 2. LINE Dropdown */}
          <div className={`relative shrink-0 ${openDropdown === 'line' ? 'z-50' : 'z-20'}`}>
            <button
              id="header-assembly-line-dropdown"
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'line' ? null : 'line')}
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left ${
                openDropdown === 'line'
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 shadow-xs ring-2 ring-emerald-500/20'
                  : 'bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs'
              }`}
              aria-expanded={openDropdown === 'line'}
              aria-haspopup="listbox"
              title="Select Assembly Line Location"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <GitFork className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0 pr-0.5">
                <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-slate-400 dark:text-slate-500 leading-none font-sans">
                  LINE
                </span>
                <span className="text-xs sm:text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight font-sans truncate mt-0.5">
                  {currentLineObj.name}
                </span>
              </div>
              <motion.span
                animate={{
                  rotate: openDropdown === 'line' ? 180 : 0,
                  scale: openDropdown === 'line' ? 1.15 : 1,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="inline-flex shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
            </button>

            {/* Animated Dropdown Popover */}
            <AnimatePresence>
              {openDropdown === 'line' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/70 p-2 ring-1 ring-black/5 dark:ring-white/5"
                >
                  <div className="px-2.5 py-1.5 mb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <GitFork className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold tracking-wider uppercase font-sans">
                        Assembly Line Selection
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/50 dark:border-emerald-900/50">
                      {lineOptions.length} Lines
                    </span>
                  </div>
                  <div className="space-y-1">
                    {lineOptions.map((line) => {
                      const isSelected = selectedAssemblyLine === line.id;
                      return (
                        <motion.button
                          key={line.id}
                          type="button"
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedAssemblyLine(line.id);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300/60 dark:border-emerald-700/60 shadow-2xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold tracking-tight font-sans truncate">{line.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                                {line.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-tight truncate mt-0.5">
                              {line.desc}
                            </span>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* 3. SHIFT Dropdown */}
          <div className={`relative shrink-0 ${openDropdown === 'shift' ? 'z-50' : 'z-20'}`}>
            <button
              id="header-shift-dropdown"
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'shift' ? null : 'shift')}
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left ${
                openDropdown === 'shift'
                  ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/80 shadow-xs ring-2 ring-purple-500/20'
                  : 'bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs'
              }`}
              aria-expanded={openDropdown === 'shift'}
              aria-haspopup="listbox"
              title="Select Active Shift"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-purple-100/80 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0 pr-0.5">
                <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-purple-600/80 dark:text-purple-400 leading-none font-sans">
                  SHIFT
                </span>
                <span className="text-xs sm:text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight font-sans truncate mt-0.5">
                  {currentShiftObj.name}
                </span>
              </div>
              <motion.span
                animate={{
                  rotate: openDropdown === 'shift' ? 180 : 0,
                  scale: openDropdown === 'shift' ? 1.15 : 1,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="inline-flex shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
            </button>

            {/* Animated Dropdown Popover */}
            <AnimatePresence>
              {openDropdown === 'shift' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute left-0 top-full mt-2 z-50 w-64 sm:w-76 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/70 p-2 ring-1 ring-black/5 dark:ring-white/5"
                >
                  <div className="px-2.5 py-1.5 mb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold tracking-wider uppercase font-sans">
                        Production Shift
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold border border-purple-200/50 dark:border-purple-900/50">
                      8.5h / Shift
                    </span>
                  </div>
                  <div className="space-y-1">
                    {shiftOptions.map((s) => {
                      const isSelected = productionPlan.shift === s.id;
                      return (
                        <motion.button
                          key={s.id}
                          type="button"
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            updateProductionPlan({ shift: s.id });
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-300/60 dark:border-purple-700/60 shadow-2xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold tracking-tight font-sans">{s.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-tight mt-0.5">
                              {s.time} • {s.desc}
                            </span>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* 4. TAKT TIME Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-2xs shrink-0">
            <div className="w-6.5 h-6.5 rounded-lg bg-blue-100/80 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold tracking-[0.08em] text-blue-600/80 dark:text-blue-400 uppercase leading-none font-sans">
                TAKT TIME
              </span>
              <span className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {Number(productionPlan.taktTimeSeconds || 27.95).toFixed(2)}s
              </span>
            </div>
          </div>

        </div>

        {/* Right Elements: Simulation Controls + Speed + Alerts */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-center">
          
          {/* Pause / Start Sim Button */}
          <button
            id="btn-toggle-sim"
            onClick={toggleSimulation}
            className="flex items-center justify-center gap-1.5 h-9 px-3 sm:px-3.5 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 active:scale-[0.98] transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
          >
            {isSimulating ? (
              <Pause className="w-3.5 h-3.5 fill-white shrink-0" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white shrink-0" />
            )}
            <span>{isSimulating ? 'PAUSE SIM' : 'START SIM'}</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 sm:gap-1.5 h-9">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase shrink-0">SPD:</span>
            <div className="flex items-center h-full rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setSimulationSpeed(s)}
                  className={`h-full px-1.5 sm:px-2 flex items-center justify-center rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                    simulationSpeed === s
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Predictive Alerts Notification Button */}
          <button
            id="btn-header-predictive-alerts"
            onClick={onOpenNotifications}
            className="flex items-center justify-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50/80 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Open Predictive Low-Stock & Starvation Alerts Panel"
          >
            {criticalLowStockCount > 0 ? (
              <BellRing className="w-3.5 h-3.5 text-red-600 dark:text-red-400 animate-bounce shrink-0" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>ALERTS</span>
            <span className="w-4.5 h-4.5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center leading-none shrink-0">
              {alertBadgeCount}
            </span>
          </button>

        </div>
      </div>

      {/* ======================= SUBTLE DIVIDER BETWEEN ROW 1 & ROW 2 ======================= */}
      <div className="w-full border-t border-slate-200/80 dark:border-slate-800/80 my-2" />

      {/* ======================= ROW 2: LIVE TELEMETRY, HEALTH STATUS & DATA MANAGEMENT ======================= */}
      <div className={`w-full flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 sm:gap-3 pt-0.5 relative ${openDropdown === 'role' ? 'z-50' : 'z-10'}`}>
        
        {/* Group 1 (Left): Live Sync, Force Refresh, Operator & Simulation Engine Mode */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 min-w-0">
          
          {/* Live Sync Status & Manual Force Sync */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                <span>LIVE SYNC</span>
                <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 whitespace-nowrap">
                Last sync: {lastSyncTime}
              </span>
            </div>

            {/* Quick Force Re-Sync Button */}
            <button
              id="btn-header-force-sync"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="p-1 sm:p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition-all cursor-pointer shadow-2xs shrink-0"
              title="Force instant synchronization with plant sensors"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* Operator Selector */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-2xs shrink-0">
            <div className="w-6.5 h-6.5 rounded-lg bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0 pr-0.5">
              <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-slate-400 dark:text-slate-500 leading-none font-sans">
                OPERATOR
              </span>
              <input
                id="input-single-operator-name"
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="sai"
                className="bg-transparent text-xs sm:text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 w-16 sm:w-20 focus:outline-none cursor-text mt-0.5 tracking-tight font-sans"
                title="Single Operator Name"
              />
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden md:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* Simulation Engine Mode: Live Dynamic vs Static Shift Baseline */}
          <div className="flex flex-col shrink-0">
            <span className="text-[9px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              SIM MODE
            </span>
            <div className="flex bg-slate-100 dark:bg-[#1a1a1f] p-0.5 rounded-lg border border-slate-200 dark:border-[#2a2a2e] mt-0.5">
              <button
                id="btn-mode-toggle-live"
                onClick={() => setDashboardMode('live')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dashboardMode === 'live'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Live dynamic inventory consumption & real-time takt tracking"
              >
                <Activity className="w-3 h-3 shrink-0" />
                <span>Live</span>
              </button>
              <button
                id="btn-mode-toggle-static"
                onClick={() => setDashboardMode('static')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  dashboardMode === 'static'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Static shift target baseline calculation"
              >
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Static</span>
              </button>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden lg:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* Active Uploaded Parts Chip */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-[#16161a] border border-slate-200 dark:border-[#2a2a2e] text-xs font-mono shrink-0 shadow-2xs"
            title="Currently loaded parts in material flow master"
          >
            <Boxes className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">Parts:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{parts.length}</span>
          </div>

          {/* Shift Delivery Pace / Trips Chip */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-[#16161a] border border-slate-200 dark:border-[#2a2a2e] text-xs font-mono shrink-0 shadow-2xs"
            title="Scheduled shift delivery trips in active plan"
          >
            <Truck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">Trips:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{trips.length}</span>
          </div>

        </div>

        {/* Group 2 (Right): Data Management, Role & File Info */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 self-center justify-start xl:justify-end">
          
          {/* Format File Download */}
          <button
            id="btn-download-template"
            onClick={downloadSampleExcelTemplate}
            className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-slate-900 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-xs transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            title="Download Material Flow Master Template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="hidden sm:inline">Download Template</span>
            <span className="sm:hidden">Template</span>
          </button>

          {/* Multi-File & Multi-Sheet Excel Upload Button */}
          <button
            id="btn-header-multifile-upload"
            onClick={() => {
              setOpenDropdown(null);
              setIsMultiUploadOpen(true);
            }}
            title="Open Multi-File & Multi-Sheet Excel Upload Workspace"
            className="container-btn-file group h-9 !px-3 sm:!px-3.5 shrink-0 whitespace-nowrap bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <UploadCloud className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[11px] sm:text-xs">MULTI-FILE EXCEL UPLOAD</span>
          </button>

          {/* Render Multi-File & Multi-Sheet Upload Workspace Modal */}
          <MultiExcelUploadModal
            isOpen={isMultiUploadOpen}
            onClose={() => setIsMultiUploadOpen(false)}
          />

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* Role Selector Dropdown */}
          <div className={`relative shrink-0 ${openDropdown === 'role' ? 'z-50' : 'z-20'}`}>
            <button
              id="select-user-role"
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')}
              className={`group flex items-center gap-2 h-9 px-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left ${
                openDropdown === 'role'
                  ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/80 shadow-xs ring-2 ring-purple-500/20'
                  : 'bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/70 dark:hover:bg-slate-800/80 border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs'
              }`}
              aria-expanded={openDropdown === 'role'}
              aria-haspopup="listbox"
              title="Switch Active Access Persona"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-purple-100/80 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0 pr-0.5">
                <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-purple-600/80 dark:text-purple-400 leading-none font-sans">
                  ROLE
                </span>
                <span className="text-xs sm:text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight font-sans truncate mt-0.5">
                  {role}
                </span>
              </div>
              <motion.span
                animate={{
                  rotate: openDropdown === 'role' ? 180 : 0,
                  scale: openDropdown === 'role' ? 1.15 : 1,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className="inline-flex shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-0.5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
            </button>

            {/* Animated Dropdown Popover */}
            <AnimatePresence>
              {openDropdown === 'role' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  className="absolute right-0 top-full mt-2 z-50 w-64 sm:w-76 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/70 p-2 ring-1 ring-black/5 dark:ring-white/5"
                >
                  <div className="px-2.5 py-1.5 mb-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold tracking-wider uppercase font-sans">
                        Access Persona
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold border border-purple-200/50 dark:border-purple-900/50">
                      {roleOptions.length} Roles
                    </span>
                  </div>
                  <div className="space-y-1">
                    {roleOptions.map((r) => {
                      const isSelected = role === r.id;
                      return (
                        <motion.button
                          key={r.id}
                          type="button"
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setRole(r.id);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-300/60 dark:border-purple-700/60 shadow-2xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 border border-transparent font-medium'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold tracking-tight font-sans truncate">{r.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                                {r.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-tight truncate mt-0.5">
                              {r.desc}
                            </span>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200/80 dark:bg-slate-800 shrink-0" />

          {/* File Info / Dataset Switcher Card */}
          <div className={`relative shrink-0 ${openDropdown === 'file' ? 'z-50' : 'z-20'}`}>
            <button
              id="btn-header-file-info"
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'file' ? null : 'file')}
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left max-w-[210px] ${
                openDropdown === 'file'
                  ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700/80 shadow-xs ring-2 ring-blue-500/20'
                  : 'bg-blue-50/50 hover:bg-blue-100/70 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-blue-200/60 dark:border-slate-800 shadow-2xs'
              }`}
              aria-expanded={openDropdown === 'file'}
              title="Active Excel File Dataset - Click to Switch File or Sheet"
            >
              <div className="w-6.5 h-6.5 rounded-lg bg-blue-100/80 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0 pr-0.5">
                <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-blue-600/80 dark:text-blue-400 leading-none font-sans flex items-center gap-1">
                  FILE INFO
                  {uploadedWorkbooks.length > 0 && (
                    <span className="px-1 py-0 rounded text-[8px] bg-blue-600 text-white font-bold">
                      {uploadedWorkbooks.length}
                    </span>
                  )}
                </span>
                <span
                  className="text-xs sm:text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5 font-sans"
                  title={uploadedFileName || (parts.length > 0 ? 'Standard Master' : 'No File Uploaded')}
                >
                  {uploadedFileName || (parts.length > 0 ? 'Standard Master' : 'No File Uploaded')}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${openDropdown === 'file' ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu for File & Sheet Selector */}
            <AnimatePresence>
              {openDropdown === 'file' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 text-sans"
                >
                  <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
                      Select Active Excel Dataset
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown(null);
                        setIsMultiUploadOpen(true);
                      }}
                      className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Files
                    </button>
                  </div>

                  <div className="py-2 space-y-1.5 max-h-72 overflow-y-auto font-mono text-xs">
                    {/* List of uploaded workbooks & sheets */}
                    {uploadedWorkbooks.length > 0 ? (
                      uploadedWorkbooks.map((wb) => (
                        <div key={wb.id} className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold truncate">
                            <span className="truncate flex items-center gap-1.5">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              {wb.fileName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal shrink-0">
                              {wb.sheets.length} sheet(s)
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {wb.sheets.map((sheet, sIdx) => {
                              const isActiveSheet =
                                activeDatasetId === wb.id && activeSheetName === sheet.sheetName;
                              return (
                                <button
                                  type="button"
                                  key={`${wb.id}-${sheet.sheetName}-${sIdx}`}
                                  onClick={() => {
                                    switchActiveDataset(wb.id, sheet.sheetName);
                                    setOpenDropdown(null);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                                    isActiveSheet
                                      ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <Layers className="w-3 h-3 text-cyan-400" />
                                  <span>{sheet.sheetName}</span>
                                  <span className="text-[9px] opacity-75">({sheet.rowCount})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-500 dark:text-slate-400 space-y-2">
                        <p className="text-xs">No custom Excel files uploaded yet.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenDropdown(null);
                            setIsMultiUploadOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Upload Multi-File Excel</span>
                        </button>
                      </div>
                    )}

                    {/* Benchmark Master Option & Clear Data */}
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          resetToInitialData();
                          setOpenDropdown(null);
                        }}
                        className="w-full p-2 rounded-xl text-left text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
                          Load Factory Benchmark Master
                        </span>
                      </button>

                      {parts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            clearAllData();
                            setOpenDropdown(null);
                          }}
                          className="w-full p-2 rounded-xl text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            Clear All Input Data (Reset Workspace)
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Upload Notification Toast Banner */}
      {uploadStatus && (
        <div className="w-full mt-2.5 p-2 rounded-xl bg-emerald-50 dark:bg-green-950/60 border border-emerald-200 dark:border-green-500/40 text-xs text-emerald-800 dark:text-green-300 font-mono flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-green-400 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Interactive 3-Shift Radio Selector Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                  Select 8-Hour Production Shift
                </h3>
              </div>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <ShiftSelectorRadio
              currentShift={productionPlan.shift}
              onShiftChange={(newShift) => {
                updateProductionPlan({ shift: newShift });
              }}
            />

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl font-mono cursor-pointer transition-all shadow-xs"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

