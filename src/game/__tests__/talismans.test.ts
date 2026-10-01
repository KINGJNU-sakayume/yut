import { describe, expect, it } from 'vitest'
import { TALISMANS } from '../../data/talismans'
import { goblinPlan } from '../ai/goblinIntent'
import { EFFECT_REGISTRY } from '../effects/effectRegistry'
import { silentEnv } from '../effects/effectEngine'
import { lapTableFor, computeScore } from '../scoring'
import { createShop, priceOf } from '../shop'
import { act, addGoblin, boardRun, finishTurn, groupOf, moveLatest, place, setIntent, throwAs } from './helpers'

describe('talisman data integrity', () => {
  it('every effect entry points at a registered handler for its hook', () => {
    for (const def of TALISMANS) {
      for (const spec of def.effects) {
        const handler = EFFECT_REGISTRY[spec.kind]
        expect(handler, `${def.id}: ${spec.kind}`).toBeDefined()
        if (spec.kind === 'rewindTurn') continue
        expect(handler[spec.hook], `${def.id}: ${spec.kind}.${spec.hook}`).toBeTypeOf('function')
        if (spec.hook === 'beforeScore') expect(spec.phase, `${def.id} needs a score phase`).toBeDefined()
      }
      if (def.rarity === 'cursed') expect(def.downside, `${def.id} must show its downside`).toBeTruthy()
    }
  })

  it('has a meaningful pool: 30+ shop talismans and 6 cursed talismans', () => {
    expect(TALISMANS.filter((t) => t.pool === 'shop').length).toBeGreaterThanOrEqual(30)
    expect(TALISMANS.filter((t) => t.rarity === 'cursed').length).toBeGreaterThanOrEqual(6)
  })
})

describe('left-to-right ordering', () => {
  function doMoveCargo(order: string[]): number {
    let run = boardRun({ talismans: order })
    const tikkeul = run.talismans.find((t) => t.defId === 'tikkeul')!
    tikkeul.counter = 4 // becomes 5 after the Do is thrown
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 0).id)
    return groupOf(run, 0).cargo
  }

  it('티끌 모아 태산 (+N) before 한 걸음 천리 (×1.5) differs from the reverse order', () => {
    const addThenMultiply = doMoveCargo(['tikkeul', 'hangeolum'])
    const multiplyThenAdd = doMoveCargo(['hangeolum', 'tikkeul'])
    expect(addThenMultiply).toBe(Math.round((5 + 5) * 1.5)) // 15
    expect(multiplyThenAdd).toBe(Math.round(5 * 1.5 + 5)) // 13
    expect(addThenMultiply).not.toBe(multiplyThenAdd)
  })

  it('reordering through the reducer changes the result', () => {
    let run = boardRun({ talismans: ['hangeolum', 'tikkeul'] })
    run = act(run, { type: 'REORDER_TALISMAN', from: 1, to: 0 })
    expect(run.talismans.map((t) => t.defId)).toEqual(['tikkeul', 'hangeolum'])
  })

  it('blessings resolve after all talismans', () => {
    // 햅쌀 (+25 cargo) is a blessing; 만선-like cargo multipliers in talismans happen in a later phase anyway,
    // so check ordering inside the same hook: 호랑이 수염 (+20 steal) runs after 뒤로 잡기 (×3).
    let run = boardRun({ talismans: ['dwirojapgi'] })
    run = act(run, { type: 'DEBUG', command: { cmd: 'addTalisman', defId: 'b_whisker' } })
    const g = place(run, 0, 'o3')
    addGoblin(run, 'o2', { cargo: 10 })
    run = throwAs(run, 'backdo')
    run = moveLatest(run, g.id)
    // place() puts the group on o3 with cargo 0; o2 was already visited (no node cargo).
    expect(groupOf(run, 0).cargo).toBe(10 * 3 + 20)
  })
})

describe('representative talisman effects', () => {
  it('쌍복: Gae gives +1 extra momentum', () => {
    let run = boardRun({ talismans: ['ssangbok'] })
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).momentum).toBe(1 + 2 + 1)
  })

  it('가마: each extra stacked piece adds cargo per node', () => {
    let run = boardRun({ talismans: ['gama'] })
    place(run, 0, 'o2')
    place(run, 1, 'o2', ['o0', 'o1', 'o2'])
    // Merge the two manually through a move: piece 1 steps back and forth would be noisy; stack via Do.
    groupOf(run, 1).node = 'o1'
    groupOf(run, 1).route = ['o0', 'o1']
    groupOf(run, 1).visited = ['o1']
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id) // o2 already visited by piece 1? no: piece 1 visited only o1
    const stack = groupOf(run, 0)
    expect(stack.members).toEqual([0, 1])
    run = finishTurn(run)
    const before = stack.cargo
    run = throwAs(run, 'gae') // o3, o4 normal: (5 + 3) × 2
    run = moveLatest(run, stack.id)
    expect(groupOf(run, 0).cargo - before).toBe(16)
  })

  it('뒤로 잡기: capturing with Backdo steals ×3', () => {
    let run = boardRun({ talismans: ['dwirojapgi'] })
    const g = place(run, 0, 'o3')
    addGoblin(run, 'o2', { cargo: 20 })
    run = throwAs(run, 'backdo')
    run = moveLatest(run, g.id)
    expect(groupOf(run, 0).cargo).toBe(20 * 3)
  })

  it('업보: 3+ stacks score a ×1.5 final multiplier', () => {
    const run = boardRun({ talismans: ['eopbo'] })
    const g = run.board!.groups[0]
    g.members = [0, 1, 2]
    g.cargo = 100
    g.momentum = 10
    const bd = computeScore(run, run.board!, g, silentEnv(run, run.board!))
    expect(bd.finalMults.map((l) => l.value)).toEqual([1.5])
    expect(bd.score).toBe(Math.floor(100 * 10 * 2.25 * 1.5))
  })

  it('모모모: two Mo in a row charge a ×3 for the next cash-out', () => {
    let run = boardRun({ talismans: ['momomo'] })
    run = throwAs(run, 'mo')
    run = throwAs(run, 'mo')
    expect(run.talismans[0].charges).toBe(1)
    const g = run.board!.groups[0]
    g.cargo = 10
    g.momentum = 1
    const bd = computeScore(run, run.board!, g, silentEnv(run, run.board!))
    expect(bd.finalMult).toBe(3)
  })

  it('얼쑤 keeps the 흥 chain alive once per board; 장단 맞추기 turns 흥 into momentum', () => {
    let run = boardRun({ talismans: ['eolssu', 'jangdan'] })
    run = throwAs(run, 'yut')
    expect(run.board!.heung).toBe(1)
    run = throwAs(run, 'gae')
    expect(run.board!.heung).toBe(1) // saved by 얼쑤
    run = moveLatest(run, groupOf(run, 0).id) // Gae (흥 0 on this result)
    run = act(run, { type: 'MOVE', resultId: run.board!.pending[0].id, groupId: groupOf(run, 1).id, pathIndex: 0 })
    // Yut carried 흥 1 → +2 momentum from 장단 맞추기
    expect(groupOf(run, 1).momentum).toBe(1 + 4 + 2)
    run = finishTurn(run)
    run = throwAs(run, 'do')
    expect(run.board!.heung).toBe(0) // second break is not prevented
  })

  it('삼족오: the third Geol for one group doubles its cargo once', () => {
    let run = boardRun({ talismans: ['samjogo'] })
    const id = groupOf(run, 0).id
    for (let i = 0; i < 3; i++) {
      run = throwAs(run, 'geol')
      run = moveLatest(run, id, 0)
      run = finishTurn(run)
    }
    // o1..o3 (15) + o4,o5,o6 (5+15+5=25) + o7,o8,o9 (15) = 55 → doubled to 110
    expect(groupOf(run, 0).cargo).toBe(110)
    expect(groupOf(run, 0).samjokoDone).toBe(true)
  })

  it('작심삼일: three Geols in a row give every active group +3 momentum', () => {
    let run = boardRun({ talismans: ['jaksim'] })
    run = throwAs(run, 'geol')
    run = moveLatest(run, groupOf(run, 0).id)
    run = finishTurn(run)
    run = throwAs(run, 'geol')
    run = moveLatest(run, groupOf(run, 0).id)
    run = finishTurn(run)
    run = throwAs(run, 'geol')
    expect(groupOf(run, 3).momentum).toBe(1 + 3)
  })

  it('황금 복주머니 doubles node cargo but raises shop prices ×1.75', () => {
    let run = boardRun({ talismans: ['hwanggeum'] })
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).cargo).toBe(20)
    expect(priceOf(run, 4)).toBe(7)
    const shop = createShop(run)
    for (const offer of shop.consumables) if (offer) expect(offer.price).toBeGreaterThanOrEqual(5)
  })

  it('복조리 pays for unused base throws when the board is cleared', () => {
    let run = boardRun({ talismans: ['bokjori'] })
    run.board!.target = 10
    const g = place(run, 0, 'o19')
    g.cargo = 50
    run = throwAs(run, 'do')
    run = moveLatest(run, g.id)
    run = act(run, { type: 'GOAL_DECISION', choice: 'cashOut' })
    const line = run.boardEnd!.coins.find((c) => c.source.startsWith('복조리'))
    expect(line?.amount).toBe(run.boardEnd!.baseThrowsLeft)
  })

  it('집 나가면 고생: stronger lap table, goblins +1 while a group is on an extra lap', () => {
    const run = boardRun({ talismans: ['jipnaga'] })
    const g = run.board!.groups[0]
    expect(lapTableFor(run, run.board!, g).table).toEqual([1, 2, 3, 6])
    const goblin = addGoblin(run, 'o8', { prev: 'o9' })
    setIntent(goblin, 2)
    expect(goblinPlan(run, run.board!, goblin).steps).toBe(2)
    g.laps = 1
    expect(goblinPlan(run, run.board!, goblin).steps).toBe(3)
  })

  it('a doubled talisman (도깨비 장터) doubles its core effect', () => {
    let run = boardRun({ talismans: ['ssangbok'] })
    run.talismans[0].power = 2
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).momentum).toBe(1 + 2 + 2)
  })
})

describe('cursed talismans', () => {
  it('피 묻은 방망이: ×3 capture, but being captured destroys cargo and costs 10 coins', () => {
    let run = boardRun({ talismans: ['pimudeun'] })
    run.coins = 25
    const g = place(run, 0, 'o3')
    g.cargo = 40
    const goblin = addGoblin(run, 'o6', { prev: 'o7', cargo: 10 })
    setIntent(goblin, 3)
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id)
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    expect(run.board!.goblins[0].cargo).toBe(10) // nothing recoverable
    expect(run.coins).toBe(15)
  })

  it('귀신 들린 윷: Do becomes Backdo', () => {
    let run = boardRun({ talismans: ['gwisin'] })
    run = throwAs(run, 'do')
    expect(run.board!.pending[0].kind).toBe('backdo')
  })

  it('저승 명부: the first captured group revives at home with its cargo; the rightmost other talisman pays', () => {
    let run = boardRun({ talismans: ['jeoseung', 'ssangbok', 'podo'] })
    const g = place(run, 0, 'o3')
    g.cargo = 40
    g.momentum = 6
    const goblin = addGoblin(run, 'o6', { prev: 'o7', cargo: 10 })
    setIntent(goblin, 3)
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id)
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    const revived = groupOf(run, 0)
    expect(revived.zone).toBe('home')
    expect(revived.cargo).toBe(40)
    expect(revived.momentum).toBe(6)
    expect(run.board!.goblins[0].cargo).toBe(10)
    run.board!.baseThrowsLeft = 1
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 2).id)
    expect(run.phase).toBe('boardEnd')
    expect(run.talismans.map((t) => t.defId)).toEqual(['jeoseung', 'ssangbok'])
  })

  it('모 아니면 죽음: Mo momentum ×2; four non-Mo results in a row burn 40% of the richest cargo', () => {
    let run = boardRun({ talismans: ['moaniJugeum'] })
    run = throwAs(run, 'mo')
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 0).id) // the Do (latest)
    run = act(run, { type: 'MOVE', resultId: run.board!.pending[0].id, groupId: groupOf(run, 0).id, pathIndex: 0 })
    expect(groupOf(run, 0).momentum).toBe(1 + 1 + 10)
    run = finishTurn(run)
    groupOf(run, 0).cargo = 100
    for (let i = 0; i < 2; i++) {
      run = throwAs(run, 'gae')
      run = moveLatest(run, groupOf(run, 1).id)
      run = finishTurn(run)
    }
    expect(groupOf(run, 0).cargo).toBe(100)
    run = throwAs(run, 'gae') // 4th non-Mo result in a row
    expect(groupOf(run, 0).cargo).toBe(60)
  })
})

describe('bosses', () => {
  it('엿장수 도깨비 suppresses the most valuable talisman for the first base throws', () => {
    let run = boardRun({ talismans: ['ssangbok', 'eopbo'], boardIndex: 2, bossId: 'taffy' })
    // Board setup already ran; re-apply the boss suppression for the test board.
    run.board!.suppression = { uid: run.talismans[0].uid, untilThrowsUsed: 3 }
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(run.board!.lastMove!.momentumGained).toBe(2) // 쌍복 suppressed
    run = finishTurn(run)
    for (let i = 0; i < 2; i++) {
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 1).id)
      run = finishTurn(run)
    }
    run = throwAs(run, 'gae') // 4th base throw: suppression lifted
    expect(run.board!.suppression).toBeNull()
    run = moveLatest(run, groupOf(run, 2).id)
    expect(run.board!.lastMove!.momentumGained).toBe(2 + 1)
  })

  it('욕심 도깨비 taxes the first cash-out, less with extra laps', () => {
    const run = boardRun({ bossId: 'greedy' })
    const g = run.board!.groups[0]
    g.cargo = 100
    g.momentum = 10
    expect(computeScore(run, run.board!, g, silentEnv(run, run.board!)).score).toBe(400)
    g.laps = 2
    expect(computeScore(run, run.board!, g, silentEnv(run, run.board!)).finalMult).toBeCloseTo(0.8)
    run.board!.flags.firstCashOutDone = true
    expect(computeScore(run, run.board!, g, silentEnv(run, run.board!)).finalMult).toBe(1)
  })

  it('외톨이 도깨비: bigger stacks make every goblin move farther', () => {
    const run = boardRun({ bossId: 'loner' })
    const goblin = addGoblin(run, 'o8', { prev: 'o9' })
    setIntent(goblin, 2)
    expect(goblinPlan(run, run.board!, goblin).steps).toBe(2)
    run.board!.groups[0].members = [0, 1, 2]
    expect(goblinPlan(run, run.board!, goblin).steps).toBe(4)
  })

  it('a real boss board starts with its rule active', () => {
    const run = boardRun({ boardIndex: 2, keepGoblins: true })
    expect(run.board!.kind).toBe('boss')
    expect(run.board!.bossId).toBe(run.bosses[0])
    expect(run.board!.goblins.some((g) => g.boss)).toBe(true)
  })
})

describe('legendary: 시간 역행', () => {
  it('after a Backdo, rewinds to before the previous move and discards the Backdo', () => {
    let run = boardRun({ talismans: ['sigan'] })
    run = throwAs(run, 'geol')
    const id = groupOf(run, 0).id
    run = moveLatest(run, id)
    expect(groupOf(run, 0).node).toBe('o3')
    run = finishTurn(run)
    const throwsBefore = run.board!.baseThrowsLeft
    run = throwAs(run, 'backdo')
    run = act(run, { type: 'REWIND' })
    const board = run.board!
    expect(groupOf(run, 0).zone).toBe('home')
    expect(board.pending.map((p) => p.kind)).toEqual(['geol'])
    expect(board.flags.rewindUsed).toBe(true)
    expect(board.lastMove).toBeNull()
    expect(board.lastCashOut).toBeNull()
    // The snapshot predates the Backdo's base throw, so that throw is refunded.
    expect(board.baseThrowsLeft).toBe(throwsBefore)
    // Once per board.
    run = moveLatest(run, id)
    run = finishTurn(run)
    run = throwAs(run, 'backdo')
    expect(run.board!.flags.rewindUsed).toBe(true)
    const next = act(run, { type: 'DEBUG', command: { cmd: 'addCoins', amount: 0 } })
    expect(next.board!.pending.at(-1)?.kind).toBe('backdo')
  })
})
