import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  MapPin,
  Truck,
  Activity,
  Boxes,
  Users,
  PlaySquare,
  BarChart3,
  ShieldAlert,
  Calculator,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Settings,
  BellRing,
} from 'lucide-react';
import { useMaterialFlow } from '../../context/MaterialFlowContext';

export type ActiveTab =
  | 'dashboard'
  | 'planning'
  | 'parts'
  | 'routes'
  | 'trips'
  | 'line-feeding'
  | 'inventory'
  | 'notifications'
  | 'operators'
  | 'trip-execution'
  | 'swct'
  | 'carryover-optimization'
  | 'shift-handover'
  | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { inventoryStates, trips, parts, productionPlan, modeConfigs } = useMaterialFlow();

  const atRiskCount = inventoryStates.filter((s) => s.riskLevel === 'Red' || s.riskLevel === 'Yellow').length;
  const criticalCount = inventoryStates.filter((s) => s.riskLevel === 'Red').length;
  const activeTripsCount = trips.filter((t) => t.status === 'In Progress' || t.status === 'Started' || t.status === 'Delayed').length;

  // Calculate low-stock predictive alert count (< 45m or Red/Yellow)
  const predictiveAlertCount = inventoryStates.filter((s) => s.coverageHours < 1.0).length;

  const sections: {
    title: string;
    tabs: { id: ActiveTab; label: string; shortLabel: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[];
  }[] = [
    {
      title: 'CONTROL TOWER',
      tabs: [
        { id: 'dashboard', label: 'Executive Tower', shortLabel: 'Dashboard', icon: LayoutDashboard },
        { id: 'planning', label: 'Production Plan', shortLabel: 'Plan', icon: Calendar },
        { id: 'swct', label: 'SWCT Analytics', shortLabel: 'SWCT', icon: BarChart3 },
        { id: 'shift-handover', label: 'Shift Handover', shortLabel: 'Handover', icon: ClipboardCheck, badgeColor: 'bg-emerald-600 text-white' },
      ],
    },
    {
      title: 'OPERATION PLANNING',
      tabs: [
        { id: 'trips', label: 'Trip Planning', shortLabel: 'Trips', icon: Truck, badge: activeTripsCount, badgeColor: 'bg-blue-600 text-white' },
        { id: 'carryover-optimization', label: 'Carryover Optimization', shortLabel: 'Carryover', icon: Calculator, badgeColor: 'bg-indigo-600 text-white' },
        { id: 'notifications', label: 'Predictive Alerts', shortLabel: 'Alerts', icon: BellRing, badge: predictiveAlertCount > 0 ? predictiveAlertCount : undefined, badgeColor: predictiveAlertCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-600 text-white' },
      ],
    },
    {
      title: 'EXECUTION CENTER',
      tabs: [
        { id: 'trip-execution', label: 'Trip Execution', shortLabel: 'Execution', icon: PlaySquare },
        { id: 'line-feeding', label: 'Line Feeding', shortLabel: 'Feeding', icon: Activity, badge: atRiskCount, badgeColor: atRiskCount > 0 ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white' },
        { id: 'inventory', label: 'Inventory Ledger', shortLabel: 'Ledger', icon: Boxes },
      ],
    },
    {
      title: 'RESOURCE MANAGEMENT',
      tabs: [
        { id: 'operators', label: 'Operator Roster', shortLabel: 'Operators', icon: Users },
      ],
    },
    {
      title: 'MASTER DATA',
      tabs: [
        { id: 'parts', label: 'Part Master', shortLabel: 'Parts', icon: Layers },
        { id: 'routes', label: 'Route Master', shortLabel: 'Routes', icon: MapPin },
      ],
    },
    {
      title: 'ADMINISTRATION',
      tabs: [
        { id: 'settings', label: 'System Settings', shortLabel: 'Settings', icon: Settings },
      ],
    },
  ];

  let overallItemIndex = 0;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <nav
        id="module-navigation"
        className={`bg-slate-100 border-r border-slate-200 flex flex-col h-full shrink-0 ${
          isMobileOpen ? 'z-50' : 'z-10 md:z-auto'
        } transition-all duration-300 select-none dark:bg-[#0f0f12] dark:border-[#2a2a2e] ${
          isCollapsed ? 'w-16' : 'w-60'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed md:static top-0 bottom-0 left-0 shadow-2xl md:shadow-none`}
      >
        {/* Sidebar Header with Hamburger & Collapse Controls */}
        <div className="p-3 border-b border-slate-200 dark:border-[#2a2a2e] flex items-center justify-between bg-slate-200/60 dark:bg-[#121216] h-12 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded text-blue-600 hover:bg-slate-200 dark:text-blue-400 dark:hover:bg-[#1a1a1f] transition-colors cursor-pointer"
                title="Collapse Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold tracking-wider text-slate-800 dark:text-white uppercase truncate">
                Control Modules
              </span>
            </div>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="mx-auto p-1.5 rounded text-blue-600 hover:bg-slate-200 dark:text-blue-400 dark:hover:bg-[#1a1a1f] transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          {!isCollapsed && (
            <div className="flex items-center space-x-1">
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-[#888] dark:hover:text-white dark:hover:bg-[#1a1a1f] transition-colors cursor-pointer hidden md:block"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-[#888] dark:hover:text-white dark:hover:bg-[#1a1a1f] transition-colors cursor-pointer md:hidden"
                title="Close Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Item List Grouped by Sections */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3 no-scrollbar">
          {sections.map((sec, secIdx) => (
            <div key={sec.title} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 pt-1 pb-0.5 text-[9px] font-mono font-bold tracking-widest text-slate-400 dark:text-[#666] uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70" />
                  {sec.title}
                </div>
              ) : (
                secIdx > 0 && <div className="my-1.5 border-t border-slate-200 dark:border-[#2a2a2e]" />
              )}

              {sec.tabs.map((tab) => {
                overallItemIndex++;
                const itemNum = overallItemIndex;
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (window.innerWidth < 768) {
                        setIsMobileOpen(false);
                      }
                    }}
                    title={tab.label}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                    } py-2 rounded-lg text-xs font-mono transition-all cursor-pointer relative group ${
                      isActive
                        ? 'bg-blue-100 text-blue-900 font-bold border-l-4 border-blue-600 shadow-xs dark:bg-blue-600/20 dark:text-white dark:border-blue-500'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border-l-4 border-transparent dark:text-[#888] dark:hover:text-[#e0e0e0] dark:hover:bg-[#16161b]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-[#666]'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate text-[11px] tracking-tight">
                          {itemNum}. {tab.label}
                        </span>
                      )}
                    </div>

                    {/* Badge Notification Count */}
                    {typeof tab.badge === 'number' && tab.badge > 0 && (
                      <span
                        className={`shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold font-mono ${
                          tab.badgeColor
                        } ${isCollapsed ? 'absolute -top-1 -right-1 px-1 text-[8px] rounded-full' : ''}`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer Info */}
        {!isCollapsed ? (
          <div className="p-3 border-t border-slate-200 dark:border-[#2a2a2e] bg-slate-200/50 dark:bg-[#0a0a0c] text-[10px] text-slate-500 dark:text-[#666] font-mono flex items-center justify-between shrink-0">
            <span>PLANT_01 • 14 MODULES</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        ) : (
          <div className="p-2 border-t border-slate-200 dark:border-[#2a2a2e] bg-slate-200/50 dark:bg-[#0a0a0c] flex justify-center shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        )}
      </nav>
    </>
  );
};

