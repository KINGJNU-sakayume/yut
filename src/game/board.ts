// Board state machine: board setup, throwing, moving, stacking, captures, the goal decision,
// the goblin phase and board end. All functions mutate a *draft* RunState (the reducer clones).

import { getBoss } from '../data/bosses'
import { getConsumable } from '../data/consumables'
import { getTrait } from '../data/pieceTraits'
import { getTalismanDef } from '../data/talismans'
import { TARGETS } from '../data/targets'
import { allGoblinPlans, rollGoblinIntent, threatenedNodes } from './ai/goblinIntent'
import { GOAL, SHORTCUT_ENTRIES, SHORTCUT_ENTRY_NAMES, cargoValue, isOuter, isShortcutEntryEdge, isShortcutNode } from './boardGraph'
import {
  BOARD_KINDS,
  BOSS_TUNING,
  DEBT_LEVELS,
  ECONOMY,
  EXTRA_THROW_RESULTS,
  GOBLINS,
  LAP_ESCALATION,
  MAX_EXTRA_LAPS,
  RESULT_MOMENTUM,
  STARTING_MOMENTUM,
  STICKS,
  WAGERS,
  goblinBaseCargo,
} from './config'
import { makeEnv, ownsEffectKind, resetTalismansForBoard, runHook, silentEnv } from './effects/effectEngine'
import type { MoveScratch } from './effects/effectTypes'
import { EngineError, invariant } from './errors'
import { groupCargoFactor, legalMovesForResult, hasAnyLegalMove } from './movement'
import { deriveStream, draw, drawInt } from './rng'
import { computeScore } from './scoring'
import {
  activeGroups,
  cloneDeep,
  findGroup,
  freshGroup,
  groupAt,
  groupLabel,
  insertSorted,
  isSealed,
  pushLog,
  roundCargo,
  sortedUnion,
  yardOf,
} from './state'
import type {
  BoardEndSummary,
  BoardSnapshot,
  BoardState,
  CoinLine,
  ConsumableParams,
  Goblin,
  GoblinMoveRecord,
  Group,
  PendingResult,
  ResultKind,
  RunState,
  StickFace,
  WagerId,
} from './types'
import { baseThrowSetup, facesToResult, finalizeSetup, ghostGateMomentum, goldCargoFor, rollThrow, type ThrowSetup } from './yut'

export const RESULT_NAMES: Record<ResultKind, string> = {
  backdo: '빽도',
  do: '도',
  gae: '개',
  geol: '걸',
  yut: '윷',
  mo: '모',
}

export const WAGER_NAMES: Record<WagerId, string> = {
  safe: '안전',
  standard: '보통',
  allIn: '모 아니면 도',
}

export const BOARD_KIND_NAMES = { small: '작은 판', big: '큰 판', boss: '도깨비 대장 판' } as const

// ── Setup ────────────────────────────────────────────────────────────────

export function targetFor(run: RunState, index: number): number {
  const yard = yardOf(index)
  const row = TARGETS[Math.min(TARGETS.length - 1, yard - 1)]
  const base = row[index % 3]
  const mult = DEBT_LEVELS[Math.min(DEBT_LEVELS.length - 1, run.debtLevel)].targetMult
  return Math.round((base * mult) / 10) * 10
}

function pickSpawnNode(board: BoardState, preferred: number): string {
  const spawns = GOBLINS.spawns
  for (let k = 0; k < spawns.length; k++) {
    const node = spawns[(preferred + k) % spawns.length]
    if (!groupAt(board, node) && !board.goblins.some((g) => g.node === node)) return node
  }
  return spawns[preferred % spawns.length]
}

export function spawnGoblin(board: BoardState, opts: { boss: boolean; permanent: boolean; resting: boolean }): Goblin {
  board.seq.goblin += 1
  const spawn = pickSpawnNode(board, board.goblins.length)
  const base = goblinBaseCargo(board.yard) * (opts.boss ? GOBLINS.bossCargoMult : 1)
  const goblin: Goblin = {
    id: `k${board.seq.goblin}`,
    node: spawn,
    prev: null,
    spawn,
    cargo: base,
    baseCargo: base,
    boss: opts.boss,
    resting: opts.resting,
    strength: 0,
    timesCaptured: 0,
    permanent: opts.permanent,
    intent: null,
    heldCargo: 0,
    heldFrom: [],
  }
  board.goblins.push(goblin)
  return goblin
}

export function createBoardState(run: RunState, wager: WagerId): BoardState {
  const index = run.boardIndex
  const yard = yardOf(index)
  const kind = BOARD_KINDS[index % 3]
  const bossId = kind === 'boss' ? (run.bosses[yard - 1] ?? null) : null
  const baseThrows = Math.max(1, WAGERS[wager].baseThrows + run.mods.baseThrowDelta + run.mods.nextBoardThrows)
  return {
    index,
    yard,
    kind,
    bossId,
    target: targetFor(run, index),
    score: 0,
    wager,
    baseThrowsTotal: baseThrows,
    baseThrowsLeft: baseThrows,
    baseThrowsUsed: 0,
    extraThrows: 0,
    pending: [],
    groups: [],
    goblins: [],
    phase: 'play',
    goalGroupId: null,
    turnActive: false,
    turn: 1,
    heung: 0,
    history: [],
    stickLocks: Array.from({ length: STICKS.count }, () => null),
    blockade: null,
    suppression: null,
    flags: { ironUsed: [], reviveUsed: false, rewindUsed: false, firstCashOutDone: false, extraGoblinsFromLaps: 0 },
    seq: { group: 0, goblin: 0, result: 0, event: 0, log: 0 },
    rng: { throw: deriveStream(run.seedNum, 'throw', index), goblin: deriveStream(run.seedNum, 'goblin', index) },
    rewindSnapshot: null,
    throwSnapshot: null,
    lastThrow: null,
    lastMove: null,
    lastGoblinPhase: null,
    lastCashOut: null,
    lastTriggers: null,
    cashOuts: [],
    log: [],
    stats: { captures: 0, lostToGoblins: 0, recoveries: 0, triggers: {}, maxStack: 1 },
    failReason: null,
    forcedNext: null,
  }
}

/** Start the current board with the chosen wager. */
export function startBoard(run: RunState, wager: WagerId): void {
  const board = createBoardState(run, wager)
  const momentum = STARTING_MOMENTUM + run.mods.nextBoardMomentum
  for (const piece of run.pieces) {
    if (isSealed(run, piece.id, board.yard)) continue
    board.groups.push(freshGroup(board, [piece.id], momentum))
  }
  run.mods.nextBoardThrows = 0
  run.mods.nextBoardMomentum = 0

  const count = Math.min(GOBLINS.maxCount, GOBLINS.baseCount + run.mods.permanentGoblins)
  for (let i = 0; i < count; i++) {
    spawnGoblin(board, { boss: board.kind === 'boss' && i === 0, permanent: i >= GOBLINS.baseCount, resting: false })
  }

  const boss = getBoss(board.bossId)
  if (boss?.blockade) {
    const first = SHORTCUT_ENTRIES[drawInt(board.rng, 'goblin', SHORTCUT_ENTRIES.length)]
    const next = SHORTCUT_ENTRIES[drawInt(board.rng, 'goblin', SHORTCUT_ENTRIES.length)]
    board.blockade = { current: first, next, switchAt: BOSS_TUNING.blockadeInterval }
  }
  if (boss?.taffy) {
    let best: { uid: string; price: number } | null = null
    for (const inst of run.talismans) {
      const price = getTalismanDef(inst.defId)?.price ?? 0
      if (!best || price > best.price) best = { uid: inst.uid, price }
    }
    if (best) board.suppression = { uid: best.uid, untilThrowsUsed: BOSS_TUNING.taffyThrows }
  }

  resetTalismansForBoard(run)
  run.board = board
  run.boardEnd = null
  if (board.bossId && !run.discovered.bosses.includes(board.bossId)) run.discovered.bosses.push(board.bossId)

  const env = makeEnv(run, board)
  board.lastTriggers = { seq: 0, uids: [] }
  runHook(env, 'onBoardStart', { board })
  for (const g of board.goblins) g.intent = rollGoblinIntent(run, board, g)
  pushLog(board, 'system', `${board.yard}번째 마당 · ${BOARD_KIND_NAMES[board.kind]} 시작! 목표 ${board.target.toLocaleString()}점`)
  if (boss) pushLog(board, 'boss', `${boss.name}: ${boss.rule}`)
  if (board.suppression) {
    const inst = run.talismans.find((t) => t.uid === board.suppression?.uid)
    pushLog(board, 'boss', `엿장수 도깨비가 「${getTalismanDef(inst?.defId ?? '')?.name}」에 엿을 붙였다 (기본 던지기 ${BOSS_TUNING.taffyThrows}번 동안)`)
  }
  if (board.blockade) pushLog(board, 'boss', `${SHORTCUT_ENTRY_NAMES[board.blockade.current]}이 막혔다. 다음: ${SHORTCUT_ENTRY_NAMES[board.blockade.next]}`)
  run.phase = 'board'
}

// ── Snapshots (시간 역행 / 부채) ─────────────────────────────────────────

export function makeSnapshot(run: RunState, board: BoardState): BoardSnapshot {
  const { rewindSnapshot: _r, throwSnapshot: _t, ...rest } = board
  void _r
  void _t
  return cloneDeep({
    board: { ...rest, rewindSnapshot: null, throwSnapshot: null },
    coins: run.coins,
    talismans: run.talismans,
    blessings: run.blessings,
  })
}

function restoreSnapshot(run: RunState, current: BoardState, snapshot: BoardSnapshot): BoardState {
  const restored = cloneDeep(snapshot.board)
  restored.rng = { ...current.rng }
  restored.seq = { ...current.seq }
  restored.log = current.log.slice()
  restored.rewindSnapshot = null
  restored.throwSnapshot = null
  run.coins = snapshot.coins
  run.talismans = cloneDeep(snapshot.talismans)
  run.blessings = cloneDeep(snapshot.blessings)
  run.board = restored
  return restored
}

// ── Throwing ─────────────────────────────────────────────────────────────

export function computeThrowSetup(run: RunState, board: BoardState): ThrowSetup {
  const setup = baseThrowSetup(run.sticks, board.stickLocks)
  const ctx = { backProb: setup.backProb.slice(), hauntedSyncChance: 0 }
  runHook(silentEnv(run, board), 'beforeThrow', ctx)
  return finalizeSetup({ ...setup, backProb: ctx.backProb, hauntedSyncChance: ctx.hauntedSyncChance })
}

const FORCED_FACES: Record<ResultKind, StickFace[]> = {
  backdo: ['back', 'front', 'front', 'front'],
  do: ['front', 'back', 'front', 'front'],
  gae: ['front', 'back', 'back', 'front'],
  geol: ['front', 'back', 'back', 'back'],
  yut: ['back', 'back', 'back', 'back'],
  mo: ['front', 'front', 'front', 'front'],
}

export type ThrowAvailability = { can: true; kind: 'base' | 'extra' } | { can: false; reason: string }

export function throwAvailability(board: BoardState): ThrowAvailability {
  if (board.phase !== 'play') return { can: false, reason: '지금은 던질 수 없습니다' }
  if (board.extraThrows > 0) return { can: true, kind: 'extra' }
  if (board.pending.length > 0) return { can: false, reason: '먼저 나온 결과를 말에 배정하세요' }
  if (board.turnActive) return { can: false, reason: '도깨비 차례를 기다리는 중' }
  if (board.baseThrowsLeft <= 0) return { can: false, reason: '기본 던지기를 모두 썼습니다' }
  return { can: true, kind: 'base' }
}

function updateBossTimers(run: RunState, board: BoardState): void {
  if (board.suppression && board.baseThrowsUsed > board.suppression.untilThrowsUsed) {
    const inst = run.talismans.find((t) => t.uid === board.suppression?.uid)
    pushLog(board, 'boss', `「${getTalismanDef(inst?.defId ?? '')?.name ?? '부적'}」의 엿이 녹았다. 다시 작동한다!`)
    board.suppression = null
  }
  if (board.blockade && board.baseThrowsUsed > board.blockade.switchAt) {
    const b = board.blockade
    b.current = b.next
    b.next = SHORTCUT_ENTRIES[drawInt(board.rng, 'goblin', SHORTCUT_ENTRIES.length)]
    b.switchAt += BOSS_TUNING.blockadeInterval
    pushLog(board, 'boss', `길막이: 이제 ${SHORTCUT_ENTRY_NAMES[b.current]}이 막혔다. 다음: ${SHORTCUT_ENTRY_NAMES[b.next]}`)
  }
}

export function throwYut(run: RunState, board: BoardState): PendingResult {
  const availability = throwAvailability(board)
  if (!availability.can) throw new EngineError(availability.reason)
  board.throwSnapshot = makeSnapshot(run, board)
  const fromExtra = availability.kind === 'extra'
  if (fromExtra) board.extraThrows -= 1
  else {
    board.baseThrowsLeft -= 1
    board.baseThrowsUsed += 1
    board.turnActive = true
  }
  updateBossTimers(run, board)

  const setup = computeThrowSetup(run, board)
  const rolled = rollThrow(setup, () => draw(board.rng, 'throw'))
  const faces = board.forcedNext ? FORCED_FACES[board.forcedNext] : rolled.faces
  board.forcedNext = null
  const kind = facesToResult(faces, setup.markedIndex)
  board.seq.result += 1
  const result: PendingResult = {
    id: board.seq.result,
    kind,
    originalKind: kind,
    faces,
    goldCargo: goldCargoFor(faces, run.sticks),
    ghostGate: ghostGateMomentum(kind, run.sticks) > 0,
    grantedExtra: false,
    heung: 0,
    fromExtra,
    conversions: [],
  }
  const boss = getBoss(board.bossId)
  if (boss?.doBecomesBackdo && result.kind === 'do') {
    result.kind = 'backdo'
    result.conversions.push(boss.name)
  }
  const env = makeEnv(run, board)
  runHook(env, 'onThrow', { result })

  if (EXTRA_THROW_RESULTS.includes(result.kind) && !(result.kind === 'mo' && boss?.noMoExtraThrow)) {
    result.grantedExtra = true
    board.extraThrows += 1
  }
  let heungBreaking = false
  if (result.kind === 'yut' || result.kind === 'mo') {
    board.heung += 1
    result.heung = board.heung
  } else if (board.heung > 0) heungBreaking = true
  board.history.push(result.kind)
  const rctx = { result, heungBreaking }
  runHook(env, 'onResult', rctx)
  if (rctx.heungBreaking) board.heung = 0

  board.pending.push(result)
  board.stickLocks = board.stickLocks.map(() => null)
  board.seq.event += 1
  board.lastThrow = {
    seq: board.seq.event,
    resultId: result.id,
    faces,
    kind: result.kind,
    originalKind: result.originalKind,
    grantedExtra: result.grantedExtra,
    fromExtra,
  }
  const conv = result.conversions.length ? ` (${RESULT_NAMES[result.originalKind]} → ${RESULT_NAMES[result.kind]})` : ''
  const extra = result.grantedExtra ? ' · 한 번 더!' : result.kind === 'mo' && boss?.noMoExtraThrow ? ' · 외눈 도깨비가 추가 던지기를 막았다' : ''
  pushLog(board, 'throw', `${fromExtra ? '추가 던지기' : '던지기'}: ${RESULT_NAMES[result.kind]}${conv}${extra}`)
  return result
}

// ── Moving ───────────────────────────────────────────────────────────────

function mergeGroups(board: BoardState, mover: Group, other: Group): [number, number] {
  const sizes: [number, number] = [mover.members.length, other.members.length]
  mover.members = [...mover.members, ...other.members].sort((a, b) => a - b)
  mover.cargo += other.cargo
  mover.momentum = Math.max(mover.momentum, other.momentum) + 1
  mover.laps = Math.max(mover.laps, other.laps)
  mover.visited = sortedUnion(mover.visited, other.visited)
  mover.outerSeen = sortedUnion(mover.outerSeen, other.outerSeen)
  mover.usedShortcut = mover.usedShortcut || other.usedShortcut
  for (const k of Object.keys(mover.assigned) as ResultKind[]) mover.assigned[k] += other.assigned[k]
  mover.sneak = mover.sneak || other.sneak
  mover.centerCrown = Math.min(2, mover.centerCrown + other.centerCrown)
  mover.samjokoDone = mover.samjokoDone || other.samjokoDone
  board.groups = board.groups.filter((g) => g.id !== other.id)
  return sizes
}

function pickRespawnNode(board: BoardState, goblin: Goblin): string {
  const spawns = GOBLINS.spawns
  const start = Math.max(0, spawns.indexOf(goblin.spawn))
  for (let k = 0; k < spawns.length; k++) {
    const node = spawns[(start + k) % spawns.length]
    if (!groupAt(board, node) && !board.goblins.some((g) => g.id !== goblin.id && g.node === node)) return node
  }
  return goblin.spawn
}

function respawnGoblin(board: BoardState, goblin: Goblin): void {
  const boss = getBoss(board.bossId)
  goblin.timesCaptured += 1
  if (boss?.redMask) {
    goblin.strength = Math.min(GOBLINS.redMaskMaxStrength, goblin.strength + 1)
    goblin.baseCargo = Math.round(goblin.baseCargo * (1 + GOBLINS.redMaskCargoGrowth))
  }
  goblin.cargo = goblin.baseCargo
  goblin.heldCargo = 0
  goblin.heldFrom = []
  goblin.node = pickRespawnNode(board, goblin)
  goblin.prev = null
  goblin.resting = true
  goblin.intent = null
}

function captureGoblin(run: RunState, board: BoardState, group: Group, goblin: Goblin, result: PendingResult): number {
  const env = makeEnv(run, board)
  const ctx = { group, goblin, result, stolen: goblin.cargo }
  runHook(env, 'onCapture', ctx)
  const traitMomentum = group.members.reduce((s, pid) => s + (getTrait(run.pieces[pid]?.traitId)?.captureMomentum ?? 0), 0)
  if (traitMomentum > 0) {
    group.momentum += traitMomentum
    pushLog(board, 'capture', `장군말: 기세 +${traitMomentum}`)
  }
  const stolen = roundCargo(ctx.stolen)
  group.cargo += stolen
  board.stats.captures += 1
  if (goblin.heldCargo > 0) {
    board.stats.recoveries += 1
    run.stats.recoveries += 1
    pushLog(board, 'capture', `복수 성공! 빼앗겼던 화물 ${goblin.heldCargo}을(를) 되찾았다`)
  }
  pushLog(board, 'capture', `${groupLabel(group)}이(가) ${goblin.boss ? '도깨비 대장' : '도깨비'}를 잡았다! 화물 +${stolen}`)
  respawnGoblin(board, goblin)
  return stolen
}

export function applyMove(run: RunState, board: BoardState, resultId: number, groupId: string, pathIndex: number): void {
  invariant(board.phase === 'play', '지금은 말을 움직일 수 없습니다')
  const result = board.pending.find((r) => r.id === resultId)
  invariant(result, '그 결과는 이미 사용했습니다')
  const legal = legalMovesForResult(run, board, result)
  const option = legal.moves.find((m) => m.groupId === groupId)?.options[pathIndex]
  invariant(option, '그 말은 그 길로 갈 수 없습니다')
  const group = findGroup(board, groupId)
  invariant(group, '없는 말입니다')

  board.rewindSnapshot = makeSnapshot(run, board)
  board.throwSnapshot = null
  board.pending = board.pending.filter((r) => r.id !== resultId)
  const env = makeEnv(run, board)
  const threats = threatenedNodes(run, board)
  const startThreatened = group.zone === 'board' && group.node != null && threats.has(group.node)
  const fromZone = group.zone
  const fromNode = group.node
  const move: MoveScratch = { flags: {} }

  // 1. momentum
  let gain = RESULT_MOMENTUM[result.kind] + (run.mods.momentumBonus[result.kind] ?? 0)
  if (result.ghostGate) gain += ghostGateMomentum('backdo', run.sticks)
  const bctx = { group, result, momentumGain: gain, startThreatened, move }
  runHook(env, 'beforeMove', bctx)
  const momentumGained = Math.max(0, Math.round(bctx.momentumGain))
  group.momentum += momentumGained
  group.assigned[result.kind] += 1

  // 2. movement with per-step cargo
  let cargoGained = 0
  const traitFactor = groupCargoFactor(run, group)
  if (option.destZone === 'home') {
    group.zone = 'home'
    group.node = null
    group.route = []
  } else {
    if (group.zone === 'home') group.route = [GOAL]
    let prev: string | null = group.zone === 'home' ? GOAL : group.node
    option.nodes.forEach((node, i) => {
      const wasVisited = group.visited.includes(node)
      const baseValue = cargoValue(node)
      const sctx = {
        group,
        result,
        node,
        prev,
        stepIndex: i,
        stepCount: option.nodes.length,
        stepCargo: wasVisited ? 0 : baseValue,
        baseValue,
        wasVisited,
        backward: option.backward,
        enteringShortcut: !option.backward && isShortcutEntryEdge(prev, node),
        extraLap: group.laps > 0,
        move,
      }
      runHook(env, 'onMoveStep', sctx)
      const gained = roundCargo(sctx.stepCargo * traitFactor)
      group.cargo += gained
      cargoGained += gained
      insertSorted(group.visited, node)
      if (isOuter(node)) insertSorted(group.outerSeen, node)
      if (isShortcutNode(node)) group.usedShortcut = true
      if (!option.backward) group.route.push(node)
      prev = node
    })
    if (option.backward) group.route.pop()
    if (option.destZone === 'goal') {
      group.zone = 'goal'
      group.node = null
    } else {
      group.zone = 'board'
      group.node = option.dest
    }
  }
  if (result.goldCargo > 0) {
    group.cargo += result.goldCargo
    cargoGained += result.goldCargo
  }

  // 3. stacking
  let stackedWith: string | null = null
  if (group.zone === 'board' && group.node) {
    const other = board.groups.find((g) => g.id !== group.id && g.zone === 'board' && g.node === group.node)
    if (other) {
      stackedWith = other.id
      const sizes = mergeGroups(board, group, other)
      pushLog(board, 'stack', `업었다! ${groupLabel(group)} (${group.members.length}동)`)
      runHook(env, 'onStack', { group, sizes, size: group.members.length })
    }
  }
  board.stats.maxStack = Math.max(board.stats.maxStack, group.members.length)

  // 4. captures (also on the goal corner)
  const captureNode = group.zone === 'board' ? group.node : group.zone === 'goal' ? GOAL : null
  const captured: string[] = []
  let stolen = 0
  if (captureNode) {
    for (const goblin of board.goblins.filter((k) => k.node === captureNode)) {
      captured.push(goblin.id)
      stolen += captureGoblin(run, board, group, goblin, result)
    }
  }
  if (captured.length > 0) {
    board.extraThrows += 1
    pushLog(board, 'capture', '도깨비를 잡아 한 번 더 던진다!')
  }

  // 5. after-move hooks
  runHook(env, 'afterMove', { group, result, path: option.nodes, backward: option.backward, startThreatened, captures: captured.length, move })

  board.seq.event += 1
  board.lastMove = {
    seq: board.seq.event,
    groupId: group.id,
    members: [...group.members],
    fromZone,
    fromNode,
    path: option.nodes,
    toZone: group.zone,
    toNode: group.node,
    result: result.kind,
    cargoGained,
    momentumGained,
    captured,
    stolen,
    stackedWith,
    fallback: option.fallback,
  }
  const where = group.zone === 'home' ? '집' : group.zone === 'goal' ? '참먹이(도착)' : (group.node ?? '')
  pushLog(board, 'move', `${groupLabel(group)} ${RESULT_NAMES[result.kind]}${option.fallback ? '(출발 빽도)' : ''} → ${where} · 화물 +${cargoGained} · 기세 +${momentumGained}`)

  if (group.zone === 'goal') {
    board.phase = 'goalDecision'
    board.goalGroupId = group.id
    pushLog(board, 'goal', `${groupLabel(group)}이(가) 참먹이에 도착했다. 퇴근? 한 바퀴 더?`)
    return
  }
  endTurnIfDone(run, board)
}

export function discardResult(run: RunState, board: BoardState, resultId: number): void {
  invariant(board.phase === 'play', '지금은 버릴 수 없습니다')
  const result = board.pending.find((r) => r.id === resultId)
  invariant(result, '없는 결과입니다')
  if (hasAnyLegalMove(legalMovesForResult(run, board, result))) throw new EngineError('쓸 수 있는 결과는 버릴 수 없습니다')
  board.pending = board.pending.filter((r) => r.id !== resultId)
  board.throwSnapshot = null
  pushLog(board, 'system', `${RESULT_NAMES[result.kind]}: 움직일 수 있는 말이 없어 버렸다`)
  endTurnIfDone(run, board)
}

// ── Goal decision ────────────────────────────────────────────────────────

export function goalDecision(run: RunState, board: BoardState, choice: 'cashOut' | 'oneMoreLap'): void {
  invariant(board.phase === 'goalDecision' && board.goalGroupId, '참먹이에 도착한 말이 없습니다')
  const group = findGroup(board, board.goalGroupId)
  invariant(group, '없는 말입니다')
  if (choice === 'oneMoreLap' && group.laps >= MAX_EXTRA_LAPS) throw new EngineError(`추가 바퀴는 최대 ${MAX_EXTRA_LAPS}번입니다`)
  const env = makeEnv(run, board)
  runHook(env, 'onGoalDecision', { group, choice })

  if (choice === 'cashOut') {
    const bd = computeScore(run, board, group, env)
    board.score += bd.score
    group.zone = 'finished'
    group.node = null
    board.flags.firstCashOutDone = true
    board.seq.event += 1
    const record = { seq: board.seq.event, groupId: group.id, members: [...group.members], breakdown: bd }
    board.cashOuts.push(record)
    board.lastCashOut = record
    run.stats.cashOuts += 1
    run.stats.totalScore += bd.score
    run.stats.bestCashOut = Math.max(run.stats.bestCashOut, bd.score)
    run.stats.maxLapsCashed = Math.max(run.stats.maxLapsCashed, group.laps)
    if (group.members.length >= 4) run.stats.fourStackCashOuts += 1
    runHook(env, 'onGoal', { group, breakdown: bd })
    runHook(env, 'afterScore', { group, breakdown: bd })
    pushLog(board, 'score', `퇴근! ${groupLabel(group)} → ${bd.score.toLocaleString()}점`)
    board.phase = 'play'
    board.goalGroupId = null
    if (board.score >= board.target) {
      clearBoard(run, board)
      return
    }
    if (activeGroups(board).length === 0) {
      failBoard(run, board, '모든 말이 퇴근했지만 목표 점수에 미치지 못했다')
      return
    }
    endTurnIfDone(run, board)
    return
  }

  group.laps += 1
  group.zone = 'home'
  group.node = null
  group.route = []
  group.visited = []
  board.phase = 'play'
  board.goalGroupId = null
  pushLog(board, 'goal', `한 바퀴 더! ${groupLabel(group)} — 추가 바퀴 ${group.laps}번째`)
  if (group.laps === LAP_ESCALATION.spawnGoblinAtLap) {
    if (board.goblins.length < GOBLINS.maxCount) {
      const g = spawnGoblin(board, { boss: false, permanent: false, resting: true })
      board.flags.extraGoblinsFromLaps += 1
      pushLog(board, 'goblin', `욕심 냄새를 맡고 도깨비가 하나 더 나타났다 (${g.node})`)
    }
  }
  if (group.laps === LAP_ESCALATION.distanceBonusAtLap) {
    pushLog(board, 'goblin', `세 번째 추가 바퀴: 이 무리가 판에 있는 동안 모든 도깨비 이동 +${LAP_ESCALATION.distanceBonus}`)
  }
  endTurnIfDone(run, board)
}

// ── Turn end & goblin phase ──────────────────────────────────────────────

export function endTurnIfDone(run: RunState, board: BoardState): void {
  if (board.phase !== 'play' || !board.turnActive) return
  if (board.pending.length > 0 || board.extraThrows > 0) return
  if (board.baseThrowsLeft <= 0) {
    failBoard(run, board, '기본 던지기를 모두 썼지만 목표 점수에 미치지 못했다')
    return
  }
  board.phase = 'goblinTurn'
}

function resolveGoblinCapture(run: RunState, board: BoardState, goblin: Goblin, group: Group, rec: GoblinMoveRecord): void {
  if (group.sneak) {
    rec.prevented = '살금살금'
    pushLog(board, 'goblin', `${groupLabel(group)}: 살금살금 숨어서 들키지 않았다`)
    return
  }
  const iron = group.members.find((pid) => getTrait(run.pieces[pid]?.traitId)?.preventFirstCapture && !board.flags.ironUsed.includes(pid))
  if (iron != null) {
    board.flags.ironUsed.push(iron)
    rec.prevented = '무쇠말'
    pushLog(board, 'goblin', `무쇠말이 도깨비 방망이를 튕겨냈다! (${iron + 1}번 말, 이번 판 1회)`)
    return
  }
  const env = makeEnv(run, board)
  const ctx = { group, goblin, cancel: false, reviveHome: false, destroyCargo: false }
  runHook(env, 'onCaptured', ctx)
  if (ctx.cancel) {
    rec.prevented = '부적'
    return
  }
  board.stats.lostToGoblins += 1
  run.stats.lostToGoblins += 1
  rec.captured = [...group.members]
  if (ctx.reviveHome) {
    if (ctx.destroyCargo) group.cargo = 0
    group.zone = 'home'
    group.node = null
    group.route = []
    group.sneak = false
    return
  }
  const stolen = ctx.destroyCargo ? 0 : group.cargo
  goblin.cargo += stolen
  goblin.heldCargo += stolen
  goblin.heldFrom = Array.from(new Set([...goblin.heldFrom, ...group.members])).sort((a, b) => a - b)
  rec.stolen = stolen
  board.groups = board.groups.filter((g) => g.id !== group.id)
  for (const pid of group.members) board.groups.push(freshGroup(board, [pid]))
  pushLog(
    board,
    'captured',
    `${goblin.boss ? '도깨비 대장' : '도깨비'}가 ${groupLabel(group)}을(를) 잡았다! 화물 ${stolen}을(를) 빼앗기고 집으로 돌아간다${stolen > 0 ? ' — 그 도깨비를 잡으면 되찾을 수 있다' : ''}`,
  )
}

export function resolveGoblins(run: RunState, board: BoardState): void {
  invariant(board.phase === 'goblinTurn', '도깨비 차례가 아닙니다')
  const plans = allGoblinPlans(run, board)
  const moves: GoblinMoveRecord[] = []
  for (const plan of plans) {
    const goblin = board.goblins.find((g) => g.id === plan.goblinId)
    if (!goblin) continue
    const from = goblin.node
    const rec: GoblinMoveRecord = { goblinId: goblin.id, from, path: plan.path, to: from, captured: [], stolen: 0, prevented: null, rested: plan.resting }
    if (plan.resting) {
      goblin.resting = false
      moves.push(rec)
      continue
    }
    if (plan.landing) {
      goblin.prev = plan.path.length >= 2 ? plan.path[plan.path.length - 2] : from
      goblin.node = plan.landing
      rec.to = plan.landing
      const target = groupAt(board, plan.landing)
      if (target) resolveGoblinCapture(run, board, goblin, target, rec)
    }
    moves.push(rec)
  }
  for (const g of board.groups) g.sneak = false
  runHook(makeEnv(run, board), 'onThreatEnd', { board })
  for (const goblin of board.goblins) {
    goblin.resting = false
    goblin.intent = rollGoblinIntent(run, board, goblin)
  }
  board.seq.event += 1
  board.lastGoblinPhase = { seq: board.seq.event, moves }
  board.phase = 'play'
  board.turnActive = false
  board.turn += 1
}

// ── 시간 역행 ────────────────────────────────────────────────────────────

export function canRewind(run: RunState, board: BoardState): boolean {
  if (board.phase !== 'play' || board.flags.rewindUsed || !board.rewindSnapshot) return false
  if (!ownsEffectKind(run, board, 'rewindTurn')) return false
  const latest = board.pending[board.pending.length - 1]
  return Boolean(latest && latest.kind === 'backdo' && board.lastThrow?.resultId === latest.id)
}

export function rewindTurn(run: RunState, board: BoardState): BoardState {
  invariant(canRewind(run, board), '지금은 시간을 되돌릴 수 없습니다')
  const inst = ownsEffectKind(run, board, 'rewindTurn')!
  const restored = restoreSnapshot(run, board, board.rewindSnapshot!)
  restored.flags.rewindUsed = true
  const restoredInst = run.talismans.find((t) => t.uid === inst.uid)
  if (restoredInst) restoredInst.usedThisBoard += 1
  restored.stats.triggers[inst.defId] = (restored.stats.triggers[inst.defId] ?? 0) + 1
  restored.lastTriggers = { seq: restored.seq.event + 1, uids: [inst.uid] }
  restored.seq.event += 1
  pushLog(restored, 'talisman', '시간 역행! 빽도를 제물로 직전 이동 전으로 돌아왔다')
  return restored
}

// ── Consumables ──────────────────────────────────────────────────────────

export function canUseFan(board: BoardState | null): boolean {
  if (!board || board.phase !== 'play' || !board.throwSnapshot) return false
  const latest = board.pending[board.pending.length - 1]
  return Boolean(latest && board.lastThrow?.resultId === latest.id)
}

export function applyConsumable(run: RunState, slot: number, params: ConsumableParams = {}): void {
  const id = run.consumables[slot]
  invariant(id, '빈 소모품 칸입니다')
  const def = getConsumable(id)
  invariant(def, '알 수 없는 소모품입니다')
  const board = run.board && run.phase === 'board' ? run.board : null
  switch (id) {
    case 'yeot': {
      invariant(board && board.phase === 'play', '판 위에서만 쓸 수 있습니다')
      const i = params.stickIndex ?? -1
      invariant(i >= 0 && i < STICKS.count && (params.face === 'back' || params.face === 'front'), '막대와 면을 고르세요')
      board.stickLocks[i] = params.face!
      pushLog(board, 'system', `엿: ${i + 1}번 막대를 ${params.face === 'back' ? '배(평면)' : '등(곡면)'}으로 고정했다 (다음 던지기)`)
      break
    }
    case 'fan': {
      invariant(board && canUseFan(board), '이동하기 전의 가장 최근 던지기만 다시 던질 수 있습니다')
      const restored = restoreSnapshot(run, board, board.throwSnapshot!)
      run.consumables.splice(slot, 1)
      pushLog(restored, 'system', '부채로 바람을 일으켜 다시 던진다!')
      throwYut(run, restored)
      return
    }
    case 'luckyPouch': {
      const r = params.result
      invariant(r && r in run.mods.momentumBonus, '결과를 고르세요')
      run.mods.momentumBonus[r] += 2
      if (board) pushLog(board, 'system', `복주머니: 앞으로 ${RESULT_NAMES[r]} 배정 시 기세 +2`)
      break
    }
    case 'salt': {
      invariant(board, '판 위에서만 쓸 수 있습니다')
      if (params.goblinId) {
        const goblin = board.goblins.find((g) => g.id === params.goblinId)
        invariant(goblin && goblin.intent && !goblin.resting, '이번에 움직일 도깨비를 고르세요')
        goblin.intent.weaken += 1
        pushLog(board, 'system', '소금을 뿌렸다! 그 도깨비의 이번 이동 거리 -1')
      } else if (params.status === 'suppression') {
        invariant(board.suppression, '엿이 붙은 부적이 없습니다')
        board.suppression = null
        pushLog(board, 'system', '소금으로 엿을 녹였다. 부적이 다시 작동한다')
      } else if (params.status === 'blockade') {
        invariant(board.blockade, '막힌 길이 없습니다')
        board.blockade = null
        pushLog(board, 'system', '소금으로 길막이의 결계를 걷어냈다 (이번 판)')
      } else throw new EngineError('도깨비나 대장 효과를 고르세요')
      break
    }
    default:
      throw new EngineError('알 수 없는 소모품입니다')
  }
  run.consumables.splice(slot, 1)
}

// ── Board end ────────────────────────────────────────────────────────────

function summarize(board: BoardState, cleared: boolean, coins: CoinLine[]): BoardEndSummary {
  const triggers = Object.entries(board.stats.triggers)
    .map(([defId, count]) => ({ defId, count }))
    .sort((a, b) => b.count - a.count || a.defId.localeCompare(b.defId))
  const best = board.cashOuts.reduce<BoardEndSummary['bestCashOut']>(
    (b, c) => (!b || c.breakdown.score > b.breakdown.score ? c : b),
    null,
  )
  return {
    index: board.index,
    yard: board.yard,
    kind: board.kind,
    bossId: board.bossId,
    cleared,
    reason: board.failReason,
    score: board.score,
    target: board.target,
    baseThrowsLeft: board.baseThrowsLeft,
    wager: board.wager,
    coins,
    coinsTotal: coins.reduce((s, c) => s + c.amount, 0),
    triggers,
    bestCashOut: best,
    captures: board.stats.captures,
    lostToGoblins: board.stats.lostToGoblins,
  }
}

export function clearBoard(run: RunState, board: BoardState): void {
  board.phase = 'cleared'
  const wager = WAGERS[board.wager]
  const coins: CoinLine[] = []
  const reward = Math.round(ECONOMY.clearReward[board.kind] * wager.rewardMult)
  coins.push({ source: `판 클리어 (${WAGER_NAMES[board.wager]} ×${wager.rewardMult})`, amount: reward })
  if (wager.extraCoins > 0) coins.push({ source: '모 아니면 도 보너스', amount: wager.extraCoins })
  const interest = Math.min(ECONOMY.interestMax, Math.floor(run.coins / ECONOMY.interestPer))
  if (interest > 0) coins.push({ source: `이자 (엽전 ${ECONOMY.interestPer}냥당 1, 최대 ${ECONOMY.interestMax})`, amount: interest })
  const ratio = board.score / Math.max(1, board.target)
  const overkill = Math.min(ECONOMY.overkillMaxCoins, Math.floor(Math.log2(Math.max(1, ratio))))
  if (overkill > 0) coins.push({ source: `초과 달성 (목표의 ${ratio.toFixed(1)}배)`, amount: overkill })
  const env = makeEnv(run, board)
  runHook(env, 'onBoardEnd', { cleared: true, coins })
  const summary = summarize(board, true, coins)
  run.coins += summary.coinsTotal
  run.stats.boardsCleared += 1
  run.stats.captures += board.stats.captures
  run.stats.bestBoardCaptures = Math.max(run.stats.bestBoardCaptures, board.stats.captures)
  pushLog(board, 'system', `판을 깼다! ${board.score.toLocaleString()} / ${board.target.toLocaleString()}`)
  run.boardEnd = summary
  run.phase = 'boardEnd'
}

export function failBoard(run: RunState, board: BoardState, reason: string): void {
  board.phase = 'failed'
  board.failReason = reason
  runHook(makeEnv(run, board), 'onBoardEnd', { cleared: false, coins: [] })
  run.stats.captures += board.stats.captures
  run.stats.bestBoardCaptures = Math.max(run.stats.bestBoardCaptures, board.stats.captures)
  pushLog(board, 'system', `판에서 졌다: ${reason}`)
  run.boardEnd = summarize(board, false, [])
  run.phase = 'boardEnd'
}
