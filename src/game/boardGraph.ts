// The standard Yutnori board (윷판) as a graph with stable node IDs.
//
//   o10 ── o9 ── o8 ── o7 ── o6 ── o5        (top: 뒷모 … 모)
//    │  dB1                     dA1  │
//   o11      dB2           dA2      o4
//    │             c (방)            │
//   o14      dC1           dD1      o1
//    │  dC2                     dD2  │
//   o15 ── o16 ── o17 ── o18 ── o19 ── o0    (o0 = 참먹이: start & goal)
//
// Player pieces move counter-clockwise: o0 → o1 … o5 → … o10 → … o15 → … o19 → o0.
// Shortcuts: o5 → dA1 → dA2 → c, o10 → dB1 → dB2 → c, c → dD1 → dD2 → o0 (to goal),
// c → dC1 → dC2 → o15 (the long way). Goblins walk the same graph in reverse.
//
// Movement only ever uses the adjacency functions below — pixel positions are for rendering.

import { NODE_CARGO } from './config'
import type { BoardNodeDef, Branch, NodeId } from './types'

export const GOAL: NodeId = 'o0'
export const CENTER: NodeId = 'c'

const OUTER_NAMES = [
  '참먹이',
  '도',
  '개',
  '걸',
  '윷',
  '모',
  '뒷도',
  '뒷개',
  '뒷걸',
  '뒷윷',
  '뒷모',
  '찌도',
  '찌개',
  '찌걸',
  '찌윷',
  '찌모',
  '날도',
  '날개',
  '날걸',
  '날윷',
]

const MIN = 8
const MAX = 92
const SPAN = MAX - MIN

function outerPosition(i: number): { x: number; y: number } {
  const step = SPAN / 5
  if (i <= 5) return { x: MAX, y: MAX - step * i } // right side, going up
  if (i <= 10) return { x: MAX - step * (i - 5), y: MIN } // top, going left
  if (i <= 15) return { x: MIN, y: MIN + step * (i - 10) } // left side, going down
  return { x: MIN + step * (i - 15), y: MAX } // bottom, going right
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function buildNodes(): BoardNodeDef[] {
  const nodes: BoardNodeDef[] = []
  for (let i = 0; i < 20; i++) {
    const corner = i % 5 === 0
    const pos = outerPosition(i)
    nodes.push({
      id: `o${i}`,
      kind: corner ? 'corner' : 'normal',
      ring: 'outer',
      name: OUTER_NAMES[i],
      x: pos.x,
      y: pos.y,
    })
  }
  const center = { x: 50, y: 50 }
  const tr = outerPosition(5)
  const tl = outerPosition(10)
  const bl = outerPosition(15)
  const br = outerPosition(0)
  const diag = (id: string, name: string, from: { x: number; y: number }, to: { x: number; y: number }, t: number) => {
    const p = lerp(from, to, t)
    nodes.push({ id, kind: 'normal', ring: 'diagonal', name, x: p.x, y: p.y })
  }
  diag('dA1', '모도', tr, center, 1 / 3)
  diag('dA2', '모개', tr, center, 2 / 3)
  diag('dB1', '뒷모도', tl, center, 1 / 3)
  diag('dB2', '뒷모개', tl, center, 2 / 3)
  nodes.push({ id: CENTER, kind: 'center', ring: 'center', name: '방', x: center.x, y: center.y })
  diag('dC1', '속윷', center, bl, 1 / 3)
  diag('dC2', '속모', center, bl, 2 / 3)
  diag('dD1', '사려', center, br, 1 / 3)
  diag('dD2', '안찌', center, br, 2 / 3)
  return nodes
}

export const NODES: readonly BoardNodeDef[] = buildNodes()

export const NODE_MAP: Readonly<Record<NodeId, BoardNodeDef>> = Object.fromEntries(NODES.map((n) => [n.id, n]))

export function getNode(id: NodeId): BoardNodeDef {
  const node = NODE_MAP[id]
  if (!node) throw new Error(`Unknown board node: ${id}`)
  return node
}

export function isOuter(id: NodeId): boolean {
  return NODE_MAP[id]?.ring === 'outer'
}

export function isShortcutNode(id: NodeId): boolean {
  const ring = NODE_MAP[id]?.ring
  return ring === 'diagonal' || ring === 'center'
}

export function isCorner(id: NodeId): boolean {
  return NODE_MAP[id]?.kind === 'corner'
}

export function cargoValue(id: NodeId): number {
  const node = getNode(id)
  return NODE_CARGO[node.kind]
}

/** Shortcut entry edges that a 길막이 도깨비 can block. */
export const SHORTCUT_ENTRIES = ['o5>dA1', 'o10>dB1'] as const
export type ShortcutEntry = (typeof SHORTCUT_ENTRIES)[number]

export const SHORTCUT_ENTRY_NAMES: Record<string, string> = {
  'o5>dA1': '모 지름길',
  'o10>dB1': '뒷모 지름길',
}

export function edgeKey(from: NodeId, to: NodeId): string {
  return `${from}>${to}`
}

export function isShortcutEntryEdge(from: NodeId | null, to: NodeId): boolean {
  if (!from) return false
  return (SHORTCUT_ENTRIES as readonly string[]).includes(edgeKey(from, to))
}

export interface ForwardOption {
  node: NodeId
  branch: Branch | null
}

/**
 * Forward adjacency for player movement.
 * @param isStart whether the piece begins its move on `node` (forks are only chosen at the start).
 * @param prev the node the piece arrived from (used for the straight-line rule at the center).
 */
export function forwardOptions(
  node: NodeId,
  prev: NodeId | null,
  isStart: boolean,
  blocked: ReadonlySet<string> = new Set(),
): ForwardOption[] {
  const open = (to: NodeId, branch: Branch | null): ForwardOption[] =>
    blocked.has(edgeKey(node, to)) ? [] : [{ node: to, branch }]
  switch (node) {
    case 'o5':
      return isStart ? [...open('o6', 'outer'), ...open('dA1', 'shortcut')] : [{ node: 'o6', branch: null }]
    case 'o10':
      return isStart ? [...open('o11', 'outer'), ...open('dB1', 'shortcut')] : [{ node: 'o11', branch: null }]
    case CENTER:
      if (isStart) return [{ node: 'dD1', branch: 'toGoal' }, { node: 'dC1', branch: 'toJjimo' }]
      if (prev === 'dA2') return [{ node: 'dC1', branch: null }]
      return [{ node: 'dD1', branch: null }]
    case 'dA1':
      return [{ node: 'dA2', branch: null }]
    case 'dA2':
      return [{ node: CENTER, branch: null }]
    case 'dB1':
      return [{ node: 'dB2', branch: null }]
    case 'dB2':
      return [{ node: CENTER, branch: null }]
    case 'dC1':
      return [{ node: 'dC2', branch: null }]
    case 'dC2':
      return [{ node: 'o15', branch: null }]
    case 'dD1':
      return [{ node: 'dD2', branch: null }]
    case 'dD2':
      return [{ node: GOAL, branch: null }]
    case 'o19':
      return [{ node: GOAL, branch: null }]
    default: {
      const m = /^o(\d+)$/.exec(node)
      if (!m) throw new Error(`No forward edge from ${node}`)
      const i = Number(m[1])
      return [{ node: `o${(i + 1) % 20}`, branch: null }]
    }
  }
}

/**
 * Reverse adjacency (goblins walk the board backwards: 도깨비는 거꾸로 걷는다).
 * Forks: the goal corner, the center (unless passing straight through) and 찌모.
 */
export function reverseOptions(node: NodeId, prev: NodeId | null): NodeId[] {
  switch (node) {
    case GOAL:
      return ['o19', 'dD2']
    case CENTER:
      if (prev === 'dD1') return ['dB2']
      if (prev === 'dC1') return ['dA2']
      return ['dA2', 'dB2']
    case 'o15':
      return ['o14', 'dC2']
    case 'dA1':
      return ['o5']
    case 'dA2':
      return ['dA1']
    case 'dB1':
      return ['o10']
    case 'dB2':
      return ['dB1']
    case 'dC1':
      return [CENTER]
    case 'dC2':
      return ['dC1']
    case 'dD1':
      return [CENTER]
    case 'dD2':
      return ['dD1']
    default: {
      const m = /^o(\d+)$/.exec(node)
      if (!m) throw new Error(`No reverse edge from ${node}`)
      const i = Number(m[1])
      return [`o${(i + 19) % 20}`]
    }
  }
}

/** Line segments for rendering (derived from the same node definitions). */
export const BOARD_LINES: readonly [NodeId, NodeId][] = (() => {
  const lines: [NodeId, NodeId][] = []
  for (let i = 0; i < 20; i++) lines.push([`o${i}`, `o${(i + 1) % 20}`])
  lines.push(['o5', 'dA1'], ['dA1', 'dA2'], ['dA2', CENTER], [CENTER, 'dC1'], ['dC1', 'dC2'], ['dC2', 'o15'])
  lines.push(['o10', 'dB1'], ['dB1', 'dB2'], ['dB2', CENTER], [CENTER, 'dD1'], ['dD1', 'dD2'], ['dD2', GOAL])
  return lines
})()

export const BRANCH_LABELS: Record<Branch, string> = {
  outer: '바깥길',
  shortcut: '지름길',
  toGoal: '참먹이 쪽 (지름길)',
  toJjimo: '찌모 쪽 (먼 길)',
}
