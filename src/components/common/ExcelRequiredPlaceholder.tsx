import React, { useRef, useState } from 'react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  ArrowRight, 
  Download, 
  Info,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { downloadSampleExcelTemplate, parseUploadedExcel } from '../../utils/excelParser';
import { motion } from 'motion/react';

interface ExcelRequiredPlaceholderProps {
  title?: string;
  description?: string;
}

export const ExcelRequiredPlaceholder: React.FC<ExcelRequiredPlaceholderProps> = ({
  title = "No Active Excel Sheet Selected",
  description = "Based on the plant standard rules, calculations and simulation are only loaded when an active Excel dataset is selected or uploaded. Please upload a sheet to unlock the analytics."
}) => {
  const {
    setParts,
    setUploadedFileName,
    setParsedCount,
    setUploadError,
    uploadedWorkbooks,
    switchActiveDataset,
    setIsUploadModalOpen
  } = useMaterialFlow();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setLocalError(null);
    setLocalStatus("Reading sheet data...");
    setUploadedFileName(file.name);
    setUploadError(null);
    setIsUploadModalOpen(true);

    try {
      const parsedParts = await parseUploadedExcel(file);
      if (parsedParts.length > 0) {
        setParts(parsedParts);
        setParsedCount(parsedParts.length);
        setLocalStatus(`Successfully imported ${parsedParts.length} parts.`);
      } else {
        setLocalError("No valid parts found in the selected sheet.");
        setUploadError("No valid parts found in the selected sheet.");
      }
    } catch (err: any) {
      setLocalError(err.message || "Invalid Excel format");
      setUploadError(err.message || "Invalid Excel format");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-8 p-1">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#0f0f12] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-[#1e1e24] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-[#f3f4f6] tracking-tight">{title}</h2>
              <p className="text-xs text-slate-500 dark:text-[#9ea4b0] mt-1 max-w-xl">{description}</p>
            </div>
          </div>

          <button
            onClick={() => downloadSampleExcelTemplate()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a23] dark:hover:bg-[#252530] text-slate-700 dark:text-[#d1d5db] border border-slate-200 dark:border-[#2a2a2e] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Get Template Sheet
          </button>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Drag & Drop Area */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`flex-1 min-h-[220px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer select-none group
                ${dragActive 
                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20' 
                  : 'border-slate-200 dark:border-[#2a2a2e] bg-slate-50/50 hover:bg-slate-50 dark:bg-[#07070a]/40 dark:hover:bg-[#0c0c11]'
                }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx,.xls" 
                className="hidden" 
                onChange={handleChange}
              />
              
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#15151b] text-slate-500 dark:text-[#888] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-300">
                <UploadCloud className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>

              <span className="text-sm font-bold text-slate-700 dark:text-[#e5e7eb]">
                Drag &amp; drop Excel file here
              </span>
              <span className="text-xs text-slate-400 dark:text-[#6a7280] mt-1">
                or click to browse from local computer
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-[#1a1a23] text-slate-500 dark:text-[#888] px-2 py-0.5 rounded-md mt-3.5 font-mono border border-slate-200/50 dark:border-[#2a2a2e]">
                Excel Format (.xlsx, .xls)
              </span>
            </div>

            {localError && (
              <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-start gap-2 animate-shake">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{localError}</span>
              </div>
            )}
            
            {localStatus && (
              <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{localStatus}</span>
              </div>
            )}
          </div>

          {/* Right Column: Pre-Uploaded Files or Selection */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-[#7a8290] uppercase tracking-wider mb-3">
                Select from Pre-Uploaded Datasets
              </h3>
              
              {uploadedWorkbooks.length === 0 ? (
                <div className="p-4 border border-slate-200 dark:border-[#2a2a2e] rounded-xl bg-slate-50/50 dark:bg-[#0c0c11]/50 text-center flex flex-col items-center justify-center min-h-[140px]">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <span className="text-xs font-bold text-slate-500 dark:text-[#888]">No saved sheets found</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-600 max-w-[200px] mt-1">
                    Upload an Excel sheet using the area on the left to save it here for quick selection next time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {uploadedWorkbooks.map((f) => (
                    <div 
                      key={f.id}
                      onClick={() => switchActiveDataset(f.id, 'ALL')}
                      className="group p-3 border border-slate-200 dark:border-[#2a2a2e] rounded-xl bg-slate-50/50 dark:bg-[#0c0c11]/50 hover:bg-slate-100/50 dark:hover:bg-[#14141d]/50 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-700 dark:text-[#e5e7eb] block truncate max-w-[150px]">
                            {f.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {f.sheets.reduce((sum, s) => sum + s.parsedParts.length, 0)} parts · {f.sheets.length} sheets
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#1e1e24] text-[11px] text-slate-400 dark:text-[#6a7280]">
              <div className="flex gap-1.5 items-start">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  Calculations determine hourly consumption, operator cycle times, SWCT milk-run cycles, and material delivery sequences matching the TVS standard production layout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
