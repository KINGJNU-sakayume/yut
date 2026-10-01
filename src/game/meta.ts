// Meta progression (pure). Unlocks add content; they never add permanent stat bonuses.

import { ACHIEVEMENTS, type AchievementDef } from '../data/achievements'
import { UNLOCK_MAP } from '../data/unlocks'
import { EngineError } from './errors'
import { yardOf } from './state'
import type { RunState } from './types'

export const META_VERSION = 1

export interface MetaSettings {
  reducedMotion: boolean
  pieceSkin: string
  yutSkin: string
  showOdds: boolean
}

export interface SeedRecord {
  seed: string
  result: 'win' | 'loss' | 'abandon'
  yard: number
  score: number
  date: number
  debtLevel: number
}

export interface MetaState {
  format: 'yut-roguelike-meta'
  version: number
  dokkaebibul: number
  unlocked: string[]
  discovered: { talismans: string[]; bosses: string[]; events: string[] }
  achievements: string[]
  stats: {
    runs: number
    wins: number
    losses: number
    highestScore: number
    bestCashOut: number
    bestYard: number
    captures: number
  }
  seeds: SeedRecord[]
  recordedRunIds: string[]
  settings: MetaSettings
}

export function createMeta(reducedMotion = false): MetaState {
  return {
    format: 'yut-roguelike-meta',
    version: META_VERSION,
    dokkaebibul: 0,
    unlocked: [],
    discovered: { talismans: [], bosses: [], events: [] },
    achievements: [],
    stats: { runs: 0, wins: 0, losses: 0, highestScore: 0, bestCashOut: 0, bestYard: 0, captures: 0 },
    seeds: [],
    recordedRunIds: [],
    settings: { reducedMotion, pieceSkin: 'default', yutSkin: 'default', showOdds: true },
  }
}

function mergeList(a: string[], b: string[]): string[] | null {
  const missing = b.filter((x) => !a.includes(x))
  return missing.length ? [...a, ...missing] : null
}

/** Copy newly discovered content from a run into meta. Returns the same object if unchanged. */
export function syncDiscoveries(meta: MetaState, run: RunState): MetaState {
  const t = mergeList(meta.discovered.talismans, run.discovered.talismans)
  const b = mergeList(meta.discovered.bosses, run.discovered.bosses)
  const e = mergeList(meta.discovered.events, run.discovered.events)
  if (!t && !b && !e) return meta
  return {
    ...meta,
    discovered: {
      talismans: t ?? meta.discovered.talismans,
      bosses: b ?? meta.discovered.bosses,
      events: e ?? meta.discovered.events,
    },
  }
}

const ACHIEVEMENT_CHECKS: Record<string, (run: RunState) => boolean> = {
  firstCashOut: (r) => r.stats.cashOuts > 0,
  fourStack: (r) => r.stats.fourStackCashOuts > 0,
  threeLaps: (r) => r.stats.maxLapsCashed >= 3,
  tenK: (r) => r.stats.bestCashOut >= 10_000,
  hundredK: (r) => r.stats.bestCashOut >= 100_000,
  revenge: (r) => r.stats.recoveries > 0,
  hunter: (r) => Math.max(r.stats.bestBoardCaptures, r.board?.stats.captures ?? 0) >= 5,
  yard4: (r) => r.stats.boardsCleared >= 12,
  victory: (r) => r.phase === 'victory',
}

export function evaluateAchievements(meta: MetaState, run: RunState): { meta: MetaState; earned: AchievementDef[] } {
  const earned = ACHIEVEMENTS.filter((a) => !meta.achievements.includes(a.id) && ACHIEVEMENT_CHECKS[a.id]?.(run))
  if (earned.length === 0) return { meta, earned }
  return {
    meta: {
      ...meta,
      achievements: [...meta.achievements, ...earned.map((a) => a.id)],
      dokkaebibul: meta.dokkaebibul + earned.reduce((s, a) => s + a.reward, 0),
    },
    earned,
  }
}

/** 도깨비불 earned at the end of a run (in addition to achievements). */
export function runReward(run: RunState): number {
  const bossesCleared = Math.floor(run.stats.boardsCleared / 3)
  return bossesCleared * 2 + (run.phase === 'victory' ? 5 : 0) + (run.stats.boardsCleared > 0 ? 1 : 0)
}

export function recordRunEnd(meta: MetaState, run: RunState, result: SeedRecord['result'], date: number): { meta: MetaState; reward: number } {
  if (meta.recordedRunIds.includes(run.id)) return { meta, reward: 0 }
  const reward = result === 'abandon' ? 0 : runReward(run)
  const yard = yardOf(run.boardIndex)
  return {
    meta: {
      ...meta,
      dokkaebibul: meta.dokkaebibul + reward,
      stats: {
        runs: meta.stats.runs + 1,
        wins: meta.stats.wins + (result === 'win' ? 1 : 0),
        losses: meta.stats.losses + (result === 'loss' ? 1 : 0),
        highestScore: Math.max(meta.stats.highestScore, run.stats.totalScore),
        bestCashOut: Math.max(meta.stats.bestCashOut, run.stats.bestCashOut),
        bestYard: Math.max(meta.stats.bestYard, result === 'win' ? 9 : yard),
        captures: meta.stats.captures + run.stats.captures,
      },
      seeds: [{ seed: run.seed, result, yard, score: run.stats.totalScore, date, debtLevel: run.debtLevel }, ...meta.seeds].slice(0, 20),
      recordedRunIds: [...meta.recordedRunIds, run.id].slice(-50),
    },
    reward,
  }
}

export function canBuyUnlock(meta: MetaState, id: string): boolean {
  const def = UNLOCK_MAP[id]
  if (!def || meta.unlocked.includes(id)) return false
  if (def.requires && !meta.unlocked.includes(def.requires)) return false
  return meta.dokkaebibul >= def.cost
}

export function buyUnlock(meta: MetaState, id: string): MetaState {
  const def = UNLOCK_MAP[id]
  if (!def) throw new EngineError('알 수 없는 해금입니다')
  if (meta.unlocked.includes(id)) throw new EngineError('이미 해금했습니다')
  if (def.requires && !meta.unlocked.includes(def.requires)) throw new EngineError('먼저 이전 단계를 해금하세요')
  if (meta.dokkaebibul < def.cost) throw new EngineError('도깨비불이 부족합니다')
  return { ...meta, dokkaebibul: meta.dokkaebibul - def.cost, unlocked: [...meta.unlocked, id] }
}

export function maxDebtLevel(meta: MetaState): number {
  let level = 0
  for (let i = 1; i <= 4; i++) if (meta.unlocked.includes(`debt:${i}`)) level = i
  return level
}
