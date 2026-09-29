import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import './GooeyNav.css';

interface NavItem {
  label: string;
  href: string;
}

interface GooeyNavProps {
  items?: NavItem[];
  animationTime?: number;
  particleCount?: number;
  particleDistances?: [number, number];
  particleR?: number;
  timeVariance?: number;
  colors?: string[];
  initialActiveIndex?: number;
  onItemClick?: (href: string) => void;
}

const defaultItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Live Monitor', href: '#bento-overview' },
  { label: 'Capabilities', href: '#features' },
  { label: 'Launch System', href: '#launch' },
];

const GooeyNav: React.FC<GooeyNavProps> = ({
  items = defaultItems,
  animationTime = 500,
  particleCount = 12,
  particleDistances = [70, 10],
  particleR = 80,
  timeVariance = 200,
  colors = ['#38bdf8', '#818cf8', '#c084fc', '#34d399'],
  initialActiveIndex = 0,
  onItemClick
}) => {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const particleContainerRef = useRef<HTMLDivElement>(null);

  const noise = (n = 1) => n / 2 - Math.random() * n;

  const getXY = (distance: number, pointIndex: number, totalPoints: number) => {
    const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
    return [distance * Math.cos(angle), distance * Math.sin(angle)];
  };

  const createParticle = (i: number, t: number, d: [number, number], r: number) => {
    const rotate = noise(r / 10);
    return {
      start: getXY(d[0], particleCount - i, particleCount),
      end: getXY(d[1] + noise(7), particleCount - i, particleCount),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10
    };
  };

  const triggerParticleBurst = (targetEl: HTMLElement) => {
    if (!particleContainerRef.current) return;
    const container = particleContainerRef.current;
    const rect = targetEl.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2 - parentRect.left;
    const centerY = rect.top + rect.height / 2 - parentRect.top;

    const d = particleDistances;
    const r = particleR;

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime + noise(timeVariance);
      const p = createParticle(i, t, d, r);

      const particle = document.createElement('span');
      particle.className = 'gooey-particle';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      particle.style.setProperty('--start-x', `${p.start[0]}px`);
      particle.style.setProperty('--start-y', `${p.start[1]}px`);
      particle.style.setProperty('--end-x', `${p.end[0]}px`);
      particle.style.setProperty('--end-y', `${p.end[1]}px`);
      particle.style.setProperty('--time', `${p.time}ms`);
      particle.style.setProperty('--scale', `${p.scale}`);
      particle.style.setProperty('--color', p.color);
      particle.style.setProperty('--rotate', `${p.rotate}deg`);

      container.appendChild(particle);

      setTimeout(() => {
        if (container.contains(particle)) {
          container.removeChild(particle);
        }
      }, t + 50);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, index: number, item: NavItem) => {
    e.preventDefault();
    const targetEl = e.currentTarget;

    if (onItemClick) {
      onItemClick(item.href);
    }

    if (activeIndex !== index) {
      setActiveIndex(index);
      triggerParticleBurst(targetEl);
    }
  };

  return (
    <div className="relative flex items-center select-none font-sans">
      {/* Particle Burst Container */}
      <div 
        ref={particleContainerRef} 
        className="absolute inset-0 pointer-events-none overflow-visible z-20" 
      />

      {/* Main Nav Bar */}
      <nav className="relative z-10">
        <ul className="flex items-center gap-1 sm:gap-2 p-1 m-0 list-none">
          {items.map((item, index) => {
            const isActive = activeIndex === index;
            return (
              <li key={item.label} className="relative">
                <a
                  href={item.href}
                  onClick={(e) => handleClick(e, index, item)}
                  className={`relative px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full transition-colors duration-200 flex items-center justify-center cursor-pointer outline-none ${
                    isActive
                      ? 'text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-gooey-nav-pill"
                      className="absolute inset-0 bg-white rounded-full z-[-1] shadow-md shadow-black/20"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                        mass: 0.8
                      }}
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap tracking-tight">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default GooeyNav;

