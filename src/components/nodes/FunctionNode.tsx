import React, { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Lock, Globe, Code2 } from 'lucide-react';
import { useAuditStore } from '@/store/useAuditStore';
import { cn } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const FunctionNode = ({ id, data, selected, sourcePosition = Position.Bottom, targetPosition = Position.Top }: NodeProps) => {
    const showCode = useAuditStore((state) => state.showCode);
    const edges = useAuditStore((state) => state.edges);
    const openComparison = useAuditStore((state) => state.openComparison);

    // Infer visibility from label or data if available. 
    // For now, we simulate random visibility if not present, or parse from label text like "Contract.method"
    const label = data.label as string;
    const isPrivate = label.includes('_') || label.toLowerCase().includes('private');
    const code = data.code as string;
    const isHighlighted = data._isHighlighted as boolean | undefined;
    const isDimmed = data._isDimmed as boolean | undefined;

    const handleCallClick = useCallback((callLine: number) => {
        // Find the edge that originates from this node at this specific line handle
        const handleId = `line-${callLine}`;
        const edge = edges.find(e => e.source === id && e.sourceHandle === handleId);
        if (edge) {
            openComparison(edge.id, edge.source, edge.target);
        }
    }, [edges, id, openComparison]);

    return (
        <div className={cn(
            "px-4 py-3 rounded-xl border bg-card shadow-md transition-all duration-300 min-w-[180px]",
            selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50",
            isHighlighted && "!border-cyan-400 ring-2 ring-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.3)]",
            isDimmed && "opacity-20",
        )}>
            <Handle type="target" position={targetPosition} className="!bg-muted-foreground !w-3 !h-1 !rounded-full" />

            <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isPrivate ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                )}>
                    {isPrivate ? <Lock size={16} /> : <Globe size={16} />}
                </div>

                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground truncate max-w-[300px]">
                        {label.split('.').pop() || label}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                        {isPrivate ? 'Private' : 'Public'} Fn
                    </span>
                </div>
            </div>
            {/* Code View */}
            {showCode && code && !code.includes('No source code available') && (
                <div className="mt-3 rounded-lg border border-zinc-800 overflow-hidden text-xs relative bg-zinc-950">
                    <div className="relative z-10 pointer-events-none">
                        <SyntaxHighlighter
                            language="solidity"
                            style={vscDarkPlus}
                            customStyle={{
                                margin: 0,
                                padding: '12px',
                                fontSize: '12px',
                                lineHeight: '20px',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                background: 'transparent'
                            }}
                            wrapLongLines={false}
                        >
                            {code}
                        </SyntaxHighlighter>
                    </div>

                    {/* Render Line Handles & Guides */}
                    {data.calls && (data.calls as any[]).map((call, idx) => {
                        // Check if this line is active (has an outgoing edge)
                        const isActive = (data.activeLines as number[])?.includes(call.line);

                        if (!isActive) return null;

                        // Get the text content of the line to calculate start position
                        const codeLines = code.split('\n');
                        const lineText = codeLines[call.line] || '';
                        // Estimate visual length (assuming tabs ~ 4 spaces if present)
                        const visualLength = lineText.replace(/\t/g, '    ').length;

                        return (
                            <React.Fragment key={idx}>
                                {/* Clickable invisible strip over the guide line area */}
                                <div
                                    className="absolute cursor-pointer"
                                    style={{
                                        top: `${12 + (call.line * 20) + 10 - 6}px`,
                                        left: `calc(12px + ${visualLength}ch + 12px)`,
                                        right: '0px',
                                        height: '12px',
                                        zIndex: 20,
                                        pointerEvents: 'all',
                                    }}
                                    onClick={(e) => { e.stopPropagation(); handleCallClick(call.line); }}
                                    title={`Click to compare: ${call.name}`}
                                />
                                {/* Dynamic Guide Line (visual only) */}
                                <div
                                    className="absolute border-b border-dashed border-red-500/50 pointer-events-none"
                                    style={{
                                        top: `${12 + (call.line * 20) + 10}px`,
                                        left: `calc(12px + ${visualLength}ch + 12px)`,
                                        right: '10px',
                                        zIndex: 0
                                    }}
                                />
                                <Handle
                                    id={`line-${call.line}`}
                                    type="source"
                                    position={sourcePosition}
                                    className="!bg-red-500 !w-2 !h-2 !rounded-full !border-2 !border-zinc-900 z-50 hover:scale-150 transition-transform cursor-crosshair"
                                    style={{
                                        top: `${12 + (call.line * 20) + 10}px`,
                                        right: '-5px',
                                        position: 'absolute',
                                        transform: 'translateY(-50%)'
                                    }}
                                    title={`Call to ${call.name}`}
                                />
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* Optional: Show contract name if Contract.Function format */}
            {!showCode && label.includes('.') && (
                <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 px-1">
                    <Code2 size={12} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                        {label.split('.')[0]}
                    </span>
                </div>
            )}

            <Handle type="source" position={sourcePosition} className="!bg-muted-foreground !w-3 !h-1 !rounded-full" />
        </div>
    );
};

export default memo(FunctionNode);
