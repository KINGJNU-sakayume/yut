// Typed effect registry. Talisman data refers to these kinds by name; React never does.
// Each handler mutates the engine *draft* (the reducer always works on a cloned state).

import { getTalismanDef } from '../../data/talismans'
import { isCorner } from '../boardGraph'
import { MAX_EXTRA_LAPS } from '../config'
import type { Group, ResultKind, TalismanInstance } from '../types'
import type { EffectHandler, EffectKind, EffectParams } from './effectTypes'

/** Additive amounts scale with talisman power (doubled talismans give twice as much). */
export function amt(inst: TalismanInstance, x: number | undefined): number {
  return (x ?? 0) * inst.power
}

/** Multiplicative factors scale their bonus part: ×1.5 doubled becomes ×2. */
export function fac(inst: TalismanInstance, f: number | undefined): number {
  return 1 + ((f ?? 1) - 1) * inst.power
}

function matches(p: EffectParams, kind: ResultKind): boolean {
  return !p.results || p.results.includes(kind)
}

function activeGroups(groups: Group[]): Group[] {
  return groups.filter((g) => g.zone === 'board' || g.zone === 'home' || g.zone === 'goal')
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

export const EFFECT_REGISTRY: Record<EffectKind, EffectHandler> = {
  // ── Cargo while moving ────────────────────────────────────────────────
  stepCargoMultiplier: {
    onMoveStep(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind)) return
      if (p.stepIndex != null && ctx.stepIndex !== p.stepIndex) return
      if (ctx.stepCargo <= 0) return
      ctx.stepCargo *= fac(inst, p.factor)
      env.trigger(inst)
    },
  },
  addCounterToStepCargo: {
    onMoveStep(ctx, inst, _p, env) {
      if (ctx.backward || inst.counter <= 0 || ctx.stepCargo <= 0) return
      ctx.stepCargo += amt(inst, inst.counter)
      env.trigger(inst)
    },
  },
  growOnResult: {
    onResult(ctx, inst, p, env) {
      if (ctx.result.kind !== p.result) return
      inst.counter += p.amount ?? 1
      env.trigger(inst)
    },
  },
  stepCargoPerStackMember: {
    onMoveStep(ctx, inst, p, env) {
      const extra = ctx.group.members.length - 1
      if (extra <= 0 || ctx.stepCargo <= 0) return
      ctx.stepCargo += amt(inst, p.amount) * extra
      env.trigger(inst)
    },
  },
  threatStartCargo: {
    beforeMove(ctx, inst, _p, env) {
      if (!ctx.startThreatened) return
      ctx.move.flags[inst.uid] = 1
      env.trigger(inst)
    },
    onMoveStep(ctx, inst, p) {
      if (!ctx.move.flags[inst.uid] || ctx.stepCargo <= 0) return
      ctx.stepCargo *= fac(inst, p.factor)
    },
  },
  recollectVisitedNode: {
    onMoveStep(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind)) return
      if (!ctx.wasVisited || ctx.stepCargo > 0) return
      ctx.stepCargo = ctx.baseValue * inst.power
      env.trigger(inst)
    },
  },
  shortcutEntryCargo: {
    onMoveStep(ctx, inst, p, env) {
      if (!ctx.enteringShortcut) return
      ctx.stepCargo += amt(inst, p.cargo)
      env.trigger(inst)
    },
  },
  extraLapStepCargo: {
    onMoveStep(ctx, inst, p, env) {
      if (!ctx.extraLap || ctx.backward || ctx.stepCargo <= 0) return
      ctx.stepCargo += amt(inst, p.amount)
      env.trigger(inst)
    },
  },
  coinsOnCornerPass: {
    onMoveStep(ctx, inst, p, env, name) {
      if (ctx.backward || !isCorner(ctx.node)) return
      env.addCoins(amt(inst, p.coins), name)
      env.trigger(inst)
    },
  },

  // ── Momentum on assignment ───────────────────────────────────────────
  addMomentumOnResult: {
    beforeMove(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind)) return
      ctx.momentumGain += amt(inst, p.amount)
      env.trigger(inst)
    },
  },
  momentumGainMultiplier: {
    beforeMove(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind)) return
      ctx.momentumGain *= fac(inst, p.factor)
      env.trigger(inst)
    },
  },
  heungMomentum: {
    beforeMove(ctx, inst, p, env) {
      if (ctx.result.heung <= 0) return
      ctx.momentumGain += amt(inst, p.perHeung) * ctx.result.heung
      env.trigger(inst)
    },
  },
  momentumIfExtraThrow: {
    beforeMove(ctx, inst, p, env) {
      if (!ctx.result.grantedExtra) return
      ctx.momentumGain += amt(inst, p.amount)
      env.trigger(inst)
    },
  },

  // ── After moving ─────────────────────────────────────────────────────
  sneakAfterMove: {
    afterMove(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind) || ctx.group.zone !== 'board') return
      ctx.group.sneak = true
      env.trigger(inst)
    },
  },
  doubleCargoOnNthAssign: {
    afterMove(ctx, inst, p, env, name) {
      const kind = p.result ?? 'geol'
      if (ctx.group.samjokoDone || ctx.group.assigned[kind] < (p.n ?? 3)) return
      if (ctx.group.zone === 'finished') return
      ctx.group.samjokoDone = true
      const before = ctx.group.cargo
      ctx.group.cargo = Math.round(ctx.group.cargo * fac(inst, 2))
      env.log('talisman', `${name}: 화물 ${before} → ${ctx.group.cargo}`)
      env.trigger(inst)
    },
  },
  escapeThreatCargo: {
    afterMove(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind) || !ctx.startThreatened) return
      ctx.group.cargo += amt(inst, p.cargo)
      env.trigger(inst)
    },
  },
  centerLanding: {
    afterMove(ctx, inst, p, env) {
      if (ctx.backward || ctx.group.zone !== 'board' || ctx.group.node !== 'c') return
      ctx.group.momentum += amt(inst, p.momentum)
      if (ctx.group.centerCrown < (p.maxStacks ?? 2)) ctx.group.centerCrown += 1
      env.trigger(inst)
    },
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.centerCrown <= 0) return
      const f = Math.pow(fac(inst, p.finalFactor), ctx.group.centerCrown)
      ctx.bd.finalMults.push({ source: `${name} ×${ctx.group.centerCrown}`, value: f })
      env.trigger(inst)
    },
  },

  // ── Stacking ─────────────────────────────────────────────────────────
  momentumOnStackSize: {
    onStack(ctx, inst, p, env) {
      if (ctx.size !== p.size) return
      ctx.group.momentum += amt(inst, p.amount)
      env.trigger(inst)
    },
  },

  // ── Throw-result reactions ───────────────────────────────────────────
  coinsEveryNth: {
    onResult(ctx, inst, p, env, name) {
      if (ctx.result.kind !== p.result) return
      inst.counter += 1
      if (inst.counter % (p.n ?? 3) === 0) {
        env.addCoins(amt(inst, p.coins), name)
        env.trigger(inst)
      }
    },
  },
  streakMomentumAll: {
    onResult(ctx, inst, p, env, name) {
      if (ctx.result.kind !== p.result) {
        inst.counter = 0
        return
      }
      inst.counter += 1
      if (inst.counter >= (p.streak ?? 3)) {
        inst.counter = 0
        const board = env.board
        if (!board) return
        for (const g of activeGroups(board.groups)) g.momentum += amt(inst, p.amount)
        env.log('talisman', `${name}: 모든 무리 기세 +${amt(inst, p.amount)}`)
        env.trigger(inst)
      }
    },
    boardReset(inst) {
      inst.counter = 0
    },
  },
  preventHeungBreak: {
    onResult(ctx, inst, p, env, name) {
      if (!ctx.heungBreaking || inst.usedThisBoard >= (p.perBoard ?? 1)) return
      ctx.heungBreaking = false
      inst.usedThisBoard += 1
      env.log('talisman', `${name}: 흥이 깨지지 않았다!`)
      env.trigger(inst)
    },
  },
  streakCharge: {
    onResult(ctx, inst, p, env, name) {
      if (ctx.result.kind !== p.result) {
        inst.counter = 0
        return
      }
      inst.counter += 1
      if (inst.counter >= (p.streak ?? 2)) {
        inst.counter = 0
        inst.charges += 1
        env.log('talisman', `${name}: 다음 퇴근 최종 배수 충전!`)
        env.trigger(inst)
      }
    },
    boardReset(inst) {
      inst.counter = 0
      inst.charges = 0
    },
  },
  consumeChargeFinal: {
    beforeScore(ctx, inst, p, env, name) {
      if (inst.charges <= 0) return
      inst.charges -= 1
      ctx.bd.finalMults.push({ source: name, value: fac(inst, p.factor) })
      env.trigger(inst)
    },
  },
  nonResultStreakPenalty: {
    onResult(ctx, inst, p, env, name) {
      if (ctx.result.kind === p.result) {
        inst.counter = 0
        return
      }
      inst.counter += 1
      if (inst.counter < (p.streak ?? 4)) return
      inst.counter = 0
      const board = env.board
      if (!board) return
      const candidates = activeGroups(board.groups).filter((g) => g.cargo > 0)
      if (candidates.length === 0) return
      const victim = candidates.reduce((best, g) => (g.cargo > best.cargo ? g : best), candidates[0])
      const lost = Math.floor(victim.cargo * (p.lossPct ?? 0.4))
      victim.cargo -= lost
      env.log('talisman', `${name}: 가장 무거운 무리가 화물 ${lost}을(를) 잃었다`)
      env.trigger(inst)
    },
    boardReset(inst) {
      inst.counter = 0
    },
  },
  convertResult: {
    onThrow(ctx, inst, p, env, name) {
      if (ctx.result.kind !== p.from || !p.to) return
      ctx.result.kind = p.to
      ctx.result.conversions.push(name)
      env.trigger(inst)
    },
  },
  hauntedSticks: {
    beforeThrow(ctx, inst, p) {
      ctx.hauntedSyncChance += (p.syncChance ?? 0) * inst.power
    },
  },

  // ── Captures ─────────────────────────────────────────────────────────
  multiplyCaptureCargo: {
    onCapture(ctx, inst, p, env) {
      if (!matches(p, ctx.result.kind)) return
      ctx.stolen *= fac(inst, p.factor)
      env.trigger(inst)
    },
  },
  captureBonusIfStack: {
    onCapture(ctx, inst, p, env, name) {
      if (ctx.group.members.length !== p.size) return
      ctx.stolen *= fac(inst, p.stealFactor)
      env.addCoins(amt(inst, p.coins), name)
      env.trigger(inst)
    },
  },
  coinsOnCapture: {
    onCapture(_ctx, inst, p, env, name) {
      env.addCoins(amt(inst, p.coins), name)
      env.trigger(inst)
    },
  },
  momentumOnCapture: {
    onCapture(ctx, inst, p, env) {
      ctx.group.momentum += amt(inst, p.amount)
      env.trigger(inst)
    },
  },
  captureRicher: {
    onCapture(ctx, inst, p, env) {
      if (ctx.goblin.cargo <= ctx.group.cargo) return
      ctx.stolen *= fac(inst, p.factor)
      env.trigger(inst)
    },
  },
  captureFlatCargo: {
    onCapture(ctx, inst, p, env) {
      ctx.stolen += amt(inst, p.cargo)
      env.trigger(inst)
    },
  },
  capturedPenalty: {
    onCaptured(ctx, inst, p, env, name) {
      if (ctx.cancel || ctx.reviveHome) return
      ctx.destroyCargo = true
      const loss = Math.min(env.run.coins, p.coins ?? 0)
      env.run.coins -= loss
      env.log('talisman', `${name}: 화물이 사라지고 엽전 ${loss}냥을 잃었다`)
      env.trigger(inst)
    },
  },
  reviveFirstCapture: {
    onCaptured(ctx, inst, _p, env, name) {
      const board = env.board
      if (!board || ctx.cancel || board.flags.reviveUsed) return
      board.flags.reviveUsed = true
      ctx.reviveHome = true
      env.log('talisman', `${name}: 잡힌 말이 화물을 지닌 채 집에서 되살아났다`)
      env.trigger(inst)
    },
    onBoardEnd(_ctx, inst, p, env, name) {
      const board = env.board
      if (!board?.flags.reviveUsed) return
      const run = env.run
      const index = run.talismans.findIndex((t) => t.uid === inst.uid)
      // The rightmost *other* talisman is taken to the underworld.
      let victim = -1
      for (let i = run.talismans.length - 1; i >= 0; i--) {
        if (i !== index) {
          victim = i
          break
        }
      }
      if (victim >= 0) {
        const [gone] = run.talismans.splice(victim, 1)
        env.log('talisman', `${name}: 대가로 「${getTalismanDef(gone.defId)?.name ?? gone.defId}」이(가) 저승으로 끌려갔다`)
      } else {
        const loss = Math.min(run.coins, p.coins ?? 10)
        run.coins -= loss
        env.log('talisman', `${name}: 대가로 엽전 ${loss}냥을 잃었다`)
      }
      env.trigger(inst)
    },
  },

  // ── Scoring phases ───────────────────────────────────────────────────
  finalMultIfStack: {
    beforeScore(ctx, inst, p, env, name) {
      const size = ctx.group.members.length
      if (p.size != null && size !== p.size) return
      if (p.minStack != null && size < p.minStack) return
      ctx.bd.finalMults.push({ source: name, value: fac(inst, p.factor) })
      env.trigger(inst)
    },
  },
  counterScoreMomentum: {
    beforeScore(ctx, inst, _p, env, name) {
      if (inst.counter <= 0) return
      ctx.bd.momentumAdds.push({ source: name, value: amt(inst, inst.counter) })
      env.trigger(inst)
    },
  },
  fullStackJackpot: {
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.members.length < (p.size ?? 4)) return
      const cargoNow = ctx.bd.baseCargo + ctx.bd.cargoAdds.reduce((s, l) => s + l.value, 0)
      if (cargoNow < (p.minCargo ?? 0)) return
      if (ctx.phase === 'cargoMult') ctx.bd.cargoMults.push({ source: name, value: fac(inst, p.cargoFactor) })
      if (ctx.phase === 'finalMult') ctx.bd.finalMults.push({ source: name, value: fac(inst, p.finalFactor) })
      env.trigger(inst)
    },
  },
  cargoPerDistinctOuter: {
    beforeScore(ctx, inst, p, env, name) {
      const count = ctx.group.outerSeen.length
      if (count <= 0) return
      ctx.bd.cargoAdds.push({ source: `${name} (${count}칸)`, value: amt(inst, p.perNode) * count })
      env.trigger(inst)
    },
  },
  noShortcutFinal: {
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.usedShortcut) return
      ctx.bd.finalMults.push({ source: name, value: fac(inst, p.factor) })
      env.trigger(inst)
    },
  },
  exactLapFinal: {
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.laps !== (p.laps ?? MAX_EXTRA_LAPS)) return
      ctx.bd.finalMults.push({ source: name, value: fac(inst, p.factor) })
      env.trigger(inst)
    },
  },
  lapConditionalFinal: {
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.laps >= 1) ctx.bd.finalMults.push({ source: name, value: fac(inst, p.withLap) })
      else ctx.bd.finalMults.push({ source: `${name} (즉시 퇴근)`, value: p.withoutLap ?? 1 })
      env.trigger(inst)
    },
  },
  scoreMomentumFlat: {
    beforeScore(ctx, inst, p, env, name) {
      ctx.bd.momentumAdds.push({ source: name, value: amt(inst, p.amount) })
      env.trigger(inst)
    },
  },
  scoreCargoFlat: {
    beforeScore(ctx, inst, p, env, name) {
      ctx.bd.cargoAdds.push({ source: name, value: amt(inst, p.cargo) })
      env.trigger(inst)
    },
  },
  finalMultFlat: {
    beforeScore(ctx, inst, p, env, name) {
      ctx.bd.finalMults.push({ source: name, value: fac(inst, p.factor) })
      env.trigger(inst)
    },
  },
  modifyStackMultiplier: {
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.members.length < (p.minStack ?? 2)) return
      const add = amt(inst, p.amount)
      ctx.bd.stackMult += add
      ctx.bd.stackMods.push({ source: name, value: add })
      env.trigger(inst)
    },
  },
  modifyLapMultiplier: {
    beforeScore(ctx, inst, p, env, name) {
      if (ctx.group.laps < 1) return
      const add = amt(inst, p.amount)
      ctx.bd.lapMult += add
      ctx.bd.lapMods.push({ source: name, value: add })
      env.trigger(inst)
    },
  },
  modifyLapTable: {
    queryLapTable(ctx, inst, p, _env, name) {
      const table = p.table ?? []
      let changed = false
      ctx.table = ctx.table.map((v, i) => {
        const t = table[i] != null ? fac(inst, table[i]) : v
        if (t > v) changed = true
        return Math.max(v, t)
      })
      if (changed) ctx.sources.push(name)
    },
    queryGoblinDistance(ctx, _inst, p, env, name) {
      const board = env.board
      if (!board || !p.goblinDistance) return
      if (!activeGroups(board.groups).some((g) => g.laps >= 1)) return
      ctx.bonus += p.goblinDistance
      ctx.parts.push({ source: name, value: p.goblinDistance })
    },
  },

  // ── Laps & goal ──────────────────────────────────────────────────────
  momentumOnOneMoreLap: {
    onGoalDecision(ctx, inst, p, env) {
      if (ctx.choice !== 'oneMoreLap') return
      ctx.group.momentum += amt(inst, p.amount)
      env.trigger(inst)
    },
  },
  coinsOnCashOut: {
    afterScore(_ctx, inst, p, env, name) {
      env.addCoins(amt(inst, p.coins), name)
      env.trigger(inst)
    },
  },

  // ── Economy & board lifecycle ───────────────────────────────────────
  coinsPerUnusedThrow: {
    onBoardEnd(ctx, inst, p, env, name) {
      const board = env.board
      if (!ctx.cleared || !board || board.baseThrowsLeft <= 0) return
      const coins = amt(inst, p.coins) * board.baseThrowsLeft
      ctx.coins.push({ source: `${name} (남은 던지기 ${board.baseThrowsLeft})`, amount: coins })
      env.trigger(inst)
    },
  },
  freeRerollAfterBoss: {
    onBoardEnd(ctx, inst, p, env, name) {
      const board = env.board
      if (!ctx.cleared || board?.kind !== 'boss') return
      env.run.freeRerolls += p.count ?? 1
      env.log('talisman', `${name}: 다음 상점 새로고침 1회 무료`)
      env.trigger(inst)
    },
  },
  modifyShopPrice: {
    queryShopPrice(ctx, _inst, p) {
      ctx.factor *= p.factor ?? 1
    },
  },
  boardStartMomentum: {
    onBoardStart(ctx, inst, p, env) {
      for (const g of ctx.board.groups) g.momentum += amt(inst, p.amount)
      env.trigger(inst)
    },
  },
  boardStartThrows: {
    onBoardStart(ctx, inst, p, env) {
      const add = amt(inst, p.amount)
      ctx.board.baseThrowsLeft += add
      ctx.board.baseThrowsTotal += add
      env.trigger(inst)
    },
  },
  grantExtraThrow: {
    onResult(ctx, inst, p, env, name) {
      if (ctx.result.kind !== p.result) return
      inst.counter += 1
      if (inst.counter % (p.n ?? 1) !== 0) return
      if (env.board) env.board.extraThrows += 1
      env.log('talisman', `${name}: 추가 던지기 +1`)
      env.trigger(inst)
    },
  },

  // ── Special handlers registered through the same system ─────────────
  rewindTurn: {
    // 시간 역행 has no passive hook; the engine checks for this kind when a Backdo is thrown.
  },
}

export function describeFactor(f: number): string {
  return `×${fmt(f)}`
}
