import React, { useState } from 'react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';
import { Header } from './Header';
import { Navigation, ActiveTab } from './Navigation';
import { TvsHorseLogo } from './TvsLogo';
import { motion } from 'motion/react';

// Direct imports for reliable bundling and zero dynamic import latency
import { ExecutiveDashboard } from '../features/dashboard/ExecutiveDashboard';
import { ProductionPlanning } from '../features/planning/ProductionPlanning';
import { PartMasterView } from '../features/parts/PartMaster';
import { RouteMasterView } from '../features/routes/RouteMaster';
import { TripPlanningView } from '../features/trips/TripPlanning';
import { LineFeedingMonitorView } from '../features/line-feeding/LineFeedingMonitor';
import { RealTimeInventoryView } from '../features/inventory/RealTimeInventory';
import { PredictiveStockAlertsPanel } from '../features/notifications/PredictiveStockAlertsPanel';
import { OperatorManagementView } from '../features/operators/OperatorManagement';
import { TripExecutionView } from '../features/trips/TripExecution';
import { SWCTDashboardView } from '../features/swct/SWCTDashboard';
import { CarryoverOptimizationView } from '../features/carryover-optimization/CarryoverOptimization';
import { ShiftHandoverReportView } from '../features/shift-handover/ShiftHandoverReport';
import { SettingsView } from '../features/settings/Settings';
import { ExcelUploadAnimationModal } from '../common/ExcelUploadAnimationModal';

export const AppContent: React.FC = () => {
  const {
    isUploadModalOpen,
    setIsUploadModalOpen,
    uploadedFileName,
    parsedCount,
    uploadError,
  } = useMaterialFlow();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-50 dark:bg-[#0a0a0c] text-slate-800 dark:text-[#e0e0e0] font-sans flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-300">
      {/* Top Header */}
      <Header
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
      />

      {/* Main Container with Sidebar + View Panel */}
      <div className="flex-1 flex overflow-hidden relative z-0 min-w-0">
        {/* Module Navigation Sidebar */}
        {!isUploadModalOpen && (
          <Navigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isMobileOpen={isMobileSidebarOpen}
            setIsMobileOpen={setIsMobileSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        )}

        {/* Main View Area with Independent Scrolling */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 lg:p-5 space-y-4 w-full bg-slate-50 dark:bg-[#0a0a0c] transition-colors duration-300 min-w-0">
          <div className="w-full space-y-4 min-w-0">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && <ExecutiveDashboard />}
              {activeTab === 'planning' && <ProductionPlanning />}
              {activeTab === 'parts' && <PartMasterView />}
              {activeTab === 'routes' && <RouteMasterView />}
              {activeTab === 'trips' && <TripPlanningView />}
              {activeTab === 'line-feeding' && <LineFeedingMonitorView />}
              {activeTab === 'inventory' && <RealTimeInventoryView />}
              {activeTab === 'notifications' && <PredictiveStockAlertsPanel mode="embedded" />}
              {activeTab === 'operators' && <OperatorManagementView />}
              {activeTab === 'trip-execution' && <TripExecutionView />}
              {activeTab === 'swct' && <SWCTDashboardView />}
              {activeTab === 'carryover-optimization' && <CarryoverOptimizationView />}
              {activeTab === 'shift-handover' && <ShiftHandoverReportView />}
              {activeTab === 'settings' && <SettingsView />}
            </motion.div>

            {/* TVS Motor Branded Footer */}
            <footer className="bg-white dark:bg-[#0f0f12] border border-slate-200 dark:border-[#2a2a2e] rounded-xl py-3 px-5 text-center text-[11px] text-slate-500 dark:text-[#888] font-mono flex flex-col sm:flex-row items-center justify-between gap-3 w-full mt-6 transition-colors duration-300 shadow-xs">
              <div className="flex items-center gap-2.5">
                <TvsHorseLogo className="h-4.5 w-auto" />
                <span className="font-extrabold text-red-600 dark:text-red-500 tracking-wider font-sans">TVS MOTOR COMPANY</span>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                <span className="text-slate-600 dark:text-slate-400"> Hosur </span>
              </div>
              <span className="text-blue-500 dark:text-blue-400 font-bold animate-pulse">● ZERO LINE STOPPAGE SYSTEM LOGGED</span>
              <div className="flex items-center gap-1.5">
                <span>DMF CONTROL TOWER v2.4</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#1a1a23] text-slate-600 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-800">OK</span>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* Global Slide-Over Predictive Notification Drawer */}
      <PredictiveStockAlertsPanel
        mode="drawer"
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
      />

      {/* Excel Animated Upload Modal */}
      <ExcelUploadAnimationModal
        isOpen={isUploadModalOpen}
        fileName={uploadedFileName}
        parsedCount={parsedCount}
        errorMessage={uploadError}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
};

export default AppContent;
