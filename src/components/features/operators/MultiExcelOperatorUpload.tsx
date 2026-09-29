import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  Layers,
  Eye,
  Download,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Database,
  Sparkles,
  Plus,
  FileCheck,
  ChevronDown,
  Info
} from 'lucide-react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { Operator, TransportMode } from '../../../types/manufacturing';

export interface ParsedSheetData {
  sheetName: string;
  rowCount: number;
  columns: string[];
  parsedOperators: Operator[];
  rawData: Record<string, any>[];
}

export interface UploadedExcelFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  sheets: ParsedSheetData[];
  activeSheetIndex: number;
}

const VALID_MODES: TransportMode[] = ['Jumbo Trolley', 'Manual Handling', 'Hand Pallet Truck', 'BOV (Battery Vehicle)'];
const VALID_STATUSES: Operator['status'][] = ['Active', 'On Route', 'Loading', 'On Break', 'Offline'];

/**
 * Standardize and map raw Excel row object to standard Operator interface
 */
export function mapRowToOperator(row: Record<string, any>, idx: number, sheetPrefix: string): Operator {
  const keys = Object.keys(row);

  const findValue = (possibleNames: string[]): any => {
    for (const p of possibleNames) {
      const matchKey = keys.find(k => k.trim().toLowerCase() === p.toLowerCase() || k.trim().toLowerCase().includes(p.toLowerCase()));
      if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
        return row[matchKey];
      }
    }
    return undefined;
  };

  const nameVal = findValue(['operator name', 'name', 'operator', 'employee name', 'worker name']) || `Operator ${idx + 1}`;
  const codeVal = findValue(['operator code', 'code', 'emp id', 'employee id', 'operator id', 'id']) || `MHF-OP-${sheetPrefix}-${idx + 1}`;
  const routeVal = findValue(['assigned route', 'route id', 'route', 'line route', 'assigned route id']) || 'ROUTE-01-MAIN';
  const modeValRaw = String(findValue(['transport mode', 'mode', 'vehicle', 'transport', 'trolley type']) || 'Jumbo Trolley').trim();
  const tripsVal = Number(findValue(['completed trips', 'trips', 'trip count', 'completed trips count']) || Math.floor(Math.random() * 15) + 5);
  const utilVal = Number(findValue(['utilization', 'utilization %', 'utilization percent', 'efficiency']) || 85);
  const statusValRaw = String(findValue(['status', 'state', 'duty status']) || 'Active').trim();

  // Normalize Transport Mode
  let transportMode: TransportMode = 'Jumbo Trolley';
  const modeLower = modeValRaw.toLowerCase();
  if (modeLower.includes('bov') || modeLower.includes('battery') || modeLower.includes('vehicle')) transportMode = 'BOV (Battery Vehicle)';
  else if (modeLower.includes('pallet') || modeLower.includes('hand pallet') || modeLower.includes('hpt')) transportMode = 'Hand Pallet Truck';
  else if (modeLower.includes('manual') || modeLower.includes('handling')) transportMode = 'Manual Handling';
  else transportMode = 'Jumbo Trolley';

  // Normalize Status
  let status: Operator['status'] = 'Active';
  const statusLower = statusValRaw.toLowerCase();
  if (statusLower.includes('route')) status = 'On Route';
  else if (statusLower.includes('load')) status = 'Loading';
  else if (statusLower.includes('break')) status = 'On Break';
  else if (statusLower.includes('off')) status = 'Offline';
  else status = 'Active';

  return {
    id: String(codeVal),
    name: String(nameVal),
    operatorCode: String(codeVal),
    assignedRouteId: String(routeVal),
    transportMode,
    completedTripsCount: isNaN(tripsVal) ? 10 : tripsVal,
    utilizationPercent: isNaN(utilVal) ? 85 : Math.min(100, Math.max(0, utilVal)),
    status,
  };
}

export const MultiExcelOperatorUpload: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const { operators, setOperators, uploadedWorkbooks, setUploadedWorkbooks, setUploadedFileName } = useMaterialFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filesList, setFilesList] = useState<UploadedExcelFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Active File & Active Sheet
  const activeFile = filesList.find(f => f.id === selectedFileId) || filesList[0] || null;
  const activeSheet = activeFile ? activeFile.sheets[activeFile.activeSheetIndex] || activeFile.sheets[0] : null;

  // Handle Multi-file Selection & Parsing
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setNotification(null);

    const newUploadedFiles: UploadedExcelFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        const parsedSheets: ParsedSheetData[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (rawRows.length > 0) {
            const columns = Object.keys(rawRows[0]);
            const prefix = sheetName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SH';
            const parsedOperators = rawRows.map((r, rIdx) => mapRowToOperator(r, rIdx, prefix));

            parsedSheets.push({
              sheetName,
              rowCount: rawRows.length,
              columns,
              parsedOperators,
              rawData: rawRows,
            });
          }
        });

        if (parsedSheets.length > 0) {
          const fileObj: UploadedExcelFile = {
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
      setFilesList(prev => [...prev, ...newUploadedFiles]);
      setSelectedFileId(newUploadedFiles[0].id);
      const totalParsedSheets = newUploadedFiles.reduce((acc, f) => acc + f.sheets.length, 0);
      const totalParsedOps = newUploadedFiles.reduce((acc, f) => acc + f.sheets.reduce((sAcc, s) => sAcc + s.rowCount, 0), 0);
      setNotification({
        type: 'success',
        message: `Successfully loaded ${newUploadedFiles.length} file(s) containing ${totalParsedSheets} sheet(s) and ${totalParsedOps} operator record(s)!`,
      });
    } else {
      setNotification({
        type: 'error',
        message: 'Could not parse operator records. Please ensure your Excel files contain valid sheet data.',
      });
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Change Active Sheet for Selected File
  const handleSelectSheet = (fileId: string, sheetIndex: number) => {
    setFilesList(prev =>
      prev.map(f => (f.id === fileId ? { ...f, activeSheetIndex: sheetIndex } : f))
    );
  };

  // Remove uploaded file
  const handleRemoveFile = (fileId: string) => {
    setFilesList(prev => prev.filter(f => f.id !== fileId));
    if (selectedFileId === fileId) {
      const remaining = filesList.filter(f => f.id !== fileId);
      setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Apply Current Active Sheet to Global State
  const handleApplyActiveSheet = () => {
    if (!activeFile || !activeSheet || activeSheet.parsedOperators.length === 0) return;

    setOperators(activeSheet.parsedOperators);
    setUploadedFileName(`${activeFile.fileName} [${activeSheet.sheetName}]`);
    setNotification({
      type: 'success',
      message: `Active operator roster updated! Loaded ${activeSheet.parsedOperators.length} operators from Sheet "${activeSheet.sheetName}".`,
    });
  };

  // Merge & Apply All Sheets from All Uploaded Files to Global State
  const handleApplyAllFiles = () => {
    if (filesList.length === 0) return;

    const allOps: Operator[] = [];
    filesList.forEach(f => {
      f.sheets.forEach(s => {
        allOps.push(...s.parsedOperators);
      });
    });

    if (allOps.length === 0) return;

    // Deduplicate by Operator Code / ID
    const uniqueOpsMap = new Map<string, Operator>();
    allOps.forEach(op => {
      uniqueOpsMap.set(op.operatorCode || op.id, op);
    });

    const uniqueOps = Array.from(uniqueOpsMap.values());
    setOperators(uniqueOps);
    setUploadedFileName(`Merged Roster (${filesList.length} Files / All Sheets)`);

    setNotification({
      type: 'success',
      message: `Merged and applied all ${filesList.length} files & ${filesList.reduce((acc, f) => acc + f.sheets.length, 0)} sheets! Active roster now contains ${uniqueOps.length} unique operators.`,
    });
  };

  // Download Sample Multi-Sheet Excel Template
  const handleDownloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Shift 1 Operators
    const shift1Data = [
      ['Operator Code', 'Operator Name', 'Assigned Route', 'Transport Mode', 'Completed Trips', 'Utilization %', 'Duty Status'],
      ['MHF-OP-S1-01', 'Rajesh Kumar', 'ROUTE-01-PL300', 'BOV (Battery Vehicle)', 16, 92, 'Active'],
      ['MHF-OP-S1-02', 'Anil Sharma', 'ROUTE-02-ML048', 'Jumbo Trolley', 14, 88, 'On Route'],
      ['MHF-OP-S1-03', 'Suresh Patel', 'ROUTE-03-PL200', 'BOV (Battery Vehicle)', 20, 95, 'Active'],
      ['MHF-OP-S1-04', 'Venkatesh R', 'ROUTE-04-ML037', 'Hand Pallet Truck', 12, 82, 'Loading'],
      ['MHF-OP-S1-05', 'Dinesh Singh', 'ROUTE-05-PL100', 'Manual Handling', 10, 78, 'On Break'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(shift1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'Shift 1 - Line 300 & 200');

    // Sheet 2: Shift 2 Operators
    const shift2Data = [
      ['Operator Code', 'Operator Name', 'Assigned Route', 'Transport Mode', 'Completed Trips', 'Utilization %', 'Duty Status'],
      ['MHF-OP-S2-01', 'Manoj Verma', 'ROUTE-01-PL300', 'BOV (Battery Vehicle)', 15, 90, 'Active'],
      ['MHF-OP-S2-02', 'Pravin Nair', 'ROUTE-02-ML048', 'Jumbo Trolley', 13, 85, 'Active'],
      ['MHF-OP-S2-03', 'Ramesh Rao', 'ROUTE-03-PL200', 'BOV (Battery Vehicle)', 18, 94, 'On Route'],
      ['MHF-OP-S2-04', 'Ganesh M', 'ROUTE-04-ML037', 'Hand Pallet Truck', 11, 80, 'Loading'],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(shift2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'Shift 2 - Line 100');

    // Sheet 3: Subcontractors & Buffer Roster
    const subData = [
      ['Operator Code', 'Operator Name', 'Assigned Route', 'Transport Mode', 'Completed Trips', 'Utilization %', 'Duty Status'],
      ['MHF-SUB-01', 'Kiran Kumar', 'BUFFER-ROUTE-A', 'Jumbo Trolley', 8, 70, 'Active'],
      ['MHF-SUB-02', 'Vikram Reddy', 'BUFFER-ROUTE-B', 'Hand Pallet Truck', 6, 65, 'Offline'],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(subData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Contractor Buffer Pool');

    XLSX.writeFile(wb, 'TVS_MHF_MultiSheet_Operator_Roster_Template.xlsx');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono uppercase tracking-wider">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Multi-File & Multi-Page Excel Operator Import Engine
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload multiple Excel files (.xlsx / .csv) simultaneously with multi-tab sheet parsing and live sheet switching
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSampleExcel}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Download multi-sheet Excel sample template"
          >
            <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Sample Multi-Sheet Template (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Upload Drag & Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 dark:border-emerald-500/30 dark:hover:border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <span className="text-sm font-bold text-slate-900 dark:text-white block font-mono">
            Click to Browse or Drag & Drop Multiple Excel Files Here
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Supports multiple files (.xlsx, .xls, .csv) with automatic multi-sheet / multi-page parsing
          </span>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
          notification.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
            : notification.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
            : 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-300'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Files List & Sheet Switcher */}
      {filesList.length > 0 && (
        <div className="space-y-4">
          
          {/* File Pills Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Uploaded Excel Files ({filesList.length}):
              </span>
              <button
                onClick={handleApplyAllFiles}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Merge & Apply ALL Files ({filesList.reduce((acc, f) => acc + f.sheets.reduce((sAcc, s) => sAcc + s.rowCount, 0), 0)} Ops)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {filesList.map((f) => {
                const isSelected = f.id === selectedFileId;
                const fileTotalOps = f.sheets.reduce((acc, s) => acc + s.rowCount, 0);

                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFileId(f.id)}
                    className={`px-3 py-2 rounded-xl border font-mono text-xs cursor-pointer flex items-center gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="truncate max-w-[180px] font-bold">{f.fileName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                        {f.sheets.length} Sheets • {fileTotalOps} Rows
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
          </div>

          {/* Active File Sheet Switcher Tabs */}
          {activeFile && (
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                    Select Sheet / Page in <span className="text-emerald-600 dark:text-emerald-400">{activeFile.fileName}</span>:
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Active Sheet: <strong className="text-cyan-600 dark:text-cyan-400">{activeSheet?.sheetName}</strong> ({activeSheet?.rowCount} Rows)
                </div>
              </div>

              {/* Sheet Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFile.sheets.map((sheet, idx) => {
                  const isSheetActive = idx === activeFile.activeSheetIndex;
                  return (
                    <button
                      key={`${sheet.sheetName}-${idx}`}
                      onClick={() => handleSelectSheet(activeFile.id, idx)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
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

              {/* Data Preview Table for Active Sheet */}
              {activeSheet && activeSheet.parsedOperators.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Parsed Operator Data Preview (Showing first 5 of {activeSheet.rowCount} rows):
                    </span>

                    <button
                      onClick={handleApplyActiveSheet}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Apply Sheet "{activeSheet.sheetName}" to Roster</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 font-mono">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-bold text-[11px]">
                        <tr>
                          <th className="px-3 py-2">Code / ID</th>
                          <th className="px-3 py-2">Operator Name</th>
                          <th className="px-3 py-2">Assigned Route</th>
                          <th className="px-3 py-2">Transport Mode</th>
                          <th className="px-3 py-2 text-right">Trips</th>
                          <th className="px-3 py-2 text-right">Util %</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                        {activeSheet.parsedOperators.slice(0, 5).map((op, opIdx) => (
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
  );
};
