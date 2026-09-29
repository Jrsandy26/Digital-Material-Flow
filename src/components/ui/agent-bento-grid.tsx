"use client";

import React, { useState, useEffect, memo } from "react";
import { motion } from "motion/react";
import {
  Truck,
  Package,
  Factory,
  Gauge,
  Lightning,
  ArrowsClockwise,
  Check,
  Clock,
  Gear,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────
   Niche: Digital Material Flow & Line Feeding Control Tower
   Grid: 3 cards top row · 2 cards bottom row
   Optimized for low-RAM, GPU-composited, zero jank rendering
────────────────────────────────────────────────────── */

interface FeatCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatCard({ title, description, children, className = "" }: FeatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-30px" }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-[20px] p-4.5",
        "bg-[#0D1522] text-slate-100 transform-gpu",
        "border border-white/10 shadow-[0_4px_24px_-2px_rgba(0,0,0,0.6)]",
        "hover:border-cyan-400/60 hover:shadow-[0_0_25px_rgba(56,189,248,0.22)] hover:-translate-y-1 transition-all duration-200",
        className
      )}
    >
      {/* Subtle ambient hover glow background */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/0 group-hover:bg-cyan-500/15 rounded-full blur-3xl transition-all duration-500 pointer-events-none" />
      <div className="z-10 flex flex-col gap-1">
        <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
          {title}
        </h3>
        <p className="text-slate-400 text-xs leading-relaxed max-w-[95%]">{description}</p>
      </div>
      <div className="relative mt-2 flex-1 w-full rounded-[14px] overflow-hidden border border-white/10 bg-[#070B12]/80 group-hover:border-white/20 transition-colors">
        {children}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Card 1 – Material Route Pipeline (Optimized)
   ───────────────────────────────────────────── */

type ActiveStep = "store" | "kitting" | "tugger" | "line100" | "pocFeed" | "return";

const VW = 320;
const VH = 240;

const NODES = [
  { id: "Store", x: 50, y: 120, icon: Package, label: "STORE", type: "box" },
  { id: "Hub", x: 125, y: 120, type: "circle" },
  { id: "Tugger", x: 200, y: 120, icon: Truck, label: "TUGGER", type: "box" },
  { id: "Line100", x: 278, y: 52, icon: Factory, label: "1VCON100", type: "box" },
  { id: "PocFeed", x: 278, y: 188, icon: Gauge, label: "POC FEED", type: "box" },
];

const PATHS = [
  { id: "store-to-hub", d: "M 78 120 L 113 120", activeSteps: ["store"], colorClass: "text-cyan-400" },
  { id: "hub-to-tugger", d: "M 137 120 L 172 120", activeSteps: ["kitting"], colorClass: "text-blue-400" },
  { id: "tugger-to-line100", d: "M 200 92 L 200 52 L 250 52", activeSteps: ["line100"], colorClass: "text-indigo-400" },
  { id: "tugger-to-pocfeed", d: "M 200 148 L 200 188 L 250 188", activeSteps: ["pocFeed"], colorClass: "text-emerald-400" },
  { id: "return-flow-1", d: "M 172 120 L 137 120", activeSteps: ["return"], colorClass: "text-amber-400" },
  { id: "return-flow-2", d: "M 113 120 L 78 120", activeSteps: ["return"], colorClass: "text-amber-400" },
];

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; buttonBg: string; buttonBorder: string }> = {
  Store: { bg: "bg-cyan-500/10", border: "border-cyan-500/60", text: "text-cyan-400", buttonBg: "bg-cyan-600", buttonBorder: "border-cyan-400" },
  Hub: { bg: "bg-amber-500/10", border: "border-amber-500/60", text: "text-amber-400", buttonBg: "bg-amber-500", buttonBorder: "border-amber-600" },
  Tugger: { bg: "bg-blue-500/10", border: "border-blue-500/60", text: "text-blue-400", buttonBg: "bg-blue-600", buttonBorder: "border-blue-400" },
  Line100: { bg: "bg-indigo-500/10", border: "border-indigo-500/60", text: "text-indigo-400", buttonBg: "bg-indigo-600", buttonBorder: "border-indigo-400" },
  PocFeed: { bg: "bg-emerald-500/10", border: "border-emerald-500/60", text: "text-emerald-400", buttonBg: "bg-emerald-600", buttonBorder: "border-emerald-400" },
};

export const Card1 = memo(function Card1() {
  const [step, setStep] = useState<ActiveStep>("store");

  useEffect(() => {
    const steps: ActiveStep[] = ["store", "kitting", "tugger", "line100", "pocFeed", "return"];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % steps.length;
      setStep(steps[idx]);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const isNodeActive = (nodeId: string) => {
    switch (step) {
      case "store": return nodeId === "Store";
      case "kitting": return nodeId === "Hub";
      case "tugger": return nodeId === "Tugger";
      case "line100": return nodeId === "Tugger" || nodeId === "Line100";
      case "pocFeed": return nodeId === "Tugger" || nodeId === "PocFeed";
      case "return": return nodeId === "Tugger" || nodeId === "Hub" || nodeId === "Store";
      default: return false;
    }
  };

  const getStepLabel = () => {
    switch (step) {
      case "store": return "Stage 1: Parts Picked @ Central Store";
      case "kitting": return "Stage 2: Kitting Hub Sequencing";
      case "tugger": return "Stage 3: Jumbo Tugger #02 En Route";
      case "line100": return "Stage 4: Feeding Line 1VCON100";
      case "pocFeed": return "Stage 5: Station POC Buffer Synced";
      case "return": return "Stage 6: Empty Bin Reverse Loop";
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-[#070B12] rounded-xl flex flex-col items-center justify-between p-2">
      {/* Grid Pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" aria-hidden>
        <defs>
          <pattern id="clean-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.75" fill="#334155" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#clean-grid)" />
      </svg>

      {/* Top status indicator */}
      <div className="w-full flex items-center justify-between z-10 px-2 pt-1">
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>ROUTE ACTIVE</span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 truncate max-w-[170px]">{getStepLabel()}</span>
      </div>

      {/* Connector SVG & Nodes */}
      <svg
        className="w-full h-[180px] transform-gpu"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <path d="M 78 120 L 113 120" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 137 120 L 172 120" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 200 92 L 200 52 L 250 52" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M 200 148 L 200 188 L 250 188" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="3 3" />

        {PATHS.map((p) => {
          const isActive = p.activeSteps.includes(step);
          if (!isActive) return null;

          return (
            <g key={p.id}>
              <path
                d={p.d}
                fill="none"
                stroke="currentColor"
                className={p.colorClass}
                strokeWidth="3"
                strokeOpacity="0.3"
              />
              <path
                d={p.d}
                fill="none"
                stroke="currentColor"
                className={p.colorClass}
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {NODES.map((node) => {
          const isBox = node.type === "box";
          const w = isBox ? 58 : 24;
          const h = isBox ? 54 : 24;
          const isActive = isNodeActive(node.id);
          const colorStyles = NODE_COLORS[node.id];

          return (
            <foreignObject
              key={node.id}
              x={node.x - w / 2}
              y={node.y - h / 2}
              width={w}
              height={h}
              className="overflow-visible"
            >
              <div className="w-full h-full flex items-center justify-center">
                {isBox && node.icon ? (
                  <div
                    className={`w-full h-full rounded-[12px] border flex flex-col items-center justify-center shadow-lg text-white transition-all duration-300 ${
                      colorStyles.buttonBg
                    } ${colorStyles.buttonBorder} ${
                      isActive ? "ring-2 ring-white/50 shadow-cyan-500/30 scale-105" : "opacity-85"
                    }`}
                  >
                    <div className="mb-0.5 flex items-center justify-center">
                      <node.icon className="w-4.5 h-4.5" weight="fill" />
                    </div>
                    <span className="text-[7.5px] font-mono font-bold tracking-wider select-none text-center px-0.5 leading-tight">
                      {node.label}
                    </span>
                  </div>
                ) : (
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm transition-all duration-300 ${
                      isActive ? "bg-amber-500/30 border-amber-400" : "bg-[#0A1018] border-slate-700"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full border border-dashed animate-spin ${
                        isActive ? "border-amber-400" : "border-slate-500"
                      }`}
                    />
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Card 2 – Takt & Output Monitor (Live Animated Graph)
   ───────────────────────────────────────────── */
export const Card2 = memo(function Card2() {
  const [bars, setBars] = useState([129, 125, 138, 131, 118, 135, 142, 150]);
  const [liveTakt, setLiveTakt] = useState(27.9);
  const target = 129;
  const hours = ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"];

  const [activeIdx, setActiveIdx] = useState(0);

  // Live real-time up & down graph oscillation
  useEffect(() => {
    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map((val, idx) => {
          // Keep active hours (H6-H8) fluctuating live going up and down
          const delta = Math.floor(Math.random() * 19) - 9; // -9 to +9
          const base = idx > 4 ? 135 : 125;
          return Math.min(160, Math.max(98, val + delta || base));
        })
      );
      setLiveTakt(Number((27.5 + Math.random() * 0.8).toFixed(1)));
      setActiveIdx((prev) => (prev === 0 ? 1 : 0));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Compute live SVG sparkline path from bar heights
  const sparklinePath1 = bars
    .slice(0, 5)
    .map((v, i) => `${i * 10},${Math.round(18 - ((v - 95) / 65) * 14)}`)
    .reduce((acc, pt, idx) => (idx === 0 ? `M ${pt}` : `${acc} L ${pt}`), "");

  const sparklinePath2 = bars
    .slice(3)
    .map((v, i) => `${i * 10},${Math.round(18 - ((v - 95) / 65) * 14)}`)
    .reduce((acc, pt, idx) => (idx === 0 ? `M ${pt}` : `${acc} L ${pt}`), "");

  return (
    <div className="w-full h-full flex flex-col gap-2.5 justify-between p-1">
      <div className="flex gap-2.5 pt-1">
        {[
          { label: "Takt Time", value: `${liveTakt}s`, trend: "LIVE SYNC", icon: Clock },
          { label: "Shift Feeding", value: "1,032 u", trend: "100% Target", icon: Factory },
        ].map((s, i) => {
          const isActive = i === activeIdx;

          return (
            <div
              key={i}
              className={`flex-1 h-[68px] rounded-xl p-2.5 border transition-all duration-300 flex items-center justify-between gap-2 shadow-md cursor-pointer ${
                isActive
                  ? "bg-[#0E182A] border-cyan-400/60 shadow-cyan-500/20"
                  : "bg-[#0B1320] border-white/10"
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] text-slate-400 font-mono uppercase tracking-widest leading-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  {s.label}
                </span>
                <span className="text-sm font-bold font-mono text-white leading-none mt-1.5 tracking-tight">
                  {s.value}
                </span>
                <span className="text-[8px] font-mono font-bold text-emerald-400 mt-1.5">
                  {s.trend}
                </span>
              </div>

              <div className="w-10 h-6 flex items-center justify-center shrink-0">
                <svg className="w-full h-full" viewBox="0 0 40 20">
                  <path
                    d={i === 0 ? sparklinePath1 : sparklinePath2}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar chart with smooth live animated heights */}
      <div className="flex-1 flex items-end gap-2 px-1 min-h-[78px] pt-2">
        {bars.map((val, i) => {
          const pct = Math.min(100, Math.max(15, Math.round((val / 165) * 100)));
          const isTargetMet = val >= target * 0.95;

          return (
            <div
              key={i}
              className="flex-1 h-full rounded-lg bg-[#070B12] border border-white/10 relative overflow-hidden flex flex-col justify-end group/bar"
            >
              <div className="absolute top-[22%] left-0 right-0 h-[1px] bg-red-500/40 z-10 border-b border-dashed border-red-400/50" />
              <div
                style={{ height: `${pct}%` }}
                className={`w-full rounded-t-md transition-all duration-500 ease-out ${
                  isTargetMet
                    ? "bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                    : "bg-gradient-to-t from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                }`}
              />
              <span className="absolute bottom-1 left-0 right-0 text-center text-[7px] font-mono font-bold text-white opacity-0 group-hover/bar:opacity-100 transition-opacity">
                {val}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 px-1">
        {hours.map((d, i) => (
          <p key={i} className="flex-1 text-center text-[7.5px] text-slate-400 font-mono font-medium">
            {d}
          </p>
        ))}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Card 3 – Stacked Operator & AGV Dispatch Feed (Optimized)
   ───────────────────────────────────────────── */

const STATUS_ICONS: Record<string, { icon: any; color: string; bg: string; gradient: string; border: string }> = {
  active: { icon: Truck, color: "text-cyan-400", bg: "bg-cyan-500/15", gradient: "bg-gradient-to-b from-cyan-400 to-blue-600", border: "border-cyan-400" },
  feeding: { icon: Lightning, color: "text-emerald-400", bg: "bg-emerald-500/15", gradient: "bg-gradient-to-b from-emerald-400 to-emerald-600", border: "border-emerald-500" },
  loading: { icon: Package, color: "text-amber-400", bg: "bg-amber-500/15", gradient: "bg-gradient-to-b from-amber-400 to-amber-600", border: "border-amber-500" },
  return: { icon: ArrowsClockwise, color: "text-indigo-400", bg: "bg-indigo-500/15", gradient: "bg-gradient-to-b from-indigo-400 to-indigo-600", border: "border-indigo-500" },
  ready: { icon: Check, color: "text-lime-400", bg: "bg-lime-500/15", gradient: "bg-gradient-to-b from-lime-400 to-lime-600", border: "border-lime-500" },
};

export const Card3 = memo(function Card3() {
  const logs = [
    { entity: "Tugger A-101 (Ramesh)", action: "Delivering Frame Assemblies -> 1VCON100", status: "active", t: "2.4m" },
    { entity: "AGV Fleet #04", action: "Docking Battery Packs at Stn 06", status: "feeding", t: "1.1m" },
    { entity: "Suresh P. (Jumbo)", action: "Staging Wiring Harnesses in Supermarket", status: "loading", t: "3.2m" },
    { entity: "Deepak Raj (Tugger B)", action: "Collecting 4x Empty Trolleys at Line End", status: "return", t: "0.8m" },
    { entity: "Standby Fleet Crew", action: "Shift 2 Buffer Pre-Load Ready", status: "ready", t: "0.0m" },
  ];

  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % logs.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [logs.length]);

  const currentLog = logs[activeIdx];
  const nextLog = logs[(activeIdx + 1) % logs.length];
  const prevLog = logs[(activeIdx - 1 + logs.length) % logs.length];

  return (
    <div className="w-full h-full relative flex flex-col justify-center gap-2 p-2 overflow-hidden">
      {/* Stacked 3 items with smooth CSS transforms */}
      {[prevLog, currentLog, nextLog].map((l, i) => {
        const isMain = i === 1;
        const si = STATUS_ICONS[l.status] || STATUS_ICONS.active;

        return (
          <div
            key={l.entity}
            className={`w-full rounded-xl border flex items-center gap-2.5 transition-all duration-300 ${
              isMain
                ? "px-3 py-2 bg-[#0C1422] border-blue-500/40 shadow-lg scale-100 opacity-100 z-10"
                : "px-2.5 py-1.5 bg-[#080D16]/60 border-white/5 scale-95 opacity-50 z-0"
            }`}
          >
            <div
              className={`shrink-0 rounded-[8px] flex items-center justify-center font-bold text-white ${
                si.gradient
              } border ${si.border} ${isMain ? "w-7 h-7" : "w-5 h-5"}`}
            >
              <si.icon weight="bold" className={isMain ? "w-4 h-4" : "w-3 h-3"} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`font-mono font-bold text-white leading-none ${isMain ? "text-[10px]" : "text-[8.5px]"}`}>
                  {l.entity}
                </span>
                <span className={`font-mono uppercase tracking-wide rounded px-1 py-0.5 ${si.bg} ${si.color} text-[6.5px]`}>
                  {l.status}
                </span>
              </div>
              {isMain && (
                <p className="text-[8.5px] text-slate-300 truncate mt-0.5 leading-tight">{l.action}</p>
              )}
            </div>

            {isMain && (
              <span className="text-[8.5px] font-mono text-cyan-400 shrink-0 font-bold">{l.t}</span>
            )}
          </div>
        );
      })}

      {/* Ticker dots */}
      <div className="flex justify-center gap-1 mt-1">
        {logs.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === activeIdx ? "w-3 bg-cyan-400" : "w-1 bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Card 4 – Predictive Stock & Buffer Coverage (Optimized)
   ───────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, { bar: string; dot: string; badge: string; buttonBg: string; buttonBorder: string }> = {
  chassis: { bar: "from-blue-500 to-cyan-400", dot: "bg-cyan-400", badge: "bg-blue-500/20 text-cyan-300", buttonBg: "bg-blue-600", buttonBorder: "border-blue-400" },
  powertrain: { bar: "from-indigo-500 to-indigo-400", dot: "bg-indigo-400", badge: "bg-indigo-500/20 text-indigo-300", buttonBg: "bg-indigo-600", buttonBorder: "border-indigo-400" },
  battery: { bar: "from-emerald-500 to-emerald-400", dot: "bg-emerald-400", badge: "bg-emerald-500/20 text-emerald-300", buttonBg: "bg-emerald-600", buttonBorder: "border-emerald-400" },
  fasteners: { bar: "from-amber-500 to-amber-400", dot: "bg-amber-400", badge: "bg-amber-500/20 text-amber-300", buttonBg: "bg-amber-600", buttonBorder: "border-amber-400" },
};

const REPLENISHMENT_LOGS = [
  { cat: "chassis", text: "Chassis Frame Set #12 -> Line 1VCON100", t: "0.2s" },
  { cat: "battery", text: "Li-Ion Pack Buffer Healthy (5.2 hrs)", t: "1.4s" },
  { cat: "powertrain", text: "24x Drive Motors Staged @ Kitting", t: "2.8s" },
  { cat: "fasteners", text: "Kanban Bin Swap Confirmed @ Stn 09", t: "4.1s" },
];

export const Card4 = memo(function Card4() {
  const categories = [
    { key: "chassis", name: "Chassis & Frame", coverage: "4.8h", fill: 94, icon: Factory },
    { key: "battery", name: "Battery & ECU", coverage: "5.2h", fill: 98, icon: Lightning },
    { key: "powertrain", name: "Motor Assembly", coverage: "3.6h", fill: 82, icon: Gear },
    { key: "fasteners", name: "Hardware & Bins", coverage: "2.8h", fill: 74, icon: Package },
  ];

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => (prev + 1) % REPLENISHMENT_LOGS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const activeCat = REPLENISHMENT_LOGS[tick].cat;

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-4 py-2 px-3">
      {/* Left panel: Category Buffer Bars */}
      <div className="flex-1 flex flex-col justify-between min-w-0 pr-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400">Buffer Safety Coverage</p>
          <span className="text-[8px] font-mono text-emerald-400 font-bold">100% LIVE TELEMETRY</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {categories.map((cat) => {
            const c = CATEGORY_COLORS[cat.key];
            const isActive = cat.key === activeCat;
            const Icon = cat.icon;

            return (
              <div key={cat.key} className="flex items-center gap-2.5">
                <div
                  className={`flex shrink-0 items-center justify-center w-[28px] h-[28px] rounded-[8px] border transition-all duration-300 ${
                    isActive
                      ? `text-white ${c.buttonBg} ${c.buttonBorder} scale-105 shadow-md shadow-cyan-500/20`
                      : "bg-[#0A101A] border-white/10 text-slate-400"
                  }`}
                >
                  <Icon size={14} weight={isActive ? "fill" : "regular"} />
                </div>

                <span className={`text-[9px] font-mono w-28 shrink-0 truncate transition-colors duration-200 ${
                  isActive ? "text-white font-bold" : "text-slate-400"
                }`}>
                  {cat.name}
                </span>

                <div className="flex-1 h-2 bg-[#0A101A] border border-white/5 rounded-full overflow-hidden relative">
                  <div
                    style={{ width: `${cat.fill}%` }}
                    className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-500 ${
                      isActive ? "opacity-100" : "opacity-50"
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1 w-12 justify-end">
                  <span className={`text-[8.5px] font-mono font-bold ${isActive ? "text-cyan-300" : "text-slate-400"}`}>
                    {cat.coverage}
                  </span>
                  {isActive && <div className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 text-[8px] font-mono text-slate-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Automated Kanban replenishment loop active</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-white/10 self-stretch shrink-0 hidden md:block" />

      {/* Right panel: Replenishment Log */}
      <div className="w-full md:w-[185px] shrink-0 flex flex-col justify-between">
        <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400 mb-2">Live Replenishment Feed</p>

        <div className="flex flex-col gap-1.5 flex-1">
          {REPLENISHMENT_LOGS.map((q, qi) => {
            const c = CATEGORY_COLORS[q.cat];
            const isLatest = qi === tick;

            return (
              <div
                key={qi}
                className={`rounded-xl border px-2.5 py-1.5 transition-all duration-300 ${
                  isLatest
                    ? "border-blue-500/40 bg-[#0E1726] shadow-sm opacity-100"
                    : "border-white/10 bg-[#0A101A] opacity-60"
                }`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-[6.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${c.badge}`}>
                    {q.cat}
                  </span>
                  <span className="text-[7px] font-mono text-slate-500 ml-auto">{q.t}</span>
                </div>
                <p className="text-[8px] text-slate-300 leading-tight font-mono truncate">{q.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Card 5 – Line Feeding Telemetry (Optimized)
   ───────────────────────────────────────────── */
export const Card5 = memo(function Card5() {
  const telemetry = [
    { name: "1VCON100", trips: 48, cycle: "24.2m", color: "bg-gradient-to-b from-cyan-400 to-blue-600", borderColor: "border-cyan-400", icon: Factory },
    { name: "1VCON200", trips: 36, cycle: "18.5m", color: "bg-gradient-to-b from-emerald-400 to-emerald-600", borderColor: "border-emerald-500", icon: Lightning },
    { name: "1VCON300", trips: 29, cycle: "21.0m", color: "bg-gradient-to-b from-amber-400 to-amber-600", borderColor: "border-amber-500", icon: Gauge },
    { name: "SUPERMARKET", trips: 113, cycle: "8.5m", color: "bg-gradient-to-b from-indigo-400 to-indigo-600", borderColor: "border-indigo-400", icon: Package },
  ];

  return (
    <div className="w-full h-full flex items-center justify-center p-1">
      <div className="grid grid-cols-2 gap-2 w-full">
        {telemetry.map((t, i) => (
          <div
            key={i}
            className="relative rounded-[14px] border border-white/10 bg-[#090F1A] shadow-md hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between p-2.5 group"
          >
            <div className="flex items-start justify-between">
              <div className={`w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-white ${t.color} border ${t.borderColor} shadow-md`}>
                <t.icon weight="fill" className="w-3.5 h-3.5" />
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[12px] font-mono font-bold text-white leading-none">{t.trips}</span>
                <span className="text-[6.5px] font-mono text-slate-400 uppercase tracking-widest leading-none">Trips</span>
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono font-bold text-white tracking-tight">{t.name}</span>
                <span className="text-[8px] font-mono text-cyan-400 font-bold">{t.cycle}</span>
              </div>
              <div className="w-full h-1.5 bg-[#060A12] border border-white/5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${(t.trips / 113) * 100}%` }}
                  className={`h-full rounded-full ${t.color}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Main Bento Grid Component
   ───────────────────────────────────────────── */
const CARDS = [
  {
    title: "Material Route Pipeline",
    description: "Visualise parts flow from Central Store through Kitting to Line POC Stations in real time.",
    visual: <Card1 />,
    colSpan: "lg:col-span-1",
    height: "h-[270px]",
  },
  {
    title: "Takt & Consumption Monitor",
    description: "Track hourly vehicle output against Takt Time (27.9s) and live parts feeding demands.",
    visual: <Card2 />,
    colSpan: "lg:col-span-1",
    height: "h-[270px]",
  },
  {
    title: "Milk-Run Dispatch Feed",
    description: "Real-time activity log of operators, tuggers, AGVs, and trip execution stages.",
    visual: <Card3 />,
    colSpan: "lg:col-span-1",
    height: "h-[270px]",
  },
  {
    title: "Predictive Stock & Buffer Coverage",
    description: "Station buffer health, safety coverage hours, and automated Kanban triggers.",
    visual: <Card4 />,
    colSpan: "lg:col-span-2",
    height: "h-[270px]",
  },
  {
    title: "Line Feeding Telemetry",
    description: "Telemetry across conveyor lines (1VCON100/200/300), Supermarket, and cycle times.",
    visual: <Card5 />,
    colSpan: "lg:col-span-1",
    height: "h-[270px]",
  }
];

export interface AgentBentoGridProps {
  className?: string;
}

export function AgentBentoGrid({ className }: AgentBentoGridProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-6xl mx-auto", className)}>
      {CARDS.map((card, idx) => (
        <FeatCard
          key={idx}
          title={card.title}
          description={card.description}
          className={cn(card.colSpan, card.height)}
        >
          {card.visual}
        </FeatCard>
      ))}
    </div>
  );
}

export default AgentBentoGrid;
