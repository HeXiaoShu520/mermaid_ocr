'use client'

import { useState, useEffect } from 'react'
import { Trash2, Shapes } from 'lucide-react'

interface SvgContextMenuProps {
  position: { x: number; y: number }
  nodeId?: string
  edgeIdx?: number
  onDelete: () => void
  onChangeShape?: (shape: string) => void
  onClose: () => void
}

const SHAPES = [
  { value: 'rectangle', label: '矩形' },
  { value: 'rounded', label: '圆角矩形' },
  { value: 'stadium', label: '体育场' },
  { value: 'subroutine', label: '子程序' },
  { value: 'cylinder', label: '圆柱' },
  { value: 'circle', label: '圆形' },
  { value: 'diamond', label: '菱形' },
  { value: 'hexagon', label: '六边形' },
  { value: 'parallelogram', label: '平行四边形' },
  { value: 'trapezoid', label: '梯形' },
]

export default function SvgContextMenu({ position, nodeId, edgeIdx, onDelete, onChangeShape, onClose }: SvgContextMenuProps) {
  const [showShapes, setShowShapes] = useState(false)

  useEffect(() => {
    const handleClick = () => onClose()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onClose])

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {nodeId && onChangeShape && (
        <div className="relative">
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => setShowShapes(!showShapes)}
          >
            <Shapes size={16} />
            更改形状
          </button>
          {showShapes && (
            <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px]">
              {SHAPES.map((shape) => (
                <button
                  key={shape.value}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  onClick={() => {
                    onChangeShape(shape.value)
                    onClose()
                  }}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
        onClick={() => {
          onDelete()
          onClose()
        }}
      >
        <Trash2 size={16} />
        删除
      </button>
    </div>
  )
}
