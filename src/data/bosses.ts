// Boss goblins (도깨비 대장). Declarative rule flags are read by the engine.

export interface BossDef {
  id: string
  name: string
  glyph: string
  /** One-line rule shown before the board starts and in the HUD. */
  rule: string
  detail: string
  /** Mo still moves 5 but grants no free throw. */
  noMoExtraThrow?: boolean
  /** Normal Do becomes Backdo (Backdo effects still trigger). */
  doBecomesBackdo?: boolean
  /** Goblin distance + (largest player stack − 1) × value. */
  lonerDistancePerMember?: number
  /** The first cash-out of the board is taxed; extra laps reduce the tax. */
  greedyTax?: boolean
  /** One shortcut entry is blocked; the next blocked route is announced. */
  blockade?: boolean
  /** The highest-value talisman is suppressed for the first few base throws. */
  taffy?: boolean
  /** Captured goblins return stronger and with a bigger bounty. */
  redMask?: boolean
  unlock?: string
}

export const BOSSES: readonly BossDef[] = [
  {
    id: 'oneEye',
    name: '외눈 도깨비',
    glyph: '目',
    rule: '모는 5칸 그대로 가지만 추가 던지기를 주지 않는다.',
    detail: '윷은 여전히 추가 던지기를 준다. 모에 기대는 빌드는 흐름이 끊긴다.',
    noMoExtraThrow: true,
  },
  {
    id: 'upsideDown',
    name: '거꾸로 도깨비',
    glyph: '倒',
    rule: '도가 나오면 빽도가 된다. (빽도 효과는 그대로 발동)',
    detail: '빽도 부적이 있다면 오히려 기회다.',
    doBecomesBackdo: true,
  },
  {
    id: 'loner',
    name: '외톨이 도깨비',
    glyph: '孤',
    rule: '가장 큰 내 무리의 말 1개가 늘 때마다 모든 도깨비 이동 +1.',
    detail: '업을수록 도깨비가 멀리 뛴다. 위협 범위는 늘 공개된다.',
    lonerDistancePerMember: 1,
  },
  {
    id: 'greedy',
    name: '욕심 도깨비',
    glyph: '貪',
    rule: '이 판의 첫 퇴근은 세금으로 60%를 빼앗긴다. 추가 바퀴 1번마다 세금 20%p 감소.',
    detail: '첫 퇴근 점수 ×0.4 / ×0.6 / ×0.8 / ×1 (추가 바퀴 0~3).',
    greedyTax: true,
  },
  {
    id: 'blocker',
    name: '길막이 도깨비',
    glyph: '塞',
    rule: '모서리 지름길 하나가 막힌다. 다음에 막힐 길은 미리 알려준다 (기본 던지기 3번마다 교대).',
    detail: '막힌 지름길로는 들어갈 수 없다. 방에서 나가는 길은 막지 않는다.',
    blockade: true,
    unlock: 'boss:blocker',
  },
  {
    id: 'taffy',
    name: '엿장수 도깨비',
    glyph: '飴',
    rule: '가장 비싼 부적 하나가 처음 기본 던지기 3번 동안 엿에 붙어 작동하지 않는다.',
    detail: '부적은 사라지지 않는다. 소금으로 엿을 떼어낼 수 있다.',
    taffy: true,
  },
  {
    id: 'redMask',
    name: '붉은 탈',
    glyph: '赤',
    rule: '잡힌 도깨비는 더 강해져서(이동 +1, 최대 +2) 돌아오고, 현상금(화물)도 50%씩 커진다.',
    detail: '사냥할수록 위험해지지만 보상도 커진다.',
    redMask: true,
    unlock: 'boss:redMask',
  },
]

export const BOSS_MAP: Readonly<Record<string, BossDef>> = Object.fromEntries(BOSSES.map((b) => [b.id, b]))

export function getBoss(id: string | null | undefined): BossDef | null {
  if (!id) return null
  return BOSS_MAP[id] ?? null
}
