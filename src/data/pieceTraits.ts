// Piece traits (말 특성). One major trait per piece. Declarative flags read by the engine.

export interface PieceTraitDef {
  id: string
  name: string
  glyph: string
  description: string
  /** Prevent the first capture against this piece each board. */
  preventFirstCapture?: boolean
  /** Multiplier on cargo gained from nodes while this piece is in the moving group. */
  cargoMult?: number
  /** This piece can never stack (moves onto own groups are illegal). */
  noStack?: boolean
  /** Momentum gained by its group when it captures a goblin. */
  captureMomentum?: number
  /** Stronger lap multiplier table for its group. */
  lapTable?: readonly number[]
  /** Cannot voluntarily end a move on a currently threatened landing node. */
  avoidThreat?: boolean
  /** Moves this many extra physical nodes on forward results. */
  extraStep?: number
  price: number
}

export const PIECE_TRAITS: readonly PieceTraitDef[] = [
  {
    id: 'iron',
    name: '무쇠말',
    glyph: '鐵',
    description: '판마다 이 말이 처음 잡힐 때 한 번은 막아낸다.',
    preventFirstCapture: true,
    price: 6,
  },
  {
    id: 'bundle',
    name: '보따리말',
    glyph: '包',
    description: '이 말이 얻는 칸 화물 +50%. 대신 절대 업을 수도, 업힐 수도 없다.',
    cargoMult: 1.5,
    noStack: true,
    price: 6,
  },
  {
    id: 'general',
    name: '장군말',
    glyph: '將',
    description: '이 말이 있는 무리가 도깨비를 잡으면 기세 +2.',
    captureMomentum: 2,
    price: 5,
  },
  {
    id: 'wanderer',
    name: '역마말',
    glyph: '驛',
    description: '이 말이 있는 무리의 바퀴 배수가 강해진다: ×2 / ×3 / ×5.',
    lapTable: [1, 2, 3, 5],
    price: 6,
  },
  {
    id: 'coward',
    name: '겁쟁이말',
    glyph: '怯',
    description: '도깨비가 노리는 칸에는 스스로 멈출 수 없다. 대신 얻는 칸 화물 +25%.',
    avoidThreat: true,
    cargoMult: 1.25,
    price: 5,
  },
  {
    id: 'swift',
    name: '날쌘말',
    glyph: '迅',
    description: '앞으로 갈 때 한 칸 더 간다. 결과 이름(도·개·걸…)과 부적 판정은 원래대로.',
    extraStep: 1,
    price: 7,
  },
]

export const PIECE_TRAIT_MAP: Readonly<Record<string, PieceTraitDef>> = Object.fromEntries(PIECE_TRAITS.map((t) => [t.id, t]))

export function getTrait(id: string | null | undefined): PieceTraitDef | null {
  if (!id) return null
  return PIECE_TRAIT_MAP[id] ?? null
}
