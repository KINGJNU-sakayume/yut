// Small state helpers shared across the engine.

import { LOG_LIMIT, STARTING_MOMENTUM } from './config'
import type { BoardState, Group, LogKind, ResultKind, RunState } from './types'

export function cloneDeep<T>(value: T): T {
  return structuredClone(value)
}

export function emptyResultCounts(): Record<ResultKind, number> {
  return { backdo: 0, do: 0, gae: 0, geol: 0, yut: 0, mo: 0 }
}

export function pushLog(board: BoardState, kind: LogKind, text: string): void {
  board.seq.log += 1
  board.log.push({ id: board.seq.log, kind, text })
  if (board.log.length > LOG_LIMIT) board.log.splice(0, board.log.length - LOG_LIMIT)
}

export function newGroupId(board: BoardState): string {
  board.seq.group += 1
  return `g${board.seq.group}`
}

export function freshGroup(board: BoardState, members: number[], momentum = STARTING_MOMENTUM): Group {
  return {
    id: newGroupId(board),
    members: [...members].sort((a, b) => a - b),
    zone: 'home',
    node: null,
    cargo: 0,
    momentum,
    laps: 0,
    route: [],
    visited: [],
    outerSeen: [],
    usedShortcut: false,
    assigned: emptyResultCounts(),
    sneak: false,
    centerCrown: 0,
    samjokoDone: false,
  }
}

export function findGroup(board: BoardState, id: string): Group | undefined {
  return board.groups.find((g) => g.id === id)
}

/** Groups that can still act this board (on the board, at home, or waiting at goal). */
export function activeGroups(board: BoardState): Group[] {
  return board.groups.filter((g) => g.zone === 'board' || g.zone === 'home' || g.zone === 'goal')
}

export function groupAt(board: BoardState, node: string): Group | undefined {
  return board.groups.find((g) => g.zone === 'board' && g.node === node)
}

export function pieceLabel(id: number): string {
  return ['一', '二', '三', '四'][id] ?? String(id + 1)
}

export function groupLabel(group: Group): string {
  return group.members.map((m) => `${m + 1}`).join('·') + '번 말'
}

export function yardOf(boardIndex: number): number {
  return Math.floor(boardIndex / 3) + 1
}

export function sortedUnion(a: readonly string[], b: readonly string[]): string[] {
  return Array.from(new Set([...a, ...b])).sort()
}

export function insertSorted(list: string[], value: string): void {
  if (list.includes(value)) return
  list.push(value)
  list.sort()
}

export function isSealed(run: RunState, pieceId: number, yard: number): boolean {
  return run.mods.sealed.some((s) => s.pieceId === pieceId && yard <= s.untilYard)
}

export function roundCargo(value: number): number {
  return Math.max(0, Math.round(value))
}
