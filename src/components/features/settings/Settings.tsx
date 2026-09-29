import React, { useState } from 'react';
import { useMaterialFlow } from '../../../context/MaterialFlowContext';
import { 
  Settings as SettingsIcon, 
  Sun, 
  Moon, 
  Monitor, 
  Factory, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Gauge, 
  Zap, 
  Users, 
  RotateCcw,
  Check,
  Building2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export const SettingsView: React.FC = () => {
  const {
    productionPlan,
    updateProductionPlan,
    theme,
    setDashboardMode,
    dashboardMode,
    selectedPlant,
    setSelectedPlant,
    setTheme,
  } = useMaterialFlow();

  // Local settings that we persist or couple with state
  const [bovPriority, setBovPriority] = useState<boolean>(() => {
    return localStorage.getItem('tvs_bov_priority') !== 'false';
  });
  const [soundAlerts, setSoundAlerts] = useState<boolean>(() => {
    return localStorage.getItem('tvs_sound_alerts') !== 'false';
  });
  const [speedLimit, setSpeedLimit] = useState<number>(() => {
    return Number(localStorage.getItem('tvs_speed_limit')) || 8;
  });
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Read theme from context or localStorage
  const currentTheme = theme || 'dark';

  const plants = [
    { id: 'hosur', name: 'Hosur Main Plant (Tamil Nadu)', desc: 'Primary Scooter, Motorcycle & EV hub' },
    { id: 'mysore', name: 'Mysore Advanced Facility (Karnataka)', desc: 'Premium series & R&D proving ground' },
    { id: 'nalagarh', name: 'Nalagarh Assembly (Himachal Pradesh)', desc: 'Commuter motorcycles & northern logistics' },
    { id: 'jakarta', name: 'Karawang Assembly (Indonesia / PT TVS)', desc: 'Southeast Asian regional hub' },
  ];

  const handleSave = () => {
    localStorage.setItem('tvs_bov_priority', String(bovPriority));
    localStorage.setItem('tvs_sound_alerts', String(soundAlerts));
    localStorage.setItem('tvs_speed_limit', String(speedLimit));
    
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  const handleReset = () => {
    setSelectedPlant('Hosur Main Plant (Tamil Nadu)');
    setBovPriority(true);
    setSoundAlerts(true);
    setSpeedLimit(8);
    updateProductionPlan({ taktTimeSeconds: 27.9 });
    setTheme('dark');
    
    localStorage.setItem('tvs_bov_priority', 'true');
    localStorage.setItem('tvs_sound_alerts', 'true');
    localStorage.setItem('tvs_speed_limit', '8');
    
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header and Toast */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 font-sans">
            <SettingsIcon className="w-5.5 h-5.5 text-blue-500 animate-[spin_5s_linear_infinite]" />
            TVS DMF SETTINGS PANEL
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Configure Hosur/Mysore plant presets, alert sounds, safety speed rules, and theme preferences.
          </p>
        </div>

        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono"
          >
            <Check className="w-4 h-4" />
            <span>Settings saved successfully!</span>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: General Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Plant Logistics & Speed Safety Thresholds */}
          <section className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Gauge className="w-4.5 h-4.5 text-blue-500" />
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-900 dark:text-slate-200">
                1. Operational Speed & Safety Parameters
              </h3>
            </div>

            <div className="space-y-4">
              {/* Max Speed Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-slate-400">Aisle Speed Limit for Operator Fleet:</span>
                  <span className="text-blue-500 dark:text-blue-400 font-bold">{speedLimit} km/h</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="16"
                  step="1"
                  value={speedLimit}
                  onChange={(e) => setSpeedLimit(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                />
                <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                  <span>4 km/h (Strict Safety)</span>
                  <span>10 km/h (Standard)</span>
                  <span>16 km/h (High-velocity Warning)</span>
                </div>
              </div>

              {/* Takt Time Override */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="tvs-takt-override" className="text-xs text-slate-600 dark:text-slate-400 font-mono block">
                    Manufacturing Takt Time (Sec):
                  </label>
                  <div className="flex bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                    <input
                      id="tvs-takt-override"
                      type="number"
                      step="0.1"
                      min="10"
                      max="120"
                      value={productionPlan.taktTimeSeconds}
                      onChange={(e) => updateProductionPlan({ taktTimeSeconds: Math.max(10, Number(e.target.value)) })}
                      className="bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white w-full px-2 py-1.5 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono px-2 py-1.5 shrink-0 uppercase">SEC</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="dashboard-mode-selector" className="text-xs text-slate-600 dark:text-slate-400 font-mono block">
                    Telemetry Mode (All Viewports):
                  </label>
                  <select
                    id="dashboard-mode-selector"
                    value={dashboardMode}
                    onChange={(e) => setDashboardMode(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="live">LIVE PRODUCTION (Real-Time Tick)</option>
                    <option value="static">STATIC RECONCILIATION REPORT (Ideal Shift)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* TVS Special Features & System Settings */}
          <section className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Zap className="w-4.5 h-4.5 text-amber-500" />
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-900 dark:text-slate-200">
                2. Advanced Material Routing & Alerts
              </h3>
            </div>

            <div className="space-y-4">
              {/* BOV Priority Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#09090b] rounded-xl border border-slate-200 dark:border-slate-800/80">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                    TVS BOV Emergency Routing
                    <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0">Priority</span>
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                    Prioritizes Battery Operated Vehicles (BOVs) for material shortage alarms, bypassing standard queues.
                  </p>
                </div>
                <button
                  onClick={() => setBovPriority(!bovPriority)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    bovPriority ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-800'
                  }`}
                  role="switch"
                  aria-checked={bovPriority}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      bovPriority ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sound Alerts Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#09090b] rounded-xl border border-slate-200 dark:border-slate-800/80">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                    Critical Shortage Alarms
                    {soundAlerts ? <Volume2 className="w-3.5 h-3.5 text-blue-500" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-relaxed">
                    Plays sound effects and displays prominent red alerts in the Control Tower when stock coverage drops below safety levels.
                  </p>
                </div>
                <button
                  onClick={() => setSoundAlerts(!soundAlerts)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    soundAlerts ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-800'
                  }`}
                  role="switch"
                  aria-checked={soundAlerts}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      soundAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Bottom Action Area */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16161c] dark:hover:bg-[#202028] dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-mono text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Factory Presets
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-blue-900/10"
            >
              <Check className="w-4 h-4" />
              Save Configuration
            </button>
          </div>

        </div>

        {/* Right Column: Theme Switcher & System Profile Preview */}
        <div className="space-y-6">
          
          {/* Theme Switcher Widget */}
          <section className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-[#2a2a2e] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <Sun className="w-4.5 h-4.5 text-amber-500 dark:text-blue-400" />
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-900 dark:text-slate-200">
                3. Select Theme Preference
              </h3>
            </div>

            <div className="flex flex-col gap-2.5">
              {[
                { id: 'light', label: 'Light Theme', desc: 'Aesthetic high-contrast paper layout', icon: Sun, color: 'text-amber-500' },
                { id: 'dark', label: 'Dark Theme', desc: 'Premium technical slate look (Default)', icon: Moon, color: 'text-indigo-400' },
                { id: 'system', label: 'System Sync', desc: 'Follows operating system settings', icon: Monitor, color: 'text-teal-400' },
              ].map((themeItem) => {
                const isSelected = currentTheme === themeItem.id;
                const Icon = themeItem.icon;
                
                return (
                  <button
                    key={themeItem.id}
                    onClick={() => setTheme(themeItem.id as any)}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-500/5 border-blue-600 dark:bg-blue-500/10 dark:border-blue-400'
                        : 'bg-slate-50 dark:bg-[#09090b] border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-white dark:bg-[#1a1a1f] border border-slate-200 dark:border-slate-800 shadow-sm ${themeItem.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{themeItem.label}</span>
                        {isSelected && (
                          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block leading-snug">{themeItem.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Informational Card */}
          <section className="bg-red-500/5 border border-red-500/20 dark:bg-red-500/10 dark:border-red-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4.5 h-4.5 shrink-0" />
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">TVS Heritage & Safety First</h4>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
              TVS Motors DMF control system enforces rigorous standard operating procedures. Setting a speed limit above 12 km/h inside line corridors triggers an automated supervisor safety notification log. Keep speeds locked inside standard limits.
            </p>
          </section>

        </div>

      </div>
    </motion.div>
  );
};
