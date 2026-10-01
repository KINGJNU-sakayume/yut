// Hook names, hook contexts and effect parameter shapes for the talisman effect system.

import type {
  BoardState,
  CoinLine,
  Goblin,
  Group,
  LogKind,
  NodeId,
  PendingResult,
  ResultKind,
  RunState,
  ScoreBreakdown,
  ScoreLine,
  TalismanInstance,
} from '../types'

/**
 * Hook order during play (see README):
 * onBoardStart → beforeThrow → onThrow → onResult → beforeMove → onMoveStep → afterMove →
 * onStack → onCapture → onThreatEnd → onGoalDecision → beforeScore → onGoal → afterScore → onBoardEnd.
 * `onCaptured` fires when a goblin catches a player group. `query*` hooks are passive modifiers.
 */
export type HookName =
  | 'onBoardStart'
  | 'beforeThrow'
  | 'onThrow'
  | 'onResult'
  | 'beforeMove'
  | 'onMoveStep'
  | 'afterMove'
  | 'onStack'
  | 'onCapture'
  | 'onCaptured'
  | 'onThreatEnd'
  | 'onGoalDecision'
  | 'beforeScore'
  | 'onGoal'
  | 'afterScore'
  | 'onBoardEnd'
  | 'queryShopPrice'
  | 'queryGoblinDistance'
  | 'queryLapTable'

/** Score calculation phases, always applied in this order. */
export type ScorePhase = 'addCargo' | 'addMomentum' | 'cargoMult' | 'stackLapMult' | 'finalMult'
export const SCORE_PHASES: readonly ScorePhase[] = ['addCargo', 'addMomentum', 'cargoMult', 'stackLapMult', 'finalMult']

export interface EffectEnv {
  run: RunState
  board: BoardState | null
  /** Mark a talisman as having fired (UI flash + "major triggers" summary). */
  trigger(inst: TalismanInstance): void
  addCoins(amount: number, source: string): void
  log(kind: LogKind, text: string): void
}

export interface MoveScratch {
  flags: Record<string, number>
}

export interface BoardStartCtx {
  board: BoardState
}
export interface BeforeThrowCtx {
  backProb: number[]
  hauntedSyncChance: number
}
export interface OnThrowCtx {
  result: PendingResult
}
export interface OnResultCtx {
  result: PendingResult
  heungBreaking: boolean
}
export interface BeforeMoveCtx {
  group: Group
  result: PendingResult
  momentumGain: number
  startThreatened: boolean
  move: MoveScratch
}
export interface MoveStepCtx {
  group: Group
  result: PendingResult
  node: NodeId
  prev: NodeId | null
  stepIndex: number
  stepCount: number
  stepCargo: number
  baseValue: number
  wasVisited: boolean
  backward: boolean
  enteringShortcut: boolean
  extraLap: boolean
  move: MoveScratch
}
export interface AfterMoveCtx {
  group: Group
  result: PendingResult
  path: NodeId[]
  backward: boolean
  startThreatened: boolean
  captures: number
  move: MoveScratch
}
export interface StackCtx {
  group: Group
  sizes: [number, number]
  size: number
}
export interface CaptureCtx {
  group: Group
  goblin: Goblin
  result: PendingResult
  stolen: number
}
export interface CapturedCtx {
  group: Group
  goblin: Goblin
  cancel: boolean
  reviveHome: boolean
  destroyCargo: boolean
}
export interface ThreatEndCtx {
  board: BoardState
}
export interface GoalDecisionCtx {
  group: Group
  choice: 'cashOut' | 'oneMoreLap'
}
export interface ScoreCtx {
  group: Group
  phase: ScorePhase
  bd: ScoreBreakdown
}
export interface AfterScoreCtx {
  group: Group
  breakdown: ScoreBreakdown
}
export interface BoardEndCtx {
  cleared: boolean
  coins: CoinLine[]
}
export interface ShopPriceCtx {
  factor: number
}
export interface GoblinDistanceCtx {
  bonus: number
  parts: ScoreLine[]
}
export interface LapTableCtx {
  table: number[]
  sources: string[]
}

export interface HookCtxMap {
  onBoardStart: BoardStartCtx
  beforeThrow: BeforeThrowCtx
  onThrow: OnThrowCtx
  onResult: OnResultCtx
  beforeMove: BeforeMoveCtx
  onMoveStep: MoveStepCtx
  afterMove: AfterMoveCtx
  onStack: StackCtx
  onCapture: CaptureCtx
  onCaptured: CapturedCtx
  onThreatEnd: ThreatEndCtx
  onGoalDecision: GoalDecisionCtx
  beforeScore: ScoreCtx
  onGoal: AfterScoreCtx
  afterScore: AfterScoreCtx
  onBoardEnd: BoardEndCtx
  queryShopPrice: ShopPriceCtx
  queryGoblinDistance: GoblinDistanceCtx
  queryLapTable: LapTableCtx
}

/** Flat parameter bag shared by all effect kinds (each kind reads only what it needs). */
export interface EffectParams {
  results?: ResultKind[]
  result?: ResultKind
  factor?: number
  amount?: number
  coins?: number
  cargo?: number
  n?: number
  size?: number
  minStack?: number
  stepIndex?: number
  streak?: number
  laps?: number
  minCargo?: number
  cargoFactor?: number
  finalFactor?: number
  momentum?: number
  perNode?: number
  table?: number[]
  goblinDistance?: number
  withLap?: number
  withoutLap?: number
  lossPct?: number
  syncChance?: number
  from?: ResultKind
  to?: ResultKind
  perBoard?: number
  perHeung?: number
  stealFactor?: number
  count?: number
  maxStacks?: number
}

export type EffectKind =
  | 'stepCargoMultiplier'
  | 'growOnResult'
  | 'addCounterToStepCargo'
  | 'sneakAfterMove'
  | 'addMomentumOnResult'
  | 'momentumOnStackSize'
  | 'finalMultIfStack'
  | 'counterScoreMomentum'
  | 'coinsEveryNth'
  | 'doubleCargoOnNthAssign'
  | 'streakMomentumAll'
  | 'heungMomentum'
  | 'momentumIfExtraThrow'
  | 'preventHeungBreak'
  | 'streakCharge'
  | 'consumeChargeFinal'
  | 'recollectVisitedNode'
  | 'escapeThreatCargo'
  | 'multiplyCaptureCargo'
  | 'rewindTurn'
  | 'stepCargoPerStackMember'
  | 'captureBonusIfStack'
  | 'fullStackJackpot'
  | 'coinsOnCapture'
  | 'momentumOnCapture'
  | 'threatStartCargo'
  | 'captureRicher'
  | 'shortcutEntryCargo'
  | 'centerLanding'
  | 'cargoPerDistinctOuter'
  | 'noShortcutFinal'
  | 'extraLapStepCargo'
  | 'momentumOnOneMoreLap'
  | 'exactLapFinal'
  | 'modifyLapTable'
  | 'coinsPerUnusedThrow'
  | 'coinsOnCornerPass'
  | 'freeRerollAfterBoss'
  | 'capturedPenalty'
  | 'hauntedSticks'
  | 'convertResult'
  | 'modifyShopPrice'
  | 'lapConditionalFinal'
  | 'reviveFirstCapture'
  | 'momentumGainMultiplier'
  | 'nonResultStreakPenalty'
  | 'boardStartMomentum'
  | 'boardStartThrows'
  | 'scoreMomentumFlat'
  | 'scoreCargoFlat'
  | 'captureFlatCargo'
  | 'finalMultFlat'
  | 'modifyStackMultiplier'
  | 'modifyLapMultiplier'
  | 'coinsOnCashOut'
  | 'grantExtraThrow'

export interface EffectSpec {
  hook: HookName
  kind: EffectKind
  params?: EffectParams
  /** Only for `beforeScore`: the score phase this entry participates in. */
  phase?: ScorePhase
}

export type EffectHandler = {
  [H in HookName]?: (ctx: HookCtxMap[H], inst: TalismanInstance, params: EffectParams, env: EffectEnv, name: string) => void
} & {
  /** Called for every owned talisman at board start (reset per-board state). */
  boardReset?: (inst: TalismanInstance, params: EffectParams) => void
}
