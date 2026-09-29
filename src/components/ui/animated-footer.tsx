"use client";

import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export interface AnimatedFooterProps {
  /** The large display words along the bottom edge. Defaults to ["TVS", "MOTOR"]. */
  headingLines?: string[];
  /** Left image URL, sampled into ASCII art. */
  leftImage?: string;
  /** Right image URL, sampled into ASCII art. */
  rightImage?: string;

  /** Footer background color. Defaults to "#05070B". */
  background?: string;
  /** Text color for links, copy and headings. Defaults to "#38BDF8". */
  textColor?: string;

  /** Character ramp, ordered dark → light, used to render the ASCII art. */
  asciiChars?: string;
  /** Color of the ASCII glyphs. Defaults to "#0284c7". */
  charColor?: string;
  /** Fill color of a highlighted (hovered) cell. Defaults to "#38bdf8". */
  hoverColor?: string;
  /** Glyph color inside a highlighted cell. Defaults to "#05070b". */
  hoverCharColor?: string;
  /** Number of columns each image is sampled to. Defaults to 80. */
  columns?: number;
  /** Pixel size of each ASCII cell. Defaults to 18. */
  cellSize?: number;
  /** Font size (px) of the ASCII glyphs. Defaults to 16. */
  fontSize?: number;

  /** Pointer parallax strength in px; set to 0 to disable. Defaults to 25. */
  parallaxStrength?: number;
  /** Cursor influence radius, in cells, for the hover highlight. Defaults to 10. */
  hoverRadius?: number;

  /** Play the reveal when the footer scrolls into view. Defaults to true. */
  revealOnScroll?: boolean;
  /** Controlled reveal. */
  revealed?: boolean;

  /** Extra class names for the root element. */
  className?: string;
}

const DEFAULT_ASCII_CHARS = "........:::=+xX#0369";

const HIGHLIGHT_LIFETIME = 350; // ms a hovered cell stays lit
const CLUSTER_SIZE = 12; // max cells a hover ripple spreads across
const PARALLAX_EASE = 0.08;

// Procedural Dark-Mode High-Contrast Mechanical Arm SVG Data URIs
const DEFAULT_LEFT_HAND_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350" fill="none">
  <rect width="500" height="350" fill="#FFFFFF"/>
  <path d="M-50 350 L120 220 L180 200 L240 180 L290 150 L340 110 L330 90 L260 140 L210 165 L150 185 L80 215 L-50 280 Z" fill="#000000"/>
  <path d="M290 150 L380 100 L430 75 L450 70 L445 85 L415 100 L355 130 L290 165 Z" fill="#111111"/>
  <path d="M280 165 L390 120 L455 90 L475 82 L470 98 L440 115 L370 150 L280 180 Z" fill="#000000"/>
  <path d="M270 180 L375 140 L440 115 L455 110 L450 125 L420 140 L350 170 L270 195 Z" fill="#222222"/>
  <path d="M255 195 L345 165 L405 142 L420 138 L415 150 L385 165 L330 190 L255 210 Z" fill="#111111"/>
  <path d="M210 165 L260 110 L300 70 L315 55 L325 68 L290 95 L245 140 L210 170 Z" fill="#000000"/>
  <circle cx="210" cy="180" r="28" fill="#000000"/>
  <circle cx="280" cy="165" r="22" fill="#000000"/>
  <circle cx="260" cy="120" r="16" fill="#000000"/>
</svg>
`)}`;

const DEFAULT_RIGHT_HAND_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350" fill="none">
  <rect width="500" height="350" fill="#FFFFFF"/>
  <path d="M550 350 L380 220 L320 200 L260 180 L210 150 L160 110 L170 90 L240 140 L290 165 L350 185 L420 215 L550 280 Z" fill="#000000"/>
  <path d="M210 150 L120 100 L70 75 L50 70 L55 85 L85 100 L145 130 L210 165 Z" fill="#111111"/>
  <path d="M220 165 L110 120 L45 90 L25 82 L30 98 L60 115 L130 150 L220 180 Z" fill="#000000"/>
  <path d="M230 180 L125 140 L60 115 L45 110 L50 125 L80 140 L150 170 L230 195 Z" fill="#222222"/>
  <path d="M245 195 L155 165 L95 142 L80 138 L85 150 L115 165 L170 190 L245 210 Z" fill="#111111"/>
  <path d="M290 165 L240 110 L200 70 L185 55 L175 68 L210 95 L255 140 L290 170 Z" fill="#000000"/>
  <circle cx="290" cy="180" r="28" fill="#000000"/>
  <circle cx="220" cy="165" r="22" fill="#000000"/>
  <circle cx="240" cy="120" r="16" fill="#000000"/>
</svg>
`)}`;

interface Cell {
  col: number;
  row: number;
  char: string;
  highlightEndTime: number;
}

interface Hand {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cells: Map<string, Cell>;
  cellList: Cell[];
  rows: number;
  columns: number;
  cellSize: number;
  baselineOffset: number;
  direction: 1 | -1;
}

/** Build procedural fallback cells for TVS Mechanical Arms if sampling fails */
function buildProceduralHandCells(
  columns: number,
  asciiChars: string,
  direction: 1 | -1
): { rows: number; cells: Map<string, Cell> } {
  const rows = Math.round(columns * 0.65);
  const cells = new Map<string, Cell>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const nx = c / columns;
      const ny = r / rows;

      const armX = direction === 1 ? nx : (1 - nx);
      const isArm = armX < 0.62 && Math.abs(ny - (0.35 + armX * 0.45)) < 0.16;
      const isJoint = Math.hypot(armX - 0.58, ny - 0.58) < 0.2;
      const isF1 = armX >= 0.58 && armX < 0.92 && Math.abs(ny - (0.58 - (armX - 0.58) * 0.45)) < 0.04;
      const isF2 = armX >= 0.58 && armX < 0.95 && Math.abs(ny - (0.58 - (armX - 0.58) * 0.18)) < 0.04;
      const isF3 = armX >= 0.58 && armX < 0.88 && Math.abs(ny - (0.58 + (armX - 0.58) * 0.12)) < 0.04;
      const isF4 = armX >= 0.58 && armX < 0.80 && Math.abs(ny - (0.58 + (armX - 0.58) * 0.38)) < 0.04;

      if (isArm || isJoint || isF1 || isF2 || isF3 || isF4) {
        const charIdx = Math.floor(Math.random() * (asciiChars.length - 8)) + 8;
        cells.set(`${c},${r}`, {
          col: c,
          row: r,
          char: asciiChars[charIdx] || "#",
          highlightEndTime: 0,
        });
      }
    }
  }

  return { rows, cells };
}

/** Build the ASCII cell grid for one image by sampling its brightness. */
function buildHandCells(
  image: HTMLImageElement,
  columns: number,
  asciiChars: string,
  direction: 1 | -1
): { rows: number; cells: Map<string, Cell> } {
  const rows = Math.max(
    1,
    Math.round(columns / (image.naturalWidth / image.naturalHeight || 1.4)),
  );

  const sampler = document.createElement("canvas");
  sampler.width = columns;
  sampler.height = rows;
  const sampleCtx = sampler.getContext("2d");
  const cells = new Map<string, Cell>();
  if (!sampleCtx) return buildProceduralHandCells(columns, asciiChars, direction);

  sampleCtx.drawImage(image, 0, 0, columns, rows);
  const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
  const backgroundCharIndex = asciiChars.lastIndexOf(".");

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const offset = (row * columns + col) * 4;
      const brightness =
        (pixels[offset] * 0.299 +
          pixels[offset + 1] * 0.587 +
          pixels[offset + 2] * 0.114) /
        255;
      const charIndex = Math.min(
        asciiChars.length - 1,
        Math.floor((1 - brightness) * asciiChars.length),
      );
      if (charIndex <= backgroundCharIndex) continue;

      cells.set(`${col},${row}`, {
        col,
        row,
        char: asciiChars[charIndex],
        highlightEndTime: 0,
      });
    }
  }

  if (cells.size === 0) {
    return buildProceduralHandCells(columns, asciiChars, direction);
  }

  return { rows, cells };
}

/** Light up a wandering cluster of cells starting from `startCell`. */
function highlightCluster(cells: Map<string, Cell>, startCell: Cell) {
  const now = Date.now();
  startCell.highlightEndTime = now + HIGHLIGHT_LIFETIME;

  const steps = Math.floor(Math.random() * CLUSTER_SIZE) + 1;
  const litCells = [startCell];
  let current = startCell;

  for (let step = 0; step < steps; step++) {
    const neighbours: Cell[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbour = cells.get(`${current.col + dx},${current.row + dy}`);
        if (neighbour && !litCells.includes(neighbour)) neighbours.push(neighbour);
      }
    }
    if (neighbours.length === 0) break;

    const next = neighbours[Math.floor(Math.random() * neighbours.length)];
    next.highlightEndTime = now + HIGHLIGHT_LIFETIME + step * 10;
    litCells.push(next);
    current = next;
  }
}

export function AnimatedFooter({
  headingLines = ["TVS", "MOTOR"],
  leftImage = DEFAULT_LEFT_HAND_SVG,
  rightImage = DEFAULT_RIGHT_HAND_SVG,
  background = "#05070B",
  textColor = "#38BDF8",
  charColor = "#0284c7",
  hoverColor = "#38bdf8",
  hoverCharColor = "#05070b",
  asciiChars = DEFAULT_ASCII_CHARS,
  columns = 75,
  cellSize = 18,
  fontSize = 16,
  parallaxStrength = 25,
  hoverRadius = 10,
  revealOnScroll = true,
  revealed,
  className,
}: AnimatedFooterProps) {
  const rootRef = useRef<HTMLElement>(null);
  const leftWrapRef = useRef<HTMLDivElement>(null);
  const rightWrapRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  const animateInRef = useRef<() => void>(() => {});
  const animateOutRef = useRef<() => void>(() => {});

  const liveRef = useRef({
    charColor,
    hoverColor,
    hoverCharColor,
    parallaxStrength,
    hoverRadius,
  });

  useEffect(() => {
    liveRef.current = {
      charColor,
      hoverColor,
      hoverCharColor,
      parallaxStrength,
      hoverRadius,
    };
  }, [charColor, hoverColor, hoverCharColor, parallaxStrength, hoverRadius]);

  const sig = useMemo(
    () =>
      JSON.stringify({
        leftImage,
        rightImage,
        columns,
        cellSize,
        fontSize,
        asciiChars,
        revealOnScroll,
        headingLines,
      }),
    [leftImage, rightImage, columns, cellSize, fontSize, asciiChars, revealOnScroll, headingLines],
  );

  useEffect(() => {
    const root = rootRef.current;
    const leftWrap = leftWrapRef.current;
    const rightWrap = rightWrapRef.current;
    if (!root || !leftWrap || !rightWrap) return;

    const hands: Hand[] = [];
    const wrappers = [leftWrap, rightWrap];

    const setupHand = (
      image: HTMLImageElement,
      canvas: HTMLCanvasElement,
      direction: 1 | -1,
    ) => {
      const { rows, cells } = buildHandCells(image, columns, asciiChars, direction);
      if (cells.size === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = columns * cellSize * dpr;
      canvas.height = rows * cellSize * dpr;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      const metrics = ctx.measureText("X");
      const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const baselineOffset = cellSize / 2 + glyphHeight / 2 - metrics.actualBoundingBoxDescent;

      hands.push({
        canvas,
        ctx,
        cells,
        cellList: [...cells.values()],
        rows,
        columns,
        cellSize,
        baselineOffset,
        direction,
      });
    };

    const loadHand = (src: string, canvas: HTMLCanvasElement, direction: 1 | -1) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      let initialized = false;

      const init = () => {
        if (initialized) return;
        initialized = true;
        setupHand(image, canvas, direction);
      };

      image.onload = init;
      image.onerror = () => {
        // Fallback SVG if image loading encounters cross-origin or 404
        const fallback = direction === 1 ? DEFAULT_LEFT_HAND_SVG : DEFAULT_RIGHT_HAND_SVG;
        const fallbackImg = new Image();
        fallbackImg.onload = () => setupHand(fallbackImg, canvas, direction);
        fallbackImg.src = fallback;
      };

      image.src = src || (direction === 1 ? DEFAULT_LEFT_HAND_SVG : DEFAULT_RIGHT_HAND_SVG);
      if (image.complete && image.naturalWidth) init();
    };

    if (leftCanvasRef.current) loadHand(leftImage, leftCanvasRef.current, 1);
    if (rightCanvasRef.current) loadHand(rightImage, rightCanvasRef.current, -1);

    const renderHand = (hand: Hand, now: number) => {
      const { ctx, cellList, cellSize: cs, baselineOffset, columns: cols, rows } = hand;
      const { charColor: cc, hoverColor: hc, hoverCharColor: hcc } = liveRef.current;
      ctx.clearRect(0, 0, cols * cs, rows * cs);

      for (const cell of cellList) {
        const x = cell.col * cs;
        const y = cell.row * cs;
        const isHighlighted = cell.highlightEndTime > now;

        if (isHighlighted) {
          ctx.fillStyle = hc;
          ctx.fillRect(x, y, cs, cs);
        }
        ctx.fillStyle = isHighlighted ? hcc : cc;
        ctx.fillText(cell.char, x + cs / 2, y + baselineOffset);
      }
    };

    const pointer = { x: 0, y: 0 };
    const drift = { x: 0, y: 0 };
    const curtain = { offset: revealOnScroll ? 125 : 0 };

    const hoverHand = (hand: Hand, clientX: number, clientY: number) => {
      const rect = hand.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const mouseCol = ((clientX - rect.left) / rect.width) * hand.columns;
      const mouseRow = ((clientY - rect.top) / rect.height) * hand.rows;

      let closest: Cell | null = null;
      let closestDist = Infinity;
      for (const cell of hand.cellList) {
        const dx = mouseCol - cell.col;
        const dy = mouseRow - cell.row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = cell;
        }
      }
      if (closest && closestDist <= liveRef.current.hoverRadius) {
        highlightCluster(hand.cells, closest);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      const strength = liveRef.current.parallaxStrength;
      const rect = root.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      pointer.x = ((event.clientX - rect.left) / w - 0.5) * strength * 2;
      pointer.y = ((event.clientY - rect.top) / h - 0.5) * strength * 2;
      for (const hand of hands) hoverHand(hand, event.clientX, event.clientY);
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    let rafId = 0;
    const frame = () => {
      const now = Date.now();

      // Ambient live idle sparkle
      if (Math.random() < 0.2) {
        for (const hand of hands) {
          if (hand.cellList.length > 0) {
            const rc = hand.cellList[Math.floor(Math.random() * hand.cellList.length)];
            if (rc && rc.highlightEndTime < now) {
              rc.highlightEndTime = now + 160;
            }
          }
        }
      }

      for (const hand of hands) renderHand(hand, now);

      drift.x += (pointer.x - drift.x) * PARALLAX_EASE;
      drift.y += (pointer.y - drift.y) * PARALLAX_EASE;
      const strength = liveRef.current.parallaxStrength;
      const scale = 1 + (strength * 2) / 200;

      wrappers.forEach((wrapper, i) => {
        const dir = i === 0 ? 1 : -1;
        const revealX = i === 0 ? -curtain.offset : curtain.offset;
        const x = drift.x * dir || 0;
        const y = -drift.y || 0;
        wrapper.style.transform = `translateX(${revealX}%) translate(${x}px, ${y}px) scale(${scale})`;
      });

      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    // ── Reveal Animations ─────────────────────────
    const chars = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-af-char]"));

    const animateIn = () => {
      gsap.to(curtain, { offset: 0, duration: 0.9, ease: "power3.out", overwrite: true });
      gsap.to(chars, {
        yPercent: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: { each: 0.03, from: "center" },
        overwrite: true,
      });
    };

    const animateOut = () => {
      gsap.to(curtain, { offset: 125, duration: 0.4, ease: "power2.in", overwrite: true });
      gsap.to(chars, {
        yPercent: 125,
        duration: 0.4,
        ease: "power2.in",
        stagger: { each: 0.01, from: "center" },
        overwrite: true,
      });
    };

    animateInRef.current = animateIn;
    animateOutRef.current = animateOut;

    const maskAll = () => {
      gsap.set(chars, { yPercent: 125 });
    };
    const showAll = () => {
      gsap.set(chars, { yPercent: 0 });
    };

    let observer: IntersectionObserver | null = null;

    if (revealed !== undefined) {
      curtain.offset = revealed ? 0 : 125;
      if (revealed) showAll();
      else maskAll();
    } else if (revealOnScroll) {
      maskAll();

      let isRevealed = false;
      const checkViewAndTrigger = () => {
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (inView && !isRevealed) {
          isRevealed = true;
          animateIn();
        } else if (!inView && isRevealed) {
          isRevealed = false;
          animateOut();
        }
      };

      try {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting && !isRevealed) {
                isRevealed = true;
                animateIn();
              } else if (!entry.isIntersecting && isRevealed) {
                isRevealed = false;
                animateOut();
              }
            }
          },
          { root: null, threshold: 0.05 },
        );
        observer.observe(root);
      } catch (e) {
        console.warn("IntersectionObserver init error:", e);
      }

      // Check on mount and scroll
      checkViewAndTrigger();
      window.addEventListener("scroll", checkViewAndTrigger, { passive: true });

      // Clean listener
      const cleanupCheck = () => window.removeEventListener("scroll", checkViewAndTrigger);
      (root as any)._cleanupCheck = cleanupCheck;
    } else {
      showAll();
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      if ((root as any)._cleanupCheck) (root as any)._cleanupCheck();
      observer?.disconnect();
      gsap.killTweensOf([curtain, ...chars]);
    };
  }, [sig]);

  useEffect(() => {
    if (revealed === undefined) return;
    if (revealed) animateInRef.current();
    else animateOutRef.current();
  }, [revealed]);

  const startsHidden = revealed !== undefined ? !revealed : revealOnScroll;
  const offEdge = startsHidden ? 125 : 0;

  return (
    <footer
      ref={rootRef}
      className={cn(
        "relative h-full w-full overflow-hidden select-none",
        className
      )}
      style={{ backgroundColor: background, color: textColor, containerType: "inline-size" }}
    >
      {/* ASCII hands */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between z-0 overflow-hidden">
        <div
          ref={leftWrapRef}
          className="relative w-1/2 md:w-2/5 min-w-[220px] will-change-transform"
          style={{ transform: `translateX(-${offEdge}%)` }}
        >
          <canvas ref={leftCanvasRef} className="block h-auto w-full" />
        </div>
        <div
          ref={rightWrapRef}
          className="relative w-1/2 md:w-2/5 min-w-[220px] will-change-transform"
          style={{ transform: `translateX(${offEdge}%)` }}
        >
          <canvas ref={rightCanvasRef} className="block h-auto w-full" />
        </div>
      </div>

      {/* Display headings */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 md:gap-6 p-4 md:p-8 z-10 pointer-events-none">
        {headingLines.map((word, wi) => (
          <h2
            key={`${word}-${wi}`}
            aria-label={word}
            className="overflow-hidden font-extrabold leading-none tracking-tight pb-[0.1em] -mb-[0.1em] select-none text-cyan-400 drop-shadow-[0_0_25px_rgba(56,189,248,0.35)]"
            style={{ fontSize: "clamp(3rem, 14cqw, 12rem)" }}
          >
            {Array.from(word).map((ch, ci) => (
              <span
                key={ci}
                data-af-char
                aria-hidden="true"
                className="inline-block transform-gpu"
              >
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h2>
        ))}
      </div>
    </footer>
  );
}

export default AnimatedFooter;
