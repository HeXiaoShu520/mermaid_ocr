'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'
import { useSvgEditorStore } from '@/lib/svgEditorStore'
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

  // 渲染完成后居中显示
  useEffect(() => {
    if (!svg || !containerRef.current) return
    // 等 DOM 更新后测量
    requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const svgEl = container.querySelector('svg')
      if (!svgEl) return
      const cW = container.clientWidth
      const cH = container.clientHeight
      const sW = svgEl.clientWidth || svgEl.getBoundingClientRect().width
      const sH = svgEl.clientHeight || svgEl.getBoundingClientRect().height
      if (sW === 0 || sH === 0) return
      // fit：以宽高中较小的缩放比为准，留 20px 边距
      const scale = Math.min((cW - 20) / sW, (cH - 32) / sH)
      const x = (cW - sW * scale) / 2
      // 垂直靠上，留 16px 上边距
      const y = 16
      setViewTransform({ x, y, scale })
    })
  }, [svg])

  // 渲染 Mermaid SVG
  useEffect(() => {
    if (!code.trim()) {
      setSvg('')
      setError('')
      return
    }

    // 去掉行内注释（%% shape-name），Mermaid 不支持行内注释
    let cleanCode = code.replace(/\s*%%\s*\S+\s*$/gm, '')

    // treeView-beta：把 id[label] 转成 id["label"]，Mermaid 只认带引号的格式
    if (/^treeView-beta/i.test(cleanCode.trim())) {
      cleanCode = cleanCode.replace(/(\w+)\[([^\]"]+)\]/g, '$1["$2"]')
    }

    let mounted = true

    ;(async () => {
      const id = `preview-${Date.now()}`
      try {
        mermaid.initialize({
          startOnLoad: false,
          logLevel: 'error',
          theme: theme as any,
          ...(look !== 'classic' ? { look } as any : {}),
        } as any)

        await mermaid.parse(cleanCode)
        const { svg: rendered } = await mermaid.render(id, cleanCode)

        if (mounted) {
          setSvg(rendered)
          setError('')
        }
      } catch (err: any) {
        if (mounted) {
          const msg = err?.message || ''
          // mermaid block-beta 已知 bug：render 内部 JSON.stringify DOM 节点
          if (msg.includes('circular structure') || msg.includes('Converting circular')) {
            // 尝试从临时容器取出已生成的 SVG（mermaid 会创建 id 对应的 div）
            const tmp = document.getElementById(id)
            const svgEl = tmp?.querySelector('svg')
            if (svgEl) {
              setSvg(svgEl.outerHTML)
              setError('')
              // 清理临时节点
              tmp?.remove()
            } else {
              setError('渲染引擎内部错误（block-beta 已知问题），请尝试简化图表')
            }
          } else {
            setError(msg || 'Mermaid 语法错误')
            setSvg('')
          }
        }
      }
    })()

    return () => { mounted = false }
  }, [code, theme, look])

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
    const container = containerRef.current
    if (!container) { setViewTransform({ x: 0, y: 0, scale: 1 }); return }
    const svgEl = container.querySelector('svg')
    if (!svgEl) { setViewTransform({ x: 0, y: 0, scale: 1 }); return }
    const cW = container.clientWidth
    const cH = container.clientHeight
    const sW = svgEl.clientWidth || svgEl.getBoundingClientRect().width
    const sH = svgEl.clientHeight || svgEl.getBoundingClientRect().height
    if (sW === 0 || sH === 0) { setViewTransform({ x: 0, y: 0, scale: 1 }); return }
    const scale = Math.min((cW - 20) / sW, (cH - 32) / sH)
    const x = (cW - sW * scale) / 2
    const y = 16
    setViewTransform({ x, y, scale })
  }

  // 导出 PNG
  const handleExportPNG = useCallback(async () => {
    if (!containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return

    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement
      // 移除外部引用，内联所有样式
      cloned.querySelectorAll('foreignObject').forEach(el => el.remove())
      cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

      const bbox = svgEl.getBBox()
      const width = Math.ceil(bbox.width + bbox.x * 2) || svgEl.clientWidth || 800
      const height = Math.ceil(bbox.height + bbox.y * 2) || svgEl.clientHeight || 600
      cloned.setAttribute('width', String(width))
      cloned.setAttribute('height', String(height))

      const svgData = new XMLSerializer().serializeToString(cloned)
      // 使用 data URL 而非 blob URL，避免 tainted canvas
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)

      const canvas = document.createElement('canvas')
      const scale = 2 // 2x 清晰度
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (!blob) return
          const link = document.createElement('a')
          link.download = `mermaid-${Date.now()}.png`
          link.href = URL.createObjectURL(blob)
          link.click()
          URL.revokeObjectURL(link.href)
        })
      }

      img.src = dataUrl
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
        className="relative h-full flex flex-col bg-white border-r"
      >
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
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div style={{ fontSize: 72, lineHeight: 1 }}>🖼️</div>
          <div className="text-center">
            <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>渲染区</div>
          </div>
        </div>
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
