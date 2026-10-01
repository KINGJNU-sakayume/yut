// Core type definitions for the Yut Roguelike engine ("모 아니면 도").
// Everything in src/game is pure TypeScript with no React dependency.

export type ResultKind = 'backdo' | 'do' | 'gae' | 'geol' | 'yut' | 'mo'
export const RESULT_KINDS: readonly ResultKind[] = ['backdo', 'do', 'gae', 'geol', 'yut', 'mo']

/** `back` is the flat, counted face of a Yut stick (배). `front` is the round face (등). */
export type StickFace = 'front' | 'back'

export type NodeId = string
export type NodeKind = 'normal' | 'corner' | 'center'
export type NodeRing = 'outer' | 'diagonal' | 'center'

export interface BoardNodeDef {
  id: NodeId
  kind: NodeKind
  ring: NodeRing
  name: string
  /** Layout position in a 0..100 square. Movement never uses these. */
  x: number
  y: number
}

export type Branch = 'outer' | 'shortcut' | 'toGoal' | 'toJjimo'

export type Zone = 'home' | 'board' | 'goal' | 'finished'

export interface Group {
  id: string
  /** Piece IDs (sorted ascending). */
  members: number[]
  zone: Zone
  /** Current node when zone === 'board'. */
  node: NodeId | null
  cargo: number
  momentum: number
  /** Extra laps taken (0..3). */
  laps: number
  /** Nodes traversed during the current lap, starting with the goal/start corner. Empty at home before entering. */
  route: NodeId[]
  /** Nodes whose base cargo was already collected during the current lap. */
  visited: NodeId[]
  /** Distinct outer nodes this group has ever traversed (all laps). */
  outerSeen: NodeId[]
  usedShortcut: boolean
  /** How many results of each kind were assigned to this group. */
  assigned: Record<ResultKind, number>
  /** Temporary protection against the next goblin phase (살금살금). */
  sneak: boolean
  /** 중앙집권 crowns waiting to be cashed out. */
  centerCrown: number
  samjokoDone: boolean
}

export interface GoblinIntent {
  result: ResultKind
  steps: number
  /** Pre-rolled random numbers used at forks so a changed distance keeps a deterministic path. */
  forkRolls: number[]
  /** Distance reduction applied by 소금. */
  weaken: number
  aimed: boolean
}

export interface Goblin {
  id: string
  node: NodeId
  /** Node the goblin arrived from (straight-line rule at the center). */
  prev: NodeId | null
  spawn: NodeId
  cargo: number
  baseCargo: number
  boss: boolean
  /** Resting goblins do not move during the next goblin phase (fresh spawns / respawns). */
  resting: boolean
  /** Extra movement distance (붉은 탈). */
  strength: number
  timesCaptured: number
  permanent: boolean
  intent: GoblinIntent | null
  /** Player cargo this goblin is carrying (recoverable by capturing it). */
  heldCargo: number
  heldFrom: number[]
}

export interface PendingResult {
  id: number
  kind: ResultKind
  originalKind: ResultKind
  faces: StickFace[]
  /** Cargo granted to the moved group by 금 윷 sticks showing their back face. */
  goldCargo: number
  ghostGate: boolean
  grantedExtra: boolean
  heung: number
  fromExtra: boolean
  conversions: string[]
}

export type BoardKind = 'small' | 'big' | 'boss'
export type WagerId = 'safe' | 'standard' | 'allIn'
export type BoardPhase = 'play' | 'goalDecision' | 'goblinTurn' | 'cleared' | 'failed'

export interface Blockade {
  /** Shortcut entry edge that is currently blocked, e.g. "o5>dA1". */
  current: string
  /** The next edge that will be blocked (announced in advance). */
  next: string
  /** Base-throws-used count at which `next` becomes `current`. */
  switchAt: number
}

export interface Suppression {
  uid: string
  /** Suppression ends once this many base throws have been used. */
  untilThrowsUsed: number
}

export interface BoardFlags {
  ironUsed: number[]
  reviveUsed: boolean
  rewindUsed: boolean
  firstCashOutDone: boolean
  extraGoblinsFromLaps: number
}

export type LogKind =
  | 'throw'
  | 'move'
  | 'capture'
  | 'captured'
  | 'stack'
  | 'goal'
  | 'score'
  | 'talisman'
  | 'goblin'
  | 'boss'
  | 'system'

export interface LogEntry {
  id: number
  kind: LogKind
  text: string
}

export interface MoveRecord {
  seq: number
  groupId: string
  members: number[]
  fromZone: Zone
  fromNode: NodeId | null
  path: NodeId[]
  toZone: Zone
  toNode: NodeId | null
  result: ResultKind
  cargoGained: number
  momentumGained: number
  captured: string[]
  stolen: number
  stackedWith: string | null
  fallback: boolean
}

export interface GoblinMoveRecord {
  goblinId: string
  from: NodeId
  path: NodeId[]
  to: NodeId
  captured: number[]
  stolen: number
  prevented: string | null
  rested: boolean
}

export interface GoblinPhaseRecord {
  seq: number
  moves: GoblinMoveRecord[]
}

export interface ThrowRecord {
  seq: number
  resultId: number
  faces: StickFace[]
  kind: ResultKind
  originalKind: ResultKind
  grantedExtra: boolean
  fromExtra: boolean
}

export interface ScoreLine {
  source: string
  value: number
}

export interface ScoreBreakdown {
  groupId: string
  members: number[]
  baseCargo: number
  cargoAdds: ScoreLine[]
  cargoMults: ScoreLine[]
  cargo: number
  baseMomentum: number
  momentumAdds: ScoreLine[]
  momentum: number
  stackSize: number
  stackMult: number
  stackMods: ScoreLine[]
  laps: number
  lapMult: number
  lapMods: ScoreLine[]
  finalMults: ScoreLine[]
  finalMult: number
  score: number
  post: string[]
}

export interface CashOutRecord {
  seq: number
  groupId: string
  members: number[]
  breakdown: ScoreBreakdown
}

export interface BoardStats {
  captures: number
  lostToGoblins: number
  recoveries: number
  triggers: Record<string, number>
  maxStack: number
}

export interface TriggerFlash {
  seq: number
  uids: string[]
}

export interface BoardState {
  index: number
  yard: number
  kind: BoardKind
  bossId: string | null
  target: number
  score: number
  wager: WagerId
  baseThrowsTotal: number
  baseThrowsLeft: number
  baseThrowsUsed: number
  extraThrows: number
  pending: PendingResult[]
  groups: Group[]
  goblins: Goblin[]
  phase: BoardPhase
  goalGroupId: string | null
  /** True after a base throw until the goblin phase ends. */
  turnActive: boolean
  turn: number
  /** 흥 chain (consecutive Yut/Mo). */
  heung: number
  history: ResultKind[]
  stickLocks: (StickFace | null)[]
  blockade: Blockade | null
  suppression: Suppression | null
  flags: BoardFlags
  seq: { group: number; goblin: number; result: number; event: number; log: number }
  rng: { throw: number; goblin: number }
  rewindSnapshot: BoardSnapshot | null
  throwSnapshot: BoardSnapshot | null
  lastThrow: ThrowRecord | null
  lastMove: MoveRecord | null
  lastGoblinPhase: GoblinPhaseRecord | null
  lastCashOut: CashOutRecord | null
  lastTriggers: TriggerFlash | null
  cashOuts: CashOutRecord[]
  log: LogEntry[]
  stats: BoardStats
  failReason: string | null
  /** Debug only: force the next throw's result. */
  forcedNext: ResultKind | null
}

/** Everything that a rewind (시간 역행) or fan (부채) restores. RNG streams are never restored. */
export interface BoardSnapshot {
  board: BoardState
  coins: number
  talismans: TalismanInstance[]
  blessings: TalismanInstance[]
}

export interface TalismanInstance {
  uid: string
  defId: string
  /** Growing value / streak counter, depending on the talisman. */
  counter: number
  /** Stored one-shot bonuses (e.g. 모모모). Reset every board. */
  charges: number
  usedThisBoard: number
  /** 1 normally, 2 when doubled at the Goblin Market. */
  power: number
}

export interface StickState {
  modId: string | null
  /** For 쌍둥이 윷: which stick it mirrors. */
  twinOf: number | null
}

export interface PieceState {
  id: number
  traitId: string | null
}

export interface RunMods {
  baseThrowDelta: number
  permanentGoblins: number
  goalScoreMult: number
  momentumBonus: Record<ResultKind, number>
  nextBoardThrows: number
  nextBoardMomentum: number
  sealed: { pieceId: number; untilYard: number }[]
}

export type RunPhase = 'wager' | 'board' | 'boardEnd' | 'event' | 'shop' | 'victory' | 'defeat'

export interface CoinLine {
  source: string
  amount: number
}

export interface BoardEndSummary {
  index: number
  yard: number
  kind: BoardKind
  bossId: string | null
  cleared: boolean
  reason: string | null
  score: number
  target: number
  baseThrowsLeft: number
  wager: WagerId
  coins: CoinLine[]
  coinsTotal: number
  triggers: { defId: string; count: number }[]
  bestCashOut: CashOutRecord | null
  captures: number
  lostToGoblins: number
}

export interface ShopTalismanOffer {
  defId: string
  price: number
  synergy: boolean
}

export interface ShopConsumableOffer {
  id: string
  price: number
}

export interface ShopSpecialOffer {
  kind: 'stickMod' | 'trait'
  id: string
  price: number
}

export interface ShopState {
  talismans: (ShopTalismanOffer | null)[]
  consumables: (ShopConsumableOffer | null)[]
  special: ShopSpecialOffer | null
  rerolls: number
  freeRerollUsed: boolean
}

export interface EventState {
  id: string
  stage: 'choose' | 'done'
  talismanOffers: string[]
  modOffers: string[]
  blessingOffers: string[]
  marketOffers: string[]
  cursedOffers: { defId: string; price: number }[]
  traitOffers: string[]
  rerolled: boolean
  message: string | null
  gamble: { faces: StickFace[]; kind: ResultKind; wager: number; payout: number } | null
}

export interface RunStats {
  cashOuts: number
  totalScore: number
  bestCashOut: number
  captures: number
  lostToGoblins: number
  recoveries: number
  boardsCleared: number
  maxLapsCashed: number
  fourStackCashOuts: number
  bestBoardCaptures: number
}

export interface RunState {
  format: 'yut-roguelike-run'
  version: number
  /** Unique id (seed + start time) used by meta progression to record each run once. */
  id: string
  seed: string
  seedNum: number
  debtLevel: number
  boardIndex: number
  phase: RunPhase
  coins: number
  talismans: TalismanInstance[]
  talismanCapacity: number
  consumables: string[]
  consumableCapacity: number
  sticks: StickState[]
  pieces: PieceState[]
  blessings: TalismanInstance[]
  mods: RunMods
  board: BoardState | null
  boardEnd: BoardEndSummary | null
  shop: ShopState | null
  event: EventState | null
  bosses: string[]
  queue: string[]
  history: BoardEndSummary[]
  stats: RunStats
  seqInstance: number
  rng: { run: number; shop: number; event: number }
  freeRerolls: number
  discovered: { talismans: string[]; bosses: string[]; events: string[] }
  /** Unlock IDs active for this run (copied from meta progression at run start). */
  unlocked: string[]
  /** Events visited this run (most recent last) — avoids immediate repeats. */
  eventHistory: string[]
  notice: string | null
}

export interface ConsumableParams {
  stickIndex?: number
  face?: StickFace
  result?: ResultKind
  goblinId?: string
  status?: 'suppression' | 'blockade'
}

export interface ShopBuyParams {
  stickIndex?: number
  twinOf?: number
  pieceId?: number
}

export interface EventParams {
  talismanIndex?: number
  offerIndex?: number
  stickIndex?: number
  stickIndex2?: number
  twinOf?: number
  pieceId?: number
  wager?: number
  defId?: string
}

export type DebugCommand =
  | { cmd: 'forceResult'; result: ResultKind }
  | { cmd: 'addCoins'; amount: number }
  | { cmd: 'addTalisman'; defId: string }
  | { cmd: 'setCargo'; groupId: string; value: number }
  | { cmd: 'setMomentum'; groupId: string; value: number }
  | { cmd: 'teleport'; groupId: string; node: NodeId }
  | { cmd: 'spawnGoblin' }
  | { cmd: 'jumpToBoss' }
  | { cmd: 'setTarget'; value: number }
  | { cmd: 'addThrows'; amount: number }
  | { cmd: 'addConsumable'; id: string }

export type GameAction =
  | { type: 'CHOOSE_WAGER'; wager: WagerId }
  | { type: 'THROW' }
  | { type: 'MOVE'; resultId: number; groupId: string; pathIndex: number }
  | { type: 'DISCARD_RESULT'; resultId: number }
  | { type: 'GOAL_DECISION'; choice: 'cashOut' | 'oneMoreLap' }
  | { type: 'RESOLVE_GOBLINS' }
  | { type: 'REWIND' }
  | { type: 'USE_CONSUMABLE'; slot: number; params?: ConsumableParams }
  | { type: 'DISCARD_CONSUMABLE'; slot: number }
  | { type: 'REORDER_TALISMAN'; from: number; to: number }
  | { type: 'CONTINUE' }
  | { type: 'SHOP_BUY'; section: 'talisman' | 'consumable' | 'special'; index: number; params?: ShopBuyParams }
  | { type: 'SHOP_REROLL' }
  | { type: 'SHOP_SELL'; index: number }
  | { type: 'SHOP_LEAVE' }
  | { type: 'EVENT_CHOOSE'; optionId: string; params?: EventParams }
  | { type: 'EVENT_LEAVE' }
  | { type: 'DEBUG'; command: DebugCommand }
