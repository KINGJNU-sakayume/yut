// Cash-out scoring with explicitly separated phases.
//
//   finalScore = cargo × momentum × stackMultiplier × lapMultiplier × Π(final multipliers)
//
// Phases (each resolved left → right across talisman slots, then blessings):
//   1. addCargo      — flat cargo additions
//   2. addMomentum   — flat momentum additions
//   3. cargoMult     — cargo multipliers
//   4. stackLapMult  — stack / lap multiplier modifications
//   5. finalMult     — final score multipliers (then built-in contracts / boss tax)
//   6. afterScore    — post-score effects (coins etc.), dispatched by the board engine

import { getBoss } from '../data/bosses'
import { getTrait } from '../data/pieceTraits'
import { BOSS_TUNING, LAP_MULTIPLIERS, STACK_MULTIPLIERS } from './config'
import { runHook, silentEnv } from './effects/effectEngine'
import { SCORE_PHASES, type EffectEnv, type LapTableCtx } from './effects/effectTypes'
import { cloneDeep, findGroup } from './state'
import type { BoardState, Group, RunState, ScoreBreakdown } from './types'

export function stackMultiplierFor(size: number): number {
  return STACK_MULTIPLIERS[Math.max(0, Math.min(STACK_MULTIPLIERS.length - 1, size))]
}

export function lapTableFor(run: RunState, board: BoardState | null, group: Group | null): LapTableCtx {
  let table = [...LAP_MULTIPLIERS] as number[]
  const sources: string[] = []
  if (group) {
    for (const pid of group.members) {
      const trait = getTrait(run.pieces[pid]?.traitId)
      if (trait?.lapTable) {
        const t = trait.lapTable
        if (t.some((v, i) => v > table[i])) sources.push(trait.name)
        table = table.map((v, i) => Math.max(v, t[i] ?? v))
      }
    }
  }
  const ctx: LapTableCtx = { table, sources }
  runHook(silentEnv(run, board), 'queryLapTable', ctx)
  return ctx
}

export function greedyTaxFactor(board: BoardState, group: Group): number | null {
  const boss = getBoss(board.bossId)
  if (!boss?.greedyTax || board.flags.firstCashOutDone) return null
  const table = BOSS_TUNING.greedyTaxByLaps
  return table[Math.min(table.length - 1, group.laps)]
}

function product(values: number[]): number {
  return values.reduce((p, v) => p * v, 1)
}

/** Compute (and, with a real env, apply side effects of) a cash-out. */
export function computeScore(run: RunState, board: BoardState, group: Group, env: EffectEnv): ScoreBreakdown {
  const size = group.members.length
  const lap = lapTableFor(run, board, group)
  const baseLap = LAP_MULTIPLIERS[Math.min(LAP_MULTIPLIERS.length - 1, group.laps)]
  const tableLap = lap.table[Math.min(lap.table.length - 1, group.laps)]
  const bd: ScoreBreakdown = {
    groupId: group.id,
    members: [...group.members],
    baseCargo: group.cargo,
    cargoAdds: [],
    cargoMults: [],
    cargo: 0,
    baseMomentum: group.momentum,
    momentumAdds: [],
    momentum: 0,
    stackSize: size,
    stackMult: stackMultiplierFor(size),
    stackMods: [],
    laps: group.laps,
    lapMult: tableLap,
    lapMods: group.laps > 0 && tableLap !== baseLap ? [{ source: lap.sources.join(', ') || '배수표', value: tableLap - baseLap }] : [],
    finalMults: [],
    finalMult: 1,
    score: 0,
    post: [],
  }
  for (const phase of SCORE_PHASES) {
    runHook(env, 'beforeScore', { group, phase, bd }, (spec) => spec.phase === phase)
  }
  if (run.mods.goalScoreMult !== 1) bd.finalMults.push({ source: '도깨비 장터 계약', value: run.mods.goalScoreMult })
  const tax = greedyTaxFactor(board, group)
  if (tax != null && tax !== 1) bd.finalMults.push({ source: '욕심 도깨비 세금', value: tax })

  const cargoBeforeMult = bd.baseCargo + bd.cargoAdds.reduce((s, l) => s + l.value, 0)
  bd.cargo = Math.max(0, Math.round(cargoBeforeMult * product(bd.cargoMults.map((l) => l.value))))
  bd.momentum = Math.max(0, bd.baseMomentum + bd.momentumAdds.reduce((s, l) => s + l.value, 0))
  bd.finalMult = product(bd.finalMults.map((l) => l.value))
  const raw = bd.cargo * bd.momentum * bd.stackMult * bd.lapMult * bd.finalMult
  bd.score = Math.max(0, Math.floor(raw + 1e-6))
  return bd
}

/** Side-effect-free prediction for the UI (runs on a deep clone with a silent env). */
export function predictScore(run: RunState, groupId: string): ScoreBreakdown | null {
  if (!run.board) return null
  const clone = cloneDeep(run)
  const board = clone.board!
  const group = findGroup(board, groupId)
  if (!group) return null
  return computeScore(clone, board, group, silentEnv(clone, board))
}
