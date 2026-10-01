import { describe, expect, it } from 'vitest'
import { forwardOptions, reverseOptions } from '../boardGraph'
import { BACKDO_FALLBACK_RULE, backwardPathOption, forwardPathOptions, legalMovesForResult } from '../movement'
import { act, addGoblin, boardRun, finishTurn, groupOf, lastPendingId, place, rejected, setIntent, throwAs } from './helpers'

describe('board graph', () => {
  it('has 29 nodes with stable ids and correct cargo kinds', async () => {
    const { NODES, cargoValue } = await import('../boardGraph')
    expect(NODES).toHaveLength(29)
    expect(cargoValue('o3')).toBe(5)
    expect(cargoValue('o5')).toBe(15)
    expect(cargoValue('o0')).toBe(15)
    expect(cargoValue('c')).toBe(30)
    expect(cargoValue('dA1')).toBe(5)
  })

  it('forks only at the start of a move', () => {
    expect(forwardOptions('o5', 'o4', true).map((o) => o.node)).toEqual(['o6', 'dA1'])
    expect(forwardOptions('o5', 'o4', false).map((o) => o.node)).toEqual(['o6'])
    expect(forwardOptions('o10', 'o9', true).map((o) => o.node)).toEqual(['o11', 'dB1'])
    expect(forwardOptions('c', 'dA2', true).map((o) => o.node)).toEqual(['dD1', 'dC1'])
    expect(forwardOptions('c', 'dA2', false).map((o) => o.node)).toEqual(['dC1'])
    expect(forwardOptions('c', 'dB2', false).map((o) => o.node)).toEqual(['dD1'])
  })

  it('goblins walk in reverse with forks at the goal, center and 찌모', () => {
    expect(reverseOptions('o3', null)).toEqual(['o2'])
    expect(reverseOptions('o0', 'o1')).toEqual(['o19', 'dD2'])
    expect(reverseOptions('c', 'dD1')).toEqual(['dB2'])
    expect(reverseOptions('c', null)).toEqual(['dA2', 'dB2'])
    expect(reverseOptions('o15', 'o16')).toEqual(['o14', 'dC2'])
  })
})

describe('outer-board movement', () => {
  it('a home piece enters at 도 and walks the outer path', () => {
    let run = boardRun()
    const g = groupOf(run, 0)
    run = throwAs(run, 'geol')
    const legal = legalMovesForResult(run, run.board!, run.board!.pending[0])
    const opts = legal.moves.find((m) => m.groupId === g.id)!.options
    expect(opts).toHaveLength(1)
    expect(opts[0].nodes).toEqual(['o1', 'o2', 'o3'])
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: g.id, pathIndex: 0 })
    const after = groupOf(run, 0)
    expect(after.node).toBe('o3')
    expect(after.route).toEqual(['o0', 'o1', 'o2', 'o3'])
    expect(after.cargo).toBe(15)
    expect(after.momentum).toBe(1 + 3)
  })

  it('passing a corner mid-move keeps to the outer path', () => {
    const run = boardRun()
    const g = place(run, 0, 'o3')
    expect(forwardPathOptions(g, 3).map((o) => o.nodes)).toEqual([['o4', 'o5', 'o6']])
  })

  it('reaching the goal stops early and is flagged', () => {
    const run = boardRun()
    const g = place(run, 0, 'o18')
    const opts = forwardPathOptions(g, 4)
    expect(opts).toHaveLength(1)
    expect(opts[0].nodes).toEqual(['o19', 'o0'])
    expect(opts[0].destZone).toBe('goal')
  })
})

describe('shortcut routing', () => {
  it('offers outer and shortcut paths when starting on 모 (o5)', () => {
    const run = boardRun()
    const g = place(run, 0, 'o5')
    const paths = forwardPathOptions(g, 2)
    expect(paths.map((p) => [p.branch, p.nodes])).toEqual([
      ['outer', ['o6', 'o7']],
      ['shortcut', ['dA1', 'dA2']],
    ])
  })

  it('passing straight through the center from 모 continues toward 찌모', () => {
    const run = boardRun()
    const g = place(run, 0, 'dA2', ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'dA1', 'dA2'])
    expect(forwardPathOptions(g, 3).map((p) => p.nodes)).toEqual([['c', 'dC1', 'dC2']])
  })

  it('passing through the center from 뒷모 continues straight to the goal', () => {
    const run = boardRun()
    const g = place(run, 0, 'dB2', ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'dB1', 'dB2'])
    const paths = forwardPathOptions(g, 4)
    expect(paths).toHaveLength(1)
    expect(paths[0].nodes).toEqual(['c', 'dD1', 'dD2', 'o0'])
    expect(paths[0].destZone).toBe('goal')
  })

  it('stopping on the center lets the player choose either exit', () => {
    const run = boardRun()
    const g = place(run, 0, 'c', ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'dA1', 'dA2', 'c'])
    expect(forwardPathOptions(g, 2).map((p) => [p.branch, p.nodes])).toEqual([
      ['toGoal', ['dD1', 'dD2']],
      ['toJjimo', ['dC1', 'dC2']],
    ])
  })

  it('player must explicitly pick the branch through the reducer', () => {
    let run = boardRun()
    const g = place(run, 0, 'o10')
    run = throwAs(run, 'do')
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: g.id, pathIndex: 1 })
    expect(groupOf(run, 0).node).toBe('dB1')
    expect(groupOf(run, 0).usedShortcut).toBe(true)
  })

  it('a blocked shortcut (길막이) is not offered', () => {
    const run = boardRun()
    run.board!.blockade = { current: 'o5>dA1', next: 'o10>dB1', switchAt: 99 }
    const g = place(run, 0, 'o5')
    const legal = legalMovesForResult(run, run.board!, { id: 1, kind: 'do', originalKind: 'do', faces: [], goldCargo: 0, ghostGate: false, grantedExtra: false, heung: 0, fromExtra: false, conversions: [] })
    expect(legal.moves.find((m) => m.groupId === g.id)!.options.map((o) => o.nodes)).toEqual([['o6']])
  })
})

describe('Backdo movement', () => {
  it('moves back along the route history', () => {
    let run = boardRun()
    const g = place(run, 0, 'dA1', ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'dA1'])
    expect(backwardPathOption(g)?.nodes).toEqual(['o5'])
    run = throwAs(run, 'backdo')
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: g.id, pathIndex: 0 })
    const after = groupOf(run, 0)
    expect(after.node).toBe('o5')
    expect(after.route).toEqual(['o0', 'o1', 'o2', 'o3', 'o4', 'o5'])
    expect(after.momentum).toBe(1 + 2)
  })

  it('backs off the first node into home, keeping cargo', () => {
    let run = boardRun()
    const g = place(run, 0, 'o1')
    g.cargo = 5
    run = throwAs(run, 'backdo')
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: g.id, pathIndex: 0 })
    const after = groupOf(run, 0)
    expect(after.zone).toBe('home')
    expect(after.cargo).toBe(5)
  })

  it('fallback: with everyone at home, Backdo becomes one forward step that still counts as Backdo', () => {
    expect(BACKDO_FALLBACK_RULE).toContain('빽도')
    let run = boardRun()
    run = throwAs(run, 'backdo')
    const legal = legalMovesForResult(run, run.board!, run.board!.pending[0])
    expect(legal.fallback).toBe(true)
    expect(legal.moves).toHaveLength(4)
    const g = groupOf(run, 2)
    expect(legal.moves.find((m) => m.groupId === g.id)!.options[0].nodes).toEqual(['o1'])
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: g.id, pathIndex: 0 })
    const after = groupOf(run, 2)
    expect(after.node).toBe('o1')
    expect(after.cargo).toBe(5)
    expect(after.momentum).toBe(1 + 2)
    expect(after.assigned.backdo).toBe(1)
    expect(run.board!.lastMove?.fallback).toBe(true)
  })

  it('a result can be discarded only when no legal move exists (겁쟁이말 + visible threat)', () => {
    let run = boardRun()
    run.pieces[0].traitId = 'coward'
    for (const pid of [1, 2, 3]) groupOf(run, pid).zone = 'finished'
    place(run, 0, 'o3')
    const goblin = addGoblin(run, 'o7', { prev: 'o8' })
    setIntent(goblin, 2) // o6 → o5: lands on o5
    run = throwAs(run, 'gae')
    const legal = legalMovesForResult(run, run.board!, run.board!.pending[0])
    expect(legal.moves[0].options).toHaveLength(0)
    expect(legal.moves[0].illegal[0].reason).toContain('겁쟁이말')
    run = act(run, { type: 'DISCARD_RESULT', resultId: lastPendingId(run) })
    expect(run.board!.phase).toBe('goblinTurn')
  })

  it('discarding a usable result is refused', () => {
    let run = boardRun()
    run = throwAs(run, 'gae')
    rejected(run, { type: 'DISCARD_RESULT', resultId: lastPendingId(run) })
    const after = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: groupOf(run, 0).id, pathIndex: 0 })
    expect(finishTurn(after).board!.phase).toBe('play')
  })
})
