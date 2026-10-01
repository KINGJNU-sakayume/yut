// Event definitions (만남). Resolution logic lives in src/game/events.ts.

export interface EventDef {
  id: string
  name: string
  glyph: string
  description: string
  /** Goblin Market is scheduled separately, not drawn from the random pool. */
  special?: boolean
  unlock?: string
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'seonghwang',
    name: '성황당',
    glyph: '祠',
    description: '오색 천이 나부끼는 서낭당. 부적을 바치면 신령이 무언가를 내어 준다.',
  },
  {
    id: 'jumak',
    name: '주막',
    glyph: '酒',
    description: '국밥 냄새가 나는 주막. 엽전만 있으면 다음 판을 든든하게 준비할 수 있다.',
  },
  {
    id: 'daejang',
    name: '대장간',
    glyph: '鍛',
    description: '대장장이가 윷가락을 손봐 준다. 막대 하나를 개조할 수 있다.',
  },
  {
    id: 'nolum',
    name: '노름판',
    glyph: '賭',
    description: '엽전을 걸고 내 윷으로 한 번 던진다. 배당표는 공개되어 있다.',
    unlock: 'event:nolum',
  },
  {
    id: 'sansin',
    name: '산신령',
    glyph: '山',
    description: '흰 수염의 산신령이 세 가지 축복 중 하나를 내린다. 축복은 런 내내 이어진다.',
    unlock: 'event:sansin',
  },
  {
    id: 'goblinMarket',
    name: '도깨비 장터',
    glyph: '市',
    description: '도깨비들의 밤 장터. 판의 구조를 팔아 강한 힘을 산다. 모든 거래는 되돌릴 수 없다.',
    special: true,
  },
]

export const EVENT_MAP: Readonly<Record<string, EventDef>> = Object.fromEntries(EVENTS.map((e) => [e.id, e]))

export function getEvent(id: string): EventDef | null {
  return EVENT_MAP[id] ?? null
}

/** Payout multipliers for 노름판 (the wager is returned × multiplier). */
export const GAMBLE_PAYOUT: Record<string, number> = {
  backdo: 0,
  do: 0,
  gae: 0,
  geol: 2,
  yut: 4,
  mo: 5,
}

export const GAMBLE_WAGERS = [2, 5, 10] as const

/** Goblin Market exchanges. */
export interface MarketOfferDef {
  id: string
  cost: string
  reward: string
}

export const MARKET_OFFERS: readonly MarketOfferDef[] = [
  { id: 'throwsForLegend', cost: '앞으로 매 판 기본 던지기 -1 (영구)', reward: '전설 부적 1개 (보이는 것 중 선택)' },
  { id: 'slotForPower', cost: '부적 칸 -1 (영구)', reward: '고른 부적의 핵심 효과 2배' },
  { id: 'sealForMods', cost: '말 하나를 다음 마당 동안 봉인', reward: '윷 개조 2개 (각각 막대 선택)' },
  { id: 'goblinForScore', cost: '도깨비 1마리 영구 추가', reward: '모든 퇴근 점수 ×1.25 (영구)' },
  { id: 'coinsForCopy', cost: '가진 엽전의 절반', reward: '고른 부적 복제 (전설·저주 제외, 빈 칸 필요)' },
]
