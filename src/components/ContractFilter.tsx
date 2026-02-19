"use client";

import React from 'react';
import { Eye, EyeOff, Filter } from 'lucide-react';
import { useAuditStore, ContractInfo } from '@/store/useAuditStore';
import { cn } from '@/lib/utils';

export function ContractFilter() {
    const contractFilters = useAuditStore((s) => s.contractFilters);
    const isOpen = useAuditStore((s) => s.isFilterPanelOpen);
    const toggleContract = useAuditStore((s) => s.toggleContract);
    const toggleAll = useAuditStore((s) => s.toggleAllContracts);
    const togglePanel = useAuditStore((s) => s.toggleFilterPanel);

    const entries = Object.entries(contractFilters);
    const hasContracts = entries.length > 0;
    const contracts = entries.filter(([, info]) => !info.isInterface);
    const interfaces = entries.filter(([, info]) => info.isInterface);
    const visibleCount = entries.filter(([, info]) => info.visible).length;

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={togglePanel}
                className={cn(
                    'p-2.5 rounded-lg hover:bg-muted transition-colors relative group cursor-pointer',
                    isOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground',
                )}
            >
                <div className="absolute left-12 bg-card px-2 py-1 rounded-md border border-border text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    Filter Contracts
                </div>
                <Filter size={18} />
                {hasContracts && visibleCount < entries.length && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                        {visibleCount}
                    </span>
                )}
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="absolute left-14 top-0 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl pointer-events-auto w-64 overflow-hidden z-50">
                    {/* Header */}
                    <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Contracts
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => toggleAll(true)}
                                className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                All
                            </button>
                            <button
                                onClick={() => toggleAll(false)}
                                className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                None
                            </button>
                        </div>
                    </div>

                    {hasContracts ? (
                        <>
                            {/* Contract List */}
                            <div className="max-h-80 overflow-auto py-1">
                                {contracts.length > 0 && (
                                    <div>
                                        {contracts.map(([name, info]) => (
                                            <FilterRow
                                                key={name}
                                                name={name}
                                                info={info}
                                                onToggle={() => toggleContract(name)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {interfaces.length > 0 && (
                                    <>
                                        <div className="px-3 pt-2 pb-1">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Interfaces
                                            </span>
                                        </div>
                                        {interfaces.map(([name, info]) => (
                                            <FilterRow
                                                key={name}
                                                name={name}
                                                info={info}
                                                onToggle={() => toggleContract(name)}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
                                {visibleCount} of {entries.length} shown
                            </div>
                        </>
                    ) : (
                        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                            Upload a project to filter contracts
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

function FilterRow({
    name,
    info,
    onToggle,
}: {
    name: string;
    info: ContractInfo;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/50 cursor-pointer',
                info.visible ? 'text-foreground' : 'text-muted-foreground/50',
            )}
        >
            {info.visible ? (
                <Eye size={13} className="text-primary shrink-0" />
            ) : (
                <EyeOff size={13} className="text-muted-foreground/40 shrink-0" />
            )}
            <span className={cn('text-xs font-medium truncate flex-1', info.isInterface && 'italic')}>
                {name}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {info.functionCount}
            </span>
        </button>
    );
}
