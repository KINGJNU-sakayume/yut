// Debug commands for balancing (exposed in the UI only with ?debug=1 or in dev builds).

import { getConsumable } from '../data/consumables'
import { getTalismanDef } from '../data/talismans'
import { spawnGoblin } from './board'
import { NODE_MAP, forwardOptions } from './boardGraph'
import { GOBLINS } from './config'
import { rollGoblinIntent } from './ai/goblinIntent'
import { EngineError, invariant } from './errors'
import { newTalismanInstance } from './shop'
import { findGroup, groupAt, pushLog } from './state'
import type { DebugCommand, RunState } from './types'

/** Shortest forward route from the start corner to a node (so Backdo behaves naturally). */
function shortestRoute(target: string): string[] {
  const prev = new Map<string, string | null>([['o0', null]])
  const queue: { node: string; from: string | null; start: boolean }[] = [{ node: 'o0', from: null, start: true }]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.node === target) break
    for (const opt of forwardOptions(cur.node, cur.from, true)) {
      if (prev.has(opt.node) || opt.node === 'o0') continue
      prev.set(opt.node, cur.node)
      queue.push({ node: opt.node, from: cur.node, start: true })
    }
  }
  const route: string[] = []
  let at: string | null | undefined = target
  while (at) {
    route.unshift(at)
    at = prev.get(at) ?? null
  }
  return route[0] === 'o0' ? route : ['o0', target]
}

export function applyDebug(run: RunState, command: DebugCommand): void {
  const board = run.board
  switch (command.cmd) {
    case 'forceResult':
      invariant(board, '판이 없습니다')
      board.forcedNext = command.result
      return
    case 'addCoins':
      run.coins = Math.max(0, run.coins + command.amount)
      return
    case 'addTalisman': {
      invariant(getTalismanDef(command.defId), '없는 부적')
      const def = getTalismanDef(command.defId)!
      if (def.pool === 'blessing') run.blessings.push(newTalismanInstance(run, def.id))
      else {
        if (run.talismans.length >= run.talismanCapacity) throw new EngineError('부적 칸이 가득 찼습니다')
        run.talismans.push(newTalismanInstance(run, def.id))
      }
      return
    }
    case 'addConsumable':
      invariant(getConsumable(command.id), '없는 소모품')
      if (run.consumables.length >= run.consumableCapacity) throw new EngineError('소모품 칸이 가득 찼습니다')
      run.consumables.push(command.id)
      return
    case 'setCargo': {
      invariant(board, '판이 없습니다')
      const g = findGroup(board, command.groupId)
      invariant(g, '없는 무리')
      g.cargo = Math.max(0, Math.round(command.value))
      return
    }
    case 'setMomentum': {
      invariant(board, '판이 없습니다')
      const g = findGroup(board, command.groupId)
      invariant(g, '없는 무리')
      g.momentum = Math.max(0, Math.round(command.value))
      return
    }
    case 'teleport': {
      invariant(board, '판이 없습니다')
      const g = findGroup(board, command.groupId)
      invariant(g && (g.zone === 'home' || g.zone === 'board'), '움직일 수 없는 무리')
      invariant(NODE_MAP[command.node] && command.node !== 'o0', '없는 칸')
      const other = groupAt(board, command.node)
      invariant(!other || other.id === g.id, '그 칸에는 다른 무리가 있습니다')
      g.zone = 'board'
      g.node = command.node
      g.route = shortestRoute(command.node)
      pushLog(board, 'system', `[디버그] ${g.id} → ${command.node}`)
      return
    }
    case 'spawnGoblin': {
      invariant(board, '판이 없습니다')
      invariant(board.goblins.length < GOBLINS.maxCount, '도깨비가 너무 많습니다')
      const goblin = spawnGoblin(board, { boss: false, permanent: false, resting: false })
      goblin.intent = rollGoblinIntent(run, board, goblin)
      return
    }
    case 'jumpToBoss': {
      invariant(run.phase === 'wager', '판돈 고르기 화면에서만 쓸 수 있습니다')
      run.boardIndex = Math.floor(run.boardIndex / 3) * 3 + 2
      return
    }
    case 'setTarget':
      invariant(board, '판이 없습니다')
      board.target = Math.max(1, Math.round(command.value))
      return
    case 'addThrows':
      invariant(board, '판이 없습니다')
      board.baseThrowsLeft = Math.max(0, board.baseThrowsLeft + command.amount)
      board.baseThrowsTotal = Math.max(board.baseThrowsTotal, board.baseThrowsLeft)
      return
  }
}
