'use client'

import { useSvgEditorStore } from '@/lib/svgEditorStore'
import { ZoomIn, ZoomOut, Maximize2, Undo2, Redo2 } from 'lucide-react'

interface SvgZoomControlsProps {
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export default function SvgZoomControls({ onUndo, onRedo, canUndo, canRedo }: SvgZoomControlsProps) {
  const { viewTransform, setViewTransform } = useSvgEditorStore()

  const handleZoomIn = () => {
    const newScale = Math.min(4, viewTransform.scale * 1.2)
    setViewTransform({ ...viewTransform, scale: newScale })
  }

  const handleZoomOut = () => {
    const newScale = Math.max(0.1, viewTransform.scale / 1.2)
    setViewTransform({ ...viewTransform, scale: newScale })
  }

  const handleFitView = () => {
    setViewTransform({ x: 0, y: 0, scale: 1 })
  }

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
      <button
        onClick={handleZoomIn}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="放大 (Ctrl +)"
      >
        <ZoomIn size={20} />
      </button>
      <button
        onClick={handleZoomOut}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="缩小 (Ctrl -)"
      >
        <ZoomOut size={20} />
      </button>
      <button
        onClick={handleFitView}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="适应画布 (Ctrl 0)"
      >
        <Maximize2 size={20} />
      </button>
      <div className="h-px bg-gray-200 my-1" />
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="撤销 (Ctrl Z)"
      >
        <Undo2 size={20} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="重做 (Ctrl Y)"
      >
        <Redo2 size={20} />
      </button>
    </div>
  )
}
