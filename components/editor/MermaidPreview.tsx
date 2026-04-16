'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'
import { useSvgEditorStore } from '@/lib/svgEditorStore'
import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface MermaidPreviewProps {
  code: string
  widthPx: number
}

export default function MermaidPreview({ code, widthPx }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const theme = useSvgEditorStore(s => s.theme)
  const look = useSvgEditorStore(s => s.look)
  const curveStyle = useGraphEditorStore(s => s.curveStyle)

  // 渲染 Mermaid SVG
  useEffect(() => {
    if (!code.trim()) {
      setSvg('')
      setError('')
      return
    }

    // 去掉行内注释（%% shape-name），Mermaid 不支持行内注释
    const cleanCode = code.replace(/\s*%%\s*\S+\s*$/gm, '')

    let mounted = true

    ;(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme as any,
          flowchart: { curve: curveStyle },
          ...(look !== 'classic' ? { look } as any : {}),
        } as any)

        const id = `preview-${Date.now()}`
        await mermaid.parse(cleanCode)
        const { svg: rendered } = await mermaid.render(id, cleanCode)

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

  // 平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
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
  }, [isPanning, panStart, viewTransform])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // 缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
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
  }, [viewTransform])

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

  // 导出 PNG
  const handleExportPNG = useCallback(async () => {
    if (!containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return

    try {
      const canvas = document.createElement('canvas')
      const bbox = svgEl.getBBox()
      canvas.width = bbox.width
      canvas.height = bbox.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const svgData = new XMLSerializer().serializeToString(svgEl)
      const img = new Image()
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)

        canvas.toBlob((blob) => {
          if (!blob) return
          const link = document.createElement('a')
          link.download = `mermaid-${Date.now()}.png`
          link.href = URL.createObjectURL(blob)
          link.click()
          URL.revokeObjectURL(link.href)
        })
      }

      img.src = url
    } catch (err) {
      console.error('导出 PNG 失败:', err)
    }
  }, [])

  // 导出 SVG
  const handleExportSVG = useCallback(() => {
    if (!containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return

    try {
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `mermaid-${Date.now()}.svg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('导出 SVG 失败:', err)
    }
  }, [])

  if (error) {
    return (
      <div
        style={{ width: widthPx }}
        className="relative h-full flex items-center justify-center bg-gray-50 text-red-600 p-4 border-r"
      >
        <div>
          <div className="font-semibold mb-2">渲染错误</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!svg) {
    return (
      <div
        style={{ width: widthPx }}
        className="relative h-full flex items-center justify-center bg-gray-50 text-gray-400 border-r"
      >
        代码预览区（只读）
      </div>
    )
  }

  return (
    <div
      style={{ width: widthPx }}
      className="relative h-full flex flex-col bg-white border-r"
    >
      {/* 标题栏 + 导出按钮 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
        <div className="text-xs font-semibold text-gray-700">渲染区</div>
        <button
          onClick={handleExportPNG}
          className="px-4 py-2 bg-purple-50 border border-purple-300 text-purple-700 rounded text-sm hover:bg-purple-100 transition-colors"
          title="导出为 PNG"
        >
          导出 PNG
        </button>
        <button
          onClick={handleExportSVG}
          className="px-4 py-2 bg-indigo-50 border border-indigo-300 text-indigo-700 rounded text-sm hover:bg-indigo-100 transition-colors"
          title="导出为 SVG"
        >
          导出 SVG
        </button>
      </div>

      {/* SVG 内容区 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* SVG 内容 */}
        <div
          style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        {/* 缩放控件 */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="适应画布"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
