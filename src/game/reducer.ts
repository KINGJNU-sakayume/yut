// The single pure entry point for gameplay: (state, action) → new state.
// The incoming state is never mutated; every action works on a deep clone.

import {
  applyMove,
  discardResult,
  goalDecision,
  resolveGoblins,
  rewindTurn,
  throwYut,
  applyConsumable,
} from './board'
import { applyDebug } from './debug'
import { EngineError, invariant } from './errors'
import { chooseEvent } from './events'
import { advanceQueue, chooseWager, continueAfterBoard } from './run'
import { buyFromShop, rerollShop, sellTalisman } from './shop'
import { cloneDeep } from './state'
import type { BoardState, GameAction, RunState } from './types'

function requireBoard(run: RunState): BoardState {
  invariant(run.phase === 'board' && run.board, '진행 중인 판이 없습니다')
  return run.board
}

function beginBoardAction(board: BoardState): void {
  board.seq.event += 1
  board.lastTriggers = { seq: board.seq.event, uids: [] }
}

export function applyAction(run: RunState, action: GameAction): void {
  switch (action.type) {
    case 'CHOOSE_WAGER':
      chooseWager(run, action.wager)
      return
    case 'THROW': {
      const board = requireBoard(run)
      beginBoardAction(board)
      throwYut(run, board)
      return
    }
    case 'MOVE': {
      const board = requireBoard(run)
      beginBoardAction(board)
      applyMove(run, board, action.resultId, action.groupId, action.pathIndex)
      return
    }
    case 'DISCARD_RESULT': {
      const board = requireBoard(run)
      beginBoardAction(board)
      discardResult(run, board, action.resultId)
      return
    }
    case 'GOAL_DECISION': {
      const board = requireBoard(run)
      beginBoardAction(board)
      goalDecision(run, board, action.choice)
      return
    }
    case 'RESOLVE_GOBLINS': {
      const board = requireBoard(run)
      beginBoardAction(board)
      resolveGoblins(run, board)
      return
    }
    case 'REWIND': {
      const board = requireBoard(run)
      rewindTurn(run, board)
      return
    }
    case 'USE_CONSUMABLE':
      if (run.board && run.phase === 'board') beginBoardAction(run.board)
      applyConsumable(run, action.slot, action.params)
      return
    case 'DISCARD_CONSUMABLE':
      invariant(run.consumables[action.slot], '빈 칸입니다')
      run.consumables.splice(action.slot, 1)
      return
    case 'REORDER_TALISMAN': {
      const { from, to } = action
      invariant(from >= 0 && from < run.talismans.length && to >= 0 && to < run.talismans.length, '옮길 수 없습니다')
      const [inst] = run.talismans.splice(from, 1)
      run.talismans.splice(to, 0, inst)
      return
    }
    case 'CONTINUE':
      continueAfterBoard(run)
      return
    case 'SHOP_BUY':
      buyFromShop(run, action.section, action.index, action.params)
      return
    case 'SHOP_REROLL':
      rerollShop(run)
      return
    case 'SHOP_SELL':
      sellTalisman(run, action.index)
      return
    case 'SHOP_LEAVE':
      invariant(run.phase === 'shop', '상점이 열려 있지 않습니다')
      advanceQueue(run)
      return
    case 'EVENT_CHOOSE':
      chooseEvent(run, action.optionId, action.params)
      return
    case 'EVENT_LEAVE':
      invariant(run.phase === 'event', '진행 중인 만남이 없습니다')
      advanceQueue(run)
      return
    case 'DEBUG':
      applyDebug(run, action.command)
      return
  }
}

/**
 * Pure reducer. Rule violations (EngineError) leave the state untouched and set `notice`
 * so the UI can explain what happened. Any other exception is a bug and is rethrown.
 */
export function gameReducer(state: RunState, action: GameAction): RunState {
  const run = cloneDeep(state)
  run.notice = null
  try {
    applyAction(run, action)
  } catch (err) {
    if (err instanceof EngineError) return { ...state, notice: err.message }
    throw err
  }
  return run
}
