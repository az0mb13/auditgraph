import React, { useMemo } from 'react';
import {
    EdgeProps,
    getBezierPath,
    EdgeLabelRenderer,
    BaseEdge,
} from 'reactflow';
import { useAuditStore } from '@/store/useAuditStore';

/**
 * Compute a point along a cubic bezier curve at parameter t (0-1).
 * P(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
function bezierPoint(
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
) {
    const mt = 1 - t;
    return {
        x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    };
}

/**
 * Custom edge that makes the ENTIRE line clickable by placing
 * a chain of overlapping HTML hitbox divs along the full bezier curve.
 * These are rendered via EdgeLabelRenderer (HTML layer above nodes).
 */
const ClickableEdge: React.FC<EdgeProps> = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
}) => {
    const openComparison = useAuditStore((s) => s.openComparison);
    const highlightedEdgeId = useAuditStore((s) => s.highlightedEdgeId);
    const isHighlighted = highlightedEdgeId === id;

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    });

    // Approximate bezier control points for a standard React Flow bezier
    // React Flow uses horizontal bezier with control points offset by ~half the distance
    const dx = Math.abs(targetX - sourceX);
    const cpOffset = Math.max(dx * 0.5, 50);

    const p0 = { x: sourceX, y: sourceY };
    const p1 = { x: sourceX + cpOffset, y: sourceY }; // control point 1 (horizontal offset from source)
    const p2 = { x: targetX - cpOffset, y: targetY }; // control point 2 (horizontal offset from target)
    const p3 = { x: targetX, y: targetY };

    // Generate points along the bezier curve for the clickable hitbox chain
    const SEGMENTS = 12;
    const hitboxPoints = useMemo(() => {
        const points: { x: number; y: number; angle: number }[] = [];
        for (let i = 0; i <= SEGMENTS; i++) {
            const t = i / SEGMENTS;
            const pt = bezierPoint(t, p0, p1, p2, p3);

            // Calculate angle at this point using nearby points
            const tPrev = Math.max(0, t - 0.02);
            const tNext = Math.min(1, t + 0.02);
            const prev = bezierPoint(tPrev, p0, p1, p2, p3);
            const next = bezierPoint(tNext, p0, p1, p2, p3);
            const angle = Math.atan2(next.y - prev.y, next.x - prev.x) * (180 / Math.PI);

            points.push({ x: pt.x, y: pt.y, angle });
        }
        return points;
    }, [sourceX, sourceY, targetX, targetY]);

    // Calculate segment length for overlap
    const pathLength = Math.sqrt(
        (targetX - sourceX) ** 2 + (targetY - sourceY) ** 2
    );
    const segmentWidth = Math.max((pathLength / SEGMENTS) * 1.5, 40); // 50% overlap

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        openComparison(id, source, target);
    };

    // Highlighted edge styling
    const edgeStyle = isHighlighted
        ? {
            ...style,
            stroke: '#22d3ee',
            strokeWidth: 3,
            filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))',
        }
        : style;

    return (
        <>
            {/* Visible bezier path (SVG layer) */}
            <BaseEdge
                id={id}
                path={edgePath}
                style={edgeStyle}
                markerEnd={markerEnd}
            />

            {/* Chain of clickable HTML hitboxes along the full curve (HTML layer, above nodes) */}
            <EdgeLabelRenderer>
                {hitboxPoints.map((pt, i) => (
                    <div
                        key={`${id}-hit-${i}`}
                        onClick={handleClick}
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px) rotate(${pt.angle}deg)`,
                            width: `${segmentWidth}px`,
                            height: '28px',
                            cursor: 'pointer',
                            pointerEvents: 'all',
                            borderRadius: '14px',
                            // Uncomment to debug hitbox visibility:
                            // backgroundColor: 'rgba(255, 0, 0, 0.15)',
                        }}
                        className="nodrag nopan"
                    />
                ))}
            </EdgeLabelRenderer>
        </>
    );
};

export default ClickableEdge;
