'use client'

import { useSvgEditorStore } from '@/lib/svgEditorStore'

interface SvgHandlesProps {
  nodeId: string
  nodeElement: SVGGElement
  svgRect: DOMRect
  visible: boolean
}

type HandlePosition = 'top' | 'bottom' | 'left' | 'right'

export default function SvgHandles({ nodeId, nodeElement, svgRect, visible }: SvgHandlesProps) {
  const startConnection = useSvgEditorStore(s => s.startConnection)
  const viewTransform = useSvgEditorStore(s => s.viewTransform)

  if (!visible) return null

  const rect = nodeElement.getBoundingClientRect()

  // 计算 Handle 位置（相对于 SVG 容器）
  const handles: Array<{ pos: HandlePosition; x: number; y: number }> = [
    {
      pos: 'top',
      x: rect.left + rect.width / 2 - svgRect.left,
      y: rect.top - svgRect.top,
    },
    {
      pos: 'bottom',
      x: rect.left + rect.width / 2 - svgRect.left,
      y: rect.bottom - svgRect.top,
    },
    {
      pos: 'left',
      x: rect.left - svgRect.left,
      y: rect.top + rect.height / 2 - svgRect.top,
    },
    {
      pos: 'right',
      x: rect.right - svgRect.left,
      y: rect.top + rect.height / 2 - svgRect.top,
    },
  ]

  return (
    <>
      {handles.map((h) => (
        <div
          key={h.pos}
          className="absolute w-3 h-3 bg-blue-500 rounded-full cursor-crosshair border-2 border-white shadow-lg hover:scale-150 transition-transform z-[1000]"
          style={{
            left: h.x * viewTransform.scale + viewTransform.x - 6,
            top: h.y * viewTransform.scale + viewTransform.y - 6,
            transform: `scale(${1 / viewTransform.scale})`,
            transformOrigin: 'center',
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            startConnection(nodeId, h.pos)
          }}
          title={`连接点: ${h.pos}`}
        />
      ))}
    </>
  )
}
