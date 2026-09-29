/**
 * Excel Upload & Template Processing Engine using SheetJS (xlsx)
 */

import * as XLSX from 'xlsx-js-style';
import { PartMaster, ProductionPlan, TransportMode, TransportModeConfig, Operator, PackagingType } from '../types/manufacturing';
import { calculatePartMetrics, getShiftTripHandoverMapping } from './calculations';
import { calculateStoreToStationDistance, POC_MAX_TROLLEYS_PER_STATION, STATION_GAP_METERS, getPartPocSpaceLimit } from './pocSorter';

export function parsePackagingType(val: any, desc?: string): PackagingType {
  const str = String(val || '').trim().toLowerCase();
  
  // 1. Explicit Cover matching (parts inside cover/packet/polybag placed on any trolley)
  if (
    str.includes('cover') ||
    str.includes('packet') ||
    str.includes('pkt') ||
    str.includes('bag') ||
    str.includes('polybag') ||
    str.includes('poly-bag') ||
    str.includes('pouch') ||
    str.includes('loose')
  ) {
    return 'Cover';
  }

  // 2. Explicit Carton matching (pre-packed inside carton box)
  if (
    str.includes('carton') ||
    str.includes('corrugated') ||
    str.includes('pre packed') ||
    str.includes('pre-packed') ||
    str.includes('prepacked') ||
    str === 'cb' ||
    str === 'c/b' ||
    str.includes('carton box') ||
    (str.includes('box') && !str.includes('bin') && !str.includes('trolley'))
  ) {
    return 'Carton';
  }

  // 3. Explicit Bin matching (stored inside bin, placed above platform trolley)
  if (
    str.includes('bin') ||
    str.includes('tote') ||
    str.includes('crate') ||
    str.includes('plastic') ||
    str.includes('tray')
  ) {
    return 'Bin';
  }

  // 4. Explicit Trolley matching (parts pre-loaded in dedicated trolley, e.g. frame=6)
  if (
    str.includes('trolley') ||
    str.includes('trly') ||
    str.includes('dolly') ||
    str.includes('rack') ||
    str.includes('carrier')
  ) {
    return 'Trolley';
  }

  // 5. Fallback inference based on Part Description
  if (desc) {
    const descLower = desc.toLowerCase();
    if (descLower.includes('cable') || descLower.includes('brake cable') || descLower.includes('accel cable') || descLower.includes('wire cover') || descLower.includes('cover') || descLower.includes('packet') || descLower.includes('pouch')) {
      return 'Cover';
    }
    if (descLower.includes('carton') || descLower.includes('harness') || descLower.includes('mirror') || descLower.includes('charger')) {
      return 'Carton';
    }
    if (descLower.includes('bin') || descLower.includes('headlamp') || descLower.includes('head lamp') || descLower.includes('switch') || descLower.includes('screw') || descLower.includes('bracket') || descLower.includes('grip') || descLower.includes('throttle')) {
      return 'Bin';
    }
    if (descLower.includes('frame') || descLower.includes('wheel') || descLower.includes('swingarm') || descLower.includes('battery')) {
      return 'Trolley';
    }
  }

  return 'Trolley';
}

export function downloadSampleExcelTemplate() {
  const headers = [
    'S.NO',
    'Jumbo / Manual',
    'Model No',
    'PART NO',
    'Description',
    'BIN / Trolley / Carton / Cover',
    '(No of QTY Loaded in single Trolley/bin)',
    'STORE',
    'POC Point',
    'No of Usages (Qty per Vehicle)',
    'No of Trolley/bin QTY required for one hour based on takt time',
    'LOAD MOVING Distance /trip (M)',
    'EMPTY MOVING Distance /trip (M)',
    'POC Space Constraint (no/trolley)',
  ];

  const sampleRows = [
    [
      1,
      'Jumbo',
      'I Qube',
      'KE090530',
      'SWINGARM SUB ASSY DRUM',
      'Trolley', // Trolley: pre-loaded in dedicated trolley
      60,
      'E 03,04',
      'PL-03',
      1,
      2,
      194,
      194,
      1,
    ],
    [
      2,
      'Jumbo',
      'I Qube',
      'K6100890',
      'LOWER BRKT COMP',
      'Trolley', // Trolley: pre-loaded in dedicated trolley
      80,
      'E 05,06',
      'PL-13',
      1,
      2,
      278,
      278,
      1,
    ],
    [
      3,
      'Jumbo',
      'I Qube',
      'KE121500',
      'SUB FRAME COMP',
      'Trolley', // Trolley: pre-loaded in dedicated trolley
      64,
      'E 07,09',
      'PL-03',
      1,
      2,
      186,
      186,
      2,
    ],
    [
      4,
      'Jumbo',
      'I Qube',
      'KE121530',
      'FRAME, SCOOTER COMP',
      'Trolley', // Trolley: pre-loaded in trolley eg frame=6
      6,
      'E 10-17',
      'PL-03',
      1,
      22, // 129 / 6 = ~21.5 -> 22 trolleys/hr
      192,
      192,
      2,
    ],
    [
      5,
      'Jumbo',
      'I Qube',
      'KE110470',
      'WHEEL ASSY DISC TUBELESS',
      'Trolley', // Trolley: pre-loaded in trolley, 2 wheels per vehicle
      30,
      'B 15,16',
      'PL-13',
      2, // 2 Wheels needed for 1 vehicle
      9, // 258 wheels / 30 = ~8.6 -> 9 trolleys/hr
      204,
      204,
      1,
    ],
    [
      6,
      'Jumbo',
      'I Qube',
      'BAT-48V-01',
      'BATTERY PACK ASSEMBLY 48V (Dual Modules)',
      'Trolley', // Trolley: 64 qty of battery placed inside the trolley
      64,
      'B 01,02',
      'PL-08',
      2, // 2 Battery packs needed for 1 vehicle
      5, // 258 batteries / 64 = ~4.03 -> 5 trolleys/hr
      180,
      180,
      2,
    ],
    [
      7,
      'Jumbo',
      'I Qube',
      'HEADLAMP-01',
      'HEAD LAMP ASSEMBLY LED',
      'Bin', // Bin: 56 qty placed inside the bin, placed above platform trolley
      56,
      'E 01,02',
      'PL-05',
      1,
      3, // 129 / 56 = ~2.3 -> 3 bins/hr
      160,
      160,
      2,
    ],
    [
      8,
      'Jumbo',
      'I Qube',
      'HARN-EV-01',
      'WIRING HARNESS COMP EV',
      'Carton', // Carton: pre-packed by vendor and placed inside carton box
      25,
      'D 11,12',
      'PL-07',
      1,
      6, // 129 / 25 = ~5.16 -> 6 cartons/hr
      175,
      175,
      2,
    ],
    [
      9,
      'Jumbo',
      'I Qube',
      'CABLE-BRK-01',
      'CABLE ASSY BRAKE',
      'Cover', // Cover: packet/polybag with 50 pcs, placed freely on any trolley (zero trolley demand)
      50, // 50 qty inside cover packet
      'D 05,06',
      'PL-06',
      1, // 1 per vehicle
      0, // Placed on any trolley, no separate trolley required (3 cover packets piggybacked per hr)
      170,
      170,
      2,
    ],
  ];

  const worksheetData = [headers, ...sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths for clean readability
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 32 },
    { wch: 12 },
    { wch: 36 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 42 },
    { wch: 28 },
    { wch: 28 },
    { wch: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Material Flow Master');

  // Generate binary output and download
  XLSX.writeFile(workbook, 'Digital_Material_Flow_I_Qube_Template.xlsx');
}

export async function parseUploadedExcel(file: File): Promise<PartMaster[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Uploaded Excel workbook has no sheets');
        }

        // Keywords to evaluate candidate header rows and candidate sheets
        const coreKeywords = [
          'part', 'material', 'item', 's.no', 'sno', 'sl.no', 'sl', 'no',
          'description', 'desc', 'model', 'jumbo', 'manual', 'mode', 'store',
          'poc', 'station', 'usage', 'trolley', 'bin', 'capacity', 'qty',
          'distance', 'load', 'empty', 'moving'
        ];

        // 1. Select the best sheet in the workbook with the most material flow data
        let bestSheetName = workbook.SheetNames[0];
        let maxDataScore = -1;
        let bestRows: any[] = [];
        let bestHeaderIdx = 0;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (!rows || rows.length < 2) continue;

          // Scan first 15 rows to find best header row in this sheet
          for (let rIdx = 0; rIdx < Math.min(15, rows.length); rIdx++) {
            const row = rows[rIdx];
            if (!Array.isArray(row)) continue;

            const rowText = row.map((cell) => String(cell || '').toLowerCase()).join(' ');
            let matchScore = 0;
            coreKeywords.forEach((kw) => {
              if (rowText.includes(kw)) matchScore++;
            });

            if (matchScore > maxDataScore) {
              maxDataScore = matchScore;
              bestSheetName = sheetName;
              bestRows = rows;
              bestHeaderIdx = rIdx;
            }
          }
        }

        if (bestRows.length < 2) {
          throw new Error('Excel file contains no readable data rows');
        }

        const actualHeaderIndex = bestHeaderIdx;
        const headers: string[] = bestRows[actualHeaderIndex].map((h: any) =>
          String(h || '').trim().toLowerCase()
        );

        const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // Prioritized and robust column header matching
        const getColIdx = (searchTerms: string[], fallbackIdx: number, excludeTerms: string[] = []) => {
          // 1. Exact match after alphanumeric normalization
          for (const term of searchTerms) {
            const normTerm = normalize(term);
            const idx = headers.findIndex((h) => {
              if (excludeTerms.some((ex) => normalize(h).includes(normalize(ex)))) return false;
              return normalize(h) === normTerm;
            });
            if (idx >= 0) return idx;
          }
          // 2. Substring matching (checking both normalized and standard lowercase)
          for (const term of searchTerms) {
            const normTerm = normalize(term);
            const idx = headers.findIndex((h) => {
              if (excludeTerms.some((ex) => normalize(h).includes(normalize(ex)))) return false;
              return normalize(h).includes(normTerm) || h.includes(term.toLowerCase());
            });
            if (idx >= 0) return idx;
          }
          return fallbackIdx;
        };

        // Determine positional offsets if S.No column is present
        const hasSNo = headers.some((h) => h.includes('s.no') || h.includes('sno') || h.includes('sl') || h === 'no');
        const defaultOffset = hasSNo ? 1 : 0;

        // Comprehensive flexible column index resolution
        const modeIdx = getColIdx(['jumbo', 'manual', 'mode', 'bov', 'handling', 'transport', 'vehicle type'], 0 + defaultOffset);
        const modelIdx = getColIdx(['vehicle model', 'model no', 'model', 'vehicle', 'series'], 1 + defaultOffset);
        const partNoIdx = getColIdx(['part no', 'part_no', 'partno', 'part number', 'item code', 'item no', 'material code', 'material no', 'material', 'item', 'pn', 'p/n', 'code'], 2 + defaultOffset);
        const descIdx = getColIdx(['description', 'desc', 'part name', 'item name', 'material name', 'details', 'name'], 3 + defaultOffset);
        
        // Exclude 'veh', 'vehicle', 'usage' so bin capacity never accidentally latches onto "qty per vehicle" or "no of usage"
        let capIdx = getColIdx(
          [
            '(no of qty loaded in single trolley/bin)',
            'no of qty loaded in single trolley/bin',
            'no of qty loaded in single trolley/bin/carton',
            'no of qty loaded in single trolley/bin/carton/cover',
            'qty loaded in single trolley/bin',
            'no of qty loaded in single trolley',
            'no of qty loaded in single bin',
            'qty loaded in single trolley',
            'qty loaded in single bin',
            'no of qty loaded in single',
            'no of qty loaded',
            'qty loaded in single',
            'qty loaded',
            'single trolley/bin',
            'loaded in single trolley',
            'loaded in single bin',
            'loaded in single',
            'qty in single trolley',
            'qty in single bin',
            'qty/trolley',
            'qty / trolley',
            'qty per trolley',
            'qty/bin',
            'qty / bin',
            'qty per bin',
            'bin capacity',
            'trolley capacity',
            'capacity',
            'bin qty',
            'trolley qty',
            'batch size',
            'pack size',
            'units/bin',
            'units/trolley',
            'units per trolley',
            'pcs per trolley',
            'pcs per bin',
            'pcs per cover'
          ],
          6,
          ['vehicle', 'veh', 'usage', 'usages']
        );
        
        const storeIdx = getColIdx(['store location', 'store loc', 'store', 'warehouse', 'source', 'depot'], 7);
        const pocIdx = getColIdx(['poc point', 'poc station', 'poc', 'station', 'line point', 'drop point', 'destination'], 8);
        
        // Comprehensive matching for "No of Usages" / parts needed per 1 vehicle
        const usageIdx = getColIdx(
          [
            'no of usage',
            'no of usages',
            'no. of usage',
            'no. of usages',
            'no of usage/vehicle',
            'no of usage / vehicle',
            'no of usages/vehicle',
            'no of usages / vehicle',
            'usage per vehicle',
            'usages per vehicle',
            'usage per veh',
            'qty per vehicle',
            'qty/vehicle',
            'qty/veh',
            'qty per veh',
            'qty / vehicle',
            'qty / veh',
            'per vehicle',
            'parts per vehicle',
            'part per vehicle',
            'parts / vehicle',
            'parts needed for 1 vehicle',
            'parts needed for vehicle',
            'needed for 1 vehicle',
            'needed for vehicle',
            'battery no of usage',
            'vehicle usage',
            'part usage',
            'usage count',
            'consumption per vehicle',
            'usage quantity',
            'usage/veh',
            'usages',
            'usage'
          ],
          9,
          ['trolley', 'bin', 'box', 'tray', 'carrying']
        );
        
        const trolleyReqIdx = getColIdx(['no of trolley/bin qty required', 'trolley/bin qty required', 'required for one hour based on takt time', 'required for one hour', 'trolley required', 'trolleys per hour', 'trolleys req', 'req/hr', 'trolleys/hr', 'trolley req', 'bins req'], 10);
        const loadDistIdx = getColIdx(['load moving distance', 'load moving', 'loaded distance', 'load dist', 'loaded m', 'lead distance', 'load (m)', 'load distance'], 11);
        const emptyDistIdx = getColIdx(['empty moving distance', 'empty moving', 'return distance', 'empty dist', 'return m', 'empty (m)', 'return distance'], 12);
        const spaceConstraintIdx = getColIdx(['poc space constraint', 'space constraint', 'poc space max', 'space max', 'trolleys max', 'poc space', 'trolley limit', 'max trolley'], -1);
        const binOrTrolleyIdx = getColIdx([
          'bin/trolley/carton/cover',
          'bin / trolley / carton / cover',
          'trolley/bin/carton/cover',
          'trolley / bin / carton / cover',
          'bin/trolley',
          'bin or trolley',
          'bin / trolley',
          'bin / trolley / carton',
          'bin/trolley/carton',
          'trolley / bin / carton',
          'trolley/bin/carton',
          'packing type',
          'packaging type',
          'package type',
          'packaging',
          'packing',
          'unit type',
          'container type',
          'container',
          'unit',
          'type'
        ], 5);
        const initialStockIdx = getColIdx(['initial poc stock', 'initial trolley stock', 'initial stock', 'opening stock', 'initial buffer', 'carryover stock', 'initial poc'], -1);

        // Helper to extract clean numbers from text (e.g. "2 pcs" -> 2, "2 nos" -> 2, "60 units" -> 60, "194m" -> 194)
        const parseNumericCell = (val: any, fallback: number): number => {
          if (typeof val === 'number' && !isNaN(val)) return val;
          if (val === undefined || val === null) return fallback;
          const str = String(val).trim();
          const cleaned = str.replace(/[^0-9.]/g, '');
          const parsed = parseFloat(cleaned);
          return !isNaN(parsed) && parsed > 0 ? parsed : fallback;
        };

        const parsedParts: PartMaster[] = [];

        for (let i = actualHeaderIndex + 1; i < bestRows.length; i++) {
          const row = bestRows[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          const rawPartNo = row[partNoIdx];
          if (!rawPartNo || String(rawPartNo).trim() === '') continue;

          // Ignore repeated header strings if Excel had sub-headers
          const partNoStr = String(rawPartNo).trim();
          if (partNoStr.toLowerCase().includes('part no') || partNoStr.toLowerCase().includes('material code')) continue;

          const modeRaw = String(row[modeIdx] || 'Jumbo Trolley');
          let transportMode: TransportMode = 'Jumbo Trolley';
          if (modeRaw.toLowerCase().includes('manual')) transportMode = 'Manual Handling';
          else if (modeRaw.toLowerCase().includes('bov') || modeRaw.toLowerCase().includes('battery')) transportMode = 'BOV (Battery Vehicle)';
          else if (modeRaw.toLowerCase().includes('hand') || modeRaw.toLowerCase().includes('pallet')) transportMode = 'Hand Pallet Truck';

          const storeLoc = String(row[storeIdx] || 'Store-A').trim();
          const pocPointVal = String(row[pocIdx] || 'PL-01').trim();
          
          // Parse numeric bin capacity with fallback scanning across row
          let parsedBinCap = parseNumericCell(row[capIdx], 0);
          if (parsedBinCap <= 0) {
            for (let c = Math.max(0, capIdx - 2); c <= Math.min(row.length - 1, capIdx + 3); c++) {
              if (c === partNoIdx || c === descIdx || c === storeIdx || c === pocIdx) continue;
              const scannedNum = parseNumericCell(row[c], 0);
              if (scannedNum > 0 && scannedNum !== 194 && scannedNum !== 278) { // avoid distance columns
                parsedBinCap = scannedNum;
                break;
              }
            }
          }
          const finalBinCap = parsedBinCap > 0 ? parsedBinCap : 10;

          const parsedTrolleyReq = parseNumericCell(row[trolleyReqIdx], 0);
          const hourlyTrolleysRequired = parsedTrolleyReq > 0 ? parsedTrolleyReq : undefined;

          const usageVal = parseNumericCell(row[usageIdx], 1);
          const loadDistVal = parseNumericCell(row[loadDistIdx], 0);
          let emptyDistVal = parseNumericCell(row[emptyDistIdx], 0);

          // Distance calculation: if not provided, calculate using 2m per station gap rule (Stores base 190m + 2m * (station-1))
          const calculatedStationDist = calculateStoreToStationDistance(pocPointVal);
          const finalLoadDist = loadDistVal > 0 ? loadDistVal : (emptyDistVal > 0 ? emptyDistVal : calculatedStationDist);
          const finalEmptyDist = emptyDistVal > 0 ? emptyDistVal : finalLoadDist;

          // Parse POC space constraints: Read from 'POC Space Constraint (no/trolley)' column if available,
          // or derive from per-part plant standard: Swingarm/Lower Brkt/Wheel = 1 trolley, Frame/Sub Frame = 2 trolleys
          const parsedSpaceConstraint = spaceConstraintIdx >= 0 ? parseNumericCell(row[spaceConstraintIdx], 0) : 0;
          const partDesc = String(row[descIdx] || 'Assembly Component').trim();
          const defaultSpaceConstraint = getPartPocSpaceLimit({ description: partDesc, partNo: partNoStr });
          const pocSpaceTrolleysMax = parsedSpaceConstraint > 0 ? Math.min(parsedSpaceConstraint, POC_MAX_TROLLEYS_PER_STATION) : defaultSpaceConstraint;

          const binOrTrolley: PackagingType = binOrTrolleyIdx >= 0
            ? parsePackagingType(row[binOrTrolleyIdx], partDesc)
            : parsePackagingType(undefined, partDesc);
          const parsedInitialStock = initialStockIdx >= 0 ? parseNumericCell(row[initialStockIdx], 0) : 0;

          const part: PartMaster = {
            partNo: partNoStr,
            description: partDesc,
            modelNo: String(row[modelIdx] || 'I Qube').trim(),
            usagePerVehicle: usageVal,
            transportMode,
            binCapacity: finalBinCap,
            storeLocation: storeLoc,
            pocPoint: pocPointVal,
            stationName: `Station (${pocPointVal})`,
            pickTimeMin: 3.5,
            storingTimePocMin: 2.5,
            emptyCollectionTimeMin: 2.0,
            emptyLeavingTimeMin: 1.0,
            loadedDistanceMeters: finalLoadDist,
            returnDistanceMeters: finalEmptyDist,
            initialPocTrolleyStock: parsedInitialStock > 0 ? parsedInitialStock : 0,
            minSafetyCoverageHours: 1.5,
            hourlyTrolleysRequired,
            pocSpaceTrolleysMax,
            binOrTrolley,
          };

          parsedParts.push(part);
        }

        if (parsedParts.length === 0) {
          throw new Error('No valid part records found in Excel sheet');
        }

        resolve(parsedParts);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

/**
 * Exports current Material Flow parts configuration and calculations to Excel
 */
export function exportMaterialFlowExcel(
  parts: PartMaster[],
  productionPlan: ProductionPlan,
  customFileName?: string,
  modeConfigs?: Record<TransportMode, TransportModeConfig>
) {
  // Sheet 1: Part Master & Line-Feeding Calculations
  const partHeaders = [
    'S.NO',
    'Jumbo / Manual',
    'Model No',
    'PART NO',
    'Description',
    'BIN/Trolley',
    'No of QTY Loaded in single Trolley/bin',
    'STORE',
    'POC Point',
    'No of Usages',
    'Exact Trolleys Required / Hour',
    'No of Trolley/bin QTY required for one hour based on takt time',
    'Carrying Capacity (Bins/Trip)',
    'Single Operator Delivery Capacity (Units/Trip)',
    'Hourly Consumption (Units)',
    'Shift Consumption (Units)',
    'Single Operator Trips Required / Shift',
    'LOAD MOVING Distance /trip (M)',
    'EMPTY MOVING Distance /trip (M)',
    'Single Operator Trip Cycle Time (Min)',
    'Single Operator Shift Workload (Min)',
    'Single Operator Utilization (%)',
    'Delivery Frequency (Min)',
    'Single Operator MHF Fleet Required',
    'POC Space Constraint (no/trolley)',
  ];

  const partRows = parts.map((part, index) => {
    const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
    const modeLabel = part.transportMode.includes('Jumbo')
      ? 'Jumbo'
      : part.transportMode.includes('BOV')
      ? 'BOV'
      : part.transportMode.includes('Hand')
      ? 'Hand Pallet'
      : 'Manual';

    return [
      index + 1,
      modeLabel,
      part.modelNo,
      part.partNo,
      part.description,
      'Trolley',
      part.binCapacity,
      part.storeLocation,
      part.pocPoint,
      part.usagePerVehicle,
      Number(metrics.trolleyReqPerHour.toFixed(2)),
      metrics.roundedTrolleysPerHour,
      metrics.carryingCapacity,
      metrics.singleOperatorDeliveryCapacityUnits,
      metrics.hourlyConsumption,
      metrics.shiftConsumption,
      part.transportMode === 'Jumbo Trolley' || part.transportMode === 'BOV (Battery Vehicle)'
        ? `${metrics.tripsRequiredPerShift} (Co-loaded)`
        : metrics.tripsRequiredPerShift,
      part.loadedDistanceMeters,
      part.returnDistanceMeters,
      metrics.cycleTimeMin,
      metrics.singleOperatorWorkloadMinPerShift,
      `${metrics.singleOperatorUtilizationPercent}%`,
      metrics.deliveryFrequencyMins,
      metrics.mhfRequired,
      part.pocSpaceTrolleysMax ?? (part.description.toLowerCase().includes('frame') ? 2 : 1),
    ];
  });

  const partsWorksheet = XLSX.utils.aoa_to_sheet([partHeaders, ...partRows]);

  partsWorksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 32 },
    { wch: 12 },
    { wch: 36 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 30 },
    { wch: 42 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 },
    { wch: 28 },
    { wch: 28 },
    { wch: 26 },
  ];

  // Sheet 2: Production Planning Summary
  const planHeaders = ['Parameter', 'Value', 'Unit / Details'];
  const planRows = [
    ['Vehicle Model Code', productionPlan.selectedModelId, 'Selected Assembly Line'],
    ['Target Takt Time', productionPlan.taktTimeSeconds, 'Seconds / Vehicle'],
    ['Hourly Production Plan', productionPlan.hourlyPlanVehicles, 'Vehicles / Hour'],
    ['Shift Production Plan (8.5 Hours)', productionPlan.shiftPlanVehicles, 'Vehicles / Shift'],
    ['Production Shift', productionPlan.shift, 'Current Active Shift'],
    ['Production Line Status', productionPlan.productionStatus, 'Live Status'],
    ['Current Hour Elapsed', productionPlan.currentHour, 'Hours'],
    ['Units Completed So Far', productionPlan.unitsCompleted, 'Vehicles'],
    ['Export Date & Time', new Date().toLocaleString(), 'Timestamp'],
  ];

  const planWorksheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
  planWorksheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 30 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, partsWorksheet, 'Material Flow Master');
  XLSX.utils.book_append_sheet(workbook, planWorksheet, 'Production Plan Summary');

  const fileName = customFileName || `Digital_Material_Flow_Export_${productionPlan.taktTimeSeconds}s_Takt.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Helper to download CSV string from a SheetJS worksheet
 */
function downloadCsv(worksheet: XLSX.WorkSheet, defaultFileName: string) {
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFileName.endsWith('.csv') ? defaultFileName : `${defaultFileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Executive Dashboard tables to Excel (.xlsx) or CSV (.csv)
 */
export function exportExecutiveDashboardData(
  inventoryStates: any[],
  parts: PartMaster[],
  trips: any[],
  operators: Operator[],
  alerts: any[],
  productionPlan: ProductionPlan,
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const timestamp = new Date().toISOString().slice(0, 10);

  // 1. Executive KPIs Sheet / Section
  const kpiHeaders = ['KPI Metric', 'Value', 'Details / Status'];
  const totalActiveParts = parts.length;
  const totalTripsPlanned = trips.length;
  const tripsCompleted = trips.filter((t) => t.status === 'Completed' || t.status === 'Delivered').length;
  const healthyPartsCount = inventoryStates.filter((s) => s.riskLevel === 'Green').length;
  const lineStopRiskCount = inventoryStates.filter((s) => s.riskLevel === 'Red').length;
  const avgOperatorUtilization = Number(
    (operators.reduce((acc, o) => acc + o.utilizationPercent, 0) / Math.max(1, operators.length)).toFixed(1)
  );

  const kpiRows = [
    ['Active Parts Count', totalActiveParts, 'Parts Monitored'],
    ['Completed Trips / Planned', `${tripsCompleted} / ${totalTripsPlanned}`, `${((tripsCompleted / Math.max(1, totalTripsPlanned)) * 100).toFixed(1)}% Completed`],
    ['Healthy Stock POC Coverage', `${healthyPartsCount} / ${totalActiveParts}`, 'Green Risk Level'],
    ['Line Stop Risk Count', lineStopRiskCount, lineStopRiskCount > 0 ? 'Action Required' : 'Nominal'],
    ['Avg Operator Utilization', `${avgOperatorUtilization}%`, 'Single Operator Fleet Pace'],
    ['Active Shift Window', productionPlan.shift, '24-Hour Operational Cycle'],
    ['Vehicle Model Code', productionPlan.selectedModelId, `Takt Time: ${productionPlan.taktTimeSeconds}s`],
    ['Export Timestamp', new Date().toLocaleString(), 'Live Snapshot'],
  ];

  // 2. POC Inventory Coverage Table
  const inventoryHeaders = ['POC Point', 'Part No', 'Opening Stock', 'Delivered Qty', 'Consumed Qty', 'Current Stock Units', 'Coverage (Hours)', 'Risk Level', 'Last Replenished At', 'Next Scheduled'];
  const inventoryRows = inventoryStates.map((s) => [
    s.pocPoint,
    s.partNo,
    s.openingStockUnits,
    s.deliveredQuantityUnits,
    s.consumedQuantityUnits,
    s.currentStockUnits,
    `${s.coverageHours} hrs`,
    s.riskLevel,
    s.lastReplenishedAt || 'N/A',
    s.nextDeliveryScheduledAt || 'N/A',
  ]);

  // 3. Control Tower Alerts Feed Table
  const alertHeaders = ['Alert ID', 'Part No', 'Severity', 'Title', 'Message', 'Timestamp', 'Acknowledged'];
  const alertRows = alerts.map((a) => [
    a.id,
    a.partNo,
    a.severity.toUpperCase(),
    a.title,
    a.message,
    a.timestamp,
    a.acknowledged ? 'YES' : 'NO',
  ]);

  // 4. Operator Roster & Workload Table
  const operatorHeaders = ['Operator Code', 'Name', 'Transport Mode', 'Assigned Route', 'Completed Trips', 'Utilization %', 'Status'];
  const operatorRows = operators.map((o) => [
    o.operatorCode,
    o.name,
    o.transportMode,
    o.assignedRouteId,
    o.completedTripsCount,
    `${o.utilizationPercent}%`,
    o.status,
  ]);

  // 5. Trip Dispatch Schedule Table
  const tripHeaders = ['Trip ID', 'Part No', 'Route ID', 'Operator Name', 'Transport Mode', 'Trolley Qty', 'Total Units', 'Scheduled Dispatch', 'ETA POC', 'Status', 'Delay Mins'];
  const tripRows = trips.map((t) => [
    t.id,
    t.partNo,
    t.routeId,
    t.assignedOperatorName,
    t.transportMode,
    t.trolleyQuantity,
    t.totalUnits,
    t.scheduledDispatchTime,
    t.estimatedArrivalPoc,
    t.status,
    t.delayMinutes || 0,
  ]);

  if (format === 'csv') {
    // For CSV export, concatenate sections with headers for complete tabular clarity
    const combinedData = [
      ['=== EXECUTIVE KPI OVERVIEW ==='],
      kpiHeaders,
      ...kpiRows,
      [],
      ['=== POC INVENTORY COVERAGE & RISK LEVELS ==='],
      inventoryHeaders,
      ...inventoryRows,
      [],
      ['=== ACTIVE CONTROL TOWER ALERTS ==='],
      alertHeaders,
      ...alertRows,
      [],
      ['=== OPERATOR ROSTER & WORKLOAD ==='],
      operatorHeaders,
      ...operatorRows,
      [],
      ['=== TRIP DISPATCH SCHEDULE ==='],
      tripHeaders,
      ...tripRows,
    ];

    const sheet = XLSX.utils.aoa_to_sheet(combinedData);
    downloadCsv(sheet, `Executive_Dashboard_Report_${timestamp}.csv`);
  } else {
    // For Excel (.xlsx), construct workbook with dedicated tabbed sheets
    const workbook = XLSX.utils.book_new();

    const kpiSheet = XLSX.utils.aoa_to_sheet([kpiHeaders, ...kpiRows]);
    kpiSheet['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, kpiSheet, 'KPI Summary');

    const invSheet = XLSX.utils.aoa_to_sheet([inventoryHeaders, ...inventoryRows]);
    invSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, invSheet, 'Inventory Coverage');

    const alertSheet = XLSX.utils.aoa_to_sheet([alertHeaders, ...alertRows]);
    alertSheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 40 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, alertSheet, 'Control Tower Alerts');

    const opSheet = XLSX.utils.aoa_to_sheet([operatorHeaders, ...operatorRows]);
    opSheet['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 15 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, opSheet, 'Operator Roster');

    const tripSheet = XLSX.utils.aoa_to_sheet([tripHeaders, ...tripRows]);
    tripSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, tripSheet, 'Trip Schedule');

    XLSX.writeFile(workbook, `Executive_Dashboard_Report_${timestamp}.xlsx`);
  }
}

/**
 * Export Production Planning tables to Excel (.xlsx) or CSV (.csv)
 */
export function exportProductionPlanningData(
  parts: PartMaster[],
  productionPlan: ProductionPlan,
  modeConfigs?: Record<TransportMode, TransportModeConfig>,
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const timestamp = new Date().toISOString().slice(0, 10);

  // 1. Plan Overview Sheet
  const planHeaders = ['Parameter', 'Value', 'Details / Units'];
  const planRows = [
    ['Schedule Date', productionPlan.date, 'Planned Date'],
    ['Shift Window', productionPlan.shift, 'Active Shift'],
    ['Vehicle Model ID', productionPlan.selectedModelId, 'Assembly Line Code'],
    ['Target Takt Time', `${productionPlan.taktTimeSeconds} s`, 'Seconds / Unit'],
    ['Shift Production Target', `${productionPlan.shiftPlanVehicles} units`, '8 Hour Target'],
    ['Hourly Production Target', `${productionPlan.hourlyPlanVehicles} units`, 'Vehicles / Hour'],
    ['Units Completed So Far', `${productionPlan.unitsCompleted} units`, 'Current Progress'],
    ['Line Execution Status', productionPlan.productionStatus, 'Live Line Status'],
    ['Current Hour Elapsed', `Hour ${productionPlan.currentHour}`, 'Hours'],
    ['Export Timestamp', new Date().toLocaleString(), 'Report Generated'],
  ];

  // 2. Hourly Production Breakdown Table
  const hourlyHeaders = ['Hour', 'Time Slot', 'Target Vehicles', 'Cumulative Target', 'Line Feeding Status'];
  const hourlyRows = [1, 2, 3, 4, 5, 6, 7, 8].map((hr) => {
    const hourlyTarget = Math.round(productionPlan.hourlyPlanVehicles);
    const cum = hourlyTarget * hr;
    const status = hr < productionPlan.currentHour ? 'Completed' : hr === productionPlan.currentHour ? 'Active Line Feeding' : 'Scheduled';
    return [`Hour ${hr}`, `${String(5 + hr).padStart(2, '0')}:00 - ${String(6 + hr).padStart(2, '0')}:00`, `${hourlyTarget} units`, `${cum} units`, status];
  });

  // 3. Transport Mode Standards Table
  const modeHeaders = [
    'Transport Mode', 
    'Carrying Capacity (Bins/Trip)', 
    'Load Speed (sec/mtr)', 
    'Empty Speed (sec/mtr)', 
    'Pick Time (Sec)', 
    'Unload/Storing Time (Sec)',
    'Empty Handling/Pick Time (Sec)',
    'Empty Drop Time at Stores (Sec)'
  ];
  const modeRows = modeConfigs
    ? Object.keys(modeConfigs).map((mode) => {
        const cfg = modeConfigs[mode as TransportMode];
        return [
          mode, 
          cfg.carryingCapacityTrolleys, 
          (cfg as any).loadSpeedSecPerMtr, 
          (cfg as any).emptySpeedSecPerMtr, 
          cfg.pickTimeSec, 
          cfg.storingTimeSec,
          cfg.emptyHandlingTimeSec,
          (cfg as any).emptyDropTimeSec
        ];
      })
    : [];

  // 4. Part Master Takt Calculation Rows
  const partHeaders = [
    'S.NO',
    'Part No',
    'Description',
    'Model No',
    'Transport Mode',
    'Bin Capacity',
    'Store Location',
    'POC Point',
    'Usages / Vehicle',
    'Exact Trolleys Req / Hr',
    'Rounded Trolleys Req / Hr',
    'Hourly Consumption',
    'Shift Consumption',
    'Trips Required / Shift',
    'Loaded Dist (M)',
    'Return Dist (M)',
    'Trip Cycle Time (Min)',
    'Shift Workload (Min)',
    'Operator Utilization (%)',
    'MHF Required',
  ];

  const partRows = parts.map((part, index) => {
    const metrics = calculatePartMetrics(part, productionPlan.hourlyPlanVehicles, productionPlan.shiftPlanVehicles, modeConfigs);
    return [
      index + 1,
      part.partNo,
      part.description,
      part.modelNo,
      part.transportMode,
      part.binCapacity,
      part.storeLocation,
      part.pocPoint,
      part.usagePerVehicle,
      Number(metrics.trolleyReqPerHour.toFixed(2)),
      metrics.roundedTrolleysPerHour,
      metrics.hourlyConsumption,
      metrics.shiftConsumption,
      part.transportMode === 'Jumbo Trolley' || part.transportMode === 'BOV (Battery Vehicle)'
        ? `${metrics.tripsRequiredPerShift} (Co-loaded)`
        : metrics.tripsRequiredPerShift,
      part.loadedDistanceMeters,
      part.returnDistanceMeters,
      metrics.cycleTimeMin,
      metrics.singleOperatorWorkloadMinPerShift,
      `${metrics.singleOperatorUtilizationPercent}%`,
      metrics.mhfRequired,
    ];
  });

  if (format === 'csv') {
    const combinedData = [
      ['=== PRODUCTION PLAN OVERVIEW ==='],
      planHeaders,
      ...planRows,
      [],
      ['=== HOURLY PRODUCTION BREAKDOWN ==='],
      hourlyHeaders,
      ...hourlyRows,
      [],
      ['=== TRANSPORT MODE STANDARDS ==='],
      modeHeaders,
      ...modeRows,
      [],
      ['=== PART MASTER TAKT & LINE FEEDING CALCULATIONS ==='],
      partHeaders,
      ...partRows,
    ];

    const sheet = XLSX.utils.aoa_to_sheet(combinedData);
    downloadCsv(sheet, `Production_Planning_Report_${timestamp}.csv`);
  } else {
    const workbook = XLSX.utils.book_new();

    const planSheet = XLSX.utils.aoa_to_sheet([planHeaders, ...planRows]);
    planSheet['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, planSheet, 'Plan Overview');

    const hourlySheet = XLSX.utils.aoa_to_sheet([hourlyHeaders, ...hourlyRows]);
    hourlySheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, hourlySheet, 'Hourly Breakdown');

    if (modeRows.length > 0) {
      const modeSheet = XLSX.utils.aoa_to_sheet([modeHeaders, ...modeRows]);
      modeSheet['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(workbook, modeSheet, 'Mode Standards');
    }

    const partSheet = XLSX.utils.aoa_to_sheet([partHeaders, ...partRows]);
    partSheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 30 },
      { wch: 12 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, partSheet, 'Part Line Feeding Calculations');

    // Shift Handover 8-Hour Trip Mapping Sheet
    const shiftHandoverData = getShiftTripHandoverMapping(parts, productionPlan, modeConfigs, 8);
    const shiftHandoverHeaders = [
      's.no',
      'Model No',
      'PART NO',
      'Description',
      'BIN/Trolley',
      'Qty / Trolley',
      'Load Per Trip',
      'Store',
      'POC Point',
      'Trip ID (1 Hr)',
      'Trip ID (8hrs)',
      '8-Hr Delivered Units',
    ];

    const shiftHandoverRows = shiftHandoverData.items.map((item) => [
      item.sNo,
      item.modelNo,
      item.partNo,
      item.description,
      item.binOrTrolley,
      item.qtyPerTrolley,
      item.loadTrolleysPerTrip,
      item.store,
      item.pocPoint,
      item.oneCycleTripIdsFormatted,
      item.shiftTripIdsFormatted,
      item.shiftDeliveredUnits,
    ]);

    const handoverSheet = XLSX.utils.aoa_to_sheet([shiftHandoverHeaders, ...shiftHandoverRows]);
    handoverSheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 14 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 65 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, handoverSheet, 'Shift Handover Trips');

    // 64-Trip Complete Operator Loading & Pick Manifest Sheet
    const tripManifestHeaders = [
      'Trip #',
      'Shift Hour',
      'Cycle Trip',
      'Part No',
      'Description',
      'Store Location',
      'POC Drop Point',
      'Trolleys Loaded',
      'Qty / Trolley',
      'Total Units Loaded',
      'Trip Total Trolleys',
      'Trip Total Units',
      'Capacity Utilization',
    ];

    const tripManifestRows: any[] = [];
    shiftHandoverData.allShiftTrips.forEach((trip) => {
      trip.items.forEach((item, itemIdx) => {
        tripManifestRows.push([
          itemIdx === 0 ? `Trip #${trip.tripNumber}` : '',
          itemIdx === 0 ? `Hour ${trip.shiftHour}` : '',
          itemIdx === 0 ? `T${trip.hourlyTripIndex}` : '',
          item.partNo,
          item.description,
          item.store,
          item.pocPoint,
          item.trolleysLoaded,
          item.qtyPerTrolley,
          item.totalUnitsLoaded,
          itemIdx === 0 ? `${trip.totalTrolleys} / ${trip.vehicleCapacity}` : '',
          itemIdx === 0 ? trip.totalUnits : '',
          itemIdx === 0 ? `${trip.utilizationPercent}%` : '',
        ]);
      });
    });

    const manifestSheet = XLSX.utils.aoa_to_sheet([tripManifestHeaders, ...tripManifestRows]);
    manifestSheet['!cols'] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, manifestSheet, 'Operator Pick Manifest (1-64)');

    XLSX.writeFile(workbook, `Production_Planning_Report_${timestamp}.xlsx`);
  }
}


