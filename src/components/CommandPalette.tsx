"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Code2, ArrowRight } from 'lucide-react';
import { useReactFlow } from 'reactflow';
import { useAuditStore } from '@/store/useAuditStore';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const nodes = useAuditStore((s) => s.nodes);
    const reactFlowInstance = useReactFlow();

    const functionNodes = useMemo(() => {
        return nodes.filter(n => n.type === 'function' || n.type === 'default');
    }, [nodes]);

    const results = useMemo(() => {
        if (!query.trim()) return functionNodes.slice(0, 20);
        const q = query.toLowerCase();
        return functionNodes
            .filter(n => {
                const label = (n.data.label as string || '').toLowerCase();
                return label.includes(q);
            })
            .slice(0, 20);
    }, [query, functionNodes]);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Keep selected index in bounds
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.children[selectedIndex] as HTMLElement;
            selected?.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const handleSelect = useCallback((nodeId: string) => {
        reactFlowInstance.fitView({
            nodes: [{ id: nodeId }],
            duration: 500,
            padding: 0.5,
        });
        onClose();
    }, [reactFlowInstance, onClose]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex].id);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Palette */}
            <div
                className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <Search size={18} className="text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search functions..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-[10px] text-muted-foreground font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-72 overflow-auto py-1">
                    {results.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No functions found
                        </div>
                    ) : (
                        results.map((node, idx) => {
                            const label = node.data.label as string;
                            const funcName = label.split('.').pop() || label;
                            const contractName = label.includes('.') ? label.split('.')[0] : null;

                            return (
                                <button
                                    key={node.id}
                                    onClick={() => handleSelect(node.id)}
                                    className={cn(
                                        "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer",
                                        idx === selectedIndex
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                >
                                    <Code2 size={14} className={cn(
                                        "shrink-0",
                                        idx === selectedIndex ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium truncate block">{funcName}</span>
                                    </div>
                                    {contractName && (
                                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                                            {contractName}
                                        </span>
                                    )}
                                    {idx === selectedIndex && (
                                        <ArrowRight size={12} className="text-primary shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">↑↓</kbd>
                            navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">↵</kbd>
                            select
                        </span>
                    </div>
                    <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div >
    );
}
