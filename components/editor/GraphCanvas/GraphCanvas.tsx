'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useGraphEditorStore } from '@/lib/graphEditorStore'

/** 形状 → 英文前缀映射 */
const shapePrefix: Record<string, string> = {
  rectangle: 'rect',
  rounded: 'round',
  stadium: 'stadium',
  circle: 'circle',
  diamond: 'diamond',
  hexagon: 'hex',
  parallelogram: 'para',
  'parallelogram-alt': 'para',
  trapezoid: 'trap',
  'trapezoid-alt': 'trap',
  cylinder: 'cyl',
  cylindrical: 'cyl',
  subroutine: 'sub',
  triangle: 'tri',
  text: 'text',
  comment: 'comment',
  hourglass: 'hglass',
  flag: 'flag',
  cloud: 'cloud',
  'h-cyl': 'hcyl',
  'lin-cyl': 'lcyl',
  'tag-rect': 'tagrect',
  'sl-rect': 'slrect',
  'bow-rect': 'bowrect',
  'notch-pent': 'npent',
  'curv-trap': 'ctrap',
  delay: 'delay',
  bolt: 'bolt',
  doc: 'doc',
  'lin-doc': 'ldoc',
  'st-doc': 'stdoc',
  'tag-doc': 'tdoc',
  fork: 'fork',
  brace: 'brace',
  'brace-r': 'bracer',
  braces: 'braces',
  'win-pane': 'wpane',
  ellipse: 'ellipse',
}

/** 根据形状和已有节点生成唯一 ID */
function generateNodeId(shape: string, existingNodes: { id: string }[]): string {
  const prefix = shapePrefix[shape] || shape.replace(/[^a-zA-Z]/g, '')
  let i = 1
  while (existingNodes.some(n => n.id === `${prefix}${i}`)) {
    i++
  }
  return `${prefix}${i}`
}
import GraphNode from './GraphNode'
import GraphEdge, { EdgeMarkerDefs } from './GraphEdge'
import GraphContextMenu from './GraphContextMenu'
import NodeEditor from './NodeEditor'
import EdgeEditor from './EdgeEditor'
import Subgraph from './Subgraph'

interface GraphCanvasProps {
  // 空，所有状态从 store 获取
}

export default function GraphCanvas({}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    nodes,
    edges,
    subgraphs,
    viewTransform,
    setViewTransform,
    moveNode,
    showGrid,
    connecting,
    updateConnectionMouse,
    endConnection,
    cancelConnection,
    clearSelection,
    pendingAddShape,
    setPendingAddShape,
    addNode,
    selectedEdgeId,
    selectedNodeIds,
    removeEdge,
    removeNode,
  } = useGraphEditorStore()

  // ─── Pan and Zoom ───

  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isBoxSelecting, setIsBoxSelecting] = useState(false)
  const [boxStart, setBoxStart] = useState({ x: 0, y: 0 })
  const [boxEnd, setBoxEnd] = useState({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 检查是否点击的是画布或 Overlay 层（不是节点/边）
    const target = e.target as HTMLElement
    const isCanvasOrOverlay = target === e.currentTarget || target.classList.contains('graph-overlay')

    if (!isCanvasOrOverlay) {
      return
    }

    // 如果有待添加的形状，开始框选
    if (pendingAddShape && e.button === 0) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
        setIsBoxSelecting(true)
        setBoxStart({ x, y })
        setBoxEnd({ x, y })
        e.preventDefault()
        return
      }
    }

    // 左键、中键、右键都可以平移
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y })
      e.preventDefault()
    }
  }, [viewTransform, pendingAddShape])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewTransform({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
        scale: viewTransform.scale,
      })
    }

    // 框选中
    if (isBoxSelecting) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
        setBoxEnd({ x, y })
      }
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
  }, [isPanning, panStart, viewTransform, setViewTransform, connecting, updateConnectionMouse, isBoxSelecting])

  const handleMouseUp = useCallback(() => {
    if (isBoxSelecting) {
      // 创建节点
      const width = Math.abs(boxEnd.x - boxStart.x)
      const height = Math.abs(boxEnd.y - boxStart.y)
      const x = Math.min(boxStart.x, boxEnd.x)
      const y = Math.min(boxStart.y, boxEnd.y)

      if (width > 10 && height > 10) {
        const nodeId = generateNodeId(pendingAddShape || 'rectangle', nodes)
        const newNode = {
          id: nodeId,
          label: nodeId,
          shape: pendingAddShape as any,
          x,
          y,
          width,
          height,
        }
        addNode(newNode)
      }

      setIsBoxSelecting(false)
      setPendingAddShape(null)
    }

    setIsPanning(false)
  }, [isBoxSelecting, boxStart, boxEnd, pendingAddShape, addNode, setPendingAddShape])

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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ─── Node Drag Handlers ───

  const handleNodeDragStart = useCallback((nodeId: string) => {
    // 可以在这里记录初始位置用于撤销
  }, [])

  const handleNodeDragMove = useCallback((nodeId: string, newX: number, newY: number) => {
    // 直接设置新位置，而不是增量
    moveNode(nodeId, newX, newY)
  }, [moveNode])

  const handleNodeDragEnd = useCallback((nodeId: string) => {
    // 拖拽结束
  }, [])

  // ─── Canvas Click (取消连线或清除选择或添加节点) ───

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // 检查是否点击的是画布或 Overlay 层（不是节点/边）
    const target = e.target as HTMLElement
    const isCanvasOrOverlay = target === e.currentTarget || target.classList.contains('graph-overlay')

    if (!isCanvasOrOverlay) return

    if (connecting) {
      cancelConnection()
    } else if (pendingAddShape) {
      // 添加新节点
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale

        const nodeId = generateNodeId(pendingAddShape || 'rectangle', nodes)
        const newNode = {
          id: nodeId,
          label: nodeId,
          shape: pendingAddShape as any,
          x: x - 60, // 居中
          y: y - 20,
          width: 120,
          height: 40,
        }

        addNode(newNode)
        setPendingAddShape(null)
      }
    } else {
      clearSelection()
    }
  }, [connecting, cancelConnection, clearSelection, pendingAddShape, setPendingAddShape, addNode, viewTransform])

  // ─── Handle 连线完成 ───
  const handleNodeClick = useCallback((nodeId: string) => {
    if (connecting && connecting.sourceId !== nodeId) {
      endConnection(nodeId)
    }
  }, [connecting, endConnection])

  // ─── ESC 取消连线 & Delete 删除 ───

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connecting) {
        cancelConnection()
      }

      // Delete 或 Backspace 删除选中的节点或边
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId)
        }
        if (selectedNodeIds.size > 0) {
          selectedNodeIds.forEach(nodeId => removeNode(nodeId))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [connecting, cancelConnection, selectedEdgeId, selectedNodeIds, removeEdge, removeNode])

  // ─── Drag and Drop ───

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const shape = e.dataTransfer.getData('application/shape')
    if (!shape) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
      const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale

      const nodeId = generateNodeId(shape || 'rectangle', nodes)
      const newNode = {
        id: nodeId,
        label: nodeId,
        shape: shape as any,
        x: x - 60,
        y: y - 20,
        width: 120,
        height: 40,
      }

      addNode(newNode)
    }
  }, [viewTransform, addNode])

  // ─── Render ───

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-white"
      style={{
        backgroundImage: showGrid
          ? 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)'
          : undefined,
        backgroundSize: showGrid ? '20px 20px' : undefined,
        cursor: isPanning ? 'grabbing' : (connecting || pendingAddShape || isBoxSelecting) ? 'crosshair' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Overlay 层 */}
      <div
        className="graph-overlay"
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
          className="graph-overlay"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <EdgeMarkerDefs />
          {edges.map(edge => {
            // 计算平行边的索引和总数（同一对节点间的多条边）
            const pairKey = [edge.source, edge.target].sort().join('|')
            const siblings = edges.filter(e => [e.source, e.target].sort().join('|') === pairKey)
            const parallelCount = siblings.length
            const parallelIndex = siblings.indexOf(edge)
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                nodes={nodes}
                parallelIndex={parallelCount > 1 ? parallelIndex : 0}
                parallelCount={parallelCount > 1 ? parallelCount : 1}
              />
            )
          })}

          {/* 临时连线 */}
          {connecting && (() => {
            const fromNode = nodes.find(n => n.id === connecting.sourceId)
            if (!fromNode) return null
            const x1 = fromNode.x + fromNode.width / 2
            const y1 = fromNode.y + fromNode.height / 2
            return (
              <line
                x1={x1}
                y1={y1}
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

        {/* Subgraphs */}
        {subgraphs.map(sg => (
          <Subgraph key={sg.id} subgraph={sg} nodes={nodes} viewTransform={viewTransform} />
        ))}

        {/* Nodes */}
        {nodes.map(node => (
          <GraphNode
            key={node.id}
            node={node}
            viewTransform={viewTransform}
            onDragStart={handleNodeDragStart}
            onDragMove={handleNodeDragMove}
            onDragEnd={handleNodeDragEnd}
          />
        ))}

        {/* 框选矩形 */}
        {isBoxSelecting && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(boxStart.x, boxEnd.x),
              top: Math.min(boxStart.y, boxEnd.y),
              width: Math.abs(boxEnd.x - boxStart.x),
              height: Math.abs(boxEnd.y - boxStart.y),
              border: '2px dashed #3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* 右键菜单 */}
      <GraphContextMenu />

      {/* 编辑器 */}
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
        <NodeEditor />
        <EdgeEditor />
      </div>
    </div>
  )
}
