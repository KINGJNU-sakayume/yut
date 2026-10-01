// Meta-progression unlocks bought with 도깨비불. Unlocks add content, never raw stat bonuses.

export type UnlockKind = 'talisman' | 'cursed' | 'boss' | 'event' | 'pieceSkin' | 'yutSkin' | 'debt'

export interface UnlockDef {
  id: string
  kind: UnlockKind
  name: string
  description: string
  cost: number
  /** Another unlock that must be owned first. */
  requires?: string
}

export const UNLOCKS: readonly UnlockDef[] = [
  { id: 'talisman:manseon', kind: 'talisman', name: '만선 (전설 부적)', description: '네 말을 모두 업고 퇴근하는 대박 부적이 상점에 나온다.', cost: 6 },
  { id: 'talisman:sigan', kind: 'talisman', name: '시간 역행 (전설 부적)', description: '빽도로 시간을 되돌리는 부적이 상점에 나온다.', cost: 6 },
  { id: 'talisman:samsepan', kind: 'talisman', name: '삼세판 (희귀 부적)', description: '세 바퀴를 다 돌고 퇴근하면 ×3.', cost: 4 },
  { id: 'talisman:jipnaga', kind: 'talisman', name: '집 나가면 고생 (희귀 부적)', description: '추가 바퀴 배수표를 강화하는 대신 도깨비가 사나워진다.', cost: 4 },
  { id: 'cursed:jeoseung', kind: 'cursed', name: '저승 명부 (저주 부적)', description: '도깨비 장터에 저승 명부가 나온다.', cost: 3 },
  { id: 'cursed:moani', kind: 'cursed', name: '모 아니면 죽음 (저주 부적)', description: '도깨비 장터에 모 아니면 죽음이 나온다.', cost: 3 },
  { id: 'boss:blocker', kind: 'boss', name: '길막이 도깨비', description: '새 도깨비 대장이 등장한다.', cost: 2 },
  { id: 'boss:redMask', kind: 'boss', name: '붉은 탈', description: '새 도깨비 대장이 등장한다.', cost: 2 },
  { id: 'event:nolum', kind: 'event', name: '노름판', description: '새 만남: 엽전을 걸고 윷 한 판.', cost: 2 },
  { id: 'event:sansin', kind: 'event', name: '산신령', description: '새 만남: 런 내내 이어지는 축복.', cost: 3 },
  { id: 'pieceSkin:obang', kind: 'pieceSkin', name: '오방색 말', description: '말 색을 오방색으로 바꾼다.', cost: 2 },
  { id: 'pieceSkin:baekja', kind: 'pieceSkin', name: '백자 말', description: '말을 백자와 청화 무늬로 바꾼다.', cost: 2 },
  { id: 'yutSkin:bamboo', kind: 'yutSkin', name: '대나무 윷', description: '윷가락을 대나무 결로 바꾼다.', cost: 2 },
  { id: 'yutSkin:lacquer', kind: 'yutSkin', name: '옻칠 윷', description: '윷가락을 붉은 옻칠로 바꾼다.', cost: 2 },
  { id: 'debt:1', kind: 'debt', name: '빚 1단계', description: '목표 점수 ×1.15.', cost: 3 },
  { id: 'debt:2', kind: 'debt', name: '빚 2단계', description: '목표 점수 ×1.3, 도깨비가 더 자주 노린다.', cost: 4, requires: 'debt:1' },
  { id: 'debt:3', kind: 'debt', name: '빚 3단계', description: '목표 점수 ×1.5.', cost: 5, requires: 'debt:2' },
  { id: 'debt:4', kind: 'debt', name: '빚 4단계', description: '목표 점수 ×1.75. 진짜 빚쟁이.', cost: 6, requires: 'debt:3' },
]

export const UNLOCK_MAP: Readonly<Record<string, UnlockDef>> = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]))

export const PIECE_SKINS: Record<string, { name: string; colors: [string, string, string, string]; ink: string }> = {
  default: { name: '먹·쪽·솔·황', colors: ['#2b2420', '#2d4f86', '#2f6b46', '#b8862c'], ink: '#f3e7cc' },
  obang: { name: '오방색', colors: ['#1d4e8f', '#c0392b', '#e0b33a', '#f2efe6'], ink: '#1b1410' },
  baekja: { name: '백자', colors: ['#f4f1ea', '#e8eef3', '#efe9df', '#f1ece4'], ink: '#24477a' },
}

export const YUT_SKINS: Record<string, { name: string; flat: string; round: string; edge: string }> = {
  default: { name: '박달나무', flat: '#ead2a0', round: '#b77b3f', edge: '#6e4220' },
  bamboo: { name: '대나무', flat: '#e6e2a6', round: '#8fa152', edge: '#4f5f22' },
  lacquer: { name: '옻칠', flat: '#e7c9a0', round: '#8f2a1d', edge: '#4a120c' },
}
