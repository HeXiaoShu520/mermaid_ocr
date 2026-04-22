/**
 * Packet diagram parser
 * 解析 Mermaid packet-beta 语法
 */

export interface PacketField {
  id: string
  startBit: number
  endBit: number
  label: string
}

export interface PacketData {
  fields: PacketField[]
  bitsPerRow?: number
}

export function parsePacketDiagram(code: string): PacketData {
  const fields: PacketField[] = []
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean)

  let fieldId = 0
  for (const line of lines) {
    if (line === 'packet-beta') continue
    if (line.startsWith('%%')) continue

    // 匹配格式：0-15: "Source Port" 或 96-99: "Data Offset"
    const match = line.match(/^(\d+)-(\d+):\s*"([^"]+)"/)
    if (match) {
      const [, start, end, label] = match
      fields.push({
        id: `field-${++fieldId}`,
        startBit: parseInt(start, 10),
        endBit: parseInt(end, 10),
        label,
      })
    }
  }

  return { fields }
}

export function serializePacketDiagram(data: PacketData): string {
  const lines = ['packet-beta']

  for (const field of data.fields) {
    lines.push(`${field.startBit}-${field.endBit}: "${field.label}"`)
  }

  return lines.join('\n')
}
