// All tunable gameplay constants live here (targets live in src/data/targets.ts).
// Nothing in this file should be imported by React for rules — UI only reads values for display.

import type { BoardKind, NodeId, ResultKind, WagerId } from './types'

export const SAVE_VERSION = 1

export const STICKS = {
  count: 4,
  /** Index of the marked Backdo stick (뒷도 표시 막대). */
  markedIndex: 0,
  baseBackProbability: 0.5,
  minBackProbability: 0.05,
  maxBackProbability: 0.95,
} as const

/** Physical movement for each result. */
export const RESULT_STEPS: Record<ResultKind, number> = {
  backdo: -1,
  do: 1,
  gae: 2,
  geol: 3,
  yut: 4,
  mo: 5,
}

/** Momentum gained by the group that receives a result. */
export const RESULT_MOMENTUM: Record<ResultKind, number> = {
  backdo: 2,
  do: 1,
  gae: 2,
  geol: 3,
  yut: 4,
  mo: 5,
}

/** Results that grant a free extra throw (unless a boss says otherwise). */
export const EXTRA_THROW_RESULTS: readonly ResultKind[] = ['yut', 'mo']

export const STARTING_MOMENTUM = 1

export const NODE_CARGO = {
  normal: 5,
  corner: 15,
  center: 30,
} as const

/** Index = number of pieces in the group. */
export const STACK_MULTIPLIERS = [1, 1, 1.5, 2.25, 4] as const

/** Index = number of extra laps taken. */
export const LAP_MULTIPLIERS = [1, 1.5, 2.25, 4] as const
export const MAX_EXTRA_LAPS = 3

/** Escalation when a group starts its Nth extra lap. */
export const LAP_ESCALATION = {
  /** Starting the 2nd extra lap spawns one additional goblin. */
  spawnGoblinAtLap: 2,
  /** While any active group is on its 3rd extra lap, every goblin moves this much farther. */
  distanceBonusAtLap: 3,
  distanceBonus: 1,
} as const

export interface WagerDef {
  id: WagerId
  baseThrows: number
  rewardMult: number
  extraCoins: number
}

/**
 * Board-start wagers.
 *
 * The design brief suggested 10 / 8 / 6 base throws. With the brief's movement values a
 * single lap of the standard board takes 11–20 steps (~2.5 steps per base throw), so with
 * 8 throws "One More Lap" — the signature mechanic — was practically unreachable.
 * We keep the same 1.25 : 1 : 0.75 ratio but scale by 1.5. Tune freely here.
 */
export const WAGERS: Record<WagerId, WagerDef> = {
  safe: { id: 'safe', baseThrows: 15, rewardMult: 0.85, extraCoins: 0 },
  standard: { id: 'standard', baseThrows: 12, rewardMult: 1, extraCoins: 0 },
  allIn: { id: 'allIn', baseThrows: 9, rewardMult: 1.3, extraCoins: 2 },
}
export const WAGER_ORDER: readonly WagerId[] = ['safe', 'standard', 'allIn']

export const GOBLINS = {
  baseCount: 2,
  maxCount: 6,
  /** Spawn nodes in priority order. Goblin i prefers SPAWNS[i % length]. */
  spawns: ['o10', 'c', 'o15', 'dB1', 'dC1', 'o8'] as NodeId[],
  /** Chance that a goblin aims its (publicly shown) intent at a player group within reach. */
  aimChance: { small: 0.25, big: 0.35, boss: 0.45 } as Record<BoardKind, number>,
  aimChancePerDebt: 0.05,
  bossCargoMult: 3,
  /** 붉은 탈: cargo multiplier gained each time the goblin is captured, and max strength. */
  redMaskCargoGrowth: 0.5,
  redMaskMaxStrength: 2,
} as const

export function goblinBaseCargo(yard: number): number {
  return 10 + 10 * (yard - 1)
}

export const ECONOMY = {
  startingCoins: 4,
  clearReward: { small: 3, big: 4, boss: 5 } as Record<BoardKind, number>,
  interestPer: 10,
  interestMax: 5,
  rerollCosts: [3, 5, 8, 12] as const,
  rerollIncrement: 5,
  sellRatio: 0.5,
  /** Overkill bonus: +1 coin each time the final score doubles the target (max). */
  overkillMaxCoins: 3,
} as const

export function rerollCost(rerollsDone: number): number {
  const table = ECONOMY.rerollCosts
  if (rerollsDone < table.length) return table[rerollsDone]
  return table[table.length - 1] + ECONOMY.rerollIncrement * (rerollsDone - table.length + 1)
}

export const SHOP = {
  talismanSlots: 3,
  consumableSlots: 2,
  rarityWeights: { common: 60, uncommon: 30, rare: 10, legendary: 2 } as Record<string, number>,
  /** Weight multiplier for synergy tags in the first talisman slot. */
  synergyWeight: 2.5,
  synergyMinOwned: 2,
  consumablePrice: { yeot: 3, fan: 3, luckyPouch: 4, salt: 3 } as Record<string, number>,
  stickModPrice: 6,
  traitPrice: 6,
} as const

export const RUN = {
  yards: 8,
  boardsPerYard: 3,
  talismanCapacity: 5,
  consumableCapacity: 2,
  pieces: 4,
  /** After the big board of every yard an event is offered. */
  eventAfterBig: true,
  /** After the boss of these yards the Goblin Market appears. */
  goblinMarketYards: [2, 4, 6] as readonly number[],
} as const

export const BOARD_KINDS: readonly BoardKind[] = ['small', 'big', 'boss']

/** Debt levels (difficulty). Unlocked through meta progression. */
export const DEBT_LEVELS = [
  { level: 0, targetMult: 1 },
  { level: 1, targetMult: 1.15 },
  { level: 2, targetMult: 1.3 },
  { level: 3, targetMult: 1.5 },
  { level: 4, targetMult: 1.75 },
] as const

export const BOSS_TUNING = {
  greedyTaxByLaps: [0.4, 0.6, 0.8, 1],
  taffyThrows: 3,
  blockadeInterval: 3,
  lonerPerMember: 1,
} as const

export const TRAIT_TUNING = {
  bundleCargo: 1.5,
  cowardCargo: 1.25,
  generalMomentum: 2,
  wandererLapTable: [1, 2, 3, 5] as readonly number[],
} as const

export const STICK_MOD_TUNING = {
  heavyDelta: 0.15,
  lightDelta: -0.15,
  goldCargo: 5,
  ghostGateMomentum: 3,
} as const

export const LOG_LIMIT = 60
