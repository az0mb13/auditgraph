import ELK, { ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { Node, Edge, Position } from 'reactflow';

const elk = new ELK();

// Find connected components
const findClusters = (nodes: Node[], edges: Edge[]) => {
    const adj = new Map<string, string[]>();
    nodes.forEach(n => adj.set(n.id, []));
    edges.forEach(e => {
        if (adj.has(e.source)) adj.get(e.source)?.push(e.target);
        if (adj.has(e.target)) adj.get(e.target)?.push(e.source);
    });

    const visited = new Set<string>();
    const clusters: Node[][] = [];
    nodes.forEach(n => {
        if (!visited.has(n.id)) {
            const cluster: Node[] = [];
            const stack = [n.id];
            visited.add(n.id);
            while (stack.length > 0) {
                const u = stack.pop()!;
                const node = nodes.find(fn => fn.id === u);
                if (node) cluster.push(node);
                (adj.get(u) || []).forEach(v => {
                    if (!visited.has(v)) { visited.add(v); stack.push(v); }
                });
            }
            clusters.push(cluster);
        }
    });
    return clusters;
};

// Calculate node dimensions
const calcDims = (node: Node, isCodeView: boolean) => {
    if (!isCodeView) return { width: 300, height: 120 };

    const hasCode = node.data.code && !(node.data.code as string).includes('No source code available');
    if (!hasCode) return { width: 300, height: 120 };

    const lines = (node.data.code as string).split('\n');
    return {
        width: Math.max(Math.max(...lines.map(l => l.length)) * 9.5 + 100, 400),
        height: Math.max(lines.length * 20 + 100, 150),
    };
};

export const getLayoutedElements = async (
    nodes: Node[], edges: Edge[], direction = 'LR', isCodeView = false
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    const isHorizontal = direction === 'LR';

    const functionNodes = nodes.filter(n =>
        n.type === 'function' || n.type === 'default' || n.type === 'input' || n.type === 'output'
    );

    const clusters = findClusters(functionNodes, edges);
    const complexClusters = clusters.filter(c => c.length > 1);
    const singleClusters = clusters.filter(c => c.length === 1);

    const finalNodes: Node[] = [];

    // Bezier curves for clean Miro-style connectors
    const finalEdges: Edge[] = edges.map(e => ({
        ...e,
        type: 'clickable',  // Custom edge with HTML click overlay
        animated: false,
        style: { stroke: '#64748b', strokeWidth: 1.5 },
        interactionWidth: 30, // 30px invisible hitbox for easy clicking
    }));

    // MASSIVE padding so nodes have breathing room
    const GROUP_PADDING = 400;
    const GROUP_HEADER = 60;
    let currentGroupX = 0;

    for (let index = 0; index < complexClusters.length; index++) {
        const clusterNodes = complexClusters[index];
        const clusterNodeIds = new Set(clusterNodes.map(n => n.id));
        const clusterEdges = edges.filter(e => clusterNodeIds.has(e.source) && clusterNodeIds.has(e.target));

        const elkGraph = {
            id: `root-${index}`,
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': 'RIGHT',
                // MASSIVE spacing so bezier curves never cross through nodes
                'elk.spacing.nodeNode': isCodeView ? '300' : '180',
                'elk.layered.spacing.nodeNodeBetweenLayers': isCodeView ? '600' : '450',
                'elk.edgeRouting': 'SPLINES',  // Spline routing for ELK's internal calculations
                'elk.spacing.edgeNode': '120',
                'elk.spacing.edgeEdge': '60',
                'elk.layered.mergeEdges': 'false',
                'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
                'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
                // Spread nodes vertically to give edges distinct paths
                'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            },
            children: clusterNodes.map(node => {
                const { width, height } = calcDims(node, isCodeView);
                return { id: node.id, width, height };
            }),
            edges: clusterEdges.map(e => ({
                id: e.id, sources: [e.source], targets: [e.target]
            }))
        };

        try {
            const layoutedGraph = await elk.layout(elkGraph);

            // Calculate bounds
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            layoutedGraph.children?.forEach(c => {
                minX = Math.min(minX, c.x!);
                maxX = Math.max(maxX, c.x! + c.width!);
                minY = Math.min(minY, c.y!);
                maxY = Math.max(maxY, c.y! + c.height!);
            });

            const groupWidth = (maxX - minX) + GROUP_PADDING * 2;
            const groupHeight = (maxY - minY) + GROUP_PADDING * 2 + GROUP_HEADER;
            const groupId = `group-cluster-${index}`;

            finalNodes.push({
                id: groupId,
                type: 'group',
                position: { x: currentGroupX, y: 0 },
                style: {
                    width: groupWidth,
                    height: groupHeight,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid rgba(51,65,85,0.8)',
                    borderRadius: '16px',
                },
                data: { label: `Cluster ${index + 1}` },
            });

            const ox = -minX + GROUP_PADDING;
            const oy = -minY + GROUP_PADDING + GROUP_HEADER;

            clusterNodes.forEach(node => {
                const elkNode = layoutedGraph.children?.find(n => n.id === node.id);
                if (elkNode) {
                    const { width, height } = calcDims(node, isCodeView);
                    finalNodes.push({
                        ...node,
                        parentNode: groupId,
                        extent: 'parent' as const,
                        position: { x: elkNode.x! + ox, y: elkNode.y! + oy },
                        style: { ...node.style, width, height },
                        targetPosition: isHorizontal ? Position.Left : Position.Top,
                        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
                        data: { ...node.data, _width: width, _height: height },
                    });
                }
            });

            currentGroupX += groupWidth + 200;
        } catch (err) {
            console.error('ELK Layout Failed:', err);
            finalNodes.push(...clusterNodes);
        }
    }

    // Single-node grid
    if (singleClusters.length > 0) {
        const gridX = currentGroupX + 200;
        const COLS = isCodeView ? 3 : 5;
        const CW = isCodeView ? 600 : 350;
        const CH = isCodeView ? 500 : 200;

        singleClusters.forEach((cluster, i) => {
            const node = cluster[0];
            const { width, height } = calcDims(node, isCodeView);
            finalNodes.push({
                ...node,
                parentNode: undefined,
                extent: undefined,
                position: { x: gridX + (i % COLS) * CW, y: Math.floor(i / COLS) * CH },
                style: { ...node.style, width, height },
                data: { ...node.data, _width: width, _height: height },
            });
        });
    }

    return { nodes: finalNodes, edges: finalEdges };
};
