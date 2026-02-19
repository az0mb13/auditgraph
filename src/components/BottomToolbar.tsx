"use client";

import React from 'react';
import { ZoomIn, ZoomOut, Undo, Redo, LayoutGrid, ArrowRightLeft, ArrowUpDown, Maximize } from 'lucide-react';
import { useReactFlow, useStore as useRFStore } from 'reactflow';
import { useStore as useZustandStore } from 'zustand';
import { useAuditStore } from '@/store/useAuditStore';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';

export function BottomToolbar() {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const transform = useRFStore((s) => s.transform);
    const zoomLevel = Math.round(transform[2] * 100);

    const { layoutDirection, setLayoutDirection } = useAuditStore();

    // Access temporal store safely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const temporalStore = (useAuditStore as any).temporal;

    const { undo, redo, pastStates, futureStates } = useZustandStore(temporalStore, (state: any) => state) || {
        undo: () => { }, redo: () => { }, pastStates: [], futureStates: []
    };

    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    const toggleLayout = () => {
        setLayoutDirection(layoutDirection === 'LR' ? 'TB' : 'LR');
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 bg-card/80 backdrop-blur-md p-2 rounded-2xl border border-border shadow-lg z-10 px-4 items-center">
            <button
                onClick={() => zoomOut()}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoom Out"
            >
                <ZoomOut size={18} />
            </button>
            <div className="w-px bg-border h-6 mx-1" />
            <span className="text-xs text-muted-foreground font-mono w-12 text-center select-none">
                {zoomLevel}%
            </span>
            <div className="w-px bg-border h-6 mx-1" />
            <button
                onClick={() => zoomIn()}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoom In"
            >
                <ZoomIn size={18} />
            </button>
            <button
                onClick={() => fitView()}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                title="Fit View"
            >
                <Maximize size={18} />
            </button>

            <div className="w-px bg-border h-6 mx-2" />

            <button
                onClick={() => undo()}
                disabled={!canUndo}
                className={cn(
                    "p-2 rounded-lg transition-colors cursor-pointer",
                    canUndo ? "hover:bg-muted text-muted-foreground hover:text-foreground" : "opacity-50 cursor-not-allowed text-muted-foreground"
                )}
                title="Undo"
            >
                <Undo size={18} />
            </button>
            <button
                onClick={() => redo()}
                disabled={!canRedo}
                className={cn(
                    "p-2 rounded-lg transition-colors cursor-pointer",
                    canRedo ? "hover:bg-muted text-muted-foreground hover:text-foreground" : "opacity-50 cursor-not-allowed text-muted-foreground"
                )}
                title="Redo"
            >
                <Redo size={18} />
            </button>

            <div className="w-px bg-border h-6 mx-2" />

            <button
                onClick={toggleLayout}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer group relative"
                title={`Layout: ${layoutDirection === 'LR' ? 'Left-Right' : 'Top-Down'}`}
            >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card px-2 py-1 rounded-md border border-border text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Switch to {layoutDirection === 'LR' ? 'Top-Down' : 'Left-Right'}
                </div>
                {layoutDirection === 'LR' ? <ArrowRightLeft size={18} /> : <ArrowUpDown size={18} />}
            </button>
        </div>
    );
}
