// Goblin AI with *public* intent. A goblin's intent (result, distance, path, landing node) is
// rolled once, shown to the player, and then executed exactly as shown. Distance modifiers
// (lap escalation, bosses, curses, 소금) are derived from the current state, so the displayed
// plan is always the plan that will run.

import { getBoss } from '../../data/bosses'
import { getTrait } from '../../data/pieceTraits'
import { reverseOptions } from '../boardGraph'
import { GOBLINS, LAP_ESCALATION, RESULT_STEPS } from '../config'
import { runHook, silentEnv } from '../effects/effectEngine'
import type { GoblinDistanceCtx } from '../effects/effectTypes'
import { draw } from '../rng'
import { activeGroups, groupAt } from '../state'
import type { BoardState, Goblin, GoblinIntent, Group, NodeId, ResultKind, RunState, ScoreLine } from '../types'
import { facesToResult } from '../yut'

export interface GoblinPlan {
  goblinId: string
  resting: boolean
  result: ResultKind | null
  baseSteps: number
  steps: number
  parts: ScoreLine[]
  path: NodeId[]
  landing: NodeId | null
  targetGroupId: string | null
  /** Why the targeted group would survive (살금살금 / 무쇠말), if it would. */
  targetProtected: string | null
  aimed: boolean
}

const STEP_KINDS: Record<number, ResultKind> = { 1: 'do', 2: 'gae', 3: 'geol', 4: 'yut', 5: 'mo' }

/** Walk the board in reverse using pre-rolled fork choices. */
export function walkReverse(start: NodeId, prev: NodeId | null, steps: number, forkRolls: readonly number[]): NodeId[] {
  const path: NodeId[] = []
  let cur = start
  let p = prev
  let fork = 0
  for (let i = 0; i < steps; i++) {
    const options = reverseOptions(cur, p)
    let next: NodeId
    if (options.length === 1) next = options[0]
    else {
      const roll = forkRolls.length > 0 ? forkRolls[fork % forkRolls.length] : 0
      fork += 1
      next = options[Math.min(options.length - 1, Math.floor(roll * options.length))]
    }
    path.push(next)
    p = cur
    cur = next
  }
  return path
}

/** Every distance modifier currently affecting this goblin (all public). */
export function goblinDistanceParts(run: RunState, board: BoardState, goblin: Goblin, includeWeaken = true): ScoreLine[] {
  const parts: ScoreLine[] = []
  const groups = activeGroups(board)
  if (groups.some((g) => g.laps >= LAP_ESCALATION.distanceBonusAtLap)) {
    parts.push({ source: '세 번째 추가 바퀴', value: LAP_ESCALATION.distanceBonus })
  }
  const boss = getBoss(board.bossId)
  if (boss?.lonerDistancePerMember) {
    const maxStack = groups.reduce((m, g) => Math.max(m, g.members.length), 1)
    if (maxStack > 1) parts.push({ source: boss.name, value: (maxStack - 1) * boss.lonerDistancePerMember })
  }
  if (goblin.strength > 0) parts.push({ source: '붉은 탈 (강해짐)', value: goblin.strength })
  const ctx: GoblinDistanceCtx = { bonus: 0, parts: [] }
  runHook(silentEnv(run, board), 'queryGoblinDistance', ctx)
  parts.push(...ctx.parts)
  if (includeWeaken && goblin.intent && goblin.intent.weaken > 0) parts.push({ source: '소금', value: -goblin.intent.weaken })
  return parts
}

export function protectionReason(run: RunState, board: BoardState, group: Group): string | null {
  if (group.sneak) return '살금살금'
  for (const pid of group.members) {
    const trait = getTrait(run.pieces[pid]?.traitId)
    if (trait?.preventFirstCapture && !board.flags.ironUsed.includes(pid)) return '무쇠말'
  }
  return null
}

export function goblinPlan(run: RunState, board: BoardState, goblin: Goblin): GoblinPlan {
  if (goblin.resting || !goblin.intent) {
    return {
      goblinId: goblin.id,
      resting: true,
      result: null,
      baseSteps: 0,
      steps: 0,
      parts: [],
      path: [],
      landing: null,
      targetGroupId: null,
      targetProtected: null,
      aimed: false,
    }
  }
  const parts = goblinDistanceParts(run, board, goblin)
  const steps = Math.max(0, goblin.intent.steps + parts.reduce((s, p) => s + p.value, 0))
  const path = walkReverse(goblin.node, goblin.prev, steps, goblin.intent.forkRolls)
  const landing = path.length > 0 ? path[path.length - 1] : null
  const target = landing ? groupAt(board, landing) : undefined
  return {
    goblinId: goblin.id,
    resting: false,
    result: goblin.intent.result,
    baseSteps: goblin.intent.steps,
    steps,
    parts,
    path,
    landing,
    targetGroupId: target?.id ?? null,
    targetProtected: target ? protectionReason(run, board, target) : null,
    aimed: goblin.intent.aimed,
  }
}

export function allGoblinPlans(run: RunState, board: BoardState): GoblinPlan[] {
  return board.goblins.map((g) => goblinPlan(run, board, g))
}

/** Landing nodes of every goblin that will move this goblin phase. */
export function threatenedNodes(run: RunState, board: BoardState): Set<NodeId> {
  const set = new Set<NodeId>()
  for (const plan of allGoblinPlans(run, board)) if (plan.landing && !plan.resting) set.add(plan.landing)
  return set
}

export function aimChance(run: RunState, board: BoardState): number {
  const chance = GOBLINS.aimChance[board.kind] + GOBLINS.aimChancePerYard * (board.yard - 1) + GOBLINS.aimChancePerDebt * run.debtLevel
  return Math.min(GOBLINS.aimChanceMax, chance)
}

/**
 * Roll a new public intent for a goblin. Always consumes exactly 9 random numbers from the
 * goblin stream (4 sticks + aim roll + 4 fork rolls) to keep the stream aligned.
 */
export function rollGoblinIntent(run: RunState, board: BoardState, goblin: Goblin): GoblinIntent {
  const rand = () => draw(board.rng, 'goblin')
  const faces = [0, 1, 2, 3].map(() => (rand() < 0.5 ? 'back' : 'front') as 'back' | 'front')
  let result = facesToResult(faces)
  if (result === 'backdo') result = 'do' // goblins never step back
  const aimRoll = rand()
  const forkRolls = [rand(), rand(), rand(), rand()]
  let steps = RESULT_STEPS[result]
  let aimed = false
  if (aimRoll < aimChance(run, board)) {
    const bonus = goblinDistanceParts(run, board, { ...goblin, intent: null }, false).reduce((s, p) => s + p.value, 0)
    let best: { steps: number; value: number } | null = null
    for (let s = 1; s <= 5; s++) {
      const path = walkReverse(goblin.node, goblin.prev, Math.max(0, s + bonus), forkRolls)
      const landing = path[path.length - 1]
      if (!landing) continue
      const target = groupAt(board, landing)
      if (!target || protectionReason(run, board, target)) continue
      const value = target.cargo + target.members.length * 10 + target.momentum
      if (!best || value > best.value) best = { steps: s, value }
    }
    if (best) {
      steps = best.steps
      result = STEP_KINDS[best.steps]
      aimed = true
    }
  }
  return { result, steps, forkRolls, weaken: 0, aimed }
}
