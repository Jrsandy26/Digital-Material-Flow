"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

interface PerspectiveGridProps {
    /** Additional CSS classes for the grid container */
    className?: string;
    /** Number of tiles per row/column (default: 30) */
    gridSize?: number;
    /** Whether to show the gradient overlay (default: true) */
    showOverlay?: boolean;
    /** Fade radius percentage for the gradient overlay (default: 80) */
    fadeRadius?: number;
}

export function PerspectiveGrid({
    className,
    gridSize = 30,
    showOverlay = true,
    fadeRadius = 75,
}: PerspectiveGridProps) {
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: 50, y: 40, rotX: 35, rotY: -5, active: false });

    useEffect(() => {
        setMounted(true);

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            
            // Check if mouse is near or inside the hero bounds
            const isInside =
                e.clientX >= rect.left - 200 &&
                e.clientX <= rect.right + 200 &&
                e.clientY >= rect.top - 200 &&
                e.clientY <= rect.bottom + 200;

            if (isInside) {
                const relativeX = e.clientX - rect.left;
                const relativeY = e.clientY - rect.top;
                const pctX = (relativeX / rect.width) * 100;
                const pctY = (relativeY / rect.height) * 100;

                // Calculate subtle 3D tilt angles based on cursor offset from center
                const normX = (relativeX / rect.width) - 0.5; // -0.5 to 0.5
                const normY = (relativeY / rect.height) - 0.5;

                const rotX = 35 - normY * 16; // Pitch tilt
                const rotY = -5 + normX * 18; // Yaw tilt

                setMousePos({
                    x: Math.round(pctX * 10) / 10,
                    y: Math.round(pctY * 10) / 10,
                    rotX: Math.round(rotX * 10) / 10,
                    rotY: Math.round(rotY * 10) / 10,
                    active: true,
                });
            } else {
                setMousePos((prev) => ({ ...prev, active: false, rotX: 35, rotY: -5 }));
            }
        };

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Memoize tiles array for optional tile DOM rendering or CSS grid
    const tiles = useMemo(() => Array.from({ length: Math.min(gridSize * gridSize, 900) }), [gridSize]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative w-full h-full overflow-hidden bg-transparent select-none pointer-events-auto",
                "[--fade-stop:#05070B]",
                className
            )}
            style={{
                perspective: "1600px",
                transformStyle: "preserve-3d",
            }}
        >
            {/* Dynamic Cursor Matrix Spotlight Glow Layer */}
            <div
                className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-500"
                style={{
                    opacity: mousePos.active ? 1 : 0.4,
                    background: `radial-gradient(circle 420px at ${mousePos.x}% ${mousePos.y}%, rgba(56, 189, 248, 0.35) 0%, rgba(77, 163, 255, 0.18) 45%, transparent 80%)`,
                }}
            />

            {/* GPU-Accelerated 3D Perspective Grid Matrix */}
            <div
                className="absolute w-[85rem] aspect-square grid origin-center transform-gpu opacity-80 transition-transform duration-200 ease-out"
                style={{
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) rotateX(${mousePos.rotX}deg) rotateY(${mousePos.rotY}deg) rotateZ(18deg) scale(2)`,
                    transformStyle: "preserve-3d",
                    gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                    gridTemplateRows: `repeat(${gridSize}, 1fr)`,
                }}
            >
                {/* Tiles rendered efficiently */}
                {mounted &&
                    tiles.map((_, i) => (
                        <div
                            key={i}
                            className="tile min-h-[1px] min-w-[1px] border border-cyan-500/20 dark:border-cyan-400/25 bg-transparent transition-all duration-700 ease-out hover:duration-0 hover:border-cyan-300 hover:bg-cyan-400/30 hover:shadow-[0_0_18px_rgba(56,189,248,0.8)] hover:scale-105 pointer-events-auto cursor-pointer"
                        />
                    ))}
            </div>

            {/* Radial Gradient Mask Overlay for seamless blending with hero text */}
            {showOverlay && (
                <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                        background: mousePos.active
                            ? `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, transparent 15%, var(--fade-stop) ${fadeRadius}%)`
                            : `radial-gradient(circle at 50% 40%, transparent 20%, var(--fade-stop) ${fadeRadius}%)`,
                        transition: "background 0.3s ease-out",
                    }}
                />
            )}
        </div>
    );
}

export default PerspectiveGrid;
