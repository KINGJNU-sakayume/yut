// Movement rules: path enumeration on the board graph, Backdo along route history,
// the Backdo fallback rule, and legality filters (traits).

import { getTrait } from '../data/pieceTraits'
import { threatenedNodes } from './ai/goblinIntent'
import { GOAL, forwardOptions } from './boardGraph'
import { RESULT_STEPS } from './config'
import type { BoardState, Branch, Group, NodeId, PendingResult, RunState } from './types'

export interface PathOption {
  /** Nodes traversed in order (the last one is the destination). Empty for Backdo-to-home. */
  nodes: NodeId[]
  destZone: 'board' | 'home' | 'goal'
  dest: NodeId | null
  /** Fork choice taken at the start node, if any. */
  branch: Branch | null
  backward: boolean
  /** Backdo fallback (see BACKDO_FALLBACK_RULE). */
  fallback: boolean
}

export interface IllegalOption {
  option: PathOption
  reason: string
}

export interface LegalMove {
  groupId: string
  options: PathOption[]
  illegal: IllegalOption[]
}

export interface LegalMoves {
  moves: LegalMove[]
  /** True when the Backdo fallback rule is in effect for this result. */
  fallback: boolean
}

/**
 * Backdo fallback rule (빽도 출발):
 * If no group can legally move backward (e.g. every piece is still at home), the Backdo is used
 * as a single forward step by the group the player chooses. It still counts as a Backdo for
 * momentum (+2) and for every talisman, so the throw is never silently wasted.
 */
export const BACKDO_FALLBACK_RULE =
  '뒤로 갈 수 있는 무리가 없으면, 빽도는 고른 무리의 앞으로 한 칸 이동으로 쓰입니다. 기세(+2)와 부적 판정은 빽도 그대로입니다.'

export function blockedEdges(board: BoardState): Set<string> {
  const set = new Set<string>()
  if (board.blockade) set.add(board.blockade.current)
  return set
}

export function startNodeOf(group: Group): NodeId | null {
  if (group.zone === 'home') return GOAL
  if (group.zone === 'board') return group.node
  return null
}

/** Enumerate every forward path of exactly `steps` (or ending early at the goal). */
export function forwardPathOptions(group: Group, steps: number, blocked: ReadonlySet<string> = new Set()): PathOption[] {
  const start = startNodeOf(group)
  if (!start || steps <= 0) return []
  const prev = group.zone === 'board' && group.route.length >= 2 ? group.route[group.route.length - 2] : null
  const out: PathOption[] = []
  const walk = (cur: NodeId, p: NodeId | null, remaining: number, isStart: boolean, acc: NodeId[], branch: Branch | null) => {
    if (remaining === 0) {
      out.push({ nodes: acc, destZone: 'board', dest: cur, branch, backward: false, fallback: false })
      return
    }
    for (const opt of forwardOptions(cur, p, isStart, blocked)) {
      const nextAcc = [...acc, opt.node]
      const nextBranch = isStart && opt.branch ? opt.branch : branch
      if (opt.node === GOAL) {
        out.push({ nodes: nextAcc, destZone: 'goal', dest: GOAL, branch: nextBranch, backward: false, fallback: false })
        continue
      }
      walk(opt.node, cur, remaining - 1, false, nextAcc, nextBranch)
    }
  }
  walk(start, prev, steps, true, [], null)
  return out
}

/** Backdo moves to the previous node of the current lap's route (or back home from the first node). */
export function backwardPathOption(group: Group): PathOption | null {
  if (group.zone !== 'board' || group.route.length < 2) return null
  const target = group.route[group.route.length - 2]
  if (target === GOAL) return { nodes: [], destZone: 'home', dest: null, branch: null, backward: true, fallback: false }
  return { nodes: [target], destZone: 'board', dest: target, branch: null, backward: true, fallback: false }
}

export function groupTraits(run: RunState, group: Group) {
  return group.members.map((pid) => getTrait(run.pieces[pid]?.traitId)).filter((t) => t != null)
}

export function groupExtraSteps(run: RunState, group: Group): number {
  return groupTraits(run, group).reduce((m, t) => Math.max(m, t.extraStep ?? 0), 0)
}

export function groupCargoFactor(run: RunState, group: Group): number {
  return groupTraits(run, group).reduce((f, t) => f * (t.cargoMult ?? 1), 1)
}

/** Groups the player may assign results to. */
export function movableGroups(board: BoardState): Group[] {
  return board.groups.filter((g) => g.zone === 'home' || g.zone === 'board')
}

function illegalReason(run: RunState, board: BoardState, group: Group, option: PathOption, threats: Set<NodeId>): string | null {
  if (option.destZone !== 'board' || !option.dest) return null
  const other = board.groups.find((g) => g.id !== group.id && g.zone === 'board' && g.node === option.dest)
  if (other) {
    const noStack = [...groupTraits(run, group), ...groupTraits(run, other)].some((t) => t.noStack)
    if (noStack) return '보따리말은 업거나 업힐 수 없습니다'
  }
  if (groupTraits(run, group).some((t) => t.avoidThreat) && threats.has(option.dest)) {
    return '겁쟁이말은 도깨비가 노리는 칸에 멈출 수 없습니다'
  }
  return null
}

export function legalMovesForResult(run: RunState, board: BoardState, result: PendingResult): LegalMoves {
  const groups = movableGroups(board)
  const threats = threatenedNodes(run, board)
  const blocked = blockedEdges(board)
  const build = (optionsFor: (g: Group) => PathOption[]): LegalMove[] => {
    const moves: LegalMove[] = []
    for (const g of groups) {
      const options: PathOption[] = []
      const illegal: IllegalOption[] = []
      for (const option of optionsFor(g)) {
        const reason = illegalReason(run, board, g, option, threats)
        if (reason) illegal.push({ option, reason })
        else options.push(option)
      }
      if (options.length > 0 || illegal.length > 0) moves.push({ groupId: g.id, options, illegal })
    }
    return moves
  }
  const steps = RESULT_STEPS[result.kind]
  if (steps < 0) {
    const backward = build((g) => {
      const o = backwardPathOption(g)
      return o ? [o] : []
    })
    if (backward.some((m) => m.options.length > 0)) return { moves: backward.filter((m) => m.options.length > 0 || m.illegal.length > 0), fallback: false }
    const fallback = build((g) => forwardPathOptions(g, 1, blocked).map((o) => ({ ...o, fallback: true })))
    return { moves: fallback, fallback: true }
  }
  return { moves: build((g) => forwardPathOptions(g, steps + groupExtraSteps(run, g), blocked)), fallback: false }
}

export function hasAnyLegalMove(legal: LegalMoves): boolean {
  return legal.moves.some((m) => m.options.length > 0)
}
