import React, { useState } from 'react';
import { MapPin, Route as RouteIcon, Clock, Users, Truck, ArrowRight, Sparkles, TrendingDown, ShieldCheck, Activity, Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { getMilkRunGroups, filterPartsByLine, filterInventoryByLine, filterRoutesByLine } from '../../../utils/calculations';
import { AssemblyLineToggle } from '../../common/AssemblyLineToggle';

import { ExcelRequiredPlaceholder } from '../../common/ExcelRequiredPlaceholder';

export const RouteMasterView: React.FC = () => {
  const { routes, operators, parts, productionPlan, modeConfigs, inventoryStates, selectedAssemblyLine } = useMaterialFlow();
  const [routeMode, setRouteMode] = useState<'standard' | 'milkrun'>('milkrun');

  const filteredParts = React.useMemo(() => filterPartsByLine(parts, selectedAssemblyLine), [parts, selectedAssemblyLine]);
  const filteredInventoryStates = React.useMemo(() => filterInventoryByLine(inventoryStates, parts, selectedAssemblyLine), [inventoryStates, parts, selectedAssemblyLine]);
  const filteredRoutes = React.useMemo(() => filterRoutesByLine(routes, parts, selectedAssemblyLine), [routes, parts, selectedAssemblyLine]);

  // Generate dynamic Milk-Run groups based on active parts/production parameters
  const milkRunGroups = getMilkRunGroups(filteredParts, productionPlan, modeConfigs, filteredInventoryStates);

  // Compute stats for comparisons
  const totalStandardTrips = filteredParts.length * 3; // rough estimate
  const totalMilkRunTrips = milkRunGroups.length * 2; // balanced frequency
  const percentReduction = totalStandardTrips > 0 ? Math.round(((totalStandardTrips - totalMilkRunTrips) / totalStandardTrips) * 100) : 0;

  // Download Excel Export
  const downloadRoutesExcel = () => {
    const wb = XLSX.utils.book_new();

    if (routeMode === 'milkrun') {
      // Export Milk-Run Grouping Sequences
      const headers = [
        'Route/Group ID',
        'Route Name',
        'Vehicle Type',
        'Capacity Load (Bins)',
        'Co-Loading Sequence & Delivery Path',
        'Assigned Parts (Single-Trip qty)',
        'Total Cycle Time (Min)',
        'Assigned Operator'
      ];
      const data = milkRunGroups.map((group, idx) => {
        const assignedOp = operators[idx % operators.length]?.name || 'Unassigned';
        const path = group.storeLocations.map(store => `LOAD ${store}`).join(' -> ') + ` -> DROP ${group.pocPoint} -> Empty Ret`;
        const partsText = group.parts.map(p => `${p.part.partNo} (${p.loadQty} bin)`).join(' + ');
        return [
          group.groupId,
          group.groupName,
          group.transportMode,
          `${group.totalTrolleys} / 3 Bins`,
          path,
          partsText,
          group.cycleTimeMin.toFixed(1),
          assignedOp
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 18 },
        { wch: 45 },
        { wch: 35 },
        { wch: 22 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Milk-Run Route Sequences');
    } else {
      // Export Standard Part-wise Sequences
      const headers = [
        'Route ID',
        'Route Name',
        'Vehicle Type',
        'Total Distance (m)',
        'Store Location',
        'Delivery POC Sequence',
        'Assigned Parts',
        'Total Cycle Time (Min)',
        'Assigned Operator'
      ];
      const data = routes.map((route) => {
        const assignedOp = operators.find((o) => o.id === route.assignedOperatorId)?.name || 'Unassigned';
        const path = `${route.storeLocation.split(' ')[0]} -> ` + route.pocSequence.join(' -> ') + ` -> Return Store`;
        const partsText = route.partsCarried.join(', ');
        return [
          route.routeId,
          route.routeName,
          route.transportMode,
          route.totalDistanceMeters,
          route.storeLocation,
          path,
          partsText,
          route.totalCycleTimeMin,
          assignedOp
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 40 },
        { wch: 30 },
        { wch: 22 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Standard Route Sequences');
    }

    XLSX.writeFile(wb, `TVS_MHF_RouteMaster_${routeMode}_Mode.xlsx`);
  };

  // Download PDF Export
  const downloadRoutesPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 size

    // Title text
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('TVS CONTROL TOWER - ROUTE MASTER SEQUENCES', 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()} | Active Mode: ${routeMode.toUpperCase()}`, 14, 21);

    if (routeMode === 'milkrun') {
      const tableHeaders = [[
        'ID',
        'Route Name',
        'Vehicle',
        'Load Bins',
        'Co-Loading Sequence & Delivery Path',
        'Assigned Parts (Single-Trip)',
        'Cycle Time',
        'Operator'
      ]];

      const tableData = milkRunGroups.map((group, idx) => {
        const assignedOp = operators[idx % operators.length]?.name || 'Unassigned';
        const path = group.storeLocations.map(store => `LOAD ${store}`).join(' -> ') + `\n-> DROP ${group.pocPoint}\n-> Return`;
        const partsText = group.parts.map(p => `${p.part.partNo} (${p.loadQty} bin)`).join('\n');
        return [
          group.groupId,
          group.groupName,
          group.transportMode,
          `${group.totalTrolleys} / 3 Bins`,
          path,
          partsText,
          `${group.cycleTimeMin.toFixed(1)} Min`,
          assignedOp
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold', font: 'helvetica', fontSize: 9 }, // blue-700
        bodyStyles: { textColor: [51, 65, 85], font: 'helvetica', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 65 },
          5: { cellWidth: 45 },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    } else {
      const tableHeaders = [[
        'ID',
        'Route Name',
        'Vehicle',
        'Distance',
        'Delivery Sequence & Path',
        'Assigned Parts',
        'Cycle Time',
        'Operator'
      ]];

      const tableData = routes.map((route) => {
        const assignedOp = operators.find((o) => o.id === route.assignedOperatorId)?.name || 'Unassigned';
        const path = `${route.storeLocation.split(' ')[0]} ->\n` + route.pocSequence.join(' -> ') + `\n-> Return`;
        const partsText = route.partsCarried.join(', ');
        return [
          route.routeId,
          route.routeName,
          route.transportMode,
          `${route.totalDistanceMeters}m`,
          path,
          partsText,
          `${route.totalCycleTimeMin} Min`,
          assignedOp
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', font: 'helvetica', fontSize: 9 },
        bodyStyles: { textColor: [51, 65, 85], font: 'helvetica', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 22 },
          4: { cellWidth: 65 },
          5: { cellWidth: 50 },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    }

    doc.save(`TVS_MHF_RouteMaster_${routeMode}_Mode.pdf`);
  };

  if (parts.length === 0) {
    return <ExcelRequiredPlaceholder />;
  }

  return (
    <div id="route-master-view" className="space-y-6 font-mono">
      
      {/* Header with Switcher & Downloads */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RouteIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Route Master & Co-Loading Sequences
            <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
              ({selectedAssemblyLine === 'ALL' ? 'ALL LINES' : selectedAssemblyLine})
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Optimize material movement from Stores to line POCs using consolidated Milk-Run grouping
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Route Mode Switcher */}
          <div className="flex bg-slate-200/50 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800">
            <button
              onClick={() => setRouteMode('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                routeMode === 'standard'
                  ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-sm dark:shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Standard Delivery
            </button>
            <button
              onClick={() => setRouteMode('milkrun')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                routeMode === 'milkrun'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Milk-Run Co-Loading
            </button>
          </div>

          {/* Export Controls */}
          <div className="flex items-center bg-slate-200/50 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800 gap-1.5">
            <button
              onClick={downloadRoutesExcel}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer shadow-sm dark:shadow-md"
              title="Download Excel Format"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>XLSX</span>
            </button>
            <button
              onClick={downloadRoutesPDF}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-450 flex items-center gap-1.5 cursor-pointer shadow-sm dark:shadow-md"
              title="Download PDF Format"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Seed-and-Fill Explainer Block */}
      {routeMode === 'milkrun' && (
        <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-blue-900/30 rounded-2xl p-5 shadow-lg dark:shadow-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dynamic Seed-and-Fill Trip Grouping Engine</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Real-time prevention of line shortages through intelligent multi-part consolidation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850 relative">
              <div className="absolute top-2 right-2 text-[10px] text-blue-600 dark:text-blue-500 font-bold">STEP 1</div>
              <h4 className="text-slate-900 dark:text-white font-bold text-[11px] mb-1 pr-6">Check Coverage</h4>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Assess live line stock & find material with the least remaining minutes.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850 relative">
              <div className="absolute top-2 right-2 text-[10px] text-blue-600 dark:text-blue-500 font-bold">STEP 2</div>
              <h4 className="text-slate-900 dark:text-white font-bold text-[11px] mb-1 pr-6">Select Seed</h4>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Put the most critical part on the Jumbo first (becomes Trolley 1).</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850 relative">
              <div className="absolute top-2 right-2 text-[10px] text-blue-600 dark:text-blue-500 font-bold">STEP 3</div>
              <h4 className="text-slate-900 dark:text-white font-bold text-[11px] mb-1 pr-6">Fill Compatible Slots</h4>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Score candidates by Same POC (+150), Same Store (+75), and Urgency.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850 relative">
              <div className="absolute top-2 right-2 text-[10px] text-blue-600 dark:text-blue-500 font-bold">STEP 4</div>
              <h4 className="text-slate-900 dark:text-white font-bold text-[11px] mb-1 pr-6">Route Feasibility</h4>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Verify if travel time ensures arrival before any of the 1–3 parts runs dry.</p>
            </div>

            <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850 relative">
              <div className="absolute top-2 right-2 text-[10px] text-blue-600 dark:text-blue-500 font-bold">STEP 5</div>
              <h4 className="text-slate-900 dark:text-white font-bold text-[11px] mb-1 pr-6">Simulate Dispatch</h4>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed">Refill stock, advance time, find next critical material, and repeat.</p>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Insights Banner (Shown when Milk-Run is active) */}
      {routeMode === 'milkrun' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 p-4 rounded-2xl flex items-start gap-3">
            <TrendingDown className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase">Congestion Reduced</h4>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                By co-loading parts on standard Jumbo Trolleys, total inter-aisle trips drop from <strong className="text-blue-600 dark:text-blue-300">{totalStandardTrips}</strong> to <strong className="text-emerald-600 dark:text-emerald-400">{totalMilkRunTrips}</strong> per shift (<strong className="text-emerald-600 dark:text-emerald-400">-{percentReduction}% Traffic</strong>).
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 p-4 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase">Zero Line Stoppage</h4>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                Matched components (e.g. Left & Right Leg Assemblies) are delivered together. This eliminates starvation where one part is in stock but the matching component is delayed.
              </p>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 p-4 rounded-2xl flex items-start gap-3">
            <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase">Balanced Workloads</h4>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                Operators travel with fuller loads (3 trolleys/trip) rather than running multiple half-empty trips, leading to a highly consistent and sustainable operator fatigue cycle.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Routes Grid Display */}
      {routeMode === 'standard' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {routes.map((route) => {
            const assignedOp = operators.find((o) => o.id === route.assignedOperatorId);
            return (
              <div key={route.routeId} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400 text-xs">{route.routeId}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        {route.transportMode}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{route.routeName}</h3>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Total Distance</div>
                    <div className="font-mono font-extrabold text-cyan-600 dark:text-cyan-300 text-sm">{route.totalDistanceMeters}m</div>
                  </div>
                </div>

                {/* Sequence Flow */}
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Delivery POC Sequence:</div>
                  <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-400 text-xs font-mono font-bold">
                      {route.storeLocation.split(' ')[0]}
                    </div>

                    {route.pocSequence.map((poc, idx) => (
                      <React.Fragment key={poc}>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                        <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold">
                          {poc}
                        </div>
                      </React.Fragment>
                    ))}

                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                    <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-500 text-xs font-mono">
                      Return Store
                    </div>
                  </div>
                </div>

                {/* Parts list standard */}
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">Assigned Parts (Single-Item Flow):</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {route.partsCarried.map((pn) => {
                      const pt = parts.find((p) => p.partNo === pn);
                      return (
                        <div key={pn} className="bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-850">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 block">{pn}</span>
                          <span className="text-slate-500 dark:text-slate-400 block truncate">{pt?.description || 'Component'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">Total Cycle Time</div>
                    <div className="font-bold text-slate-900 dark:text-white font-mono mt-0.5">{route.totalCycleTimeMin} Minutes</div>
                  </div>

                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">Assigned Operator</div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-300 font-mono mt-0.5">
                      {assignedOp ? assignedOp.name : 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Milk-Run Display */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {milkRunGroups.map((group, gIdx) => {
            const assignedOp = operators[gIdx % operators.length];
            return (
              <div key={group.groupId} className="bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-5 shadow-xl space-y-4 hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">{group.groupId}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {group.transportMode}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{group.groupName}</h3>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Co-Loaded</div>
                    <div className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {group.totalTrolleys} / 3 Bins
                    </div>
                  </div>
                </div>

                {/* Milk Run Pickup Map */}
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Sequential Co-Loading & Delivery Path:</div>
                  <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                    
                    {/* Visual Segment Diagram */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Pick locations */}
                      {group.storeLocations.map((store, idx) => (
                        <React.Fragment key={store}>
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-blue-400 dark:text-blue-500/60 shrink-0" />}
                          <div className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            LOAD {store}
                          </div>
                        </React.Fragment>
                      ))}

                      <ArrowRight className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />

                      {/* Drop POC */}
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
                        DROP {group.pocPoint}
                      </div>

                      <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-600 shrink-0" />
                      <div className="px-2 py-0.5 rounded text-slate-400 dark:text-slate-500 text-[10px]">
                        Empty Ret
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grouped Material Cargo Loading Bay */}
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">Active Cargo Bay Loadout:</div>
                  <div className="space-y-1.5">
                    {group.parts.map(({ part, loadQty }) => (
                      <div key={part.partNo} className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs block">{part.partNo}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px] truncate block">{part.description}</span>
                          <span className="text-slate-400 dark:text-slate-500 text-[9px] block">Store: {part.storeLocation} | Target: {part.pocPoint}</span>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-slate-750 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] inline-block">
                            {loadQty} {loadQty === 1 ? 'Trolley' : 'Trolleys'} ({part.binCapacity} qty)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">Total Cycle Time</div>
                    <div className="font-bold text-slate-900 dark:text-white font-mono mt-0.5">{group.cycleTimeMin.toFixed(1)} Minutes</div>
                  </div>

                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">Assigned Milk Operator</div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-300 font-mono mt-0.5">
                      {assignedOp ? assignedOp.name : 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
