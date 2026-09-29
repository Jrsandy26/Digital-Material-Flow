import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  RealTimeInventoryState,
  PartMaster,
  TripPlan,
  Operator,
  PlantAlert,
  ProductionPlan,
  AssemblyLineCode,
  TransportModeConfig,
  TransportMode,
} from '../types/manufacturing';
import { calculatePartMetrics, getMilkRunGroups } from './calculations';

export interface PdfReportOptions {
  selectedAssemblyLine: AssemblyLineCode;
  inventoryStates: RealTimeInventoryState[];
  parts: PartMaster[];
  trips: TripPlan[];
  operators: Operator[];
  alerts: PlantAlert[];
  productionPlan: ProductionPlan;
  modeConfigs: Record<TransportMode, TransportModeConfig>;
}

export function generateStationSummaryPdfReport(options: PdfReportOptions) {
  const {
    selectedAssemblyLine,
    inventoryStates,
    parts,
    trips,
    operators,
    alerts,
    productionPlan,
    modeConfigs,
  } = options;

  // Helper to resolve assembly line for a station item
  const getItemLineCode = (pocPoint: string, part?: PartMaster): AssemblyLineCode => {
    if (part?.assemblyLine) return part.assemblyLine;
    if (pocPoint.includes('300') || pocPoint.includes('PL-3') || pocPoint.includes('ML-3')) return '1VCON300';
    if (pocPoint.includes('200') || pocPoint.includes('PL-2') || pocPoint.includes('ML-2')) return '1VCON200';
    return '1VCON100';
  };

  // Filter Parts and Inventory States according to selectedAssemblyLine
  const filteredInventoryStates = inventoryStates.filter((state) => {
    if (selectedAssemblyLine === 'ALL') return true;
    const part = parts.find((p) => p.partNo === state.partNo);
    const itemLine = getItemLineCode(state.pocPoint, part);
    return itemLine === selectedAssemblyLine;
  });

  const filteredParts = parts.filter((part) => {
    if (selectedAssemblyLine === 'ALL') return true;
    const itemLine = getItemLineCode(part.pocPoint, part);
    return itemLine === selectedAssemblyLine;
  });

  // Calculate station metrics for filtered items
  const filteredPartMetrics = filteredParts.map((part) => ({
    part,
    metrics: calculatePartMetrics(
      part,
      productionPlan.hourlyPlanVehicles,
      productionPlan.shiftPlanVehicles,
      modeConfigs
    ),
  }));

  const totalFilteredParts = filteredParts.length;
  const totalBinsHr = filteredPartMetrics.reduce((acc, pm) => acc + pm.metrics.roundedTrolleysPerHour, 0);

  const milkRunEligible = filteredParts.filter(p => p.transportMode === 'Jumbo Trolley' || p.transportMode === 'BOV (Battery Vehicle)');
  const standardParts = filteredParts.filter(p => p.transportMode !== 'Jumbo Trolley' && p.transportMode !== 'BOV (Battery Vehicle)');
  
  let totalShiftTrips = 0;
  if (milkRunEligible.length > 0) {
    const groups = getMilkRunGroups(milkRunEligible, productionPlan, modeConfigs, filteredInventoryStates);
    totalShiftTrips += groups.reduce((acc, g) => acc + (g.tripsShift ?? 1), 0);
  }
  
  if (standardParts.length > 0) {
    totalShiftTrips += standardParts.reduce((acc, part) => {
      const pm = filteredPartMetrics.find(m => m.part.partNo === part.partNo);
      return acc + (pm ? pm.metrics.tripsRequiredPerShift : 0);
    }, 0);
  }

  const lineStopRiskCount = filteredInventoryStates.filter((s) => s.riskLevel === 'Red').length;
  const warningRiskCount = filteredInventoryStates.filter((s) => s.riskLevel === 'Yellow').length;
  const healthyCount = filteredInventoryStates.filter((s) => s.riskLevel === 'Green').length;
  const coveragePercent = totalFilteredParts > 0
    ? ((healthyCount / Math.max(1, totalFilteredParts)) * 100).toFixed(1)
    : '100.0';

  // Create jsPDF instance in Landscape format
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const navyHeader = [15, 23, 42];
  const accentBlue = [2, 132, 199];

  // Header Background Banner
  doc.setFillColor(navyHeader[0], navyHeader[1], navyHeader[2]);
  doc.rect(0, 0, 297, 28, 'F');

  // Decorative Accent Bar
  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.rect(0, 28, 297, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('TVS MOTORS - MATERIAL FLOW CONTROL TOWER', 12, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Station Metrics & Inventory Summary Report', 12, 19);

  // Filter Badge / Right Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const lineLabel = selectedAssemblyLine === 'ALL'
    ? 'SCOPE: ALL ASSEMBLY LINES'
    : `SCOPE: ASSEMBLY LINE ${selectedAssemblyLine}`;
  doc.text(lineLabel, 285, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  const timestampStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Generated: ${timestampStr} | Target: ${productionPlan.shiftPlanVehicles} Veh/Shift`, 285, 19, { align: 'right' });

  // Executive KPI Summary Banner (Y: 33 to 51)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 33, 273, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  // KPI Column 1: Active Line & Parts
  doc.setFont('helvetica', 'bold');
  doc.text('FILTERED SCOPE', 16, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Assembly Line: ${selectedAssemblyLine}`, 16, 43);
  doc.text(`Station Parts: ${totalFilteredParts} Active Items`, 16, 48);

  // KPI Column 2: Demand & Trips
  doc.setFont('helvetica', 'bold');
  doc.text('SHIFT & HOURLY DEMAND', 80, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Hourly Bin Demand: ${totalBinsHr} Bins/Hr`, 80, 43);
  doc.text(`Total Shift Trips: ${totalShiftTrips} Trips`, 80, 48);

  // KPI Column 3: Risk Breakdown
  doc.setFont('helvetica', 'bold');
  doc.text('SAFETY & RISK STATUS', 155, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Line Stop Risks (Red): ${lineStopRiskCount}`, 155, 43);
  doc.text(`Stock Warnings (Yellow): ${warningRiskCount}`, 155, 48);

  // KPI Column 4: Health & Coverage
  doc.setFont('helvetica', 'bold');
  doc.text('INVENTORY COVERAGE', 230, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Healthy Stations (Green): ${healthyCount}`, 230, 43);
  doc.text(`Safety Coverage: ${coveragePercent}%`, 230, 48);

  // Station Metrics Table Headers
  const tableHeaders = [
    '#',
    'POC Point',
    'Line',
    'Part No',
    'Part Description',
    'Mode / Container',
    'Opening',
    '+ Delivered',
    '- Consumed',
    'Current',
    'Coverage',
    'Bins/Hr',
    'Trips/Shift',
    'Risk Status',
  ];

  // Station Metrics Rows
  const tableBody = filteredInventoryStates.map((state, index) => {
    const part = parts.find((p) => p.partNo === state.partNo);
    const pm = filteredPartMetrics.find((p) => p.part.partNo === state.partNo);
    const itemLine = getItemLineCode(state.pocPoint, part);

    const modeStr = part ? `${part.transportMode.replace(' Trolley', '')} (${part.binCapacity}/bin)` : '-';
    const binsHr = pm ? pm.metrics.roundedTrolleysPerHour : '-';
    
    let tripsShiftStr = '-';
    if (pm) {
      if (part && (part.transportMode === 'Jumbo Trolley' || part.transportMode === 'BOV (Battery Vehicle)')) {
        tripsShiftStr = `${pm.metrics.tripsRequiredPerShift} (Co-loaded)`;
      } else {
        tripsShiftStr = pm.metrics.tripsRequiredPerShift.toString();
      }
    }

    return [
      (index + 1).toString(),
      state.pocPoint,
      itemLine,
      state.partNo,
      part?.description || 'N/A',
      modeStr,
      state.openingStockUnits.toString(),
      `+${state.deliveredQuantityUnits}`,
      `-${state.consumedQuantityUnits}`,
      state.currentStockUnits.toString(),
      `${state.coverageHours}h`,
      binsHr.toString(),
      tripsShiftStr,
      state.riskLevel,
    ];
  });

  // Render Station Metrics AutoTable
  autoTable(doc, {
    startY: 55,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 18, fontStyle: 'bold' },
      3: { cellWidth: 22, fontStyle: 'bold' },
      4: { cellWidth: 50 },
      5: { cellWidth: 28 },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 18, halign: 'right', textColor: [16, 185, 129] },
      8: { cellWidth: 18, halign: 'right', textColor: [217, 119, 6] },
      9: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 18, halign: 'right' },
      11: { cellWidth: 15, halign: 'center' },
      12: { cellWidth: 16, halign: 'center' },
      13: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 13) {
        const val = data.cell.raw as string;
        if (val === 'Red') {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [185, 28, 28];
        } else if (val === 'Yellow') {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [180, 83, 9];
        } else if (val === 'Green') {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [21, 128, 61];
        }
      }
    },
  });

  // Footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(12, 200, 285, 200);

    doc.text(
      'TVS Motor Company - Digital Line Feeding & Material Flow Control Tower | Confidential Operational Summary',
      12,
      204
    );
    doc.text(`Page ${i} of ${totalPages}`, 285, 204, { align: 'right' });
  }

  // Save the pre-formatted PDF document
  const fileName = `Station_Metrics_Summary_Report_${selectedAssemblyLine}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

export interface MisuzumashiPdfOptions {
  swctCycleSteps: any[];
  operatorName: string;
  selectedAssemblyLine: string;
  productionPlan: any;
  neededParts: number;
  windowLabel?: string;
  scheduleMode?: 'takt_interval' | 'consecutive';
}

export function generateMisuzumashiChartPdfReport(options: MisuzumashiPdfOptions) {
  const { swctCycleSteps, operatorName, selectedAssemblyLine, productionPlan, neededParts, windowLabel, scheduleMode = 'takt_interval' } = options;
  const isConsecutive = scheduleMode === 'consecutive';

  // Create Landscape A4 PDF Document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const primaryNavy = [15, 23, 42];
  const accentGold = [234, 179, 8];
  const grayBorder = [0, 0, 0]; // High contrast black borders for technical standard charts

  // Dynamic maximum minutes calculation
  let calculatedMaxMin = 60;
  swctCycleSteps.forEach(row => {
    let rowEndMin = (row.startTimeSec || 0) / 60;
    row.steps?.forEach((s: any) => { rowEndMin += (s.duration || 0) / 60; });
    row.consumption?.forEach((c: any) => {
      const cEnd = rowEndMin + (c.mins || 0);
      if (cEnd > calculatedMaxMin) calculatedMaxMin = cEnd;
    });
    if (rowEndMin > calculatedMaxMin) calculatedMaxMin = rowEndMin;
  });
  const maxTimeLine = Math.min(180, Math.max(60, Math.ceil(calculatedMaxMin / 10) * 10));

  // Title Box (Row 1)
  doc.setLineWidth(0.6);
  doc.setDrawColor(0, 0, 0);
  doc.rect(10, 8, 277, 10);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isConsecutive ? 10.5 : 12);
  doc.setTextColor(0, 0, 0);
  const titleSuffix = windowLabel ? ` — ${windowLabel.toUpperCase()}` : '';
  
  if (isConsecutive) {
    doc.text(`SWCT MOTION STUDY (CONSECUTIVE TRIPS) — ERGONOMIC ANALYSIS ONLY${titleSuffix}`, 148.5, 13, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('⚠ PURE OPERATOR BUSY-TIME TIME-STUDY (NOT PACED TO CONSUMPTION — NOT FOR LIVE SHOPFLOOR DISPATCH)', 148.5, 16.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  } else {
    doc.text(`STANDARD WORK COMBINATION SHEET (MISUZUMASHI OPERATIONAL LAYOUT)${titleSuffix}`, 148.5, 15, { align: 'center' });
  }

  // Metadata Grid Block (Row 2: Y: 18 to 34)
  doc.rect(10, 18, 277, 16);
  
  // vertical column grid dividers
  doc.line(70, 18, 70, 34);
  doc.line(140, 18, 140, 34);
  doc.line(205, 18, 205, 34);

  // Metadata contents
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  
  // Cell 1: Operator Name & Line
  doc.text('OPERATIONAL PROFILE', 12, 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`Operator Name: ${operatorName || 'Mizusumashi Operator'}`, 12, 26);
  doc.text(`Assembly Line: ${selectedAssemblyLine}`, 12, 31);

  // Cell 2: Schedule & Mode
  doc.setFont('helvetica', 'bold');
  doc.text('CHART METRICS & DISPATCH', 72, 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`Timeline Window: ${windowLabel || 'Shift Overview'}`, 72, 26);
  if (isConsecutive) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(`Mode: Motion Study (Ergo Only)`, 72, 30);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  } else {
    doc.text(`Mode: Live Plan (Takt -2m)`, 72, 30);
  }
  doc.text(`Takt Target: ${productionPlan.taktTimeSeconds}s | Scale: 0-${maxTimeLine}m`, 72, 33.5);

  // Cell 3: Needed parts
  doc.setFont('helvetica', 'bold');
  doc.text('VOLUME REQUIREMENTS', 142, 22);
  doc.setFont('helvetica', 'normal');
  doc.text(`Needed Parts / Shift: ${neededParts} units`, 142, 26);
  doc.text(`Target Vehicles: ${productionPlan.shiftPlanVehicles} Vehicles`, 142, 31);

  // Cell 4: Legends
  doc.setFont('helvetica', 'bold');
  doc.text('CHART LEGEND', 207, 22);
  
  // Pick / Loading Legend
  doc.setFillColor(253, 224, 71);
  doc.rect(207, 24.5, 5, 2.5, 'F');
  doc.rect(207, 24.5, 5, 2.5, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Pick / Load / Placing', 214, 26.5);

  // Empty Picking Legend
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.line(207, 29, 212, 29);
  doc.text('Empty Return / Walk', 214, 30);

  // Inventory Legend
  doc.setDrawColor(239, 68, 68);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(207, 32.5, 212, 32.5);
  doc.text('Inventory Consumption', 214, 33);
  doc.setLineDashPattern([], 0); // clear dashes

  // Reset drawing settings
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);

  // Build grid columns
  const tableHeaders = [
    'No',
    'Operation',
    'Pick (s)',
    'Consumption (m)',
    'Empty (s)',
    `Timeline Diagram & Replenishment Sequencing (0 to ${maxTimeLine} Minutes)`
  ];

  // Map steps to raw row data
  const tableBody = swctCycleSteps.map((row, idx) => {
    const pickTimeStr = row.pickTime > 0 ? `${row.pickTime}s` : '0s';
    const consStr = row.consumption && row.consumption.length > 0
      ? row.consumption.map((c: any) => `${c.description || c.label}: ${c.mins}m`).join('\n')
      : '—';
    const emptyTimeStr = row.emptyTime > 0 ? `${row.emptyTime}s` : '0s';

    return [
      (idx + 1).toString(),
      row.operation || 'N/A',
      pickTimeStr,
      consStr,
      emptyTimeStr,
      '' // Timeline Column filled by custom drawing
    ];
  });

  // Render Table
  autoTable(doc, {
    startY: 37,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 54, fontStyle: 'bold' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 38 }, // Widened consumption column so items are clearly readable
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 149 }, // timeline column
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        // We render visual timeline vectors right inside the cell!
        const x = data.cell.x;
        const y = data.cell.y;
        const w = data.cell.width;
        const h = data.cell.height;

        const scale = w / maxTimeLine;

        // Draw fine grid lines background
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        for (let tick = 0; tick <= maxTimeLine; tick += 5) {
          const tickX = x + (tick * scale);
          if (tick % 10 === 0) {
            doc.setDrawColor(148, 163, 184); // bolder lines for 10m intervals
          } else {
            doc.setDrawColor(226, 232, 240);
          }
          doc.line(tickX, y, tickX, y + h);
        }

        // Fetch row details from original swctCycleSteps matching index
        const rowData = swctCycleSteps[data.row.index];
        if (rowData) {
          let currentLeftMin = (rowData.startTimeSec || 0) / 60;
          let unloadEndTimeMin = 0;

          // Steps drawing loop
          rowData.steps.forEach((step: any) => {
            const durationMin = step.duration / 60;
            const leftX = x + (currentLeftMin * scale);
            const widthX = durationMin * scale;

            if (step.label === 'Unloading') {
              unloadEndTimeMin = currentLeftMin + durationMin;
            }

            if (step.label === 'Loading' || step.label === 'Unloading') {
              // Draw Yellow bar
              doc.setFillColor(253, 224, 71);
              doc.setDrawColor(0, 0, 0);
              doc.setLineWidth(0.2);
              doc.rect(leftX, y + 1.5, Math.max(0.5, widthX), h - 3, 'F');
              doc.rect(leftX, y + 1.5, Math.max(0.5, widthX), h - 3, 'S');
            } else {
              // Draw wavy blue lines for moving/return steps
              const midY = y + (h / 2);
              doc.setDrawColor(37, 99, 235);
              doc.setLineWidth(0.4);
              
              // Draw a perfect sine-wave inside the bounds using line segments
              const numPoints = Math.max(10, Math.floor(widthX * 2));
              let prevPx = leftX;
              let prevPy = midY;
              for (let pt = 1; pt <= numPoints; pt++) {
                const ratio = pt / numPoints;
                const px = leftX + (ratio * widthX);
                const py = midY + Math.sin(ratio * Math.PI * 4) * 1.5;
                doc.line(prevPx, prevPy, px, py);
                prevPx = px;
                prevPy = py;
              }
            }

            currentLeftMin += durationMin;
          });

          // Draw vertical connector drop to subsequent row
          if (data.row.index < swctCycleSteps.length - 1) {
            const nextRowData = swctCycleSteps[data.row.index + 1];
            if (nextRowData) {
              const endX = x + (currentLeftMin * scale);
              doc.setDrawColor(0, 0, 0);
              doc.setLineWidth(0.3);
              doc.line(endX, y + (h / 2), endX, y + h);
            }
          }

          // Draw inventory dashed lines (Consumption Coverage)
          if (unloadEndTimeMin > 0 && rowData.consumption && rowData.consumption.length > 0) {
            rowData.consumption.forEach((cons: any, cIdx: number) => {
              const invStartPercent = x + (unloadEndTimeMin * scale);
              const invWidthPercent = cons.mins * scale;
              const yOffset = y + 5.5 + (cIdx * 2.5);

              doc.setDrawColor(239, 68, 68);
              doc.setLineWidth(0.3);
              doc.setLineDashPattern([1.2, 1.2], 0);
              doc.line(invStartPercent, yOffset, Math.min(x + w, invStartPercent + invWidthPercent), yOffset);
              
              // clear dash and draw end line
              doc.setLineDashPattern([], 0);
              doc.line(Math.min(x + w, invStartPercent + invWidthPercent), yOffset - 1, Math.min(x + w, invStartPercent + invWidthPercent), yOffset + 1);

              // tiny text label
              doc.setFontSize(5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(239, 68, 68);
              doc.text(`${cons.mins}m`, Math.min(x + w - 4, invStartPercent + invWidthPercent + 1.2), yOffset + 0.8);
              doc.setTextColor(0, 0, 0); // reset
            });
          }
        }
      }
    }
  });

  // Footer operational summary
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);

    doc.line(10, 200, 287, 200);
    doc.text('TVS Motor Company - Standard Work Combination Sheet | Mizusumashi Digital System Log', 10, 204);
    doc.text(`Page ${i} of ${totalPages}`, 287, 204, { align: 'right' });
  }

  // Save Document
  const filePrefix = isConsecutive ? 'SWCT_Motion_Study_Ergonomic_Report' : 'SWCT_Operational_Live_Plan';
  const fileName = `${filePrefix}_${selectedAssemblyLine}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
