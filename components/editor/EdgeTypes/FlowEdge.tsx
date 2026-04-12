'use client'

import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps, useStore } from '@xyflow/react'
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

// Calculate path from node center to nearest handle (for all diagrams)
function getCenterToHandlePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourceNode: any,
  targetNode: any
): [string, number, number] {
  // Get node dimensions
  const sourceWidth = sourceNode?.measured?.width ?? sourceNode?.width ?? 100
  const sourceHeight = sourceNode?.measured?.height ?? sourceNode?.height ?? 40
  const targetWidth = targetNode?.measured?.width ?? targetNode?.width ?? 100
  const targetHeight = targetNode?.measured?.height ?? targetNode?.height ?? 40

  // Calculate source center
  const sourceCenterX = sourceX + sourceWidth / 2
  const sourceCenterY = sourceY + sourceHeight / 2

  // Calculate target handle positions (top, bottom, left, right)
  const targetCenterX = targetX + targetWidth / 2
  const targetCenterY = targetY + targetHeight / 2

  const targetHandles = [
    { x: targetCenterX, y: targetY, name: 'top' },                    // top
    { x: targetCenterX, y: targetY + targetHeight, name: 'bottom' },  // bottom
    { x: targetX, y: targetCenterY, name: 'left' },                   // left
    { x: targetX + targetWidth, y: targetCenterY, name: 'right' },    // right
  ]

  // Find nearest handle to source center
  let nearestHandle = targetHandles[0]
  let minDistance = Infinity

  for (const handle of targetHandles) {
    const dx = handle.x - sourceCenterX
    const dy = handle.y - sourceCenterY
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < minDistance) {
      minDistance = distance
      nearestHandle = handle
    }
  }

  // Shorten the line slightly to account for arrow marker size (about 10px)
  const dx = nearestHandle.x - sourceCenterX
  const dy = nearestHandle.y - sourceCenterY
  const length = Math.sqrt(dx * dx + dy * dy)
  const arrowOffset = 10 // pixels to shorten for arrow

  let endX = nearestHandle.x
  let endY = nearestHandle.y

  if (length > arrowOffset) {
    const ratio = (length - arrowOffset) / length
    endX = sourceCenterX + dx * ratio
    endY = sourceCenterY + dy * ratio
  }

  // Create straight path from source center to adjusted end point
  const path = `M ${sourceCenterX},${sourceCenterY} L ${endX},${endY}`

  // Label position at midpoint
  const labelX = (sourceCenterX + endX) / 2
  const labelY = (sourceCenterY + endY) / 2

  return [path, labelX, labelY]
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
  source,
  target,
}: EdgeProps) {
  const curveStyle = useFlowStore((s) => s.curveStyle)

  // Normal handle-to-handle mode for all diagrams
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
