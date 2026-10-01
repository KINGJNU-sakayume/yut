// Read-only views derived from engine state for the UI. Nothing here mutates the input.

import { getBoss } from '../data/bosses'
import { getTalismanDef } from '../data/talismans'
import { allGoblinPlans, threatenedNodes, protectionReason, type GoblinPlan } from './ai/goblinIntent'
import { applyMove, computeThrowSetup } from './board'
import { LAP_ESCALATION, MAX_EXTRA_LAPS } from './config'
import { isSuppressed, runHook, silentEnv } from './effects/effectEngine'
import { legalMovesForResult, type LegalMoves } from './movement'
import { lapTableFor, predictScore } from './scoring'
import { cloneDeep, findGroup } from './state'
import type { BoardState, Group, PendingResult, ResultKind, RunState, ScoreBreakdown } from './types'
import { baseThrowSetup, finalizeSetup, outcomeDistribution, type Distribution, type ThrowSetup } from './yut'

export interface PendingView {
  result: PendingResult
  legal: LegalMoves
}

export function pendingViews(run: RunState, board: BoardState): PendingView[] {
  return board.pending.map((result) => ({ result, legal: legalMovesForResult(run, board, result) }))
}

export interface MovePreview {
  cargoGained: number
  momentumGained: number
  captured: number
  stolen: number
  stackedWith: string | null
  stackSize: number
  reachesGoal: boolean
  toHome: boolean
  destination: string | null
  destThreatened: boolean
  destProtected: string | null
  coinsDelta: number
  newCargo: number
  newMomentum: number
}

/** Simulate a move on a clone (stops before the goblin phase, so no hidden rolls leak). */
export function previewMove(run: RunState, resultId: number, groupId: string, pathIndex: number): MovePreview | null {
  if (!run.board) return null
  const clone = cloneDeep(run)
  const board = clone.board!
  // Snapshots are irrelevant for previews and expensive to clone again.
  board.rewindSnapshot = null
  board.throwSnapshot = null
  try {
    applyMove(clone, board, resultId, groupId, pathIndex)
  } catch {
    return null
  }
  const after = clone.board!
  const rec = after.lastMove
  if (!rec) return null
  const group = findGroup(after, rec.groupId)
  const threats = threatenedNodes(clone, after)
  const destThreatened = Boolean(group?.zone === 'board' && group.node && threats.has(group.node))
  return {
    cargoGained: rec.cargoGained + rec.stolen,
    momentumGained: rec.momentumGained,
    captured: rec.captured.length,
    stolen: rec.stolen,
    stackedWith: rec.stackedWith,
    stackSize: group?.members.length ?? 1,
    reachesGoal: rec.toZone === 'goal',
    toHome: rec.toZone === 'home',
    destination: rec.toNode,
    destThreatened,
    destProtected: destThreatened && group ? protectionReason(clone, after, group) : null,
    coinsDelta: clone.coins - run.coins,
    newCargo: group?.cargo ?? 0,
    newMomentum: group?.momentum ?? 0,
  }
}

export interface ThrowView {
  setup: ThrowSetup
  distribution: Distribution
}

/** Converter matching the engine's result conversions (boss first, then talismans left → right). */
export function resultConverter(run: RunState, board: BoardState): (k: ResultKind) => ResultKind {
  const boss = getBoss(board.bossId)
  const conversions: { from: ResultKind; to: ResultKind }[] = []
  for (const inst of run.talismans) {
    if (isSuppressed(board, inst)) continue
    for (const spec of getTalismanDef(inst.defId)?.effects ?? []) {
      if (spec.kind === 'convertResult' && spec.params?.from && spec.params.to) conversions.push({ from: spec.params.from, to: spec.params.to })
    }
  }
  return (k) => {
    let out = k
    if (boss?.doBecomesBackdo && out === 'do') out = 'backdo'
    for (const c of conversions) if (out === c.from) out = c.to
    return out
  }
}

export function throwView(run: RunState, board: BoardState): ThrowView {
  const setup = computeThrowSetup(run, board)
  return { setup, distribution: outcomeDistribution(setup, resultConverter(run, board)) }
}

export interface GoalDecisionView {
  group: Group
  cashOut: ScoreBreakdown
  clears: boolean
  lastPieces: boolean
  canLap: boolean
  nextLap: number
  nextLapMult: number
  risk: string
}

export const LAP_RISK_TEXT: Record<number, string> = {
  1: '추가 위험 없음 — 다만 화물을 들고 판을 한 바퀴 더 돌아야 한다.',
  2: `도깨비 1마리가 더 나타난다 (이번 판 내내).`,
  3: `이 무리가 판에 있는 동안 모든 도깨비 이동 거리 +${LAP_ESCALATION.distanceBonus}.`,
}

export function goalDecisionView(run: RunState, board: BoardState): GoalDecisionView | null {
  if (board.phase !== 'goalDecision' || !board.goalGroupId) return null
  const group = findGroup(board, board.goalGroupId)
  if (!group) return null
  const cashOut = predictScore(run, group.id)
  if (!cashOut) return null
  const nextLap = group.laps + 1
  const table = lapTableFor(run, board, group).table
  const others = board.groups.filter((g) => g.id !== group.id && (g.zone === 'board' || g.zone === 'home'))
  return {
    group,
    cashOut,
    clears: board.score + cashOut.score >= board.target,
    lastPieces: others.length === 0,
    canLap: group.laps < MAX_EXTRA_LAPS,
    nextLap,
    nextLapMult: table[Math.min(table.length - 1, nextLap)],
    risk: LAP_RISK_TEXT[nextLap] ?? '',
  }
}

export function goblinPlansView(run: RunState, board: BoardState): GoblinPlan[] {
  return allGoblinPlans(run, board)
}

export function predictedCashOut(run: RunState, groupId: string): ScoreBreakdown | null {
  return predictScore(run, groupId)
}

/** Groups in display order (by first piece id) for stable UI. */
export function sortedGroups(board: BoardState): Group[] {
  return [...board.groups].sort((a, b) => a.members[0] - b.members[0])
}


/** Outcome distribution for the 노름판 throw (the player's own sticks, no board effects). */
export function gambleOdds(run: RunState): Distribution {
  const setup = baseThrowSetup(run.sticks, [])
  const ctx = { backProb: setup.backProb.slice(), hauntedSyncChance: 0 }
  runHook(silentEnv(run, null), 'beforeThrow', ctx)
  return outcomeDistribution(finalizeSetup({ ...setup, backProb: ctx.backProb, hauntedSyncChance: ctx.hauntedSyncChance }))
}
