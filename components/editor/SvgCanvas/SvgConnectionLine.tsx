'use client'

import { useEffect } from 'react'
import { useSvgEditorStore } from '@/lib/svgEditorStore'
import { extractNodeId } from '@/lib/svgElementMapper'

export default function SvgConnectionLine() {
  const connecting = useSvgEditorStore(s => s.connecting)
  const updateConnectionMouse = useSvgEditorStore(s => s.updateConnectionMouse)
  const viewTransform = useSvgEditorStore(s => s.viewTransform)

  useEffect(() => {
    if (!connecting) return

    const handleMouseMove = (e: MouseEvent) => {
      updateConnectionMouse(e.clientX, e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [connecting, updateConnectionMouse])

  if (!connecting) return null

  // 查找源节点元素
  const sourceNode = document.querySelector(`[data-node-id="${connecting.sourceId}"]`)
  if (!sourceNode) return null

  const sourceRect = sourceNode.getBoundingClientRect()
  const svgContainer = document.querySelector('.svg-canvas-container')
  if (!svgContainer) return null

  const containerRect = svgContainer.getBoundingClientRect()

  // 计算起点坐标（根据 handle 位置）
  let startX = 0, startY = 0
  switch (connecting.sourceHandle) {
    case 'top':
      startX = sourceRect.left + sourceRect.width / 2 - containerRect.left
      startY = sourceRect.top - containerRect.top
      break
    case 'bottom':
      startX = sourceRect.left + sourceRect.width / 2 - containerRect.left
      startY = sourceRect.bottom - containerRect.top
      break
    case 'left':
      startX = sourceRect.left - containerRect.left
      startY = sourceRect.top + sourceRect.height / 2 - containerRect.top
      break
    case 'right':
      startX = sourceRect.right - containerRect.left
      startY = sourceRect.top + sourceRect.height / 2 - containerRect.top
      break
  }

  // 应用视图变换
  startX = startX * viewTransform.scale + viewTransform.x
  startY = startY * viewTransform.scale + viewTransform.y

  // 终点坐标（鼠标位置）
  const endX = connecting.mousePos.x - containerRect.left
  const endY = connecting.mousePos.y - containerRect.top

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 999 }}
    >
      <defs>
        <marker
          id="arrowhead-temp"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
        </marker>
      </defs>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="5,5"
        markerEnd="url(#arrowhead-temp)"
      />
    </svg>
  )
}
