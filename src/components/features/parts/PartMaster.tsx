import React, { useState } from 'react';
import { Layers, Search, Plus, Edit2, Trash2, Download, Upload, Boxes, Package, ArrowUpRight, RotateCcw, Box, CheckCircle2 } from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { PartMaster, TransportMode, PackagingType, PACKAGING_TYPE_DEFINITIONS } from '../../../types/manufacturing';
import { calculatePartMetrics, getPartLineCode, filterPartsByLine } from '../../../utils/calculations';
import { downloadSampleExcelTemplate, exportMaterialFlowExcel } from '../../../utils/excelParser';
import { AssemblyLineToggle } from '../../common/AssemblyLineToggle';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const PartMasterView: React.FC = () => {
  const { parts, updatePart, productionPlan, setParts, modeConfigs, resetToInitialData, selectedAssemblyLine } = useMaterialFlow();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransportFilter, setSelectedTransportFilter] = useState<string>('ALL');
  const [selectedPackagingFilter, setSelectedPackagingFilter] = useState<string>('ALL');

  const [editingPart, setEditingPart] = useState<PartMaster | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const lineParts = filterPartsByLine(parts, selectedAssemblyLine);

  const filteredParts = lineParts.filter((part) => {
    const matchesSearch =
      part.partNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.pocPoint.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTransport =
      selectedTransportFilter === 'ALL' || part.transportMode === selectedTransportFilter;

    const matchesPackaging =
      selectedPackagingFilter === 'ALL' || (part.binOrTrolley || 'Trolley') === selectedPackagingFilter;

    return matchesSearch && matchesTransport && matchesPackaging;
  });

  // Count by packaging type
  const trolleyCount = lineParts.filter((p) => (p.binOrTrolley || 'Trolley') === 'Trolley').length;
  const binCount = lineParts.filter((p) => p.binOrTrolley === 'Bin').length;
  const cartonCount = lineParts.filter((p) => p.binOrTrolley === 'Carton').length;
  const coverCount = lineParts.filter((p) => p.binOrTrolley === 'Cover').length;

  const handleSavePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;

    const exists = parts.some((p) => p.partNo === editingPart.partNo);
    if (exists) {
      updatePart(editingPart.partNo, editingPart);
    } else {
      setParts((prev) => [...prev, editingPart]);
    }
    setIsModalOpen(false);
    setEditingPart(null);
  };

  const openNewPartModal = () => {
    setEditingPart({
      partNo: `P-NEW-${Math.floor(Math.random() * 900 + 100)}`,
      description: 'New Assembly Component',
      modelNo: 'APX-125',
      usagePerVehicle: 1,
      transportMode: 'Jumbo Trolley',
      binCapacity: 12,
      storeLocation: 'Store-A (Sheet Metal Zone)',
      pocPoint: 'POC-ST01',
      stationName: 'Station 01',
      pickTimeMin: 3.5,
      storingTimePocMin: 2.5,
      emptyCollectionTimeMin: 1.5,
      emptyLeavingTimeMin: 1.0,
      loadedDistanceMeters: 300,
      returnDistanceMeters: 300,
      initialPocTrolleyStock: 0,
      minSafetyCoverageHours: 1.5,
    });
    setIsModalOpen(true);
  };

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="part-master-view" className="space-y-6">
      
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm dark:shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Part Master Catalog & Container Specifications</span>
            <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400 shrink-0">
              ({selectedAssemblyLine === 'ALL' ? 'ALL LINES' : selectedAssemblyLine})
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage two-wheeler assembly part numbers, bin capacities, transport modes, and store-to-POC mapping
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start xl:self-auto">
          <button
            onClick={resetToInitialData}
            title="Reset parts master to standard input file data (60/80/64/6/30 Qty and 2/2/2/10/4 Trolleys/hr)"
            className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/60 dark:hover:bg-purple-800/80 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-500/40 text-xs flex items-center gap-1.5 shadow cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300 shrink-0" />
            <span>Reset to Standard Data</span>
          </button>

          <button
            onClick={() => exportMaterialFlowExcel(parts, productionPlan, undefined, modeConfigs)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow border border-blue-400/30 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={downloadSampleExcelTemplate}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Download Master Excel</span>
          </button>

          <button
            onClick={openNewPartModal}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add New Part</span>
          </button>
        </div>
      </div>

      {/* Packaging Types Visual Reference Legend */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
              Packaging Container Types (Identified from Excel)
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">Quick Filter:</span>
            <button
              onClick={() => setSelectedPackagingFilter('ALL')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                selectedPackagingFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All ({lineParts.length})
            </button>
            <button
              onClick={() => setSelectedPackagingFilter('Trolley')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                selectedPackagingFilter === 'Trolley'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100'
              }`}
            >
              Trolley ({trolleyCount})
            </button>
            <button
              onClick={() => setSelectedPackagingFilter('Bin')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                selectedPackagingFilter === 'Bin'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              Bin ({binCount})
            </button>
            <button
              onClick={() => setSelectedPackagingFilter('Carton')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                selectedPackagingFilter === 'Carton'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              Carton ({cartonCount})
            </button>
            <button
              onClick={() => setSelectedPackagingFilter('Cover')}
              className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-colors ${
                selectedPackagingFilter === 'Cover'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 hover:bg-purple-100'
              }`}
            >
              Cover ({coverCount})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* 1. Trolley */}
          <div className={`p-3 rounded-xl border transition-all ${
            selectedPackagingFilter === 'Trolley'
              ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-400 dark:border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Trolley (Pre-loaded)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                {trolleyCount} Parts
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Parts are <strong>pre-loaded directly in/on the specialized trolley</strong> (e.g. <em>Frame = 6</em>, <em>Battery Pack = 64</em>, <em>Wheels = 30</em>).
            </p>
            <div className="mt-2 text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 px-2 py-1 rounded">
              Capacity: 1 dedicated trolley per tugger slot
            </div>
          </div>

          {/* 2. Bin */}
          <div className={`p-3 rounded-xl border transition-all ${
            selectedPackagingFilter === 'Bin'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Bin (Platform Trolley)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                {binCount} Parts
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Parts are <strong>stored inside plastic bins/totes</strong> (e.g. <em>Head Lamp = 56</em>), and placed <strong>above the platform trolley</strong>.
            </p>
            <div className="mt-2 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 px-2 py-1 rounded">
              Capacity: 4 bins stacked per platform trolley
            </div>
          </div>

          {/* 3. Carton */}
          <div className={`p-3 rounded-xl border transition-all ${
            selectedPackagingFilter === 'Carton'
              ? 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Carton (Pre-packed Box)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                {cartonCount} Parts
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Parts are <strong>pre-packed inside carton boxes</strong> by supplier, placed on platform trolley.
            </p>
            <div className="mt-2 text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 px-2 py-1 rounded">
              Capacity: 4 carton boxes per platform trolley
            </div>
          </div>

          {/* 4. Cover */}
          <div className={`p-3 rounded-xl border transition-all ${
            selectedPackagingFilter === 'Cover'
              ? 'bg-purple-50/90 dark:bg-purple-950/60 border-purple-400 dark:border-purple-500 ring-2 ring-purple-500/20'
              : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Cover (Packet / Polybag)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">
                {coverCount} Parts
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Parts packed inside <strong>covers/packets</strong> (e.g. <em>CABLE ASSY BRAKE = 50</em>). Placed freely on <strong>any trolley</strong>.
            </p>
            <div className="mt-2 text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 px-2 py-1 rounded font-bold">
              Trolley Demand: 0 (Piggybacks on any trolley)
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm dark:shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Part No, Desc, POC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 dark:text-slate-400">Packaging:</span>
            <select
              value={selectedPackagingFilter}
              onChange={(e) => setSelectedPackagingFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="ALL">All Packaging ({lineParts.length})</option>
              <option value="Trolley">Trolley (Pre-loaded) ({trolleyCount})</option>
              <option value="Bin">Bin (Platform Trolley) ({binCount})</option>
              <option value="Carton">Carton (Pre-packed Box) ({cartonCount})</option>
              <option value="Cover">Cover (Packet / Polybag) ({coverCount})</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 dark:text-slate-400">Transport:</span>
            <select
              value={selectedTransportFilter}
              onChange={(e) => setSelectedTransportFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="ALL">All Modes</option>
              <option value="Jumbo Trolley">Jumbo Trolley</option>
              <option value="BOV (Battery Vehicle)">BOV (Battery Vehicle)</option>
              <option value="Hand Pallet Truck">Hand Pallet Truck</option>
              <option value="Manual Handling">Manual Handling</option>
            </select>
          </div>
        </div>
      </div>

      {/* Part Master Table */}
      <div className="bg-white dark:bg-[#0f0f12] border border-slate-200 dark:border-[#2a2a2e] rounded p-4 shadow-sm dark:shadow-xl overflow-x-auto">
        <div className="p-2 bg-slate-50 dark:bg-[#1a1a1f] border-b border-slate-200 dark:border-[#2a2a2e] -mx-4 -mt-4 mb-4 px-4 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#e0e0e0] font-mono flex items-center gap-2">
            <span>Part Master & Hourly Line-Feeding Requirement Engine</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/30">
              Calculated for Per Hour Based on Takt Time ({productionPlan.taktTimeSeconds}s / Takt)
            </span>
          </h3>
        </div>

        <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100 dark:bg-[#09090b] text-slate-500 dark:text-[#888] font-mono uppercase border-b border-slate-200 dark:border-[#2a2a2e] text-[10px]">
            <tr>
              <th className="px-3 py-2.5 text-center">S.No</th>
              <th className="px-3 py-2.5">Mode</th>
              <th className="px-3 py-2.5">Model No</th>
              <th className="px-3 py-2.5">Part No</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5 text-center">Qty / Trolley</th>
              <th className="px-3 py-2.5">Store</th>
              <th className="px-3 py-2.5">POC Point</th>
              <th className="px-3 py-2.5 text-center">POC Space Max (Trolleys)</th>
              <th className="px-3 py-2.5 text-center text-amber-600 dark:text-amber-400 font-bold">No of Usages (Qty/Veh)</th>
              <th className="px-3 py-2.5 text-center bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-x border-blue-200 dark:border-blue-500/30 font-bold">
                Trolleys Req / Hr
              </th>
              <th className="px-3 py-2.5 text-center bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-x border-indigo-200 dark:border-indigo-500/30">
                Shift 2 Carryover
              </th>
              <th className="px-3 py-2.5 text-center">Mode Cap</th>
              <th className="px-3 py-2.5 text-center bg-cyan-50/50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-x border-cyan-200 dark:border-cyan-500/30">
                Hourly Trips
              </th>
              <th className="px-3 py-2.5 text-center">Dist (M)</th>
              <th className="px-3 py-2.5 text-center">Cycle Time</th>
              <th className="px-3 py-2.5 text-right">Single Operator Workload</th>
              <th className="px-3 py-2.5 text-right">Optimized Trips / Shift</th>
              <th className="px-3 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#2a2a2e] font-mono text-[11px]">
            {filteredParts.map((part, idx) => {
              const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
              const roundedTrolleysHr = metrics.roundedTrolleysPerHour;

              return (
                <tr key={`${part.partNo}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-[#16161b] transition-colors">
                  <td className="px-3 py-2 text-center text-slate-400 dark:text-[#666] font-bold">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        part.transportMode.includes('BOV')
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30'
                          : part.transportMode.includes('Jumbo')
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30'
                          : part.transportMode.includes('Hand')
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                          : 'bg-slate-100 dark:bg-[#1a1a1f] text-slate-700 dark:text-[#bbb] border-slate-200 dark:border-[#2a2a2e]'
                      }`}>
                        {part.transportMode.split(' ')[0]}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                        part.binOrTrolley === 'Cover'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/40'
                          : part.binOrTrolley === 'Carton'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
                          : part.binOrTrolley === 'Bin'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/40'
                      }`} title={PACKAGING_TYPE_DEFINITIONS[part.binOrTrolley || 'Trolley']?.description}>
                        {part.binOrTrolley === 'Cover' ? 'Cover (Packet)' : part.binOrTrolley === 'Carton' ? 'Carton (Box)' : part.binOrTrolley === 'Bin' ? 'Bin (Platform)' : 'Trolley (Pre-loaded)'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-[#bbb] font-bold">{part.modelNo}</td>
                  <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{part.partNo}</td>
                  <td className="px-3 py-2 text-slate-800 dark:text-white font-sans font-medium max-w-[200px] truncate" title={part.description}>
                    {part.description}
                  </td>
                  <td className="px-3 py-2 text-center text-cyan-600 dark:text-cyan-400 font-bold">{part.binCapacity}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-[#888]">{part.storeLocation}</td>
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-white">{part.pocPoint}</td>
                  <td className="px-3 py-2 text-center text-amber-600 dark:text-amber-400 font-bold font-mono">
                    {metrics.pocSpaceTrolleysMax}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-800 dark:text-white">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        (part.usagePerVehicle || 1) > 1
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600/40'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                      title={`${part.usagePerVehicle || 1} units needed for 1 vehicle`}
                    >
                      {part.usagePerVehicle || 1} / veh
                    </span>
                  </td>
                  
                  {/* Per Hour Trolley Calculation based on Takt Time */}
                  <td className="px-3 py-2 text-center font-bold text-amber-800 dark:text-yellow-300 bg-amber-50/50 dark:bg-yellow-950/20 border-x border-amber-200 dark:border-yellow-500/30">
                    {part.binOrTrolley === 'Cover' ? (
                      <div>
                        <span className="text-xs font-extrabold text-purple-700 dark:text-purple-300">0 Trolleys</span>
                        <span className="text-[9px] text-purple-600 dark:text-purple-400 block font-bold">
                          ({metrics.packetDemandPerHour ?? Math.ceil(metrics.hourlyConsumption / (part.binCapacity || 1))} Covers/hr)
                        </span>
                        <span className="text-[8px] text-slate-400 dark:text-slate-500 block">Piggyback on trolley</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm">{roundedTrolleysHr}</span>
                        <span className="text-[9px] text-slate-500 dark:text-[#888] block font-normal">
                          ({metrics.trolleyDemandPerHour.toFixed(1)} exact/hr)
                        </span>
                      </>
                    )}
                  </td>

                  {/* Shift 2 Carryover at POC (07:00 AM) */}
                  <td className="px-3 py-2 text-center font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 border-x border-indigo-200 dark:border-indigo-500/30">
                    <span className="text-xs">{metrics.initialPocTrolleys} {metrics.initialPocTrolleys === 1 ? 'bin' : 'bins'}</span>
                    <span className="text-[9px] text-slate-500 dark:text-[#888] block font-normal">({metrics.initialPocUnits} units)</span>
                  </td>

                  <td className="px-3 py-2 text-center font-bold text-purple-750 dark:text-purple-300">
                    {metrics.carryingCapacity} {metrics.carryingCapacity === 1 ? 'bin' : 'bins'}
                  </td>

                  {/* Hourly Trips = Math.ceil(Hourly Bins / Carrying Capacity) e.g. 22 / 3 = 8 trips */}
                  <td className="px-3 py-2 text-center font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/20 border-x border-cyan-200 dark:border-cyan-500/30">
                    {part.binOrTrolley === 'Cover' ? (
                      <div>
                        <span className="text-xs font-mono font-extrabold text-purple-700 dark:text-purple-300">0 Trips</span>
                        <span className="text-[9px] text-purple-600 dark:text-purple-400 block font-medium">Piggyback</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-mono font-extrabold">{metrics.tripsRequiredPerHour} {metrics.tripsRequiredPerHour === 1 ? 'trip' : 'trips'}</span>
                        <span className="text-[9px] text-slate-500 dark:text-[#888] block font-normal">
                          ({metrics.trolleyDemandPerHour.toFixed(0)} bins / {metrics.carryingCapacity} cap)
                        </span>
                      </>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center text-slate-600 dark:text-[#bbb]">
                    {part.loadedDistanceMeters}m / {part.returnDistanceMeters}m
                  </td>

                  <td className="px-3 py-2 text-center text-amber-700 dark:text-amber-300 font-mono">
                    {metrics.cycleTimeMin.toFixed(1)}m
                  </td>

                  <td className="px-3 py-2 text-right font-mono">
                    <span className="text-blue-700 dark:text-blue-300 font-bold block">{metrics.singleOperatorWorkloadMinPerShift}m / shift</span>
                    <span className="text-[9px] text-slate-500 dark:text-[#888] block">({metrics.singleOperatorUtilizationPercent}% util)</span>
                  </td>

                  <td className="px-3 py-2 text-right font-bold">
                    {part.binOrTrolley === 'Cover' ? (
                      <span className="text-purple-600 dark:text-purple-400 block text-xs">0 Trips (Piggyback)</span>
                    ) : (
                      <>
                        <span className="text-emerald-600 dark:text-emerald-400 block text-xs">{metrics.tripsRequiredPerShift} net trips</span>
                        {metrics.grossTripsRequiredPerShift > metrics.tripsRequiredPerShift && (
                          <span className="text-[9px] text-slate-450 dark:text-slate-500 font-normal line-through block">
                            ({metrics.grossTripsRequiredPerShift} gross)
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => {
                        setEditingPart({ ...part });
                        setIsModalOpen(true);
                      }}
                      className="p-1 rounded bg-slate-50 hover:bg-slate-100 dark:bg-[#1a1a1f] dark:hover:bg-[#25252b] text-slate-600 dark:text-[#bbb] border border-slate-200 dark:border-[#2a2a2e]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && editingPart && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 max-w-xl w-full text-xs shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span>{editingPart.partNo ? `Edit Part: ${editingPart.partNo}` : 'Add New Part'}</span>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">✕</button>
            </h3>

            <form onSubmit={handleSavePart} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Part Number</label>
                  <input
                    type="text"
                    required
                    value={editingPart.partNo}
                    onChange={(e) => setEditingPart({ ...editingPart, partNo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Description</label>
                  <input
                    type="text"
                    required
                    value={editingPart.description}
                    onChange={(e) => setEditingPart({ ...editingPart, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Vehicle Model</label>
                  <input
                    type="text"
                    value={editingPart.modelNo}
                    onChange={(e) => setEditingPart({ ...editingPart, modelNo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">
                    No of Usages (Parts needed for 1 vehicle)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingPart.usagePerVehicle || 1}
                    onChange={(e) => setEditingPart({ ...editingPart, usagePerVehicle: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    e.g. 2 for Battery or Wheels (2 needed for 1 vehicle), 1 for Chassis/Swingarm.
                  </span>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Transport Mode</label>
                  <select
                    value={editingPart.transportMode}
                    onChange={(e) => setEditingPart({ ...editingPart, transportMode: e.target.value as TransportMode })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Jumbo Trolley">Jumbo Trolley</option>
                    <option value="BOV (Battery Vehicle)">BOV (Battery Vehicle)</option>
                    <option value="Hand Pallet Truck">Hand Pallet Truck</option>
                    <option value="Manual Handling">Manual Handling</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Packaging / Container Type</label>
                  <select
                    value={editingPart.binOrTrolley || 'Trolley'}
                    onChange={(e) => setEditingPart({ ...editingPart, binOrTrolley: e.target.value as PackagingType })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Trolley">Trolley (Pre-loaded in specialized trolley, e.g. Frame=6)</option>
                    <option value="Bin">Bin (Stored in plastic bin, placed above platform trolley, e.g. Head Lamp=56)</option>
                    <option value="Carton">Carton (Pre-packed inside carton box, e.g. Harness=25)</option>
                    <option value="Cover">Cover (Packet/Polybag, e.g. Cable=50 - Placed freely on any trolley)</option>
                  </select>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                    {editingPart.binOrTrolley === 'Cover'
                      ? 'Cover: Packet/Polybag placed freely on any trolley (0 dedicated trolley demand)'
                      : editingPart.binOrTrolley === 'Carton'
                      ? 'Carton: Pre-packed inside carton box (4 per platform trolley)'
                      : editingPart.binOrTrolley === 'Bin'
                      ? 'Bin: Placed above platform trolley (4 per platform trolley)'
                      : 'Trolley: Pre-loaded directly on dedicated trolley (1 trolley per slot)'}
                  </span>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Bin/Trolley Capacity</label>
                  <input
                    type="number"
                    value={editingPart.binCapacity}
                    onChange={(e) => setEditingPart({ ...editingPart, binCapacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Store Location</label>
                  <input
                    type="text"
                    value={editingPart.storeLocation}
                    onChange={(e) => setEditingPart({ ...editingPart, storeLocation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">POC Point</label>
                  <input
                    type="text"
                    value={editingPart.pocPoint}
                    onChange={(e) => setEditingPart({ ...editingPart, pocPoint: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-amber-850 dark:text-amber-300 font-medium mb-1">
                    No of Trolley/bin QTY required per hour (Takt-based)
                  </label>
                  <input
                    type="number"
                    value={editingPart.hourlyTrolleysRequired ?? ''}
                    placeholder="Auto-calculated if blank"
                    onChange={(e) => setEditingPart({ ...editingPart, hourlyTrolleysRequired: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-500/40 rounded-xl px-3 py-2 text-amber-800 dark:text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">
                    Shift 2 POC Carryover Stock (Units)
                  </label>
                  <input
                    type="number"
                    value={editingPart.initialPocTrolleyStock}
                    onChange={(e) => setEditingPart({ ...editingPart, initialPocTrolleyStock: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-indigo-700 dark:text-indigo-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    ≈ {(editingPart.initialPocTrolleyStock / Math.max(1, editingPart.binCapacity)).toFixed(1)} trolleys/bins carried into Shift 1 (07:00 AM)
                  </span>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">
                    POC Space Limit (Trolleys)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Auto (2 for Frames, 1 otherwise)"
                    value={editingPart.pocSpaceTrolleysMax ?? ''}
                    onChange={(e) => setEditingPart({ ...editingPart, pocSpaceTrolleysMax: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-amber-700 dark:text-amber-450 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Maximum number of full and empty trolleys allowed at POC simultaneously
                  </span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
