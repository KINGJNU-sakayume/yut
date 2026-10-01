// Consumables (소모품): luck correction tools. Two slots.

export type ConsumableTarget = 'stickFace' | 'none' | 'result' | 'goblinOrStatus'

export interface ConsumableDef {
  id: string
  name: string
  glyph: string
  description: string
  /** What the player must pick when using it. */
  target: ConsumableTarget
  price: number
}

export const CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: 'yeot',
    name: '엿',
    glyph: '飴',
    description: '막대 하나를 골라 다음 던지기에서 원하는 면(배/등)으로 고정한다.',
    target: 'stickFace',
    price: 3,
  },
  {
    id: 'fan',
    name: '부채',
    glyph: '扇',
    description: '가장 최근 던지기를 이동 전에 버리고 다시 던진다. (던지기 횟수는 그대로)',
    target: 'none',
    price: 3,
  },
  {
    id: 'luckyPouch',
    name: '복주머니',
    glyph: '福',
    description: '결과 하나(빽도~모)를 골라, 이번 런 동안 그 결과를 배정할 때 기세 +2.',
    target: 'result',
    price: 4,
  },
  {
    id: 'salt',
    name: '소금',
    glyph: '鹽',
    description: '도깨비 하나의 이번 이동 거리를 1 줄이거나, 대장의 일시 효과(엿 붙은 부적 / 막힌 길) 하나를 없앤다.',
    target: 'goblinOrStatus',
    price: 3,
  },
]

export const CONSUMABLE_MAP: Readonly<Record<string, ConsumableDef>> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]))

export function getConsumable(id: string): ConsumableDef | null {
  return CONSUMABLE_MAP[id] ?? null
}
