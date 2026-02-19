"use client";

import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileCode2, FolderArchive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuditStore, ContractInfo } from '@/store/useAuditStore';
import { getLayoutedElements } from '@/lib/layout';

export function EmptyState() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { setNodes, setEdges, setRawGraph, setContractFilters, showCode } = useAuditStore();

    const processUpload = useCallback(async (files: FileList | File[]) => {
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

            if (!response.ok) throw new Error('Failed to parse file');

            const data = await response.json();
            const { nodes: newNodes, edges: newEdges, contracts } = data;

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

            // Filter out interfaces
            const hiddenGroups = new Set<string>();
            const filteredNodes = (newNodes || []).filter((n: any) => {
                if (n.type === 'group' && n.data.isInterface) {
                    hiddenGroups.add(n.id);
                    return false;
                }
                if (n.parentNode && hiddenGroups.has(n.parentNode)) return false;
                return true;
            });
            const visibleIds = new Set(filteredNodes.map((n: any) => n.id));
            const filteredEdges = (newEdges || []).filter(
                (e: any) => visibleIds.has(e.source) && visibleIds.has(e.target),
            );

            const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
                filteredNodes, filteredEdges, 'LR', showCode,
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    }, [setNodes, setEdges, setRawGraph, setContractFilters, showCode]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            processUpload(e.dataTransfer.files);
        }
    }, [processUpload]);

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto">
            <div
                className={cn(
                    'relative flex flex-col items-center gap-8 p-12 rounded-3xl border-2 border-dashed transition-all duration-300 max-w-lg w-full mx-4',
                    isDragging
                        ? 'border-primary bg-primary/5 scale-[1.02]'
                        : 'border-border/60 bg-card/40 backdrop-blur-sm',
                    isUploading && 'opacity-70 pointer-events-none',
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Icon */}
                <div className={cn(
                    'w-20 h-20 rounded-2xl flex items-center justify-center transition-colors duration-300',
                    isDragging ? 'bg-primary/10' : 'bg-muted/50',
                )}>
                    <Upload
                        size={32}
                        className={cn(
                            'transition-all duration-300',
                            isDragging ? 'text-primary scale-110' : 'text-muted-foreground',
                            isUploading && 'animate-bounce',
                        )}
                    />
                </div>

                {/* Text */}
                <div className="text-center space-y-2">
                    <h2 className="text-lg font-semibold text-foreground">
                        {isUploading ? 'Analyzing contracts...' : isDragging ? 'Drop to analyze' : 'Upload Smart Contracts'}
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        Drag & drop your Solidity files or project ZIP to visualize the call graph
                    </p>
                </div>

                {/* Upload Button */}
                {!isUploading && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                        Browse Files
                    </button>
                )}

                {/* File Types */}
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <FileCode2 size={14} className="text-muted-foreground/70" />
                        .sol files
                    </span>
                    <span className="flex items-center gap-1.5">
                        <FolderArchive size={14} className="text-muted-foreground/70" />
                        .zip projects
                    </span>
                </div>

                {/* Keyboard hint */}
                <div className="text-[10px] text-muted-foreground/50">
                    or use the upload button in the sidebar
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && processUpload(e.target.files)}
                    className="hidden"
                    accept=".sol,.zip"
                    multiple
                />
            </div>
        </div>
    );
}
