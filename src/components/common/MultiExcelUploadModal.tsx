import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx-js-style';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  Layers,
  Eye,
  Download,
  AlertCircle,
  Sparkles,
  FileCheck,
  X,
  Users,
  Package,
  Database,
  ArrowRight,
  Check,
  Factory,
  GitMerge,
  Calendar,
  Clock,
} from 'lucide-react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';
import { Operator, PartMaster, TransportMode, PackagingType, PACKAGING_TYPE_DEFINITIONS } from '../../types/manufacturing';
import { mapRowToOperator } from '../features/operators/MultiExcelOperatorUpload';
import { parsePackagingType } from '../../utils/excelParser';
import { TvsLogo } from '../layout/TvsLogo';

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

/**
 * Cleanly parse numeric cells (handling text like "2 pcs", "2 nos", "60 units", etc.)
 */
function parseCleanNumber(val: any, fallback: number = 1): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Standardize raw Excel row to PartMaster interface
 */
function mapRowToPartMaster(row: Record<string, any>, idx: number): PartMaster {
  const keys = Object.keys(row);
  const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const findValue = (possibleNames: string[], excludeNames: string[] = []): any => {
    for (const p of possibleNames) {
      const normP = normalize(p);
      const matchKey = keys.find((k) => {
        if (excludeNames.some((ex) => normalize(k).includes(normalize(ex)))) return false;
        return normalize(k) === normP;
      });
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && String(row[matchKey]).trim() !== '') {
        return row[matchKey];
      }
    }
    for (const p of possibleNames) {
      const normP = normalize(p);
      const matchKey = keys.find((k) => {
        if (excludeNames.some((ex) => normalize(k).includes(normalize(ex)))) return false;
        return normalize(k).includes(normP) || k.trim().toLowerCase().includes(p.toLowerCase());
      });
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && String(row[matchKey]).trim() !== '') {
        return row[matchKey];
      }
    }
    return undefined;
  };

  const partNo = String(findValue(['part no', 'partno', 'part_no', 'item code', 'part']) || `PART-${idx + 1}`).trim();
  const desc = String(findValue(['description', 'desc', 'part description', 'item description', 'details', 'name']) || 'Standard Assembly Part').trim();
  const modelNo = String(findValue(['model no', 'model', 'vehicle model']) || 'I Qube').trim();
  
  // Robust No of Usage resolution (parts needed for 1 vehicle, e.g. 2 for battery/wheels)
  const rawUsage = findValue(
    [
      'no of usage',
      'no of usages',
      'no. of usage',
      'no. of usages',
      'no of usage/vehicle',
      'no of usage / vehicle',
      'no of usages/vehicle',
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
    ['trolley', 'bin', 'box', 'tray', 'carrying']
  );
  const usage = parseCleanNumber(rawUsage, 1);

  const rawBinCap = parseCleanNumber(findValue([
    'no of qty loaded in single trolley/bin',
    'no of qty loaded in single',
    'no of qty loaded',
    'qty loaded in single',
    'qty loaded',
    'single trolley/bin',
    'loaded in single',
    'qty/trolley',
    'qty / trolley',
    'bin capacity',
    'trolley capacity',
    'capacity',
    'bin/trolley qty',
    'bin qty',
    'trolley qty',
    'batch size',
    'pack size',
    'units/bin',
    'units/trolley',
    'units per trolley',
    'pcs per trolley'
  ], ['vehicle', 'veh', 'usage', 'usages']), 20);
  const binCap = rawBinCap <= 0 ? 20 : rawBinCap;

  const storeLoc = String(findValue(['store', 'store location', 'location', 'warehouse']) || 'Store-A').trim();
  const pocPoint = String(findValue(['poc point', 'poc', 'station', 'drop location', 'line point']) || 'PL-01').trim();
  const loadedDist = parseCleanNumber(findValue(['load moving distance', 'load moving', 'loaded distance', 'load dist', 'distance']), 194);
  const returnDist = parseCleanNumber(findValue(['empty moving distance', 'empty moving', 'return distance', 'empty dist']), 194);
  const hourlyBins = parseCleanNumber(findValue(['no of trolley/bin qty required', 'trolley/bin qty required', 'hourly bins', 'hourly trolleys', 'trolleys req']), 2);
  const rawSpaceConstraint = parseCleanNumber(findValue(['poc space constraint', 'space constraint', 'poc space', 'space max', 'trolley limit']), 0);
  const pocSpaceTrolleysMax = rawSpaceConstraint > 0 ? rawSpaceConstraint : (desc.toLowerCase().includes('frame') && !desc.toLowerCase().includes('sub') ? 2 : 1);
  const modeValRaw = String(findValue(['jumbo / manual', 'transport mode', 'mode', 'jumbo', 'manual']) || 'Jumbo Trolley').trim();
  const rawPackagingVal = findValue([
    'bin/trolley',
    'bin or trolley',
    'bin / trolley',
    'bin / trolley / carton',
    'bin/trolley/carton',
    'trolley / bin / carton',
    'trolley/bin/carton',
    'packaging type',
    'packing type',
    'packaging',
    'packing',
    'unit type',
    'container type',
    'container',
    'unit',
    'type',
  ]);
  const binOrTrolley: PackagingType = parsePackagingType(rawPackagingVal, desc);

  let transportMode: TransportMode = 'Jumbo Trolley';
  const modeLower = modeValRaw.toLowerCase();
  if (modeLower.includes('bov') || modeLower.includes('battery')) transportMode = 'BOV (Battery Vehicle)';
  else if (modeLower.includes('pallet') || modeLower.includes('hpt')) transportMode = 'Hand Pallet Truck';
  else if (modeLower.includes('manual')) transportMode = 'Manual Handling';
  else transportMode = 'Jumbo Trolley';

  // Initial POC Trolley Stock: 0 by default unless explicitly in user's Excel input
  const rawInitialStock = parseCleanNumber(findValue(['initial poc stock', 'initial trolley stock', 'initial stock', 'opening stock', 'initial poc', 'initial buffer']), 0);
  const initialPocTrolleyStock = rawInitialStock <= 0 ? 0 : rawInitialStock;

  return {
    partNo,
    description: desc,
    modelNo,
    usagePerVehicle: usage,
    transportMode,
    binCapacity: binCap,
    storeLocation: storeLoc,
    pocPoint,
    stationName: `Station (${pocPoint})`,
    pickTimeMin: 0.5,
    storingTimePocMin: 0.5,
    emptyCollectionTimeMin: 0.25,
    emptyLeavingTimeMin: 0.25,
    loadedDistanceMeters: isNaN(loadedDist) ? 194 : loadedDist,
    returnDistanceMeters: isNaN(returnDist) ? 194 : returnDist,
    initialPocTrolleyStock,
    minSafetyCoverageHours: 1.5,
    hourlyTrolleysRequired: isNaN(hourlyBins) ? 2 : hourlyBins,
    pocSpaceTrolleysMax,
    binOrTrolley,
  };
}

export const MultiExcelUploadModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const {
    setOperators,
    setParts,
    uploadedWorkbooks,
    setUploadedWorkbooks,
    switchActiveDataset,
    setUploadedFileName,
    selectedAssemblyLine,
    productionPlan,
    clearAllData,
  } = useMaterialFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filesList, setFilesList] = useState<UploadedFileItem[]>(uploadedWorkbooks);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    uploadedWorkbooks.length > 0 ? uploadedWorkbooks[0].id : null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Keep local filesList synced with uploadedWorkbooks if opened
  useEffect(() => {
    if (uploadedWorkbooks.length > 0 && filesList.length === 0) {
      setFilesList(uploadedWorkbooks);
      if (!selectedFileId) setSelectedFileId(uploadedWorkbooks[0].id);
    }
  }, [uploadedWorkbooks, filesList.length, selectedFileId]);

  if (!isOpen) return null;

  const activeFile = filesList.find((f) => f.id === selectedFileId) || filesList[0] || null;
  const activeSheet = activeFile
    ? activeFile.sheets[activeFile.activeSheetIndex] || activeFile.sheets[0]
    : null;

  // Process a collection of Files (from FileList or DragEvent)
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setNotification(null);

    const newUploadedFiles: UploadedFileItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        const parsedSheets: ParsedSheet[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (rawRows.length > 0) {
            const columns = Object.keys(rawRows[0]);
            const colsLower = columns.map((c) => c.toLowerCase());

            // Detect if sheet contains operator data vs part master data
            const isOperatorSheet = colsLower.some(
              (c) =>
                c.includes('operator') ||
                c.includes('emp id') ||
                c.includes('employee') ||
                c.includes('utilization') ||
                c.includes('trips')
            );

            const isPartSheet = colsLower.some(
              (c) =>
                c.includes('part') ||
                c.includes('usage') ||
                c.includes('bin') ||
                c.includes('store') ||
                c.includes('trolley')
            );

            const sheetType = isOperatorSheet ? 'operator' : isPartSheet ? 'part' : 'operator';
            const prefix = sheetName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SH';

            const parsedOps = rawRows.map((r, rIdx) => mapRowToOperator(r, rIdx, prefix));
            const parsedPts = rawRows.map((r, rIdx) => mapRowToPartMaster(r, rIdx));

            parsedSheets.push({
              sheetName,
              type: sheetType,
              rowCount: rawRows.length,
              columns,
              parsedOperators: parsedOps,
              parsedParts: parsedPts,
              rawData: rawRows,
            });
          }
        });

        if (parsedSheets.length > 0) {
          const fileObj: UploadedFileItem = {
            id: `FILE-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sheets: parsedSheets,
            activeSheetIndex: 0,
          };
          newUploadedFiles.push(fileObj);
        }
      } catch (err) {
        console.error(`Error parsing file ${file.name}:`, err);
      }
    }

    if (newUploadedFiles.length > 0) {
      const updatedList = [...filesList, ...newUploadedFiles];
      setFilesList(updatedList);
      setUploadedWorkbooks(updatedList);
      setSelectedFileId(newUploadedFiles[0].id);

      const totalSheets = newUploadedFiles.reduce((acc, f) => acc + f.sheets.length, 0);
      const totalRows = newUploadedFiles.reduce(
        (acc, f) => acc + f.sheets.reduce((sAcc, s) => sAcc + s.rowCount, 0),
        0
      );
      setNotification({
        type: 'success',
        message: `Successfully loaded ${newUploadedFiles.length} file(s) containing ${totalSheets} sheet(s) and ${totalRows} total data record(s)!`,
      });
    } else {
      setNotification({
        type: 'error',
        message: 'Could not parse data from uploaded file(s). Please check file format.',
      });
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleSelectSheet = (fileId: string, sheetIndex: number) => {
    setFilesList((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, activeSheetIndex: sheetIndex } : f))
    );
  };

  const handleRemoveFile = (fileId: string) => {
    const updated = filesList.filter((f) => f.id !== fileId);
    setFilesList(updated);
    setUploadedWorkbooks(updated);
    if (selectedFileId === fileId) {
      setSelectedFileId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // Apply Selected Sheet Data
  const handleApplyActiveSheet = () => {
    if (!activeFile || !activeSheet) return;

    if (activeSheet.type === 'part' || activeSheet.parsedParts.length > 0) {
      setParts(activeSheet.parsedParts);
    }
    if (activeSheet.parsedOperators.length > 0) {
      setOperators(activeSheet.parsedOperators);
    }

    setUploadedFileName(`${activeFile.fileName} [${activeSheet.sheetName}]`);

    setNotification({
      type: 'success',
      message: `Applied Sheet "${activeSheet.sheetName}" from "${activeFile.fileName}" to active workspace! (${activeSheet.parsedOperators.length} Operators / ${activeSheet.parsedParts.length} Parts loaded)`,
    });
  };

  // Merge & Apply All Uploaded Files
  const handleApplyAllFiles = () => {
    if (filesList.length === 0) return;

    const allOps: Operator[] = [];
    const allParts: PartMaster[] = [];

    filesList.forEach((f) => {
      f.sheets.forEach((s) => {
        allOps.push(...s.parsedOperators);
        allParts.push(...s.parsedParts);
      });
    });

    // Deduplicate operators
    const opsMap = new Map<string, Operator>();
    allOps.forEach((op) => opsMap.set(op.operatorCode || op.id, op));
    const uniqueOps = Array.from(opsMap.values());

    // Deduplicate parts
    const partsMap = new Map<string, PartMaster>();
    allParts.forEach((pt) => partsMap.set(pt.partNo, pt));
    const uniqueParts = Array.from(partsMap.values());

    if (uniqueOps.length > 0) setOperators(uniqueOps);
    if (uniqueParts.length > 0) setParts(uniqueParts);

    setUploadedFileName(`Merged (${filesList.length} Files / All Sheets)`);

    setNotification({
      type: 'success',
      message: `Successfully merged and applied all ${filesList.length} files & ${filesList.reduce((acc, f) => acc + f.sheets.length, 0)} sheets! Active workspace updated with ${uniqueOps.length} Operators and ${uniqueParts.length} Part Master records.`,
    });
  };

  // Download Multi-Sheet Sample Template
  const handleDownloadSampleTemplate = () => {
    const wb = XLSX.utils.book_new();

    const opData1 = [
      ['Operator Code', 'Operator Name', 'Assigned Route', 'Transport Mode', 'Completed Trips', 'Utilization %', 'Duty Status'],
      ['MHF-OP-S1-01', 'Rajesh Kumar', 'ROUTE-01-PL300', 'BOV (Battery Vehicle)', 16, 92, 'Active'],
      ['MHF-OP-S1-02', 'Anil Sharma', 'ROUTE-02-ML048', 'Jumbo Trolley', 14, 88, 'On Route'],
      ['MHF-OP-S1-03', 'Suresh Patel', 'ROUTE-03-PL200', 'BOV (Battery Vehicle)', 20, 95, 'Active'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(opData1);
    XLSX.utils.book_append_sheet(wb, ws1, 'Operators Shift 1');

    const partData1 = [
      ['S.NO', 'Jumbo / Manual', 'Model No', 'PART NO', 'Description', 'BIN / Trolley / Carton', 'No of QTY Loaded in single Trolley/bin/carton', 'STORE', 'POC Point', 'No of Usages', 'No of Trolley/bin QTY required for one hour based on takt time', 'LOAD MOVING Distance /trip (M)', 'EMPTY MOVING Distance /trip (M)'],
      [1, 'Jumbo', 'I Qube', 'KE090530', 'SWINGARM SUB ASSY DRUM', 'Trolley', 60, 'Store-A', 'PL-03', 1, 2, 194, 194],
      [2, 'Jumbo', 'I Qube', 'KE121530', 'FRAME, SCOOTER COMP', 'Trolley', 6, 'Store-A', 'PL-03', 1, 22, 192, 192], // Pre-loaded in frame trolley (frame=6)
      [3, 'Jumbo', 'I Qube', 'KE110470', 'WHEEL ASSY DISC TUBELESS', 'Trolley', 30, 'Store-B', 'PL-13', 2, 9, 204, 204], // Pre-loaded in wheel trolley
      [4, 'Jumbo', 'I Qube', 'THROT-01', 'THROTTLE & SWITCH ASSY', 'Bin', 40, 'Store-A', 'PL-05', 1, 4, 160, 160], // Stored inside bin on platform trolley
      [5, 'Jumbo', 'I Qube', 'HARN-EV-01', 'WIRING HARNESS COMP EV', 'Carton', 25, 'Store-B', 'PL-07', 1, 6, 175, 175], // Pre-packed inside carton box
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(partData1);
    XLSX.utils.book_append_sheet(wb, ws2, 'Material Flow Parts Master');

    XLSX.writeFile(wb, 'TVS_MHF_MultiFile_MultiSheet_Template.xlsx');
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto font-sans text-slate-900 dark:text-white flex flex-col max-h-[95vh]">
        
        {/* Clean Header inside Upload Workspace */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* TVS Control Tower Logo */}
            <TvsLogo className="h-6 sm:h-7" showSubtitle={true} />

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 shrink-0 hidden sm:block" />

            {/* Title & Description */}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <UploadCloud className="w-5 h-5 text-cyan-500 shrink-0" />
                MULTI-FILE & MULTI-SHEET EXCEL DATASET WORKSPACE
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate hidden sm:block">
                Upload multiple Excel files simultaneously with drag & drop support and live multi-page tab switching
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
            title="Close workspace"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 font-mono">
          
          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 relative group ${
              isDragging
                ? 'border-cyan-500 bg-cyan-500/10 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-cyan-500/60 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx, .xls, .csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
              isDragging ? 'bg-cyan-500 text-white animate-bounce' : 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400'
            }`}>
              <UploadCloud className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white block font-mono">
                {isDragging ? 'RELEASE TO UPLOAD ALL FILES NOW' : 'DRAG & DROP MULTIPLE EXCEL FILES HERE'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-mono">
                or click to select multiple files at once from your computer (.xlsx, .xls, .csv)
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                Multi-File Upload Enabled
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cyan-500" />
                Multi-Page Sheet Support
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                Auto Operators & Parts Detection
              </span>
            </div>
          </div>

          {/* Packaging Types Reference Guide */}
          <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5 uppercase font-mono tracking-wider text-[11px] text-cyan-600 dark:text-cyan-400">
                <Package className="w-3.5 h-3.5" />
                Packaging Types Detected from Excel Column ("BIN / Trolley / Carton"):
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Auto-detected from file headers & values</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
                <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Trolley (Pre-loaded)
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Parts are pre-loaded directly onto/into the dedicated trolley (e.g. <strong>Frame = 6</strong> parts loaded in frame trolley, <strong>Wheels = 30</strong>).
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Bin (Platform Trolley)
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Parts are stored inside plastic bins/totes, and those bins are placed <strong>above the platform trolley</strong> (4 bins/trolley).
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Carton (Pre-packed Box)
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Parts are <strong>pre-packed inside carton boxes</strong> by supplier, moved directly in boxes on platform trolleys/dollies.
                </div>
              </div>
            </div>
          </div>

          {/* Action Row: Sample Template Button */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold">
              Need standard test data?
            </span>
            <button
              onClick={handleDownloadSampleTemplate}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Download Multi-Sheet Template (.xlsx)</span>
            </button>
          </div>

          {/* Notification Banner */}
          {notification && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{notification.message}</span>
              </div>
            </div>
          )}

          {/* List of Uploaded Files */}
          {filesList.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Uploaded Workbooks ({filesList.length}):
                </span>

                <button
                  onClick={handleApplyAllFiles}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>MERGE & APPLY ALL FILES TO APP WORKSPACE</span>
                </button>
              </div>

              {/* Uploaded File Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {filesList.map((f) => {
                  const isSelected = f.id === selectedFileId;
                  const fileTotalRows = f.sheets.reduce((acc, s) => acc + s.rowCount, 0);

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFileId(f.id)}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'bg-cyan-50 dark:bg-cyan-950/80 border-cyan-500 text-cyan-950 dark:text-cyan-200 font-bold shadow-md'
                          : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <FileSpreadsheet className={`w-4 h-4 ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                      <div>
                        <div className="truncate max-w-[200px] font-bold">{f.fileName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          {f.sheets.length} Sheet(s) • {fileTotalRows} Records
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(f.id);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer ml-1"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Selected File Sheet Switcher & Data Preview */}
              {activeFile && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                        Sheets in <span className="text-cyan-600 dark:text-cyan-400">{activeFile.fileName}</span>:
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Active Sheet: <strong className="text-cyan-600 dark:text-cyan-400">{activeSheet?.sheetName}</strong> ({activeSheet?.rowCount} Rows)
                    </div>
                  </div>

                  {/* Sheet Tabs */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFile.sheets.map((sheet, idx) => {
                      const isSheetActive = idx === activeFile.activeSheetIndex;
                      return (
                        <button
                          key={`${sheet.sheetName}-${idx}`}
                          onClick={() => handleSelectSheet(activeFile.id, idx)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
                            isSheetActive
                              ? 'bg-cyan-600 border-cyan-500 text-white shadow-md'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>{sheet.sheetName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                            isSheetActive ? 'bg-cyan-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {sheet.rowCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sheet Preview Table */}
                  {activeSheet && (
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          Data Preview (Showing first 5 of {activeSheet.rowCount} rows):
                        </span>

                        <button
                          onClick={handleApplyActiveSheet}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Apply Sheet "{activeSheet.sheetName}" to Active Roster</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-bold text-[11px]">
                            <tr>
                              {activeSheet.type === 'operator' ? (
                                <>
                                  <th className="px-3 py-2">Code / ID</th>
                                  <th className="px-3 py-2">Operator Name</th>
                                  <th className="px-3 py-2">Assigned Route</th>
                                  <th className="px-3 py-2">Transport Mode</th>
                                  <th className="px-3 py-2 text-right">Trips</th>
                                  <th className="px-3 py-2 text-right">Util %</th>
                                  <th className="px-3 py-2 text-center">Status</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-3 py-2">Part No</th>
                                  <th className="px-3 py-2">Description</th>
                                  <th className="px-3 py-2">Model</th>
                                  <th className="px-3 py-2">Packaging</th>
                                  <th className="px-3 py-2">Transport Mode</th>
                                  <th className="px-3 py-2 text-right">Cap</th>
                                  <th className="px-3 py-2">Store</th>
                                  <th className="px-3 py-2">POC Point</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                            {activeSheet.type === 'operator'
                              ? activeSheet.parsedOperators.slice(0, 5).map((op, opIdx) => (
                                  <tr key={`${op.id}-${opIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{op.operatorCode || op.id}</td>
                                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{op.name}</td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{op.assignedRouteId}</td>
                                    <td className="px-3 py-2 text-purple-600 dark:text-purple-300 font-bold">{op.transportMode}</td>
                                    <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-bold">{op.completedTripsCount}</td>
                                    <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400 font-bold">{op.utilizationPercent}%</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                        {op.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              : activeSheet.parsedParts.slice(0, 5).map((pt, ptIdx) => (
                                  <tr key={`${pt.partNo}-${ptIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-3 py-2 font-bold text-cyan-600 dark:text-cyan-400">{pt.partNo}</td>
                                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{pt.description}</td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{pt.modelNo}</td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                                          pt.binOrTrolley === 'Cover'
                                            ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-700/60'
                                            : pt.binOrTrolley === 'Carton'
                                            ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60'
                                            : pt.binOrTrolley === 'Bin'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60'
                                            : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700/60'
                                        }`}
                                        title={PACKAGING_TYPE_DEFINITIONS[pt.binOrTrolley || 'Trolley']?.description}
                                      >
                                        {pt.binOrTrolley === 'Cover' ? 'Cover (Packet)' : pt.binOrTrolley === 'Carton' ? 'Carton Box' : pt.binOrTrolley === 'Bin' ? 'Bin (Platform)' : 'Trolley (Pre-loaded)'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-purple-600 dark:text-purple-300 font-bold">{pt.transportMode}</td>
                                    <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-bold">{pt.binCapacity}</td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{pt.storeLocation}</td>
                                    <td className="px-3 py-2 text-amber-600 dark:text-amber-400 font-bold">{pt.pocPoint}</td>
                                  </tr>
                                ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 font-mono text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {filesList.length > 0
              ? `${filesList.length} File(s) loaded • Ready to apply`
              : 'Drag & drop Excel files to start'}
          </span>

          <div className="flex items-center gap-2">
            {filesList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilesList([]);
                  setSelectedFileId(null);
                  clearAllData();
                  setNotification({
                    type: 'info',
                    message: 'All uploaded files and data have been cleared.',
                  });
                }}
                className="px-3 py-2 rounded-xl border border-red-300 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Clear All Files</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
