import { useState } from 'react'
import { Modal } from '../components/common/Modal'
import { BACKDO_FALLBACK_RULE } from '../game/movement'
import { T } from '../i18n/ko'

export function RulesSummary() {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <b>윷 던지기:</b> 막대 4개 중 배(평면)가 나온 수 — 1 도, 2 개, 3 걸, 4 윷, 0 모. 표시 막대만 배가 나오면 <b>빽도</b>. 윷·모는 한 번 더 던진다. 도깨비를 잡아도 한
        번 더.
      </p>
      <p>
        <b>배정:</b> 나온 결과를 어느 말(무리)에 줄지 직접 고른다. 모서리(모·뒷모)와 방(가운데)에서 출발할 때는 갈 길을 고른다.
      </p>
      <p>
        <b>화물 · 기세:</b> 칸을 밟으면 화물(보통 5, 모서리 15, 방 30)을 싣는다. 같은 바퀴에 같은 칸은 한 번만. 결과를 받을 때마다 기세가 오른다.
      </p>
      <p>
        <b>업기:</b> 내 말 위에 멈추면 업는다. 화물은 합치고 기세는 큰 쪽 +1. 퇴근 배수 ×1.5 / ×2.25 / ×4.
      </p>
      <p>
        <b>도깨비:</b> 다음 수(길·착지 칸)가 항상 공개된다. 착지 칸의 내 말은 잡혀 집으로 가고 화물을 빼앗긴다 — 그 도깨비를 잡으면 되찾는다.
      </p>
      <p>
        <b>참먹이:</b> 도착하면 <b>퇴근</b>(화물 × 기세 × 업기 × 바퀴 × 부적 = 점수) 또는 <b>한 바퀴 더</b>(×1.5 / ×2.25 / ×4, 위험 증가).
      </p>
      <p>
        <b>빽도 출발:</b> {BACKDO_FALLBACK_RULE}
      </p>
      <p>
        <b>부적:</b> 왼쪽부터 순서대로 발동한다. 순서를 바꿔 더하기를 곱하기보다 먼저 오게 하라.
      </p>
    </div>
  )
}

export function MenuModal({ onClose, onAbandon, onTitle, onSettings }: { onClose: () => void; onAbandon: () => void; onTitle: () => void; onSettings: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [rules, setRules] = useState(false)
  return (
    <Modal title={T.menu.title} onClose={onClose}>
      {rules ? (
        <>
          <RulesSummary />
          <button type="button" className="btn mt-3 w-full" onClick={() => setRules(false)}>
            {T.compendium.back}
          </button>
        </>
      ) : confirm ? (
        <div className="space-y-3">
          <p className="font-bold text-goblin">{T.menu.abandonConfirm}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-red flex-1" onClick={onAbandon}>
              {T.menu.abandon}
            </button>
            <button type="button" className="btn btn-paper flex-1" onClick={() => setConfirm(false)} autoFocus>
              {T.event.confirmNo}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button type="button" className="btn" onClick={onClose} autoFocus>
            {T.menu.resume}
          </button>
          <button type="button" className="btn btn-paper" onClick={() => setRules(true)}>
            {T.menu.rules}
          </button>
          <button type="button" className="btn btn-paper" onClick={onSettings}>
            {T.menu.settings}
          </button>
          <button type="button" className="btn btn-paper" onClick={onTitle}>
            {T.menu.toTitle}
          </button>
          <button type="button" className="btn btn-red" onClick={() => setConfirm(true)}>
            {T.menu.abandon}
          </button>
        </div>
      )}
    </Modal>
  )
}
