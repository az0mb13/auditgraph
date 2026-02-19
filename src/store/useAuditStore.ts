import { create } from 'zustand';
import { temporal } from 'zundo';
import {
    Node,
    Edge,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
} from 'reactflow';

interface ComparisonEdge {
    edgeId: string;
    sourceId: string;
    targetId: string;
}

export interface ContractInfo {
    visible: boolean;
    isInterface: boolean;
    functionCount: number;
}

interface AuditState {
    nodes: Node[];
    edges: Edge[];
    /** All raw nodes/edges before filtering — the source of truth from upload */
    rawNodes: Node[];
    rawEdges: Edge[];
    showCode: boolean;
    highlightedEdgeId: string | null;
    highlightedNodeIds: Set<string>;
    comparisonEdge: ComparisonEdge | null;
    /** Contract name → visibility and metadata */
    contractFilters: Record<string, ContractInfo>;
    isFilterPanelOpen: boolean;
    layoutDirection: 'LR' | 'TB';

    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    setRawGraph: (nodes: Node[], edges: Edge[]) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    toggleCodeView: () => void;
    highlightEdge: (edgeId: string, sourceId: string, targetId: string) => void;
    clearHighlight: () => void;
    openComparison: (edgeId: string, sourceId: string, targetId: string) => void;
    closeComparison: () => void;
    setContractFilters: (filters: Record<string, ContractInfo>) => void;
    toggleContract: (name: string) => void;
    toggleAllContracts: (visible: boolean) => void;
    toggleFilterPanel: () => void;
    setLayoutDirection: (direction: 'LR' | 'TB') => void;
}

export const useAuditStore = create<AuditState>()(
    temporal((set, get) => ({
        nodes: [],
        edges: [],
        rawNodes: [],
        rawEdges: [],
        showCode: false,
        highlightedEdgeId: null,
        highlightedNodeIds: new Set<string>(),
        comparisonEdge: null,
        contractFilters: {},
        isFilterPanelOpen: false,
        layoutDirection: 'LR',

        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),
        setRawGraph: (nodes, edges) => set({ rawNodes: nodes, rawEdges: edges }),

        onNodesChange: (changes: NodeChange[]) => {
            set({ nodes: applyNodeChanges(changes, get().nodes) });
        },
        onEdgesChange: (changes: EdgeChange[]) => {
            set({ edges: applyEdgeChanges(changes, get().edges) });
        },

        toggleCodeView: () => set((state) => ({ showCode: !state.showCode })),

        highlightEdge: (edgeId, sourceId, targetId) =>
            set({
                highlightedEdgeId: edgeId,
                highlightedNodeIds: new Set([sourceId, targetId]),
            }),

        clearHighlight: () =>
            set({
                highlightedEdgeId: null,
                highlightedNodeIds: new Set(),
            }),

        openComparison: (edgeId, sourceId, targetId) =>
            set({
                comparisonEdge: { edgeId, sourceId, targetId },
                highlightedEdgeId: edgeId,
                highlightedNodeIds: new Set([sourceId, targetId]),
            }),

        closeComparison: () =>
            set({
                comparisonEdge: null,
                highlightedEdgeId: null,
                highlightedNodeIds: new Set(),
            }),

        setContractFilters: (filters) => set({ contractFilters: filters }),

        toggleContract: (name) =>
            set((state) => ({
                contractFilters: {
                    ...state.contractFilters,
                    [name]: {
                        ...state.contractFilters[name],
                        visible: !state.contractFilters[name]?.visible,
                    },
                },
            })),

        toggleAllContracts: (visible) =>
            set((state) => {
                const updated: Record<string, ContractInfo> = {};
                for (const [name, info] of Object.entries(state.contractFilters)) {
                    updated[name] = { ...info, visible };
                }
                return { contractFilters: updated };
            }),

        toggleFilterPanel: () =>
            set((state) => ({ isFilterPanelOpen: !state.isFilterPanelOpen })),

        setLayoutDirection: (direction) => set({ layoutDirection: direction }),
    }), {
        // Only verify history for critical state changes, not every highlighting
        partialize: (state) => {
            const { nodes, edges, contractFilters, showCode, layoutDirection } = state;
            return { nodes, edges, contractFilters, showCode, layoutDirection };
        },
    })
);
