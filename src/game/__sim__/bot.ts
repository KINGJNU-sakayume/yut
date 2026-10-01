// A simple heuristic player used for fuzz tests and balance simulation. Not used by the UI.

import { throwAvailability } from '../board'
import { hasAnyLegalMove } from '../movement'
import { goalDecisionView, pendingViews, previewMove } from '../selectors'
import { currentRerollCost } from '../shop'
import type { GameAction, RunState, WagerId } from '../types'
import { getTalismanDef } from '../../data/talismans'
import { GOAL, NODES, forwardOptions } from '../boardGraph'

/** Approximate shortest forward distance to the goal from each node (any fork allowed). */
const DIST: Record<string, number> = (() => {
  const dist: Record<string, number> = { [GOAL]: 0 }
  for (let iter = 0; iter < 40; iter++) {
    for (const n of NODES) {
      if (n.id === GOAL) continue
      const nexts = forwardOptions(n.id, null, true).map((o) => o.node)
      const best = Math.min(...nexts.map((x) => (dist[x] ?? 99) + 1))
      if (best < (dist[n.id] ?? 99)) dist[n.id] = best
    }
  }
  return dist
})()
const HOME_DIST = (DIST['o1'] ?? 10) + 1

export interface BotOptions {
  wager?: WagerId
  /** Max extra laps the bot is willing to take when a cash-out would not clear the board. */
  greed?: number
  buyTalismans?: boolean
}

export function botAction(run: RunState, opts: BotOptions = {}): GameAction | null {
  const greed = opts.greed ?? 1
  switch (run.phase) {
    case 'wager':
      return { type: 'CHOOSE_WAGER', wager: opts.wager ?? 'standard' }
    case 'boardEnd':
      return { type: 'CONTINUE' }
    case 'shop': {
      const shop = run.shop!
      if (opts.buyTalismans !== false && run.talismans.length < run.talismanCapacity) {
        const affordable = shop.talismans
          .map((o, i) => ({ o, i }))
          .filter((x) => x.o && x.o.price <= run.coins)
          .sort((a, b) => (getTalismanDef(b.o!.defId)?.price ?? 0) - (getTalismanDef(a.o!.defId)?.price ?? 0))
        if (affordable.length > 0) return { type: 'SHOP_BUY', section: 'talisman', index: affordable[0].i }
        if (run.coins >= currentRerollCost(run, shop) + 8 && shop.rerolls < 1) return { type: 'SHOP_REROLL' }
      }
      return { type: 'SHOP_LEAVE' }
    }
    case 'event':
      return { type: 'EVENT_LEAVE' }
    case 'board':
      break
    default:
      return null
  }
  const board = run.board!
  if (board.phase === 'goblinTurn') return { type: 'RESOLVE_GOBLINS' }
  if (board.phase === 'goalDecision') {
    const view = goalDecisionView(run, board)
    if (!view) return { type: 'GOAL_DECISION', choice: 'cashOut' }
    if (view.clears || !view.canLap || view.group.laps >= greed) return { type: 'GOAL_DECISION', choice: 'cashOut' }
    if (board.baseThrowsLeft >= 5) return { type: 'GOAL_DECISION', choice: 'oneMoreLap' }
    return { type: 'GOAL_DECISION', choice: 'cashOut' }
  }
  if (board.pending.length > 0) {
    let best: { action: GameAction; value: number } | null = null
    for (const view of pendingViews(run, board)) {
      if (!hasAnyLegalMove(view.legal)) return { type: 'DISCARD_RESULT', resultId: view.result.id }
      for (const move of view.legal.moves) {
        const group = board.groups.find((g) => g.id === move.groupId)!
        move.options.forEach((option, pathIndex) => {
          const p = previewMove(run, view.result.id, move.groupId, pathIndex)
          if (!p) return
          let value = p.cargoGained + p.momentumGained * 4 + p.captured * 40 + (p.reachesGoal ? 120 : 0)
          if (p.stackedWith) value += 25 * p.stackSize
          if (p.destThreatened && !p.destProtected) value -= p.newCargo + 40
          if (group.zone === 'board') value += 5
          const before = group.zone === 'home' ? HOME_DIST : (DIST[group.node ?? ''] ?? HOME_DIST)
          const after = p.reachesGoal ? 0 : p.toHome ? HOME_DIST : (DIST[p.destination ?? ''] ?? HOME_DIST)
          value += (before - after) * 6 * Math.min(4, group.members.length)
          if (option.branch === 'shortcut' || option.branch === 'toGoal') value += 15
          if (!best || value > best.value) best = { action: { type: 'MOVE', resultId: view.result.id, groupId: move.groupId, pathIndex }, value }
        })
      }
    }
    if (best) return (best as { action: GameAction }).action
  }
  const can = throwAvailability(board)
  if (can.can) return { type: 'THROW' }
  return null
}
