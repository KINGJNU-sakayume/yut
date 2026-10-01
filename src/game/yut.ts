// Four-stick Yut simulation. Results are derived from individual stick faces so each stick
// can be modified independently (probability, mirroring, inversion, locks, haunting).

import { STICKS } from './config'
import { getStickMod } from '../data/yutMods'
import type { ResultKind, StickFace, StickState } from './types'

export interface ThrowSetup {
  /** Probability of the back (flat, counted) face for each stick, already clamped. */
  backProb: number[]
  invert: boolean[]
  twinOf: (number | null)[]
  locks: (StickFace | null)[]
  /** Chance that every unlocked stick copies the marked stick (귀신 들린 윷). */
  hauntedSyncChance: number
  markedIndex: number
}

export function flip(face: StickFace): StickFace {
  return face === 'back' ? 'front' : 'back'
}

export function clampProbability(p: number): number {
  return Math.min(STICKS.maxBackProbability, Math.max(STICKS.minBackProbability, p))
}

/** Map four faces to a result. A single back face on the marked stick is Backdo. */
export function facesToResult(faces: readonly StickFace[], markedIndex: number = STICKS.markedIndex): ResultKind {
  let backs = 0
  for (const f of faces) if (f === 'back') backs++
  switch (backs) {
    case 0:
      return 'mo'
    case 1:
      return faces[markedIndex] === 'back' ? 'backdo' : 'do'
    case 2:
      return 'gae'
    case 3:
      return 'geol'
    default:
      return 'yut'
  }
}

/** Build the per-stick setup from installed modifications and pending locks (엿). */
export function baseThrowSetup(sticks: readonly StickState[], locks: readonly (StickFace | null)[]): ThrowSetup {
  const backProb: number[] = []
  const invert: boolean[] = []
  const twinOf: (number | null)[] = []
  for (let i = 0; i < STICKS.count; i++) {
    const stick = sticks[i]
    const mod = getStickMod(stick?.modId)
    backProb.push(STICKS.baseBackProbability + (mod?.backDelta ?? 0))
    invert.push(Boolean(mod?.invert))
    const target = mod?.twin ? stick?.twinOf : null
    twinOf.push(target != null && target !== i && target >= 0 && target < STICKS.count ? target : null)
  }
  return {
    backProb,
    invert,
    twinOf,
    locks: Array.from({ length: STICKS.count }, (_, i) => locks[i] ?? null),
    hauntedSyncChance: 0,
    markedIndex: STICKS.markedIndex,
  }
}

export function finalizeSetup(setup: ThrowSetup): ThrowSetup {
  return {
    ...setup,
    backProb: setup.backProb.map(clampProbability),
    hauntedSyncChance: Math.min(0.9, Math.max(0, setup.hauntedSyncChance)),
  }
}

/**
 * Deterministic face pipeline:
 * raw roll → invert (역귀) → locks (엿) → twins mirror their source's face → haunting syncs unlocked sticks.
 */
export function resolveFaces(raw: readonly StickFace[], setup: ThrowSetup, haunted: boolean): StickFace[] {
  const faces = raw.map((f, i) => (setup.invert[i] ? flip(f) : f))
  for (let i = 0; i < faces.length; i++) {
    const lock = setup.locks[i]
    if (lock) faces[i] = lock
  }
  const afterLocks = faces.slice()
  for (let i = 0; i < faces.length; i++) {
    const src = setup.twinOf[i]
    if (src != null && !setup.locks[i] && setup.twinOf[src] == null) faces[i] = afterLocks[src]
  }
  if (haunted) {
    const marked = faces[setup.markedIndex]
    for (let i = 0; i < faces.length; i++) if (!setup.locks[i]) faces[i] = marked
  }
  return faces
}

/**
 * Roll a throw. Always consumes exactly STICKS.count + 1 random numbers so that the stream
 * stays aligned regardless of modifications.
 */
export function rollThrow(setup: ThrowSetup, rand: () => number): { raw: StickFace[]; faces: StickFace[]; haunted: boolean } {
  const raw: StickFace[] = []
  for (let i = 0; i < STICKS.count; i++) raw.push(rand() < setup.backProb[i] ? 'back' : 'front')
  const haunted = rand() < setup.hauntedSyncChance
  return { raw, faces: resolveFaces(raw, setup, haunted), haunted }
}

export type Distribution = Record<ResultKind, number>

export function emptyDistribution(): Distribution {
  return { backdo: 0, do: 0, gae: 0, geol: 0, yut: 0, mo: 0 }
}

/** Exact outcome distribution for a setup, with optional result conversion (bosses / curses). */
export function outcomeDistribution(setup: ThrowSetup, convert: (k: ResultKind) => ResultKind = (k) => k): Distribution {
  const dist = emptyDistribution()
  const n = STICKS.count
  for (let mask = 0; mask < 1 << n; mask++) {
    let p = 1
    const raw: StickFace[] = []
    for (let i = 0; i < n; i++) {
      const back = (mask >> i) & 1
      raw.push(back ? 'back' : 'front')
      p *= back ? setup.backProb[i] : 1 - setup.backProb[i]
    }
    if (p === 0) continue
    const normal = convert(facesToResult(resolveFaces(raw, setup, false), setup.markedIndex))
    dist[normal] += p * (1 - setup.hauntedSyncChance)
    if (setup.hauntedSyncChance > 0) {
      const haunted = convert(facesToResult(resolveFaces(raw, setup, true), setup.markedIndex))
      dist[haunted] += p * setup.hauntedSyncChance
    }
  }
  return dist
}

/** Count back faces on sticks carrying a gold modification. */
export function goldBackCount(faces: readonly StickFace[], sticks: readonly StickState[]): number {
  let n = 0
  faces.forEach((f, i) => {
    if (f === 'back' && getStickMod(sticks[i]?.modId)?.goldCargo) n++
  })
  return n
}

export function goldCargoFor(faces: readonly StickFace[], sticks: readonly StickState[]): number {
  let total = 0
  faces.forEach((f, i) => {
    const mod = getStickMod(sticks[i]?.modId)
    if (f === 'back' && mod?.goldCargo) total += mod.goldCargo
  })
  return total
}

export function ghostGateMomentum(kind: ResultKind, sticks: readonly StickState[]): number {
  if (kind !== 'backdo') return 0
  const mod = getStickMod(sticks[STICKS.markedIndex]?.modId)
  return mod?.ghostGateMomentum ?? 0
}
