import React, { useState, Suspense } from 'react';
import { MaterialFlowProvider } from './context/MaterialFlowContext';
import { LandingPage } from './components/landing/LandingPage';
import { motion, AnimatePresence } from 'motion/react';
import AppContent from './components/layout/AppContent';

const AppLoadingScreen: React.FC = () => (
  <div className="h-screen w-full bg-[#05070B] flex flex-col items-center justify-center gap-4 text-white font-mono">
    <div className="relative flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
      <div className="absolute w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
    </div>
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm font-bold tracking-wider text-cyan-300">INITIALIZING CONTROL TOWER</span>
      <span className="text-[11px] text-slate-400">Loading modules & live line sync...</span>
    </div>
  </div>
);

export default function App() {
  const [isAppLaunched, setIsAppLaunched] = useState(false);

  return (
    <MaterialFlowProvider>
      <AnimatePresence mode="wait">
        {!isAppLaunched ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
          >
            <LandingPage onLaunch={() => setIsAppLaunched(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-screen w-full"
          >
            <Suspense fallback={<AppLoadingScreen />}>
              <AppContent />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </MaterialFlowProvider>
  );
}

