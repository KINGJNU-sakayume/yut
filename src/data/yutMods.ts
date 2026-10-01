// Yut-stick modifications. The engine reads the declarative fields; no logic lives here.

export interface StickModDef {
  id: string
  name: string
  glyph: string
  description: string
  /** Added to this stick's back-face (flat side) probability. */
  backDelta?: number
  /** Invert this stick's final face. */
  invert?: boolean
  /** Mirror another stick's final face (target chosen when installed). */
  twin?: boolean
  /** Cargo the moved group gains when this stick shows its back face. */
  goldCargo?: number
  /** Extra momentum when this (marked) stick produces Backdo. */
  ghostGateMomentum?: number
  /** Can only be installed on the marked Backdo stick. */
  markedOnly?: boolean
  price: number
}

export const STICK_MODS: readonly StickModDef[] = [
  {
    id: 'heavy',
    name: '무거운 윷',
    glyph: '重',
    description: '이 막대의 평평한 면(배)이 나올 확률 +15%.',
    backDelta: 0.15,
    price: 6,
  },
  {
    id: 'light',
    name: '가벼운 윷',
    glyph: '輕',
    description: '이 막대의 평평한 면(배)이 나올 확률 -15%. 모를 노릴 때.',
    backDelta: -0.15,
    price: 6,
  },
  {
    id: 'gold',
    name: '금 윷',
    glyph: '金',
    description: '이 막대가 배(평면)로 나오면, 그 결과로 움직인 무리가 화물 +5.',
    goldCargo: 5,
    price: 6,
  },
  {
    id: 'twin',
    name: '쌍둥이 윷',
    glyph: '雙',
    description: '선택한 다른 막대와 항상 같은 면이 나옵니다.',
    twin: true,
    price: 7,
  },
  {
    id: 'invert',
    name: '역귀 윷',
    glyph: '逆',
    description: '이 막대의 최종 면을 뒤집습니다.',
    invert: true,
    price: 5,
  },
  {
    id: 'ghostGate',
    name: '귀문 윷',
    glyph: '鬼',
    description: '뒷도 표시 막대 전용. 이 막대로 빽도가 나오면 기세 +3.',
    ghostGateMomentum: 3,
    markedOnly: true,
    price: 6,
  },
]

export const STICK_MOD_MAP: Readonly<Record<string, StickModDef>> = Object.fromEntries(STICK_MODS.map((m) => [m.id, m]))

export function getStickMod(id: string | null | undefined): StickModDef | null {
  if (!id) return null
  return STICK_MOD_MAP[id] ?? null
}
