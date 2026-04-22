/**
 * Functions to directly edit mermaid code text.
 * All operations take the current code string and return the modified code string.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect diagram type from code */
export function getDiagramType(code: string): string | null {
  const first = code.trim().split('\n')[0]?.trim() || ''
  if (/^flowchart\s/i.test(first) || /^graph\s/i.test(first)) return 'flowchart'
  if (/^classDiagram/i.test(first)) return 'classDiagram'
  if (/^stateDiagram/i.test(first)) return 'stateDiagram'
  if (/^sequenceDiagram/i.test(first)) return 'sequenceDiagram'
  if (/^pie/i.test(first)) return 'pie'
  if (/^xychart/i.test(first)) return 'xychart'
  if (/^packet-beta/i.test(first)) return 'packet'
  if (/^kanban/i.test(first)) return 'kanban'
  if (/^mindmap/i.test(first)) return 'mindmap'
  if (/^timeline/i.test(first)) return 'timeline'
  if (/^treeView-beta/i.test(first)) return 'treeView'
  if (/^block-beta/i.test(first)) return 'block'
  return null
}

// ─── Shape syntax mapping ─────────────────────────────────────────────────────

const SHAPE_WRAP: Record<string, [string, string]> = {
  rectangle: ['["', '"]'],
  rounded: ['("', '")'],
  stadium: ['(["', '"])'],
  subroutine: ['[["', '"]]'],
  cylinder: ['[("', '")]'],
  circle: ['(("', '"))'],
  'double-circle': ['((("', '")))'],
  diamond: ['{"', '"}'],
  hexagon: ['{{"', '"}}'],
  asymmetric: ['>"', '"]'],
  parallelogram: ['[/"', '"/]'],
  'parallelogram-alt': ['[\\"', '"\\]'],
  trapezoid: ['[/"', '"\\]'],
  'trapezoid-alt': ['[\\"', '"/]'],
}

function wrapShape(id: string, label: string, shape: string): string {
  const wrap = SHAPE_WRAP[shape]
  if (wrap) return `${id}${wrap[0]}${label}${wrap[1]}`
  return `${id}["${label}"]`
}

// ─── Flowchart operations ─────────────────────────────────────────────────────

/** Generate a unique node ID */
let _counter = 1
export function genNodeId(): string {
  return `N${Date.now().toString(36)}${(_counter++).toString(36)}`
}

/** Update a node's label in flowchart code */
export function updateNodeLabel(code: string, nodeId: string, newLabel: string): string {
  // Match patterns like: nodeId["old label"], nodeId("old"), nodeId{"old"}, etc.
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match nodeId followed by shape brackets containing a label
  const re = new RegExp(
    `(^|\\s)(${escaped})(\\[\\["|\\[\\("|\\(\\["|\\(\\(\\("|\\(\\("|\\("|\\{\\{"|\\{"|\\[/"|\\[\\\\"|\\/"|>"|\\[")([^"]*?)("\\]\\]|"\\)\\]|"\\]\\)|"\\)\\)\\)|"\\)\\)|"\\)|"\\}\\}|"\\}|"\\\\\\]|"\\/\\]|"\\]|"\\])`,
    'gm'
  )
  const replaced = code.replace(re, (match, pre, id, open, _oldLabel, close) => {
    return `${pre}${id}${open}${newLabel}${close}`
  })
  if (replaced !== code) return replaced

  // Fallback: try unquoted labels
  const reUnquoted = new RegExp(
    `(^|\\s)(${escaped})(\\[\\[|\\[\\(|\\(\\[|\\(\\(\\(|\\(\\(|\\(|\\{\\{|\\{|\\[/|\\[\\\\|>|\\[)([^\\]\\)\\}]*?)(\\]\\]|\\)\\]|\\]\\)|\\)\\)\\)|\\)\\)|\\)|\\}\\}|\\}|\\\\\\]|\\/\\]|\\])`,
    'gm'
  )
  return code.replace(reUnquoted, (match, pre, id, open, _oldLabel, close) => {
    return `${pre}${id}${open}${newLabel}${close}`
  })
}

/** Add a new node to flowchart code */
export function addNode(code: string, label: string, shape: string): string {
  const id = genNodeId()
  const nodeLine = `    ${wrapShape(id, label, shape)}`
  const lines = code.split('\n')

  // Find the last non-empty content line (before any trailing blank lines)
  let insertIdx = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) { insertIdx = i + 1; break }
  }

  lines.splice(insertIdx, 0, nodeLine)
  return lines.join('\n')
}

/** Delete a node and all its connected edges from flowchart code */
export function deleteNode(code: string, nodeId: string): string {
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lines = code.split('\n')
  return lines.filter(line => {
    const trimmed = line.trim()
    // Skip empty/comment lines
    if (!trimmed || trimmed.startsWith('%%')) return true
    // Remove lines that are purely this node's declaration
    if (new RegExp(`^${escaped}(\\[|\\(|\\{|>|\\s*$)`).test(trimmed)) return false
    // Remove edge lines containing this node
    if (new RegExp(`(^|\\s)${escaped}(\\s|\\[|\\(|\\{|>|$)`).test(trimmed) &&
        trimmed.match(/-->|---|==>|===|-\.->|-\.-|--o|--x|<-->|<===>|<-\.->/)
    ) return false
    // Remove style lines for this node
    if (new RegExp(`^style\\s+${escaped}\\s`).test(trimmed)) return false
    // Remove linkStyle lines (we can't easily know which index, so keep them)
    return true
  }).join('\n')
}

/** Add an edge between two nodes */
export function addEdge(code: string, sourceId: string, targetId: string, label?: string): string {
  const edgeLine = label
    ? `    ${sourceId} -->|"${label}"| ${targetId}`
    : `    ${sourceId} --> ${targetId}`
  const lines = code.split('\n')
  let insertIdx = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) { insertIdx = i + 1; break }
  }
  lines.splice(insertIdx, 0, edgeLine)
  return lines.join('\n')
}

/** Delete an edge line by matching source and target */
export function deleteEdge(code: string, sourceId: string, targetId: string): string {
  const escSrc = sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escTgt = targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lines = code.split('\n')
  let found = false
  const result = lines.filter(line => {
    if (found) return true
    const trimmed = line.trim()
    // Match: sourceId ...connector... targetId
    if (new RegExp(`${escSrc}.*?(-->|---|==>|===|-\\.->|-\\.-|--o|--x|<-->|<===>).*?${escTgt}`).test(trimmed)) {
      found = true
      return false
    }
    return true
  })
  return result.join('\n')
}

/** Update flowchart direction */
export function updateDirection(code: string, newDir: string): string {
  return code.replace(/^(flowchart|graph)\s+(TD|TB|LR|BT|RL)/m, `$1 ${newDir}`)
}

/** Update or insert init config (theme, look, curveStyle) */
export function updateInitConfig(
  code: string,
  config: { theme?: string; look?: string; curveStyle?: string }
): string {
  const lines = code.split('\n')

  // Build config object
  const cfg: Record<string, unknown> = {}
  if (config.theme) cfg.theme = config.theme
  if (config.look) cfg.look = config.look
  if (config.curveStyle) cfg.flowchart = { curve: config.curveStyle }

  if (Object.keys(cfg).length === 0) return code

  const initLine = `%%{ init: ${JSON.stringify(cfg)} }%%`

  // Find existing init line
  const initIdx = lines.findIndex(l => l.trim().startsWith('%%{') && l.includes('init:'))
  if (initIdx >= 0) {
    lines[initIdx] = initLine
  } else {
    // Insert before the diagram header
    const headerIdx = lines.findIndex(l => /^(flowchart|graph|classDiagram|stateDiagram)/i.test(l.trim()))
    if (headerIdx >= 0) {
      lines.splice(headerIdx, 0, initLine)
    } else {
      lines.unshift(initLine)
    }
  }

  return lines.join('\n')
}

/** Update node shape in flowchart code */
export function updateNodeShape(code: string, nodeId: string, newShape: string): string {
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // First extract the current label
  const labelRe = new RegExp(
    `(${escaped})(?:\\[\\["?|\\[\\("?|\\(\\["?|\\(\\(\\("?|\\(\\("?|\\("?|\\{\\{"?|\\{"?|\\[/"?|\\[\\\\"?|>"?|\\["?)([^"\\]\\)\\}]*?)(?:"?\\]\\]|"?\\)\\]|"?\\]\\)|"?\\)\\)\\)|"?\\)\\)|"?\\)|"?\\}\\}|"?\\}|"?\\\\\\]|"?\\/\\]|"?\\])`,
    'm'
  )
  const m = code.match(labelRe)
  if (!m) return code
  const label = m[2]
  const newDecl = wrapShape(nodeId, label, newShape)
  return code.replace(labelRe, newDecl)
}
