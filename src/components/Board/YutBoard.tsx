// The Yut board, rendered from the same node graph the engine uses (never from pixel logic).

import { Fragment, type KeyboardEvent } from 'react'
import { BOARD_LINES, GOAL, NODES, NODE_MAP, SHORTCUT_ENTRY_NAMES } from '../../game/boardGraph'
import type { GoblinPlan } from '../../game/ai/goblinIntent'
import type { PathOption } from '../../game/movement'
import type { MovePreview } from '../../game/selectors'
import type { BoardState, Group, RunState } from '../../game/types'
import { useSequence } from '../../hooks/useSequence'
import { RESULT_LABELS } from '../../i18n/ko'
import { useUiSettings } from '../../ui/settings'
import { GoblinMask } from './GoblinMask'
import { PieceToken } from './PieceToken'

export interface PathOptionView {
  index: number
  option: PathOption
  preview: MovePreview | null
  label: string
}

interface YutBoardProps {
  run: RunState
  board: BoardState
  plans: GoblinPlan[]
  legalGroupIds: ReadonlySet<string>
  selectedGroupId: string | null
  options: PathOptionView[]
  focusedOption: number | null
  onSelectGroup: (id: string) => void
  onChooseOption: (index: number) => void
  onFocusOption: (index: number | null) => void
}

const STEP_MS = 110
const pos = (id: string) => NODE_MAP[id]

function onKeyActivate(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }
}

function polyPoints(ids: string[], dx = 0, dy = 0): string {
  return ids
    .filter((id) => pos(id))
    .map((id) => `${pos(id).x + dx},${pos(id).y + dy}`)
    .join(' ')
}

const CORNER_LABEL: Record<string, string> = { o0: '참먹이', o5: '모', o10: '뒷모', o15: '찌모', c: '방' }

export function YutBoard(props: YutBoardProps) {
  const { run, board, plans, legalGroupIds, selectedGroupId, options, focusedOption, onSelectGroup, onChooseOption, onFocusOption } = props
  const { reducedMotion } = useUiSettings()

  // Player move animation (the state is already final; we only replay the path).
  const lm = board.lastMove
  const moveNodes = lm ? [lm.fromZone === 'home' || !lm.fromNode ? GOAL : lm.fromNode, ...(lm.toZone === 'home' ? [GOAL] : lm.path)] : []
  const moveIdx = useSequence(lm?.seq ?? null, moveNodes.length, STEP_MS, !reducedMotion)

  // Goblin phase animation.
  const gp = board.lastGoblinPhase
  const gLen = gp ? Math.max(1, ...gp.moves.map((m) => m.path.length + 1)) : 0
  const gIdx = useSequence(gp?.seq ?? null, gLen, STEP_MS, !reducedMotion)
  const goblinAnimating = gIdx != null

  const selectedGroup = board.groups.find((g) => g.id === selectedGroupId) ?? null
  const startOf = (g: Group) => (g.zone === 'board' && g.node ? g.node : GOAL)

  const goblinAt = new Map<string, number>()
  for (const g of board.goblins) goblinAt.set(g.node, (goblinAt.get(g.node) ?? 0) + 1)

  // Merge threats that land on the same node.
  const landings = new Map<string, { plans: GoblinPlan[] }>()
  for (const plan of plans) {
    if (plan.resting || !plan.landing) continue
    const entry = landings.get(plan.landing) ?? { plans: [] }
    entry.plans.push(plan)
    landings.set(plan.landing, entry)
  }

  const blockedEdges = board.blockade ? [board.blockade.current] : []
  const nextBlocked = board.blockade && board.blockade.next !== board.blockade.current ? board.blockade.next : null

  return (
    <svg
      viewBox="-5 -7 110 114"
      className="h-full w-full select-none"
      role="group"
      aria-label="윷판"
      style={{ touchAction: 'manipulation' }}
    >
      <defs>
        <pattern id="hatch-red" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.2" height="2.2" fill="rgba(168,38,28,0.18)" />
          <line x1="0" y1="0" x2="0" y2="2.2" stroke="#a8261c" strokeWidth="0.9" />
        </pattern>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#a8261c" />
        </marker>
        <marker id="arrow-gold" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#b8860b" />
        </marker>
        <radialGradient id="paper-grad" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#f8ecd2" />
          <stop offset="75%" stopColor="#ecd8ad" />
          <stop offset="100%" stopColor="#d8bb84" />
        </radialGradient>
        <filter id="paper-noise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.15  0 0 0 0.09 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      {/* Board cloth and frame */}
      <rect x="-3.5" y="-3.5" width="107" height="107" rx="4" fill="#5a3518" stroke="#2a170a" strokeWidth="1" />
      <rect x="-1.5" y="-1.5" width="103" height="103" rx="3" fill="url(#paper-grad)" />
      <rect x="-1.5" y="-1.5" width="103" height="103" rx="3" filter="url(#paper-noise)" fill="#fff" />
      <text x="50" y="57" textAnchor="middle" fontSize="22" fill="#7a4b23" opacity="0.08" style={{ fontFamily: 'var(--font-serif)' }}>
        柶
      </text>

      {/* Lines */}
      {BOARD_LINES.map(([a, b]) => {
        const blocked = blockedEdges.includes(`${a}>${b}`)
        return (
          <line
            key={`${a}-${b}`}
            x1={pos(a).x}
            y1={pos(a).y}
            x2={pos(b).x}
            y2={pos(b).y}
            stroke={blocked ? '#a8261c' : '#3b2a1f'}
            strokeWidth={blocked ? 1.2 : 0.7}
            strokeDasharray={blocked ? '1.5 1' : undefined}
            strokeLinecap="round"
          />
        )
      })}

      {/* Blockade markers (길막이) */}
      {board.blockade && (
        <>
          {[board.blockade.current, nextBlocked].map((edge, i) => {
            if (!edge) return null
            const [a, b] = edge.split('>')
            const mx = (pos(a).x * 0.45 + pos(b).x * 0.55)
            const my = (pos(a).y * 0.45 + pos(b).y * 0.55)
            return (
              <g key={edge + i} transform={`translate(${mx} ${my})`} aria-label={i === 0 ? '막힌 지름길' : '다음에 막힐 지름길'}>
                <rect x="-4.6" y="-1.6" width="9.2" height="3.2" rx="0.8" fill={i === 0 ? '#a8261c' : '#f3e5c6'} stroke="#6e1510" strokeWidth="0.35" strokeDasharray={i === 0 ? undefined : '0.8 0.5'} />
                <text y="0.8" textAnchor="middle" fontSize="2" fontWeight="800" fill={i === 0 ? '#fff' : '#6e1510'}>
                  {i === 0 ? '✕ 막힘' : '다음 막힘'}
                </text>
                <title>{SHORTCUT_ENTRY_NAMES[edge]}</title>
              </g>
            )
          })}
        </>
      )}

      {/* Nodes */}
      {NODES.map((n) => {
        const r = n.kind === 'center' ? 4.4 : n.kind === 'corner' ? 3.9 : 2.3
        return (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
            <circle r={r} fill={n.kind === 'normal' ? '#f8eed8' : '#f1dfb6'} stroke="#3b2a1f" strokeWidth={n.kind === 'normal' ? 0.5 : 0.7} />
            {n.kind !== 'normal' && <circle r={r - 1.2} fill="none" stroke="#3b2a1f" strokeWidth="0.35" />}
            {n.id === GOAL && <circle r={r + 1.3} fill="none" stroke="#b8860b" strokeWidth="0.5" strokeDasharray="1 0.7" />}
            <title>{`${n.name} (${n.id})`}</title>
            {CORNER_LABEL[n.id] && (
              <text
                y={n.id === 'c' ? 7.6 : n.y > 50 ? 7.2 : -5.4}
                textAnchor="middle"
                fontSize="2.6"
                fontWeight="800"
                fill="#5a4636"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {CORNER_LABEL[n.id]}
              </text>
            )}
          </g>
        )
      })}

      {/* Public goblin intent (threat overlay) */}
      {!goblinAnimating &&
        plans.map((plan, i) => {
          if (plan.resting || plan.path.length === 0) return null
          const goblin = board.goblins.find((g) => g.id === plan.goblinId)
          if (!goblin) return null
          const off = (i % 3) * 0.7 - 0.7
          return (
            <polyline
              key={`threat-${plan.goblinId}`}
              points={polyPoints([goblin.node, ...plan.path], off, off)}
              fill="none"
              stroke="#a8261c"
              strokeWidth="0.8"
              strokeDasharray="1.6 1"
              strokeLinejoin="round"
              markerEnd="url(#arrow-red)"
              opacity="0.9"
            />
          )
        })}
      {!goblinAnimating &&
        [...landings.entries()].map(([node, entry]) => {
          const target = board.groups.find((g) => g.zone === 'board' && g.node === node)
          const isProtected = entry.plans.every((p) => p.targetProtected)
          const label = target ? (isProtected ? `보호(${entry.plans[0].targetProtected})` : '잡힘 위험!') : '착지'
          return (
            <g key={`land-${node}`} transform={`translate(${pos(node).x} ${pos(node).y})`} aria-label={`도깨비 착지 칸: ${pos(node).name}`}>
              <circle r="5" fill="url(#hatch-red)" stroke="#a8261c" strokeWidth={target ? 1 : 0.6} className={target && !isProtected ? 'animate-pulse-ring' : undefined} />
              <text x="3.6" y="-3.2" fontSize="3.4" fontWeight="900" fill="#a8261c">
                ✕
              </text>
              <g transform="translate(0 -6.8)">
                <rect x={-label.length * 1.15 - 1} y="-1.9" width={label.length * 2.3 + 2} height="3" rx="1" fill={target && !isProtected ? '#a8261c' : '#f3e5c6'} stroke="#a8261c" strokeWidth="0.3" />
                <text y="0.5" textAnchor="middle" fontSize="2.1" fontWeight="800" fill={target && !isProtected ? '#fff' : '#6e1510'}>
                  {label}
                  {entry.plans.length > 1 ? ` ×${entry.plans.length}` : ''}
                </text>
              </g>
            </g>
          )
        })}

      {/* Legal path choices for the selected group */}
      {selectedGroup &&
        options.map((view) => {
          const focused = focusedOption === view.index || options.length === 1
          const start = startOf(selectedGroup)
          const nodes = view.option.destZone === 'home' ? [GOAL] : view.option.nodes
          const destId = view.option.destZone === 'home' ? GOAL : (view.option.dest ?? GOAL)
          const danger = view.preview?.destThreatened && !view.preview?.destProtected
          return (
            <g key={`opt-${view.index}`}>
              <polyline
                points={polyPoints([start, ...nodes], 0.6, -0.6)}
                fill="none"
                stroke="#b8860b"
                strokeWidth={focused ? 1.5 : 0.9}
                strokeOpacity={focused ? 1 : 0.6}
                strokeLinejoin="round"
                markerEnd="url(#arrow-gold)"
              />
              {view.option.nodes.map((id, k) => (
                <g key={id + k} transform={`translate(${pos(id).x + 2.6} ${pos(id).y - 2.6})`}>
                  <circle r="1.5" fill="#f2d36b" stroke="#6b4a14" strokeWidth="0.25" />
                  <text y="0.65" textAnchor="middle" fontSize="1.8" fontWeight="900" fill="#2a1d14">
                    {k + 1}
                  </text>
                </g>
              ))}
              <g
                transform={`translate(${pos(destId).x} ${pos(destId).y})`}
                role="button"
                tabIndex={0}
                aria-label={`${view.label}(으)로 이동${danger ? ' — 도깨비 착지 칸' : ''}`}
                onClick={() => onChooseOption(view.index)}
                onKeyDown={onKeyActivate(() => onChooseOption(view.index))}
                onMouseEnter={() => onFocusOption(view.index)}
                onMouseLeave={() => onFocusOption(null)}
                onFocus={() => onFocusOption(view.index)}
                style={{ cursor: 'pointer' }}
              >
                <circle r="5.4" fill={danger ? 'rgba(168,38,28,0.25)' : 'rgba(242,211,107,0.35)'} stroke={danger ? '#a8261c' : '#b8860b'} strokeWidth={focused ? 1.2 : 0.8} strokeDasharray={danger ? '1.2 0.8' : undefined} className="animate-pulse-ring" />
                <g transform="translate(0 7.4)">
                  <rect x={-view.label.length * 1.2 - 1.2} y="-2" width={view.label.length * 2.4 + 2.4} height="3.2" rx="1" fill="#2a1d14" opacity="0.9" />
                  <text y="0.55" textAnchor="middle" fontSize="2.2" fontWeight="800" fill={danger ? '#ffb4a8' : '#f2d36b'}>
                    {danger ? '⚠ ' : ''}
                    {view.label}
                  </text>
                </g>
              </g>
            </g>
          )
        })}

      {/* Goblins */}
      {board.goblins.map((goblin) => {
        const anim = goblinAnimating ? gp?.moves.find((m) => m.goblinId === goblin.id) : undefined
        let at = goblin.node
        if (anim && gIdx != null) {
          const nodes = [anim.from, ...anim.path]
          at = nodes[Math.min(gIdx, nodes.length - 1)]
        }
        const plan = plans.find((p) => p.goblinId === goblin.id)
        const sharesWithGroup = board.groups.some((g) => g.zone === 'board' && g.node === at)
        const dx = sharesWithGroup ? 3 : 0
        return (
          <g
            key={goblin.id}
            style={{ transform: `translate(${pos(at).x + dx}px, ${pos(at).y}px)`, transition: reducedMotion ? undefined : `transform ${STEP_MS}ms linear` }}
            aria-label={`${goblin.boss ? '도깨비 대장' : '도깨비'} — ${pos(at).name}, 화물 ${goblin.cargo}`}
          >
            <g transform="scale(1.05)">
              <GoblinMask boss={goblin.boss} dim={goblin.resting} />
            </g>
            <g transform="translate(0 5.6)">
              <rect x="-3.6" y="-1.3" width="7.2" height="2.6" rx="1.2" fill="#6e1510" />
              <text y="0.75" textAnchor="middle" fontSize="1.9" fontWeight="800" fill="#ffe2a8">
                {goblin.cargo}
              </text>
            </g>
            {!goblinAnimating && plan && (
              <g transform="translate(-4.8 -4.4)">
                <rect x="-2.6" y="-1.4" width="5.2" height="2.8" rx="1" fill={plan.resting ? '#5a4636' : '#a8261c'} />
                <text y="0.7" textAnchor="middle" fontSize="1.9" fontWeight="800" fill="#fff">
                  {plan.resting ? 'zZ' : `${RESULT_LABELS[plan.result ?? 'do']}${plan.steps}`}
                </text>
              </g>
            )}
            <title>{goblin.boss ? '도깨비 대장' : '도깨비'}</title>
          </g>
        )
      })}

      {/* Ghost victims while the capturing goblin is still walking */}
      {goblinAnimating &&
        gp?.moves.map((m) =>
          m.captured.length > 0 && gIdx != null ? (
            <g key={`victim-${m.goblinId}`} transform={`translate(${pos(m.to).x - 3} ${pos(m.to).y})`}>
              {gIdx < m.path.length ? (
                <PieceToken members={m.captured} pieces={run.pieces} />
              ) : (
                <text textAnchor="middle" y="-6" fontSize="3.6" fontWeight="900" fill="#a8261c" className="animate-pop">
                  잡혔다!
                </text>
              )}
            </g>
          ) : null,
        )}

      {/* Player groups on the board */}
      {board.groups.map((g) => {
        const animating = moveIdx != null && lm?.groupId === g.id
        if (animating) return null
        if (g.zone !== 'board' || !g.node) return null
        const p = pos(g.node)
        const sharesGoblin = (goblinAt.get(g.node) ?? 0) > 0 && !goblinAnimating
        const legal = legalGroupIds.has(g.id)
        const threatened = !goblinAnimating && landings.has(g.node)
        const protectedMark = threatened && (landings.get(g.node)?.plans.every((pl) => pl.targetProtected) ?? false)
        return (
          <g
            key={g.id}
            style={{ transform: `translate(${p.x - (sharesGoblin ? 3 : 0)}px, ${p.y}px)`, cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            aria-label={`${g.members.map((m) => m + 1).join('·')}번 말 — ${p.name}, 화물 ${g.cargo}, 기세 ${g.momentum}${legal ? ', 움직일 수 있음' : ''}${threatened ? ', 도깨비가 노림' : ''}`}
            onClick={() => onSelectGroup(g.id)}
            onKeyDown={onKeyActivate(() => onSelectGroup(g.id))}
          >
            <PieceToken
              members={g.members}
              pieces={run.pieces}
              highlight={legal}
              selected={g.id === selectedGroupId}
              cargo={g.cargo}
              protectedMark={protectedMark || g.sneak}
            />
          </g>
        )
      })}

      {/* Animated mover */}
      {moveIdx != null && lm && (
        <g style={{ transform: `translate(${pos(moveNodes[moveIdx]).x}px, ${pos(moveNodes[moveIdx]).y}px)`, transition: `transform ${STEP_MS}ms linear` }}>
          <PieceToken members={lm.members} pieces={run.pieces} selected />
        </g>
      )}

      {/* Capture flashes for the player's last move */}
      {moveIdx == null && lm && lm.captured.length > 0 && lm.toNode && !reducedMotion && (
        <Fragment key={`cap-${lm.seq}`}>
          <text x={pos(lm.toNode).x} y={pos(lm.toNode).y - 7} textAnchor="middle" fontSize="3.4" fontWeight="900" fill="#2f6b46" className="animate-pop">
            +{lm.stolen} 잡았다!
          </text>
        </Fragment>
      )}
    </svg>
  )
}
