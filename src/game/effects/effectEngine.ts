// Deterministic hook dispatcher.
//
// Resolution order inside one hook:
//   1. Talisman slots, strictly left → right (array order, never object key order).
//   2. Inside one talisman, its effect entries in definition order.
//   3. Run-long blessings (산신령) after all talismans, in the order they were received.
// Suppressed talismans (엿장수 도깨비) are skipped while suppressed.

import { getTalismanDef } from '../../data/talismans'
import type { BoardState, LogKind, RunState, TalismanInstance } from '../types'
import { pushLog } from '../state'
import { EFFECT_REGISTRY } from './effectRegistry'
import type { EffectEnv, EffectHandler, EffectSpec, HookCtxMap, HookName } from './effectTypes'

export function isSuppressed(board: BoardState | null, inst: TalismanInstance): boolean {
  return Boolean(board?.suppression && board.suppression.uid === inst.uid)
}

/** Ordered effect sources (a fresh array, safe against mutation during dispatch). */
export function effectSources(run: RunState, board: BoardState | null): TalismanInstance[] {
  return [...run.talismans.filter((t) => !isSuppressed(board, t)), ...run.blessings]
}

export function makeEnv(run: RunState, board: BoardState | null): EffectEnv {
  return {
    run,
    board,
    trigger(inst: TalismanInstance) {
      if (!board) return
      board.stats.triggers[inst.defId] = (board.stats.triggers[inst.defId] ?? 0) + 1
      if (board.lastTriggers && !board.lastTriggers.uids.includes(inst.uid)) board.lastTriggers.uids.push(inst.uid)
    },
    addCoins(amount: number, source: string) {
      if (amount === 0) return
      run.coins = Math.max(0, run.coins + amount)
      if (board) pushLog(board, 'talisman', `${source}: 엽전 ${amount > 0 ? '+' : ''}${amount}`)
    },
    log(kind: LogKind, text: string) {
      if (board) pushLog(board, kind, text)
    },
  }
}

/** An env that never mutates anything — used for passive queries and previews. */
export function silentEnv(run: RunState, board: BoardState | null): EffectEnv {
  return {
    run,
    board,
    trigger() {},
    addCoins() {},
    log() {},
  }
}

type AnyHandler = (ctx: unknown, inst: TalismanInstance, params: object, env: EffectEnv, name: string) => void

export function runHook<H extends HookName>(
  env: EffectEnv,
  hook: H,
  ctx: HookCtxMap[H],
  filter?: (spec: EffectSpec) => boolean,
): void {
  for (const inst of effectSources(env.run, env.board)) {
    const def = getTalismanDef(inst.defId)
    if (!def) continue
    for (const spec of def.effects) {
      if (spec.hook !== hook) continue
      if (filter && !filter(spec)) continue
      const handler = (EFFECT_REGISTRY[spec.kind] as EffectHandler | undefined)?.[hook] as AnyHandler | undefined
      if (!handler) continue
      handler(ctx, inst, spec.params ?? {}, env, def.name)
    }
  }
}

/** Reset per-board talisman state and let kinds clear their streak counters. */
export function resetTalismansForBoard(run: RunState): void {
  for (const inst of [...run.talismans, ...run.blessings]) {
    inst.usedThisBoard = 0
    const def = getTalismanDef(inst.defId)
    if (!def) continue
    const seen = new Set<string>()
    for (const spec of def.effects) {
      if (seen.has(spec.kind)) continue
      seen.add(spec.kind)
      EFFECT_REGISTRY[spec.kind]?.boardReset?.(inst, spec.params ?? {})
    }
  }
}

export function ownsEffectKind(run: RunState, board: BoardState | null, kind: EffectSpec['kind']): TalismanInstance | null {
  for (const inst of run.talismans) {
    if (isSuppressed(board, inst)) continue
    const def = getTalismanDef(inst.defId)
    if (def?.effects.some((e) => e.kind === kind)) return inst
  }
  return null
}
