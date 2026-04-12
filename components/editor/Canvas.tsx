'use client'

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import { useFlowStore, type FlowNodeData, type NodeShape } from '@/lib/flowStore'
import { FlowNode } from './NodeTypes/FlowNode'
import { FlowEdge } from './EdgeTypes/FlowEdge'

const nodeTypes = { flowNode: FlowNode }
const edgeTypes = { flowEdge: FlowEdge }

interface CanvasInnerProps {
  onOpenPalette?: () => void
}

function CanvasInner({ onOpenPalette }: CanvasInnerProps) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, addNodeAtPosition,
    undo, redo, duplicateSelected, copySelected, pasteClipboard,
    pushHistory, assignToSubgraph,
    drawingShape, setDrawingShape,
    panMode, setPanMode,
    showGrid,
  } = useFlowStore()
  const { screenToFlowPosition } = useReactFlow()

  // ── Draw-mode state ─────────────────────────────────────────────────────────
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // Escape → cancel draw mode or pan mode
      if (e.key === 'Escape') {
        if (drawingShape) setDrawingShape(null)
        if (panMode) setPanMode(false)
        setDragStart(null)
        setDragCurrent(null)
        return
      }

      // N → add node (when not typing)
      if (!isTyping && (e.key === 'n' || e.key === 'N')) {
        addNode()
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+Z → undo
      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }

      // Ctrl+Shift+Z or Ctrl+Y → redo
      if ((ctrl && e.shiftKey && e.key === 'z') || (ctrl && e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }

      // Ctrl+D → duplicate selected
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
        return
      }

      // Ctrl+C → copy selected
      if (ctrl && !e.shiftKey && e.key === 'c') {
        e.preventDefault()
        copySelected()
        return
      }

      // Ctrl+V → paste clipboard
      if (ctrl && !e.shiftKey && e.key === 'v') {
        e.preventDefault()
        pasteClipboard()
        return
      }

      // Ctrl+K / Meta+K → open command palette
      if (ctrl && e.key === 'k') {
        e.preventDefault()
        onOpenPalette?.()
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [addNode, undo, redo, duplicateSelected, copySelected, pasteClipboard, setDrawingShape, setPanMode, onOpenPalette])

  // ── Drag-and-drop from shape palette ────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/shape')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const shape = e.dataTransfer.getData('application/shape') as NodeShape
      if (!shape) return
      e.preventDefault()
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNodeAtPosition(position, shape)
      setDrawingShape(null)
    },
    [screenToFlowPosition, addNodeAtPosition, setDrawingShape],
  )

  // ── Double-click on blank canvas → add node at cursor ─────────────────────
  const handleDoubleClick = (e: MouseEvent) => {
    if (drawingShape) return
    const target = e.target as Element
    if (target.closest('.react-flow__node')) return
    if (target.closest('.react-flow__edge')) return
    if (target.closest('.react-flow__controls')) return
    if (target.closest('.react-flow__minimap')) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addNodeAtPosition(position)
  }

  // ── Draw-mode mouse handlers ────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!drawingShape) return
      const target = e.target as Element
      if (target.closest('.react-flow__node')) return
      if (target.closest('.react-flow__controls')) return
      if (target.closest('.react-flow__minimap')) return
      e.preventDefault()
      setDragStart({ x: e.clientX, y: e.clientY })
      setDragCurrent({ x: e.clientX, y: e.clientY })
    },
    [drawingShape],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStart) return
      setDragCurrent({ x: e.clientX, y: e.clientY })
    },
    [dragStart],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragStart || !drawingShape) return
      const end = { x: e.clientX, y: e.clientY }

      const dx = Math.abs(end.x - dragStart.x)
      const dy = Math.abs(end.y - dragStart.y)

      const flowStart = screenToFlowPosition({ x: dragStart.x, y: dragStart.y })
      const flowEnd = screenToFlowPosition({ x: end.x, y: end.y })

      if (dx < 20 && dy < 20) {
        // Single click — create default-sized node
        addNodeAtPosition(flowStart, drawingShape)
      } else {
        const x = Math.min(flowStart.x, flowEnd.x)
        const y = Math.min(flowStart.y, flowEnd.y)
        const w = Math.abs(flowEnd.x - flowStart.x)
        const h = Math.abs(flowEnd.y - flowStart.y)
        addNodeAtPosition({ x, y }, drawingShape, w, h)
      }

      setDragStart(null)
      setDragCurrent(null)
      setDrawingShape(null)
    },
    [dragStart, drawingShape, screenToFlowPosition, addNodeAtPosition, setDrawingShape],
  )

  // ── Push history after drag ends; auto-assign/unassign group membership ─────
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent, draggedNode: Node<FlowNodeData>) => {
      pushHistory()
      const allNodes = useFlowStore.getState().nodes

      // Group dragged onto free nodes — auto-assign nodes now inside it
      if (draggedNode.data.isSubgraph) {
        const sgW = typeof draggedNode.style?.width === 'number' ? draggedNode.style.width : 320
        const sgH = typeof draggedNode.style?.height === 'number' ? draggedNode.style.height : 220
        const freeNodes = allNodes.filter((n) => !n.data.isSubgraph && !n.parentId)
        const toAssign = freeNodes.filter((n) => {
          const nw = n.measured?.width ?? 150
          const nh = n.measured?.height ?? 60
          const cx = n.position.x + nw / 2
          const cy = n.position.y + nh / 2
          return (
            cx >= draggedNode.position.x && cx <= draggedNode.position.x + sgW &&
            cy >= draggedNode.position.y && cy <= draggedNode.position.y + sgH
          )
        })
        if (toAssign.length > 0) assignToSubgraph(toAssign.map((n) => n.id), draggedNode.id)
        return
      }

      const w = draggedNode.measured?.width ?? 150
      const h = draggedNode.measured?.height ?? 60

      // Node already in a group — check if it was dragged outside
      if (draggedNode.parentId) {
        const parent = allNodes.find((n) => n.id === draggedNode.parentId)
        if (parent) {
          const sgW = typeof parent.style?.width === 'number' ? parent.style.width : 320
          const sgH = typeof parent.style?.height === 'number' ? parent.style.height : 220
          const cx = draggedNode.position.x + w / 2
          const cy = draggedNode.position.y + h / 2
          if (cx < 0 || cx > sgW || cy < 0 || cy > sgH) {
            assignToSubgraph([draggedNode.id], null)
          }
        }
        return
      }

      // Free node — check if dropped inside a group
      const subgraphs = allNodes.filter((n) => n.data.isSubgraph)
      if (subgraphs.length === 0) return
      const cx = draggedNode.position.x + w / 2
      const cy = draggedNode.position.y + h / 2
      for (const sg of subgraphs) {
        const sgW = typeof sg.style?.width === 'number' ? sg.style.width : 320
        const sgH = typeof sg.style?.height === 'number' ? sg.style.height : 220
        if (cx >= sg.position.x && cx <= sg.position.x + sgW &&
            cy >= sg.position.y && cy <= sg.position.y + sgH) {
          assignToSubgraph([draggedNode.id], sg.id)
          return
        }
      }
    },
    [pushHistory, assignToSubgraph]
  )

  const previewRect =
    dragStart && dragCurrent
      ? {
          left: Math.min(dragStart.x, dragCurrent.x),
          top: Math.min(dragStart.y, dragCurrent.y),
          width: Math.abs(dragCurrent.x - dragStart.x),
          height: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null

  // Offset preview rect relative to wrapper element
  // eslint-disable-next-line react-hooks/refs
  const wrapperRect = wrapperRef.current?.getBoundingClientRect()
  const relativePreview = previewRect && wrapperRect
    ? {
        left: previewRect.left - wrapperRect.left,
        top: previewRect.top - wrapperRect.top,
        width: previewRect.width,
        height: previewRect.height,
      }
    : null

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-full relative ${drawingShape ? 'cursor-crosshair' : panMode ? 'cursor-grab' : ''}`}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        panOnDrag={drawingShape ? false : panMode ? [0, 1, 2] : true}
        selectionOnDrag={!drawingShape && !panMode}
        multiSelectionKeyCode={['Shift', 'Control']}
        nodesDraggable={!drawingShape && !panMode}
        nodesConnectable={!panMode}
        elementsSelectable={!panMode}
        style={{ background: 'var(--neu-bg)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color={showGrid ? "#d1d9e6" : "transparent"} />
      </ReactFlow>

      {relativePreview && relativePreview.width > 4 && relativePreview.height > 4 && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-50/30 rounded"
          style={relativePreview}
        />
      )}

      {nodes.length === 0 && !drawingShape && !panMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-lg font-medium">画布为空</p>
            <p className="text-sm mt-1">
                选择上方的形状并拖动绘制，双击画布，或按{' '}
              <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-xs font-mono">N</kbd>{' '}
              添加节点。在空白画布上拖动可选择多个节点。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function Canvas({ onOpenPalette }: { onOpenPalette?: () => void }) {
  return <CanvasInner onOpenPalette={onOpenPalette} />
}
