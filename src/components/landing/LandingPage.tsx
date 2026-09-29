import React, { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import type { Variants } from "motion/react";
import Lenis from "lenis";
import {
  ArrowRight,
  Activity,
  BarChart3,
  Route as RouteIcon,
  Clock,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Cpu,
  ChevronRight,
  Radio,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import GooeyNav from "../ui/GooeyNav";
import { AgentBentoGrid } from "../../components/ui/agent-bento-grid";
import { SpotlightNavbar } from "../ui/spotlight-navbar";
import { PerspectiveGrid } from "../ui/perspective-grid";
import { TvsHorseLogo } from "../layout/TvsLogo";

interface LandingPageProps {
  onLaunch: () => void;
}

// Fade in and upward reveal variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (custom: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: custom * 0.1,
    },
  }),
};

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Parallax Scroll Hooks from Motion
  const { scrollY, scrollYProgress } = useScroll();
  const smoothScrollYProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Transform values for parallax effects
  const bgOrb1Y = useTransform(scrollY, [0, 1000], [0, 220]);
  const bgOrb2Y = useTransform(scrollY, [0, 1000], [0, -160]);
  const heroTextY = useTransform(scrollY, [0, 600], [0, 90]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.2]);
  const chipLeftY = useTransform(scrollY, [0, 800], [0, -80]);
  const chipRightY = useTransform(scrollY, [0, 800], [0, -120]);
  const bentoParallaxY = useTransform(scrollY, [200, 1200], [40, -40]);

  // Lenis Smooth Scroll Integration
  useEffect(() => {
    let lenis: Lenis | null = null;
    let rafId: number | null = null;

    try {
      lenis = new Lenis({
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1.1,
        touchMultiplier: 1.5,
      });

      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };

      rafId = requestAnimationFrame(raf);
    } catch (e) {
      console.warn("Smooth scroll initialization fallback", e);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, []);

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBento = () => {
    document.getElementById("bento-overview")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="landing-root min-h-screen bg-[#05070B] text-white selection:bg-[#4DA3FF] selection:text-white font-sans overflow-x-hidden relative"
    >
      {/* Parallax Background Glow / Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top Centered Cyan-Blue Beam */}
        <motion.div
          style={{ y: bgOrb1Y }}
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-[#4DA3FF]/20 via-[#38BDF8]/10 to-transparent rounded-full blur-[120px] opacity-80 transform-gpu"
        />
        {/* Deep Indigo/Purple Accent Orb */}
        <motion.div
          style={{ y: bgOrb2Y }}
          className="absolute top-[40%] right-[-10%] w-[600px] h-[500px] bg-[#8B7CFF]/15 rounded-full blur-[140px] transform-gpu"
        />
        {/* Emerald Glow for Live Telemetry Section */}
        <div className="absolute top-[75%] left-[-5%] w-[500px] h-[450px] bg-[#4DE4D0]/10 rounded-full blur-[130px] transform-gpu" />
        {/* Ambient Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
      </div>

      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0d1522]/90 backdrop-blur-md border border-white/10 rounded-full shadow-2xl">
        <GooeyNav 
          onItemClick={(href) => {
            if (href === "#launch") {
              onLaunch();
            } else if (href === "#bento-overview") {
              scrollToBento();
            } else if (href === "#features") {
              scrollToFeatures();
            } else if (href === "/") {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
      </div>

      {/* Hero Section with Parallax and Staggered Fade-in */}
      <section ref={heroRef} className="relative pt-32 pb-20 md:pt-44 md:pb-28 px-6 z-10 overflow-hidden">
        {/* Optimized 3D Perspective Grid Background for Hero Section */}
        <PerspectiveGrid className="absolute inset-0 z-0 opacity-80" gridSize={30} fadeRadius={70} />

        {/* Floating Parallax Telemetry Chips (Desktop only) */}
        <motion.div
          style={{ y: chipLeftY }}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="hidden xl:flex absolute top-48 left-10 p-3 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-2xl items-center gap-3 max-w-[210px]"
        >
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Line Telemetry</div>
            <div className="text-xs font-bold text-white font-mono">1VCON100: Active</div>
          </div>
        </motion.div>

        <motion.div
          style={{ y: chipRightY }}
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="hidden xl:flex absolute top-56 right-10 p-3 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-2xl items-center gap-3 max-w-[210px]"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Takt Balance</div>
            <div className="text-xs font-bold text-emerald-400 font-mono">27.9s · 100% Sync</div>
          </div>
        </motion.div>

        <motion.div style={{ y: heroTextY, opacity: heroOpacity }} className="max-w-5xl mx-auto text-center">
          {/* Main Title */}
          <motion.h1
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false }}
            custom={1}
            className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6 font-display"
          >
            Connected Flow <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4DA3FF] via-[#38BDF8] to-[#4DE4D0] drop-shadow-sm">
              Predictable Performance
            </span>
          </motion.h1>

          {/* Subtitle with guaranteed high contrast */}
          <motion.p
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false }}
            custom={2}
            className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-sans"
          >
            Real-time material line feeding, dynamic milk-run dispatching, standardized work (SWCT)
            synchronization, and predictive stock-out prevention for high-velocity assembly.
          </motion.p>

          {/* Call to Actions */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false }}
            custom={3}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <button
              onClick={onLaunch}
              className="px-8 py-3.5 bg-white text-[#05070B] font-bold text-sm rounded-xl hover:bg-slate-100 transition-all transform-gpu hover:scale-[1.03] active:scale-[0.98] shadow-xl shadow-white/10 flex items-center gap-2"
            >
              Enter Control Tower <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToBento}
              className="px-6 py-3.5 bg-slate-900/90 text-slate-100 font-semibold text-sm rounded-xl border border-white/15 hover:border-white/30 hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
            >
              Explore Live Telemetry <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </motion.div>

          {/* Quick Metrics Bar with Fade In & Glow */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false }}
            custom={4}
            className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto p-3 rounded-2xl bg-white/[0.04] border border-white/15 backdrop-blur-md shadow-2xl"
          >
            {[
              { label: "Target Takt Time", val: "27.9s", status: "Synchronized" },
              { label: "Safety Buffer", val: "4.8 hrs", status: "Zero Stockouts" },
              { label: "Line Conveyors", val: "1VCON 1-3", status: "Active Feed" },
              { label: "Milk-Run Operators", val: "12 Fleets", status: "100% On-Time" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-3 rounded-xl text-center bg-white/[0.02] border border-white/5">
                <span className="text-lg md:text-xl font-bold font-mono text-white tracking-tight">
                  {stat.val}
                </span>
                <span className="text-[11px] font-medium text-slate-300 mt-0.5">{stat.label}</span>
                <span className="text-[9px] font-mono text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {stat.status}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Dashboard Preview / Bento Grid Section with Scroll Reveal & Parallax */}
      <section
        id="bento-overview"
        className="py-20 md:py-28 px-4 sm:px-6 relative border-t border-white/10 bg-[#070A10]"
      >
        <motion.div style={{ y: bentoParallaxY }} className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <span className="px-3.5 py-1 text-[11px] font-mono font-semibold tracking-wider text-cyan-300 bg-cyan-950/60 rounded-full border border-cyan-800/60 uppercase shadow-sm">
              Interactive Control Room Preview
            </span>

            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white mt-4 mb-3 font-display">
              Command and Orchestrate{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4DA3FF] via-[#38BDF8] to-[#4DE4D0]">
                Every Route
              </span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
              Live operational view into material routes, operator trips, predictive buffers, and
              production line synchronizations.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <AgentBentoGrid />
          </motion.div>
        </motion.div>
      </section>

      {/* Standardized Work & SWCT Section with Scroll Reveal */}
      <section className="py-20 md:py-28 px-6 relative border-t border-white/10 bg-[#05070B]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-60px" }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[#8B7CFF] text-xs font-mono font-bold tracking-widest uppercase mb-3 block">
              Standardized Work Combination Table
            </span>

            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 font-display">
              Time every movement.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B7CFF] via-[#A599FF] to-[#38BDF8]">
                Eliminate waste.
              </span>
            </h2>

            <p className="text-slate-300 text-sm sm:text-base mb-8 leading-relaxed">
              The Standardized Work Combination Table (SWCT) integrates manual loading work, walking
              time, and machine index cycle times. Mathematically balance operator routes to ensure
              zero starvation.
            </p>

            <div className="space-y-3.5">
              {[
                {
                  title: "Takt Time Synchronization",
                  desc: "Keeps material feeding perfectly pacing the 27.9s line takt without excess buffer.",
                },
                {
                  title: "Walking Distance Optimization",
                  desc: "Minimizes unnecessary steps through optimized store-to-point-of-consumption paths.",
                },
                {
                  title: "Operator Workload Balancing",
                  desc: "Distributes line feeding weight evenly across Jumbo tuggers and manual trolleys.",
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#8B7CFF]/20 border border-[#8B7CFF]/40 flex items-center justify-center shrink-0 text-[#8B7CFF] mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white font-display">{item.title}</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <SWCTMockup />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#8B7CFF]/15 blur-[90px] rounded-full -z-10 pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* Core Capabilities Feature Grid with Scroll Reveal */}
      <section
        id="features"
        className="py-20 md:py-28 px-6 relative border-t border-white/10 bg-[#070A10]"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 font-display">
              Engineered for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4DA3FF] via-[#38BDF8] to-[#4DE4D0]">
                Two-Wheeler Assembly Lines
              </span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
              Complete, end-to-end line feeding logistics crafted specifically for automotive
              manufacturing.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={Activity}
              title="Real-Time Trip Execution"
              description="Monitor active tugger routes, lag timestamps, and point-of-consumption delivery confirmations."
              color="#4DE4D0"
              delay={0.05}
            />
            <FeatureCard
              icon={RouteIcon}
              title="Dynamic Route Master"
              description="Configure Milk-Run, Jumbo Trolley, and Direct delivery routes with auto-calculated travel times."
              color="#4DA3FF"
              delay={0.1}
            />
            <FeatureCard
              icon={BarChart3}
              title="Shift Handover Reports"
              description="Export shift-end PDF and Excel manifests with completed trips, pending kanban, and carryover notes."
              color="#FFB84D"
              delay={0.15}
            />
            <FeatureCard
              icon={Clock}
              title="Predictive Buffer Alerts"
              description="Algorithms forecast line starvation in advance based on live stroke rates and minimum coverage."
              color="#FF5C67"
              delay={0.2}
            />
            <FeatureCard
              icon={Zap}
              title="Carryover Optimization"
              description="Calculates optimal start-of-shift buffer levels to prevent morning line starvation seamlessly."
              color="#8B7CFF"
              delay={0.25}
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Zero Stoppage Assurance"
              description="Every module is calibrated to guarantee continuous assembly throughput and zero idle time."
              color="#4DE4D0"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner with Scroll Reveal */}
      <section className="py-20 px-6 border-t border-white/10 bg-gradient-to-b from-[#05070B] via-[#0A111F] to-[#05070B] relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono font-medium text-cyan-300 bg-cyan-950/60 rounded-full border border-cyan-800/60 mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ready for Instant Deployment</span>
          </div>

          <h3 className="text-2xl md:text-4xl font-extrabold text-white mb-4 font-display">
            Ready to Streamline Your Assembly Flow?
          </h3>
          <p className="text-slate-300 text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
            Access live production planning, part master tables, trip scheduling, and real-time
            operator manifests now.
          </p>
          <button
            onClick={onLaunch}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm md:text-base rounded-xl shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all transform-gpu hover:scale-105 active:scale-95 inline-flex items-center gap-2"
          >
            Launch Digital Material Flow System
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </section>

            {/* Footer */}
      <footer className="py-8 border-t border-white/10 text-center text-slate-400 text-xs bg-[#05070B]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2.5 font-bold text-sm text-slate-200">
            <TvsHorseLogo className="h-5 w-auto" />
            <span className="text-red-500 font-display text-base">TVS</span>
            <span className="font-display tracking-wider">MOTOR COMPANY</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs font-normal text-slate-400">Hosur Facility 1</span>
          </div>
          <p className="font-mono text-xs text-slate-400">
            DMF Control Tower &copy; {new Date().getFullYear()} · High Velocity Assembly
          </p>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
  delay,
}: {
  icon: any;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all transform-gpu duration-200 flex flex-col justify-between group shadow-lg"
    >
      <div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-200 shadow-md"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold mb-2 text-white group-hover:text-cyan-300 transition-colors font-display">
          {title}
        </h3>
        <p className="text-slate-300 text-xs leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function SWCTMockup() {
  const steps = [
    { label: "MANUAL WORK", time: "12s", color: "#4DA3FF", width: 40 },
    { label: "WALKING ROUTE", time: "18s", color: "#4DE4D0", width: 60 },
    { label: "MACHINE TIME", time: "5s", color: "#8B7CFF", width: 20 },
    { label: "BUFFER WAIT", time: "10s", color: "#FFB84D", width: 30 },
  ];

  return (
    <div className="rounded-2xl border border-white/15 bg-[#090E17] p-6 md:p-7 shadow-2xl backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <span className="text-[11px] font-mono font-bold tracking-widest text-slate-300 block">
            SWCT STANDARD CYCLE
          </span>
          <span className="text-xs text-slate-400">Operator 1VCON-MR01</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-[#8B7CFF]/20 border border-[#8B7CFF]/40 text-xs font-mono font-bold text-[#A599FF]">
          TAKT: 27.9s
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[105px_1fr_40px] md:grid-cols-[115px_1fr_40px] items-center gap-3"
          >
            <div className="text-[11px] font-mono text-slate-200 font-medium">{step.label}</div>
            <div className="h-6 overflow-hidden rounded-md bg-[#05070B] border border-white/10 relative">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${step.width}%` }}
                viewport={{ once: false }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: "easeOut" }}
                style={{ backgroundColor: step.color }}
                className="absolute top-0 left-0 h-full opacity-90 rounded-md"
              />
            </div>
            <div className="text-right text-xs font-mono font-bold text-white">{step.time}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-300">
        <span>Cycle Sum: 45.0s</span>
        <span className="text-emerald-400 font-bold">100% Balanced</span>
      </div>
    </div>
  );
}

export default LandingPage;
