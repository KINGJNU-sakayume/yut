// Achievements: one-time 도깨비불 rewards.

export interface AchievementDef {
  id: string
  name: string
  description: string
  reward: number
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'firstCashOut', name: '첫 퇴근', description: '처음으로 무리를 퇴근시켰다.', reward: 1 },
  { id: 'fourStack', name: '업고 튀어', description: '말 4개를 모두 업은 무리로 퇴근했다.', reward: 3 },
  { id: 'threeLaps', name: '세 바퀴 더', description: '추가 바퀴 3번을 돌고 퇴근했다.', reward: 3 },
  { id: 'tenK', name: '만 냥 퇴근', description: '한 번의 퇴근으로 10,000점 이상.', reward: 2 },
  { id: 'hundredK', name: '십만 냥 퇴근', description: '한 번의 퇴근으로 100,000점 이상.', reward: 4 },
  { id: 'revenge', name: '복수는 나의 것', description: '내 화물을 훔친 도깨비를 잡아 되찾았다.', reward: 2 },
  { id: 'hunter', name: '도깨비 사냥꾼', description: '한 판에서 도깨비를 5번 잡았다.', reward: 3 },
  { id: 'yard4', name: '반환점', description: '네 번째 마당을 넘겼다.', reward: 3 },
  { id: 'victory', name: '빚 청산', description: '여덟 마당을 모두 넘겨 빚을 갚았다.', reward: 5 },
]

export const ACHIEVEMENT_MAP: Readonly<Record<string, AchievementDef>> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))
