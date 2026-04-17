'use client'

import type { NodeShape, Direction, Theme, CurveStyle } from '@/lib/flowStore'

export function ShapeIcon({ shape, stroke = '#6b7280', fill = 'white' }: { shape: NodeShape; stroke?: string; fill?: string }) {
  const sw = 1.5
  switch (shape) {
    case 'rectangle':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'rounded':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={5} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'stadium':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={7} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'subroutine':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={2} y={3} width={20} height={10} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={5} y1={3} x2={5} y2={13} stroke={stroke} strokeWidth={0.8} /><line x1={19} y1={3} x2={19} y2={13} stroke={stroke} strokeWidth={0.8} /></svg>
    case 'cylinder':
      return <svg viewBox="0 0 20 20" className="w-5 h-5"><ellipse cx={10} cy={5} rx={7} ry={3} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={3} y1={5} x2={3} y2={15} stroke={stroke} strokeWidth={sw} /><line x1={17} y1={5} x2={17} y2={15} stroke={stroke} strokeWidth={sw} /><ellipse cx={10} cy={15} rx={7} ry={3} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'circle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx={8} cy={8} r={6} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'small-circle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx={8} cy={8} r={3} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'double-circle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx={8} cy={8} r={6} fill={fill} stroke={stroke} strokeWidth={sw} /><circle cx={8} cy={8} r={4} fill="none" stroke={stroke} strokeWidth={0.8} /></svg>
    case 'framed-circle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx={8} cy={8} r={6} fill={fill} stroke={stroke} strokeWidth={sw} /><circle cx={8} cy={8} r={3} fill={fill} stroke={stroke} strokeWidth={0.8} /></svg>
    case 'filled-circle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx={8} cy={8} r={5} fill={stroke} stroke={stroke} strokeWidth={sw} /></svg>
    case 'crossed-circle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><circle cx={8} cy={8} r={6} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={4} y1={4} x2={12} y2={12} stroke={stroke} strokeWidth={1} /><line x1={12} y1={4} x2={4} y2={12} stroke={stroke} strokeWidth={1} /></svg>
    case 'diamond':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="8,1 15,8 8,15 1,8" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'hexagon':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="7,2 17,2 23,8 17,14 7,14 1,8" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'triangle':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="8,2 15,14 1,14" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'parallelogram': case 'lean-right':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="5,2 23,2 19,14 1,14" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'parallelogram-alt': case 'lean-left':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="1,2 19,2 23,14 5,14" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'trapezoid':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="4,14 20,14 23,2 1,2" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'trapezoid-alt':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="1,14 23,14 20,2 4,2" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'asymmetric':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="1,2 19,2 23,8 19,14 1,14" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'hourglass':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="2,2 14,2 2,14 14,14" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'notch-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="1,2 22,2 22,14 1,14 1,10 4,10 4,6 1,6" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'lin-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={5} y1={2} x2={5} y2={14} stroke={stroke} strokeWidth={0.8} /></svg>
    case 'div-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={1} y1={10} x2={23} y2={10} stroke={stroke} strokeWidth={0.8} /></svg>
    case 'st-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={3} y={4} width={20} height={10} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /><rect x={1} y={2} width={20} height={10} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'tag-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /><polygon points="18,2 23,2 23,8" fill="none" stroke={stroke} strokeWidth={0.8} /></svg>
    case 'sl-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="1,5 23,2 23,14 1,14" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'notch-pent':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="4,2 20,2 23,6 23,14 1,14 1,6" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'flip-tri':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><polygon points="8,14 15,2 1,2" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'doc':
      return <svg viewBox="0 0 24 18" className="w-6 h-4"><path d="M2,2 L22,2 L22,14 C16,12 8,16 2,14 Z" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'lin-doc':
      return <svg viewBox="0 0 24 18" className="w-6 h-4"><path d="M2,2 L22,2 L22,14 C16,12 8,16 2,14 Z" fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={5} y1={2} x2={5} y2={13} stroke={stroke} strokeWidth={0.8} /></svg>
    case 'st-doc':
      return <svg viewBox="0 0 24 18" className="w-6 h-4"><path d="M4,4 L22,4 L22,16 C16,14 8,18 4,16 Z" fill={fill} stroke={stroke} strokeWidth={sw} /><path d="M2,2 L20,2 L20,14 C14,12 6,16 2,14 Z" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'tag-doc':
      return <svg viewBox="0 0 24 18" className="w-6 h-4"><path d="M2,2 L22,2 L22,14 C16,12 8,16 2,14 Z" fill={fill} stroke={stroke} strokeWidth={sw} /><polygon points="18,2 22,2 22,6" fill="none" stroke={stroke} strokeWidth={0.8} /></svg>
    case 'flag':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><path d="M1,2 C7,0 11,4 17,2 L23,2 L23,14 C17,16 13,12 7,14 L1,14 Z" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'bow-rect':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><path d="M4,2 L20,2 C22,2 22,8 20,8 C22,8 22,14 20,14 L4,14 C2,14 2,8 4,8 C2,8 2,2 4,2" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'delay':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><path d="M1,2 L18,2 C22,2 22,14 18,14 L1,14 Z" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'h-cyl':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><ellipse cx={5} cy={8} rx={3} ry={6} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={5} y1={2} x2={19} y2={2} stroke={stroke} strokeWidth={sw} /><line x1={5} y1={14} x2={19} y2={14} stroke={stroke} strokeWidth={sw} /><ellipse cx={19} cy={8} rx={3} ry={6} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'lin-cyl':
      return <svg viewBox="0 0 20 20" className="w-5 h-5"><ellipse cx={10} cy={5} rx={7} ry={3} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={3} y1={5} x2={3} y2={15} stroke={stroke} strokeWidth={sw} /><line x1={17} y1={5} x2={17} y2={15} stroke={stroke} strokeWidth={sw} /><ellipse cx={10} cy={15} rx={7} ry={3} fill={fill} stroke={stroke} strokeWidth={sw} /><ellipse cx={10} cy={8} rx={7} ry={2} fill="none" stroke={stroke} strokeWidth={0.6} /></svg>
    case 'curv-trap':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><path d="M4,2 L20,2 C22,8 22,8 20,14 L4,14 C2,8 2,8 4,2" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'win-pane':
      return <svg viewBox="0 0 16 16" className="w-4 h-4"><rect x={2} y={2} width={12} height={12} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={8} y1={2} x2={8} y2={14} stroke={stroke} strokeWidth={0.8} /><line x1={2} y1={8} x2={14} y2={8} stroke={stroke} strokeWidth={0.8} /></svg>
    case 'fork':
      return <svg viewBox="0 0 24 8" className="w-6 h-2"><rect x={1} y={2} width={22} height={4} fill={stroke} stroke={stroke} strokeWidth={sw} /></svg>
    case 'bolt':
      return <svg viewBox="0 0 16 20" className="w-4 h-5"><polygon points="9,1 4,10 8,10 7,19 12,10 8,10" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'cloud':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><path d="M6,12 C2,12 2,8 5,7 C4,4 7,2 10,3 C12,1 16,1 18,3 C21,2 23,5 21,7 C23,9 22,12 19,12 Z" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'brace':
      return <svg viewBox="0 0 12 20" className="w-3 h-5"><path d="M10,2 C7,2 7,8 5,10 C7,12 7,18 10,18" fill="none" stroke={stroke} strokeWidth={sw} /></svg>
    case 'brace-r':
      return <svg viewBox="0 0 12 20" className="w-3 h-5"><path d="M2,2 C5,2 5,8 7,10 C5,12 5,18 2,18" fill="none" stroke={stroke} strokeWidth={sw} /></svg>
    case 'braces':
      return <svg viewBox="0 0 20 20" className="w-5 h-5"><path d="M6,2 C3,2 3,8 1,10 C3,12 3,18 6,18" fill="none" stroke={stroke} strokeWidth={sw} /><path d="M14,2 C17,2 17,8 19,10 C17,12 17,18 14,18" fill="none" stroke={stroke} strokeWidth={sw} /></svg>
    case 'comment':
      return <svg viewBox="0 0 20 16" className="w-5 h-4"><text x={10} y={12} fontSize={14} fill={stroke} fontFamily="sans-serif" textAnchor="middle" fontWeight="500">T</text></svg>
    case 'text':
      return <svg viewBox="0 0 20 16" className="w-5 h-4"><text x={10} y={12} fontSize={12} fill={stroke} fontFamily="sans-serif" textAnchor="middle">Aa</text></svg>
    case 'odd':
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><polygon points="4,2 20,2 23,8 20,14 4,14 1,8" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    case 'bang':
      return <svg viewBox="0 0 16 18" className="w-4 h-4"><polygon points="8,1 10,6 15,7 11,11 12,16 8,14 4,16 5,11 1,7 6,6" fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
    default:
      return <svg viewBox="0 0 24 16" className="w-6 h-4"><rect x={1} y={2} width={22} height={12} rx={1} fill={fill} stroke={stroke} strokeWidth={sw} /></svg>
  }
}

// ─── Shape categories for tabbed UI ─────────────────────────────────────────
export type ShapeCategory = "basic" | "process" | "technical";

export const SHAPE_CATEGORIES: { id: ShapeCategory; label: string; shapes: { shape: NodeShape; label: string }[] }[] = [
  {
    id: "basic", label: "基础",
    shapes: [
      { shape: "text", label: "文本" },
      { shape: "rectangle", label: "矩形" },
      { shape: "rounded", label: "圆角矩形" },
      { shape: "stadium", label: "体育场形" },
      { shape: "triangle", label: "三角形" },
      { shape: "diamond", label: "菱形" },
      { shape: "hexagon", label: "六边形" },
      { shape: "cylinder", label: "圆柱形" },
      { shape: "h-cyl", label: "水平圆柱" },
      { shape: "lin-cyl", label: "带线圆柱" },
      { shape: "circle", label: "圆形" },
      { shape: "parallelogram", label: "平行四边形" },
      { shape: "parallelogram-alt", label: "平行四边形(反)" },
      { shape: "trapezoid", label: "梯形" },
      { shape: "trapezoid-alt", label: "梯形(反)" },
      { shape: "flag", label: "旗帜" },
    ],
  },
  {
    id: "process", label: "流程",
    shapes: [
      { shape: "rectangle", label: "矩形" },
      { shape: "tag-rect", label: "标记矩形" },
      { shape: "triangle", label: "三角形" },
      { shape: "sl-rect", label: "斜矩形" },
      { shape: "parallelogram", label: "平行四边形" },
      { shape: "parallelogram-alt", label: "平行四边形(反)" },
      { shape: "trapezoid-alt", label: "梯形(上)" },
      { shape: "trapezoid", label: "梯形(下)" },
      { shape: "hourglass", label: "沙漏" },
      { shape: "hexagon", label: "六边形" },
      { shape: "stadium", label: "体育场形" },
      { shape: "rounded", label: "圆角矩形" },
      { shape: "fork", label: "分叉/合并" },
      { shape: "diamond", label: "菱形" },
      { shape: "bow-rect", label: "蝴蝶结矩形" },
      { shape: "notch-pent", label: "缺口五边形" },
      { shape: "brace", label: "左花括号" },
      { shape: "brace-r", label: "右花括号" },
      { shape: "braces", label: "双花括号" },
      { shape: "delay", label: "延迟" },
    ],
  },
  {
    id: "technical", label: "技术",
    shapes: [
      { shape: "cylinder", label: "圆柱形" },
      { shape: "lin-cyl", label: "带线圆柱" },
      { shape: "h-cyl", label: "水平圆柱" },
      { shape: "win-pane", label: "窗格" },
      { shape: "curv-trap", label: "曲线梯形" },
      { shape: "delay", label: "延迟" },
      { shape: "bolt", label: "闪电" },
      { shape: "cloud", label: "云" },
      { shape: "doc", label: "文档" },
      { shape: "lin-doc", label: "带线文档" },
      { shape: "st-doc", label: "堆叠文档" },
      { shape: "tag-doc", label: "标记文档" },
    ],
  },
];

export const ALL_SHAPES: { shape: NodeShape; label: string }[] = SHAPE_CATEGORIES.flatMap(c => c.shapes);

export const DIRECTIONS: { value: Direction; label: string; title: string }[] = [
  { value: 'TD', label: '↓', title: '从上到下' },
  { value: 'LR', label: '→', title: '从左到右' },
  { value: 'BT', label: '↑', title: '从下到上' },
  { value: 'RL', label: '←', title: '从右到左' },
]

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'dark',    label: '深色' },
  { value: 'forest',  label: '森林' },
  { value: 'neutral', label: '中性' },
  { value: 'base',    label: '基础' },
]

export const CURVE_STYLES: { value: CurveStyle; label: string }[] = [
  { value: 'basis',      label: '基础' },
  { value: 'linear',     label: '线性' },
  { value: 'cardinal',   label: '基数' },
  { value: 'catmullRom', label: 'Catmull-Rom' },
  { value: 'step',       label: '阶梯' },
  { value: 'stepAfter',  label: '后阶梯' },
  { value: 'stepBefore', label: '前阶梯' },
  { value: 'natural',    label: '自然' },
  { value: 'monotoneX',  label: '单调水平' },
  { value: 'monotoneY',  label: '单调垂直' },
  { value: 'bumpX',      label: '水平凸起' },
  { value: 'bumpY',      label: '垂直凸起' },
]
