'use client'

import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { useFlowStore, type CurveStyle, type FlowEdgeData } from '@/lib/flowStore'

function getPathForCurve(
  curveStyle: CurveStyle,
  params: { sourceX: number; sourceY: number; sourcePosition: any; targetX: number; targetY: number; targetPosition: any }
): [string, number, number] {
  let result: [string, number, number, ...number[]]
  switch (curveStyle) {
    case 'linear':
      result = getStraightPath(params)
      break
    case 'step':
    case 'stepBefore':
    case 'stepAfter':
      result = getSmoothStepPath({ ...params, borderRadius: 0 })
      break
    case 'natural':
    case 'monotoneX':
    case 'monotoneY':
    case 'bumpX':
    case 'bumpY':
      result = getSmoothStepPath({ ...params, borderRadius: 8 })
      break
    case 'basis':
    case 'cardinal':
    case 'catmullRom':
    default:
      result = getBezierPath(params)
      break
  }
  return [result[0], result[1], result[2]]
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  markerStart,
  selected,
  data,
}: EdgeProps) {
  const curveStyle = useFlowStore((s) => s.curveStyle)
  const [edgePath, labelX, labelY] = getPathForCurve(curveStyle, {
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState((label as string) ?? '')
  const updateEdgeLabel = useFlowStore((s) => s.updateEdgeLabel)

  const commitLabel = useCallback(() => {
    updateEdgeLabel(id, draft.trim())
    setEditing(false)
  }, [draft, id, updateEdgeLabel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter') commitLabel()
      if (e.key === 'Escape') setEditing(false)
    },
    [commitLabel]
  )

  const edgeData = data as FlowEdgeData | undefined
  const edgeStyle = edgeData?.edgeStyle ?? 'solid'
  const baseColor = edgeData?.strokeColor ?? '#9ca3af'
  const strokeColor = selected ? '#3b82f6' : baseColor
  const displayLabel = label as string | undefined

  let strokeDasharray: string | undefined
  let strokeWidth = selected ? 3 : 2
  if (edgeStyle === 'dashed') strokeDasharray = '7 4'
  if (edgeStyle === 'thick') strokeWidth = selected ? 5 : 4

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={20}
        style={{
          strokeDasharray,
          strokeWidth,
          stroke: strokeColor,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setDraft((label as string) ?? '')
            setEditing(true)
          }}
        >
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={handleKeyDown}
              placeholder="标签…"
              className="text-xs px-2 py-0.5 rounded border border-blue-400 bg-white shadow-sm outline-none w-28 text-center"
            />
          ) : displayLabel ? (
            <span className="text-xs px-2 py-0.5 rounded bg-white border border-gray-200 shadow-sm text-gray-700 cursor-pointer hover:border-blue-300">
              {displayLabel}
            </span>
          ) : (
            <span className="text-xs px-1 py-0.5 rounded text-gray-300 cursor-pointer hover:text-gray-400 hover:bg-white/80 select-none">
              ✎
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
