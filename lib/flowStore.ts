import { create } from "zustand";
import { applyDagreLayout, updateEdgeHandles } from "./layout";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeMarkerType,
  type Node,
  type NodeChange,
} from "@xyflow/react";

// ─── Node shape types ────────────────────────────────────────────────────────
export type NodeShape =
  | "rectangle"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "double-circle"
  | "diamond"
  | "hexagon"
  | "parallelogram"
  | "parallelogram-alt"
  | "trapezoid"
  | "trapezoid-alt"
  | "asymmetric"
  // v11.3.0+ expanded shapes
  | "triangle"
  | "filled-circle"
  | "small-circle"
  | "framed-circle"
  | "crossed-circle"
  | "hourglass"
  | "lean-right"
  | "lean-left"
  | "notch-rect"
  | "lin-rect"
  | "div-rect"
  | "class-rect"
  | "st-rect"
  | "tag-rect"
  | "sl-rect"
  | "notch-pent"
  | "flip-tri"
  | "doc"
  | "lin-doc"
  | "st-doc"
  | "tag-doc"
  | "flag"
  | "bow-rect"
  | "delay"
  | "h-cyl"
  | "lin-cyl"
  | "curv-trap"
  | "win-pane"
  | "fork"
  | "bolt"
  | "cloud"
  | "brace"
  | "brace-r"
  | "braces"
  | "text"
  | "odd"
  | "bang";

// ─── Edge style types ─────────────────────────────────────────────────────────
export type EdgeStyle = "solid" | "dashed" | "thick";
export type ArrowType = "arrow" | "none" | "bidirectional" | "circle" | "cross";

// ─── Diagram-level settings ───────────────────────────────────────────────────
export type Direction = "TD" | "LR" | "BT" | "RL";
export type Theme = "default" | "dark" | "forest" | "neutral" | "base";
export type Look = "classic" | "handDrawn";
export type CurveStyle =
  | "basis"
  | "bumpX"
  | "bumpY"
  | "cardinal"
  | "catmullRom"
  | "linear"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step"
  | "stepAfter"
  | "stepBefore";

// ─── Data types ───────────────────────────────────────────────────────────────
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  shape: NodeShape;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  isSubgraph?: boolean;
}

export interface FlowEdgeData extends Record<string, unknown> {
  edgeStyle?: EdgeStyle;
  arrowType?: ArrowType;
  strokeColor?: string;
  useCenterConnection?: boolean; // For class/state/sequence diagrams
}

// ─── History snapshot ─────────────────────────────────────────────────────────
type Snapshot = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
};

const MAX_HISTORY = 50;
let nodeCounter = 1;

// ─── Store interface ──────────────────────────────────────────────────────────
interface FlowState {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
  direction: Direction;
  theme: Theme;
  look: Look;
  curveStyle: CurveStyle;
  showGrid: boolean;
  past: Snapshot[];
  future: Snapshot[];

  // React Flow change handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Node operations
  addNode: (shape?: NodeShape) => void;
  addNodeAtPosition: (
    position: { x: number; y: number },
    shape?: NodeShape,
    width?: number,
    height?: number,
  ) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeShape: (id: string, shape: NodeShape) => void;
  updateNodeStyle: (
    id: string,
    style: Partial<
      Pick<FlowNodeData, "fillColor" | "strokeColor" | "textColor">
    >,
  ) => void;
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  loadDiagram: (
    nodes: Node<FlowNodeData>[],
    edges: Edge<FlowEdgeData>[],
  ) => void;
  importDiagram: (
    nodes: Node<FlowNodeData>[],
    edges: Edge<FlowEdgeData>[],
    settings: { direction: Direction; theme: Theme; look: Look; curveStyle: CurveStyle },
  ) => void;

  // Subgraph operations
  addSubgraph: (title?: string) => void;
  assignToSubgraph: (nodeIds: string[], subgraphId: string | null) => void;

  // Edge operations
  updateEdgeLabel: (id: string, label: string) => void;
  updateEdgeType: (id: string, updates: Partial<FlowEdgeData>) => void;

  // Diagram settings
  setDirection: (direction: Direction) => void;
  setTheme: (theme: Theme) => void;
  setLook: (look: Look) => void;
  setCurveStyle: (curveStyle: CurveStyle) => void;
  setShowGrid: (show: boolean) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Selection operations
  duplicateSelected: () => void;
  clipboard: { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } | null;
  copySelected: () => void;
  pasteClipboard: () => void;

  // Draw mode
  drawingShape: NodeShape | null;
  setDrawingShape: (shape: NodeShape | null) => void;
  panMode: boolean;
  setPanMode: (enabled: boolean) => void;
}

// ─── Helper: compute edge markers based on arrowType ─────────────────────────
function computeMarkers(arrowType: ArrowType, color = '#9ca3af'): {
  markerEnd?: EdgeMarkerType;
  markerStart?: EdgeMarkerType;
} {
  if (arrowType === "none") return {};
  if (arrowType === "bidirectional") {
    return {
      markerEnd: { type: MarkerType.ArrowClosed, color },
      markerStart: { type: MarkerType.ArrowClosed, color },
    };
  }
  return { markerEnd: { type: MarkerType.ArrowClosed, color } };
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useFlowStore = create<FlowState>((set, get) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withHistory = <T extends (...args: any[]) => void>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      const { nodes: beforeNodes, edges: beforeEdges } = get();

      fn(...args);

      const { nodes: afterNodes, edges: afterEdges, past } = get();

      if (beforeNodes !== afterNodes || beforeEdges !== afterEdges) {
        const snapshot: Snapshot = {
          nodes: beforeNodes.map((n) => ({ ...n, data: { ...n.data } })),
          edges: beforeEdges.map((e) => ({
            ...e,
            data: { ...(e.data ?? {}) } as FlowEdgeData,
          })),
        };
        set({
          past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
          future: [],
        });
      }
    }) as T;
  };

  return {
    nodes: [],
    edges: [],
    direction: "TD",
    theme: "default",
    look: "classic",
    curveStyle: "basis",
    showGrid: true,
    past: [],
    future: [],
    clipboard: null,
    drawingShape: null,
    setDrawingShape: (shape) => set({ drawingShape: shape }),
    panMode: false,
    setPanMode: (enabled) => set({ panMode: enabled }),

    pushHistory: () => {
      const { nodes, edges, past } = get();
      const snapshot: Snapshot = {
        nodes: nodes.map((n) => ({ ...n, data: { ...n.data } })),
        edges: edges.map((e) => ({
          ...e,
          data: { ...(e.data ?? {}) } as FlowEdgeData,
        })),
      };
      set({ past: [...past.slice(-(MAX_HISTORY - 1)), snapshot], future: [] });
    },

    undo: () => {
      const { past, nodes, edges, future } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      const current: Snapshot = { nodes, edges };
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        past: past.slice(0, -1),
        future: [current, ...future.slice(0, MAX_HISTORY - 1)],
      });
    },

    redo: () => {
      const { past, nodes, edges, future } = get();
      if (future.length === 0) return;
      const next = future[0];
      const current: Snapshot = { nodes, edges };
      set({
        nodes: next.nodes,
        edges: next.edges,
        past: [...past.slice(-(MAX_HISTORY - 1)), current],
        future: future.slice(1),
      });
    },

    onNodesChange: (changes) =>
      set({
        nodes: applyNodeChanges(changes, get().nodes) as Node<FlowNodeData>[],
      }),

    onEdgesChange: (changes) =>
      set({
        edges: applyEdgeChanges(changes, get().edges) as Edge<FlowEdgeData>[],
      }),

    onConnect: withHistory((connection) => {
      const markers = computeMarkers("arrow");
      set({
        edges: addEdge(
          {
            ...connection,
            type: "flowEdge",
            ...markers,
            data: { edgeStyle: "solid", arrowType: "arrow" },
          },
          get().edges,
        ) as Edge<FlowEdgeData>[],
      });
    }),

    addNode: withHistory((shape: NodeShape = "rectangle") => {
      const id = `node_${nodeCounter++}`;
      const offset = (nodeCounter * 30) % 200;
      const newNode: Node<FlowNodeData> = {
        id,
        type: "flowNode",
        position: { x: 150 + offset, y: 100 + offset },
        data: { label: "节点", shape },
      };
      set({ nodes: [...get().nodes, newNode] });
    }),

    addNodeAtPosition: withHistory(
      (position, shape: NodeShape = "rectangle", width?: number, height?: number) => {
        const id = `node_${nodeCounter++}`;
        const circleShapes: NodeShape[] = ['circle', 'double-circle', 'small-circle', 'framed-circle', 'filled-circle', 'crossed-circle']
        const isCircle = circleShapes.includes(shape)
        const defaultStyle = isCircle && !width && !height ? { width: 80, height: 80 } : undefined
        const newNode: Node<FlowNodeData> = {
          id,
          type: "flowNode",
          position,
          data: { label: "节点", shape },
          ...(width && height ? { style: { width, height } } : defaultStyle ? { style: defaultStyle } : {}),
        };
        set({ nodes: [...get().nodes, newNode] });
      },
    ),

    updateNodeLabel: withHistory((id, label) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label } } : n,
        ),
      });
    }),

    updateNodeShape: withHistory((id, shape) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, shape } } : n,
        ),
      });
    }),

    updateNodeStyle: withHistory((id, style) => {
      set({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...style } } : n,
        ),
      });
    }),

    updateEdgeLabel: withHistory((id, label) => {
      set({
        edges: get().edges.map((e) => (e.id === id ? { ...e, label } : e)),
      });
    }),

    updateEdgeType: withHistory((id, updates) => {
      const arrowType = updates.arrowType;
      const edge = get().edges.find((e) => e.id === id);
      const edgeColor = updates.strokeColor ?? (edge?.data as FlowEdgeData | undefined)?.strokeColor ?? '#9ca3af';
      const markerUpdates =
        arrowType !== undefined ? computeMarkers(arrowType, edgeColor) : {};
      set({
        edges: get().edges.map((e) =>
          e.id === id
            ? {
                ...e,
                ...markerUpdates,
                data: { ...(e.data ?? {}), ...updates } as FlowEdgeData,
              }
            : e,
        ),
      });
    }),

    setNodes: withHistory((nodes) => {
      set({ nodes });
    }),

    loadDiagram: withHistory((nodes, edges) => {
      const stampedNodes = nodes.map((n) => ({ ...n, type: "flowNode" }));
      const stampedEdges = edges.map((e) => ({
        ...e,
        type: "flowEdge",
      })) as Edge<FlowEdgeData>[];
      set({ nodes: stampedNodes, edges: stampedEdges });
    }),

    importDiagram: (nodes, edges, settings) => {
      const stampedNodes = nodes.map((n) => ({ ...n, type: "flowNode" }));
      const stampedEdges = edges.map((e) => ({
        ...e,
        type: "flowEdge",
      })) as Edge<FlowEdgeData>[];
      const maxId = stampedNodes.reduce((max, n) => {
        const m = n.id.match(/(\d+)$/)
        return m ? Math.max(max, parseInt(m[1], 10)) : max
      }, 0)
      if (maxId >= nodeCounter) nodeCounter = maxId + 1
      const subgraphs = stampedNodes.filter((n) => n.data?.isSubgraph)
      const children = stampedNodes.filter((n) => n.parentId)
      const free = stampedNodes.filter((n) => !n.data?.isSubgraph && !n.parentId)
      set({
        nodes: [...subgraphs, ...free, ...children],
        edges: stampedEdges,
        direction: settings.direction,
        theme: settings.theme,
        look: settings.look,
        curveStyle: settings.curveStyle,
        past: [],
        future: [],
      });
    },

    addSubgraph: withHistory((title = "分组") => {
      const id = `sg_${nodeCounter++}`;
      const offset = (nodeCounter * 30) % 200;
      const newNode: Node<FlowNodeData> = {
        id,
        type: "flowNode",
        position: { x: 200 + offset, y: 150 + offset },
        data: { label: title, shape: "rectangle", isSubgraph: true },
        style: { width: 320, height: 220 },
        zIndex: -1,
      };
      set({ nodes: [...get().nodes, newNode] });
    }),

    assignToSubgraph: withHistory((nodeIds, subgraphId) => {
      const { nodes } = get();
      const updated = nodes.map((n) => {
        if (!nodeIds.includes(n.id)) return n;
        if (subgraphId === null) {
          // Remove from subgraph: restore absolute position
          const parent = n.parentId ? nodes.find((p) => p.id === n.parentId) : null;
          const absPos = parent
            ? { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y }
            : n.position;
          return { ...n, parentId: undefined, extent: undefined, position: absPos };
        }
        // Assign to subgraph: convert to relative position
        const parent = nodes.find((p) => p.id === subgraphId);
        const relPos = parent
          ? { x: n.position.x - parent.position.x, y: n.position.y - parent.position.y }
          : n.position;
        return { ...n, parentId: subgraphId, extent: [[-5000, -5000], [5000, 5000]] as [[number, number], [number, number]], position: relPos };
      });
      // React Flow requires parent nodes to appear before their children
      const subgraphs = updated.filter((n) => n.data.isSubgraph);
      const children = updated.filter((n) => n.parentId);
      const free = updated.filter((n) => !n.data.isSubgraph && !n.parentId);
      set({ nodes: [...subgraphs, ...free, ...children] });
    }),

    setDirection: (direction) => {
      const { nodes, edges } = get()
      const relaidNodes = applyDagreLayout(nodes, edges, direction)
      const updatedEdges = updateEdgeHandles(relaidNodes, edges, direction)
      set({ direction, nodes: relaidNodes, edges: updatedEdges })
    },
    setTheme: (theme) => set({ theme }),
    setLook: (look) => set({ look }),
    setCurveStyle: (curveStyle) => set({ curveStyle }),
    setShowGrid: (show) => set({ showGrid: show }),

    copySelected: () => {
      const { nodes, edges } = get();
      const selectedNodes = nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;
      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const selectedEdges = edges.filter(
        (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
      );
      set({ clipboard: { nodes: selectedNodes, edges: selectedEdges } });
    },

    pasteClipboard: withHistory(() => {
      const { clipboard, nodes, edges } = get();
      if (!clipboard || clipboard.nodes.length === 0) return;

      const idMap = new Map<string, string>();

      const newNodes = clipboard.nodes.map((n) => {
        const newId = `node_${nodeCounter++}`;
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          selected: true,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          parentId: n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
        };
      });

      const newEdges = clipboard.edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...e,
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          selected: true,
        }));

      set({
        nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
        edges: [...edges.map((e) => ({ ...e, selected: false })), ...newEdges],
      });
    }),

    duplicateSelected: withHistory(() => {
      const { nodes, edges } = get();
      const selectedNodes = nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return;
      const idMap = new Map<string, string>();

      // Duplicate the selected nodes themselves
      const newNodes = selectedNodes.map((n) => {
        const newId = `node_${nodeCounter++}`;
        idMap.set(n.id, newId);
        const label = n.data.isSubgraph ? `${n.data.label} 副本` : n.data.label;
        return {
          ...n,
          id: newId,
          data: { ...n.data, label },
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          selected: true,
        };
      });

      // For each duplicated subgraph, also duplicate its children
      const childNodes: Node<FlowNodeData>[] = [];
      for (const n of selectedNodes) {
        if (!n.data.isSubgraph) continue;
        const newParentId = idMap.get(n.id)!;
        for (const child of nodes.filter((c) => c.parentId === n.id)) {
          const newChildId = `node_${nodeCounter++}`;
          idMap.set(child.id, newChildId);
          childNodes.push({ ...child, id: newChildId, parentId: newParentId, selected: true });
        }
      }

      // Duplicate edges where both endpoints were duplicated
      const newEdges = edges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...e,
          id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

      set({
        nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes, ...childNodes],
        edges: [...edges, ...newEdges],
      });
    }),
  };
});
