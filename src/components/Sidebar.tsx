"use client";

import { ThemeToggle } from './ThemeToggle';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Upload, Search, Settings, Loader2, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuditStore, ContractInfo } from '@/store/useAuditStore';
import { getLayoutedElements } from '@/lib/layout';
import { ContractFilter } from './ContractFilter';

interface SidebarProps {
    onSearchOpen: () => void;
}

/**
 * Given the full raw graph and current filters, return only the
 * visible nodes and edges (and re-wire parentNode references).
 */
function filterGraph(
    rawNodes: import('reactflow').Node[],
    rawEdges: import('reactflow').Edge[],
    filters: Record<string, ContractInfo>,
) {
    // Build a set of hidden contract labels
    const hiddenContracts = new Set(
        Object.entries(filters)
            .filter(([, info]) => !info.visible)
            .map(([name]) => name),
    );

    if (hiddenContracts.size === 0) {
        return { nodes: rawNodes, edges: rawEdges };
    }

    // Collect IDs of hidden group nodes
    const hiddenGroupIds = new Set<string>();
    rawNodes.forEach(node => {
        if (node.type === 'group' && hiddenContracts.has(node.data.label as string)) {
            hiddenGroupIds.add(node.id);
        }
    });

    // Filter nodes: remove groups and their children
    const visibleNodes = rawNodes.filter(node => {
        if (hiddenGroupIds.has(node.id)) return false;
        if (node.parentNode && hiddenGroupIds.has(node.parentNode)) return false;
        return true;
    });

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    // Filter edges: remove any that reference hidden nodes
    const visibleEdges = rawEdges.filter(edge =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );

    return { nodes: visibleNodes, edges: visibleEdges };
}

/**
 * Apply code-view transformation: split edges into per-call-line edges
 * with sourceHandle references, and compute activeLines for each node.
 * When showCode is false, resets sourceHandle to null.
 */
function applyCodeViewTransform(
    inputNodes: import('reactflow').Node[],
    inputEdges: import('reactflow').Edge[],
    showCode: boolean,
) {
    if (!showCode) {
        const edges = inputEdges.map(e => ({ ...e, sourceHandle: null }));
        const nodes = inputNodes.map(n => ({ ...n, data: { ...n.data, activeLines: [] } }));
        return { nodes, edges };
    }

    const nodeActiveLines = new Map<string, Set<number>>();

    const edges = inputEdges.flatMap(edge => {
        const sourceNode = inputNodes.find(n => n.id === edge.source);
        const targetNode = inputNodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode && sourceNode.data.calls) {
            const calls = sourceNode.data.calls as { name: string; line: number }[];
            const targetLabel = (targetNode.data.label as string).split('.').pop() || '';
            const matchingCalls = calls.filter(c => c.name === targetLabel);

            if (matchingCalls.length > 0) {
                if (!nodeActiveLines.has(sourceNode.id)) {
                    nodeActiveLines.set(sourceNode.id, new Set());
                }
                const activeSet = nodeActiveLines.get(sourceNode.id)!;
                matchingCalls.forEach(c => activeSet.add(c.line));

                return matchingCalls.map((call, idx) => ({
                    ...edge,
                    id: `${edge.id}-call-${idx}`,
                    sourceHandle: `line-${call.line}`,
                }));
            }
        }
        return [edge];
    });

    const nodes = inputNodes.map(node => {
        if (nodeActiveLines.has(node.id)) {
            return {
                ...node,
                data: {
                    ...node.data,
                    activeLines: Array.from(nodeActiveLines.get(node.id)!),
                },
            };
        }
        return { ...node, data: { ...node.data, activeLines: [] } };
    });

    return { nodes, edges };
}

export function Sidebar({ onSearchOpen }: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {
        setNodes, setEdges, toggleCodeView, showCode, nodes, edges,
        rawNodes, rawEdges, setRawGraph, contractFilters, setContractFilters,
        layoutDirection,
    } = useAuditStore();
    const [isUploading, setIsUploading] = useState(false);

    // Shared layout helper: applies code-view transform then ELK layout
    const layoutAndApply = useCallback(
        (inputNodes: import('reactflow').Node[], inputEdges: import('reactflow').Edge[]) => {
            const { nodes: transformed, edges: transformedEdges } = applyCodeViewTransform(inputNodes, inputEdges, showCode);
            getLayoutedElements(transformed, transformedEdges, layoutDirection, showCode).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
                setNodes([...layoutedNodes]);
                setEdges([...layoutedEdges]);
            });
        },
        [showCode, layoutDirection, setNodes, setEdges],
    );

    // Re-layout when code view toggles
    useEffect(() => {
        if (nodes.length > 1) {
            layoutAndApply(nodes, edges);
        }
    }, [showCode, layoutDirection]);

    // Re-filter + re-layout when contract filters change
    useEffect(() => {
        if (rawNodes.length === 0) return;

        const { nodes: filtered, edges: filteredEdges } = filterGraph(rawNodes, rawEdges, contractFilters);

        if (filtered.length === 0) {
            setNodes([{
                id: 'placeholder',
                position: { x: 0, y: 0 },
                data: { label: 'No contracts visible' },
                type: 'function',
            }]);
            setEdges([]);
            return;
        }

        layoutAndApply(filtered, filteredEdges);
    }, [contractFilters]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('file', files[i]);
        }

        try {
            const response = await fetch('/api/parse', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to parse file');
            }

            const data = await response.json();
            const { nodes: newNodes, edges: newEdges, contracts } = data;

            // Store raw graph for later filtering
            setRawGraph(newNodes || [], newEdges || []);

            // Build contract filters — interfaces hidden by default
            const filters: Record<string, ContractInfo> = {};
            if (contracts) {
                for (const c of contracts) {
                    filters[c.name] = {
                        visible: !c.isInterface,
                        isInterface: c.isInterface,
                        functionCount: c.functionCount,
                    };
                }
            }
            setContractFilters(filters);

            // Apply initial filter (hides interfaces)
            const { nodes: filtered, edges: filteredEdges } = filterGraph(
                newNodes || [],
                newEdges || [],
                filters,
            );

            const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
                filtered,
                filteredEdges,
                'LR',
                showCode,
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <aside className="absolute left-4 top-4 z-30 flex flex-col gap-2 pointer-events-none items-start">
            {/* Branding */}
            <h1 className="text-xl font-bold tracking-tighter text-foreground mb-4 select-none px-1 pointer-events-auto">
                Audit<span className="text-primary">Graph</span>
            </h1>

            {/* Toolbar */}
            <div className="flex flex-col bg-card/80 backdrop-blur-md border border-border p-1.5 rounded-xl shadow-lg pointer-events-auto relative">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".sol,.zip"
                    multiple
                />

                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="p-2.5 rounded-lg hover:bg-muted transition-colors text-foreground group relative disabled:opacity-50 cursor-pointer"
                >
                    <div className="absolute left-12 bg-card px-2 py-1 rounded-md border border-border text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Upload Contract / ZIP
                    </div>
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                </button>

                <div className="h-px w-full bg-border my-0.5" />

                <button
                    onClick={() => toggleCodeView()}
                    className={cn(
                        'p-2.5 rounded-lg hover:bg-muted transition-colors relative group cursor-pointer',
                        showCode ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <div className="absolute left-12 bg-card px-2 py-1 rounded-md border border-border text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Toggle Code View
                    </div>
                    <Code2 size={18} />
                </button>

                <ContractFilter />

                <button
                    onClick={onSearchOpen}
                    className="p-2.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground relative group cursor-pointer"
                >
                    <div className="absolute left-12 bg-card px-2 py-1 rounded-md border border-border text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Search ⌘K
                    </div>
                    <Search size={18} />
                </button>
            </div>

            {/* Settings */}
            <div className="mt-auto pointer-events-auto">
                <div className="bg-card/80 backdrop-blur-md border border-border p-1.5 rounded-xl shadow-lg flex flex-col gap-1">
                    <ThemeToggle />
                    <button className="p-2.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                        <Settings size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
