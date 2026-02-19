"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
    Background,
    MiniMap,
    addEdge,
    Connection,
    Edge,
    BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Sidebar } from './Sidebar';
import { BottomToolbar } from './BottomToolbar';
import { EdgeComparison } from './EdgeComparison';
import { CommandPalette } from './CommandPalette';
import { EmptyState } from './EmptyState';
import { useAuditStore } from '@/store/useAuditStore';
import FunctionNode from './nodes/FunctionNode';
import ClickableEdge from './edges/ClickableEdge';

const nodeTypes = {
    default: FunctionNode,
    function: FunctionNode,
};

const edgeTypes = {
    clickable: ClickableEdge,
};

export function AuditCanvas() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        setEdges,
        highlightedEdgeId,
        highlightedNodeIds,
        highlightEdge,
        clearHighlight,
    } = useAuditStore();

    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Cmd+K / Ctrl+K global shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const onConnect = useCallback(
        (params: Connection) => {
            const { edges } = useAuditStore.getState();
            setEdges(addEdge(params, edges));
        },
        [setEdges],
    );

    const onEdgeClick = useCallback(
        (_event: React.MouseEvent, edge: Edge) => {
            highlightEdge(edge.id, edge.source, edge.target);
        },
        [highlightEdge],
    );

    const onPaneClick = useCallback(() => {
        clearHighlight();
    }, [clearHighlight]);

    // Apply highlight styles to edges
    const styledEdges = useMemo(() => {
        if (!highlightedEdgeId) return edges;

        return edges.map(edge => {
            if (edge.id === highlightedEdgeId) {
                return {
                    ...edge,
                    style: {
                        ...edge.style,
                        stroke: '#22d3ee',
                        strokeWidth: 3,
                        filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.6))',
                    },
                    animated: true,
                };
            }
            return {
                ...edge,
                style: {
                    ...edge.style,
                    stroke: '#334155',
                    strokeWidth: 1,
                    opacity: 0.3,
                },
            };
        });
    }, [edges, highlightedEdgeId]);

    // Apply highlight class to nodes
    const styledNodes = useMemo(() => {
        if (!highlightedEdgeId) return nodes;

        return nodes.map(node => {
            if (node.type === 'group') return node;

            const isHighlighted = highlightedNodeIds.has(node.id);
            return {
                ...node,
                data: {
                    ...node.data,
                    _isHighlighted: isHighlighted,
                    _isDimmed: !isHighlighted,
                },
            };
        });
    }, [nodes, highlightedEdgeId, highlightedNodeIds]);

    // Show empty state when no real nodes are loaded
    const isEmpty = nodes.length === 0 || (nodes.length === 1 && nodes[0].id === 'placeholder');

    return (
        <div className="h-screen w-full bg-background relative">
            <ReactFlow
                nodes={styledNodes}
                edges={styledEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                fitView
                className="bg-background"
                minZoom={0.1}
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#3f3f46" />
                <MiniMap className="bg-card border-border" nodeColor="#3f3f46" />

                {/* UI Overlays */}
                <BottomToolbar />
                <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            </ReactFlow>
            <Sidebar onSearchOpen={() => setIsSearchOpen(true)} />
            {isEmpty && <EmptyState />}
            <EdgeComparison />
        </div>
    );
}
