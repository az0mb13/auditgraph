"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Lock, Globe } from 'lucide-react';
import { useAuditStore } from '@/store/useAuditStore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodePanel({ node, side }: { node: { id: string; data: any }; side: 'source' | 'target' }) {
    const label = (node.data.label as string) || node.id;
    const code = node.data.code as string;
    const isPrivate = label.includes('_') || label.toLowerCase().includes('private');
    const funcName = label.split('.').pop() || label;
    const contractName = label.includes('.') ? label.split('.')[0] : null;
    const hasCode = code && !code.includes('No source code available');

    return (
        <div className="flex-1 min-w-0 flex flex-col bg-zinc-900/80 rounded-2xl border border-zinc-700/50 overflow-hidden backdrop-blur-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-700/50 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPrivate ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                    {isPrivate ? <Lock size={16} /> : <Globe size={16} />}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-white truncate">{funcName}</span>
                    {contractName && (
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                            {contractName} · {isPrivate ? 'Private' : 'Public'}
                        </span>
                    )}
                    {!contractName && (
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                            {isPrivate ? 'Private' : 'Public'} Function
                        </span>
                    )}
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${side === 'source'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                    {side === 'source' ? 'Caller' : 'Callee'}
                </span>
            </div>

            {/* Code */}
            <div className="flex-1 overflow-auto p-1">
                {hasCode ? (
                    <SyntaxHighlighter
                        language="solidity"
                        style={vscDarkPlus}
                        customStyle={{
                            margin: 0,
                            padding: '16px',
                            fontSize: '13px',
                            lineHeight: '22px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            background: 'transparent',
                            height: '100%',
                        }}
                        showLineNumbers
                        wrapLongLines={false}
                    >
                        {code}
                    </SyntaxHighlighter>
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                        No source code available
                    </div>
                )}
            </div>
        </div>
    );
}

export function EdgeComparison() {
    const comparisonEdge = useAuditStore((s) => s.comparisonEdge);
    const closeComparison = useAuditStore((s) => s.closeComparison);
    const nodes = useAuditStore((s) => s.nodes);

    if (!comparisonEdge) return null;

    const sourceNode = nodes.find(n => n.id === comparisonEdge.sourceId);
    const targetNode = nodes.find(n => n.id === comparisonEdge.targetId);

    if (!sourceNode || !targetNode) return null;

    return (
        <AnimatePresence>
            {comparisonEdge && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    onClick={closeComparison}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="relative w-[92vw] h-[85vh] flex items-stretch gap-0"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={closeComparison}
                            className="absolute -top-12 right-0 p-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-all z-10"
                        >
                            <X size={20} />
                        </button>

                        {/* Source node */}
                        <CodePanel node={sourceNode} side="source" />

                        {/* Connector */}
                        <div className="flex flex-col items-center justify-center px-4 gap-2">
                            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent" />
                            <div className="p-2 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                                <ArrowRight size={16} className="text-cyan-400" />
                            </div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono whitespace-nowrap">
                                calls
                            </div>
                            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent" />
                        </div>

                        {/* Target node */}
                        <CodePanel node={targetNode} side="target" />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
