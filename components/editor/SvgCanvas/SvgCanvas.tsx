'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'
import { useSvgEditorStore } from '@/lib/svgEditorStore'
import { scanSvgElements } from '@/lib/svgElementMapper'
import { updateNodeLabel, deleteNode, addNode, addEdge, getDiagramType } from '@/lib/mermaidCodeEditor'
import OverlayNode from './OverlayNode'
import OverlayEdge, { EdgeMarkerDefs } from './OverlayEdge'
import SvgZoomControls from './SvgZoomControls'
import SvgNodeEditor from './SvgNodeEditor'
import SvgContextMenu from './SvgContextMenu'

interface SvgCanvasProps {
  code: string
  onCodeChange: (code: string) => void
}

export default function SvgCanvas({ code, onCodeChange }: SvgCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  const {
    nodes,
    edges,
    viewTransform,
    setViewTransform,
    moveNode,
    direction,
    theme,
    look,
    curveStyle,
    showGrid,
    editingNodeId,
    setEditingNode,
    contextMenu,
    setContextMenu,
    codeHistory,
    codeFuture,
    pushHistory,
    undo,
    redo,
    connecting,
    updateConnectionMouse,
    endConnection,
    cancelConnection,
    pendingAddShape,
    setPendingAddShape,
    clearSelection,
    initFromScan,
    addEdgeState,
  } = useSvgEditorStore()

  // ─── Render Mermaid SVG (背景层) ───

  useEffect(() => {
    if (!code.trim()) {
      setSvg('')
      setError('')
      return
    }

    let mounted = true

    ;(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          logLevel: 'error',
          theme: theme as any,
          flowchart: { curve: curveStyle },
          ...(look !== 'classic' ? { look } as any : {}),
          sequence: look === 'handDrawn' ? { theme: 'hand' } as any : {},
        } as any)

        const id = `svg-canvas-${Date.now()}`
        await mermaid.parse(code)
        const { svg: rendered } = await mermaid.render(id, code)

        if (mounted) {
          setSvg(rendered)
          setError('')
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Mermaid 语法错误')
          setSvg('')
        }
      }
    })()

    return () => { mounted = false }
  }, [code, theme, look, curveStyle])

  // ─── Scan SVG and Init State ───

  useEffect(() => {
    if (!svg || !containerRef.current) return

    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return

    const { nodes: scannedNodes, edges: scannedEdges, subgraphs } = scanSvgElements(svgEl)
    initFromScan(scannedNodes, scannedEdges, subgraphs)
  }, [svg, initFromScan])

  // ─── Pan and Zoom ───

  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) { // 中键或右键平移
      setIsPanning(true)
      setPanStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y })
      e.preventDefault()
    }
  }, [viewTransform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewTransform({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
        scale: viewTransform.scale,
      })
    }

    // 更新连线鼠标位置
    if (connecting) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
        updateConnectionMouse(x, y)
      }
    }
  }, [isPanning, panStart, viewTransform, setViewTransform, connecting, updateConnectionMouse])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const newScale = Math.max(0.1, Math.min(4, viewTransform.scale * delta))
    const ratio = newScale / viewTransform.scale
    setViewTransform({
      x: cx - (cx - viewTransform.x) * ratio,
      y: cy - (cy - viewTransform.y) * ratio,
      scale: newScale,
    })
  }, [viewTransform, setViewTransform])

  // 使用原生事件监听器来支持 preventDefault
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ─── Node Drag Handlers ───

  const handleNodeDragStart = useCallback((nodeId: string, startX: number, startY: number) => {
    // 可以在这里记录初始位置用于撤销
  }, [])

  const handleNodeDragMove = useCallback((nodeId: string, dx: number, dy: number) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    moveNode(nodeId, node.x + dx, node.y + dy)
  }, [nodes, moveNode])

  const handleNodeDragEnd = useCallback((nodeId: string) => {
    // 拖拽结束，可以触发代码同步（如果需要）
  }, [])

  // ─── Canvas Click (添加节点 / 取消连线) ───

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return // 只响应空白区域点击

    if (connecting) {
      cancelConnection()
    } else if (pendingAddShape) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
      const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale

      pushHistory(code)
      const newCode = addNode(code, '新节点', pendingAddShape)
      onCodeChange(newCode)
      setPendingAddShape(null)
    } else {
      clearSelection()
    }
  }, [connecting, pendingAddShape, viewTransform, code, onCodeChange, pushHistory, cancelConnection, setPendingAddShape, clearSelection])

  // ─── Edit Handlers ───

  const handleSaveLabel = useCallback((nodeId: string, newLabel: string) => {
    pushHistory(code)
    const newCode = updateNodeLabel(code, nodeId, newLabel)
    onCodeChange(newCode)
    setEditingNode(null)
  }, [code, onCodeChange, pushHistory, setEditingNode])

  const handleDeleteNode = useCallback(() => {
    if (!contextMenu?.nodeId) return
    pushHistory(code)
    const newCode = deleteNode(code, contextMenu.nodeId)
    onCodeChange(newCode)
    clearSelection()
    setContextMenu(null)
  }, [code, contextMenu, onCodeChange, pushHistory, clearSelection, setContextMenu])

  const handleUndo = useCallback(() => {
    const prevCode = undo()
    if (prevCode) onCodeChange(prevCode)
  }, [undo, onCodeChange])

  const handleRedo = useCallback(() => {
    const nextCode = redo()
    if (nextCode) onCodeChange(nextCode)
  }, [redo, onCodeChange])

  // ─── ESC 取消连线 ───

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connecting) {
        cancelConnection()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [connecting, cancelConnection])

  // ─── Render ───

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-red-50">
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-white"
      style={{
        backgroundImage: showGrid
          ? 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)'
          : undefined,
        backgroundSize: showGrid ? '20px 20px' : undefined,
        cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : pendingAddShape ? 'copy' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* Layer 1: Mermaid SVG 背景（只读，半透明） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
          transformOrigin: '0 0',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Layer 2: Overlay 交互层 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        {/* Edges */}
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'auto',
          }}
        >
          <EdgeMarkerDefs />
          {edges.map(edge => (
            <OverlayEdge key={edge.id} edge={edge} nodes={nodes} />
          ))}

          {/* 临时连线 */}
          {connecting && (() => {
            const fromNode = nodes.find(n => n.id === connecting.sourceId)
            if (!fromNode) return null
            return (
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={connecting.mousePos.x}
                y2={connecting.mousePos.y}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5,5"
                pointerEvents="none"
              />
            )
          })()}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <OverlayNode
            key={node.id}
            node={node}
            viewTransform={viewTransform}
            onDragStart={handleNodeDragStart}
            onDragMove={handleNodeDragMove}
            onDragEnd={handleNodeDragEnd}
          />
        ))}
      </div>

      {/* Layer 3: UI 层 */}
      <SvgZoomControls
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={codeHistory.length > 0}
        canRedo={codeFuture.length > 0}
      />

      {editingNodeId && (() => {
        const node = nodes.find(n => n.id === editingNodeId)
        if (!node) return null
        return (
          <SvgNodeEditor
            nodeId={editingNodeId}
            initialLabel={node.label}
            position={{
              x: viewTransform.x + node.x * viewTransform.scale,
              y: viewTransform.y + node.y * viewTransform.scale,
            }}
            onSave={handleSaveLabel}
            onCancel={() => setEditingNode(null)}
          />
        )
      })()}

      {contextMenu && (
        <SvgContextMenu
          position={contextMenu}
          nodeId={contextMenu.nodeId}
          edgeIdx={contextMenu.edgeId ? 0 : undefined}
          onDelete={handleDeleteNode}
          onChangeShape={undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
