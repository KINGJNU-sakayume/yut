import { expect } from 'vitest'
import { UNLOCKS } from '../../data/unlocks'
import { startBoard } from '../board'
import { gameReducer } from '../reducer'
import { createRun } from '../run'
import { newTalismanInstance } from '../shop'
import { findGroup } from '../state'
import type { GameAction, Goblin, Group, NodeId, ResultKind, RunState, WagerId } from '../types'

export const ALL_UNLOCKS = UNLOCKS.map((u) => u.id)

export interface BoardSetup {
  seed?: string
  wager?: WagerId
  talismans?: string[]
  boardIndex?: number
  bossId?: string | null
  /** Keep the default goblins (otherwise the board starts goblin-free for isolated tests). */
  keepGoblins?: boolean
}

/** A run that is already on a board. Goblins are removed unless keepGoblins is set. */
export function boardRun(setup: BoardSetup = {}): RunState {
  const run = createRun({ seed: setup.seed ?? 'test-seed', unlocked: ALL_UNLOCKS })
  run.boardIndex = setup.boardIndex ?? 0
  for (const id of setup.talismans ?? []) run.talismans.push(newTalismanInstance(run, id))
  startBoard(run, setup.wager ?? 'standard')
  const board = run.board!
  if (setup.bossId !== undefined) board.bossId = setup.bossId
  if (!setup.keepGoblins) board.goblins = []
  return run
}

export function act(run: RunState, action: GameAction): RunState {
  const next = gameReducer(run, action)
  expect(next.notice, `action ${JSON.stringify(action)} should be legal`).toBeNull()
  return next
}

export function rejected(run: RunState, action: GameAction): string {
  const next = gameReducer(run, action)
  expect(next.notice, `action ${JSON.stringify(action)} should be rejected`).not.toBeNull()
  expect(next.board).toEqual(run.board)
  return next.notice!
}

/** Force the next throw's result and throw. */
export function throwAs(run: RunState, kind: ResultKind): RunState {
  const forced = act(run, { type: 'DEBUG', command: { cmd: 'forceResult', result: kind } })
  return act(forced, { type: 'THROW' })
}

export function lastPendingId(run: RunState): number {
  const p = run.board!.pending
  return p[p.length - 1].id
}

export function group(run: RunState, id: string): Group {
  const g = findGroup(run.board!, id)
  if (!g) throw new Error(`no group ${id}`)
  return g
}

/** Group containing a given piece. */
export function groupOf(run: RunState, pieceId: number): Group {
  const g = run.board!.groups.find((x) => x.members.includes(pieceId))
  if (!g) throw new Error(`no group with piece ${pieceId}`)
  return g
}

/** Put a group on a node with a plausible route (outer path from the start corner). */
export function place(run: RunState, pieceId: number, node: NodeId, route?: NodeId[]): Group {
  const g = groupOf(run, pieceId)
  g.zone = 'board'
  g.node = node
  g.route = route ?? outerRouteTo(node)
  g.visited = g.route.filter((n) => n !== 'o0')
  return g
}

export function outerRouteTo(node: NodeId): NodeId[] {
  const m = /^o(\d+)$/.exec(node)
  if (!m) return ['o0', node]
  const i = Number(m[1])
  return Array.from({ length: i + 1 }, (_, k) => `o${k}`)
}

export function addGoblin(run: RunState, node: NodeId, opts: Partial<Goblin> = {}): Goblin {
  const board = run.board!
  board.seq.goblin += 1
  const goblin: Goblin = {
    id: `k${board.seq.goblin}`,
    node,
    prev: null,
    spawn: 'o10',
    cargo: 10,
    baseCargo: 10,
    boss: false,
    resting: false,
    strength: 0,
    timesCaptured: 0,
    permanent: false,
    intent: null,
    heldCargo: 0,
    heldFrom: [],
    ...opts,
  }
  board.goblins.push(goblin)
  return goblin
}

export function setIntent(goblin: Goblin, steps: number, forkRolls: number[] = [0, 0, 0, 0]): void {
  const kinds: ResultKind[] = ['do', 'do', 'gae', 'geol', 'yut', 'mo']
  goblin.intent = { result: kinds[steps] ?? 'mo', steps, forkRolls, weaken: 0, aimed: false }
}

/** Move the only legal option for a group with the latest pending result. */
export function moveLatest(run: RunState, groupId: string, pathIndex = 0): RunState {
  return act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId, pathIndex })
}

/** Finish the turn if the engine is waiting on the goblin phase. */
export function finishTurn(run: RunState): RunState {
  if (run.board?.phase === 'goblinTurn') return act(run, { type: 'RESOLVE_GOBLINS' })
  return run
}
