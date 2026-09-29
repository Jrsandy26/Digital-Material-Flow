import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface NavItem {
  label: string;
  href: string;
}

const defaultNavItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Live Monitor', href: '#bento-overview' },
  { label: 'Capabilities', href: '#features' },
  { label: 'Launch System', href: '#launch' },
];

interface GooeyNavbarProps {
  onItemClick?: (href: string) => void;
  items?: NavItem[];
}

export const GooeyNavbar: React.FC<GooeyNavbarProps> = ({ onItemClick, items = defaultNavItems }) => {
  const [active, setActive] = useState(items[0].label);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    e.preventDefault();
    setActive(item.label);
    if (onItemClick) {
      onItemClick(item.href);
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <div className="relative flex items-center bg-[#0d1522]/90 backdrop-blur-md border border-white/10 rounded-full p-2 shadow-2xl">
        
        {/* Layer for gooey filter so text is not affected */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none" 
          style={{ filter: 'url(#gooey)' }}
        >
          {items.map((item) => active === item.label && (
             <motion.div
               key="active-blob"
               layoutId="gooey-blob"
               className="absolute bg-cyan-500 rounded-full"
               initial={false}
               transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 1 }}
               style={{ 
                 width: 'var(--blob-width, 100%)', 
                 height: 'var(--blob-height, 100%)',
                 top: 'var(--blob-top, 0)',
                 left: 'var(--blob-left, 0)'
               }}
             />
          ))}
        </div>

        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(e) => handleClick(e, item)}
            className={`relative px-5 py-2 text-sm font-medium transition-colors duration-300 z-10 ${
              active === item.label ? 'text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {active === item.label && (
              <motion.div
                layoutId="gooey-nav"
                className="absolute inset-0 bg-blue-600/80 rounded-full z-[-1]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {item.label}
          </a>
        ))}
      </div>

      {/* SVG Gooey Filter */}
      <svg width="0" height="0" className="absolute hidden">
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>
    </div>
  );
};
