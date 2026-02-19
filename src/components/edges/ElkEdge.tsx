"use client";

import React from 'react';
import { EdgeProps, getBezierPath, BaseEdge } from 'reactflow';

/**
 * Custom Edge that renders ELK's computed waypoints as an orthogonal (right-angle) path.
 * If no waypoints are provided, falls back to a bezier curve.
 */
const ElkEdge: React.FC<EdgeProps> = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    style,
}) => {
    const bendPoints = data?.bendPoints as { x: number; y: number }[] | undefined;

    if (bendPoints && bendPoints.length > 0) {
        // Build an SVG path from source -> bendPoints -> target
        let path = `M ${sourceX} ${sourceY}`;

        bendPoints.forEach((bp) => {
            path += ` L ${bp.x} ${bp.y}`;
        });

        path += ` L ${targetX} ${targetY}`;

        return (
            <g>
                <path
                    id={id}
                    d={path}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={1.5}
                    markerEnd={markerEnd}
                    style={style}
                    className="react-flow__edge-path"
                />
                {/* Invisible wider path for easier selection */}
                <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    className="react-flow__edge-interaction"
                />
            </g>
        );
    }

    // Fallback: standard bezier
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });

    return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />;
};

export default ElkEdge;
