// Development-only balancing panel (shown with `npm run dev` or `?debug=1`).

import { useState } from 'react'
import { CONSUMABLES } from '../../data/consumables'
import { TALISMANS } from '../../data/talismans'
import { NODES } from '../../game/boardGraph'
import { RESULT_KINDS, type GameAction, type RunState } from '../../game/types'
import { RESULT_LABELS } from '../../i18n/ko'

export function DebugPanel({ run, dispatch }: { run: RunState; dispatch: (a: GameAction) => void }) {
  const [open, setOpen] = useState(false)
  const [talisman, setTalisman] = useState(TALISMANS[0].id)
  const [consumable, setConsumable] = useState(CONSUMABLES[0].id)
  const [groupId, setGroupId] = useState('')
  const [value, setValue] = useState('100')
  const [node, setNode] = useState('o5')
  const board = run.board
  const groups = board?.groups.filter((g) => g.zone === 'home' || g.zone === 'board') ?? []
  const gid = groups.some((g) => g.id === groupId) ? groupId : (groups[0]?.id ?? '')
  const d = (command: Extract<GameAction, { type: 'DEBUG' }>['command']) => dispatch({ type: 'DEBUG', command })
  return (
    <div className="fixed left-1 top-1 z-50 text-xs">
      <button type="button" className="rounded bg-indigo/90 px-1.5 py-0.5 text-[10px] font-bold text-paper shadow" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        🛠 디버그
      </button>
      {open && (
        <div className="paper-panel mt-1 max-h-[70vh] w-80 space-y-2 overflow-y-auto p-2">
          <div>
            <p className="font-bold">다음 윷 결과 고정</p>
            <div className="flex flex-wrap gap-1">
              {RESULT_KINDS.map((k) => (
                <button key={k} type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={!board} onClick={() => d({ cmd: 'forceResult', result: k })}>
                  {RESULT_LABELS[k]}
                </button>
              ))}
            </div>
            {board?.forcedNext && <p>고정됨: {RESULT_LABELS[board.forcedNext]}</p>}
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" onClick={() => d({ cmd: 'addCoins', amount: 10 })}>
              엽전 +10
            </button>
            <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={!board} onClick={() => d({ cmd: 'addThrows', amount: 3 })}>
              던지기 +3
            </button>
            <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={!board} onClick={() => d({ cmd: 'spawnGoblin' })}>
              도깨비 추가
            </button>
            <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={run.phase !== 'wager'} onClick={() => d({ cmd: 'jumpToBoss' })}>
              대장 판으로
            </button>
          </div>
          <div className="flex gap-1">
            <select className="flex-1 rounded border px-1" value={talisman} onChange={(e) => setTalisman(e.target.value)}>
              {TALISMANS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.rarity})
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" onClick={() => d({ cmd: 'addTalisman', defId: talisman })}>
              부적 추가
            </button>
          </div>
          <div className="flex gap-1">
            <select className="flex-1 rounded border px-1" value={consumable} onChange={(e) => setConsumable(e.target.value)}>
              {CONSUMABLES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" onClick={() => d({ cmd: 'addConsumable', id: consumable })}>
              소모품 추가
            </button>
          </div>
          {board && (
            <div className="space-y-1">
              <div className="flex gap-1">
                <select className="rounded border px-1" value={gid} onChange={(e) => setGroupId(e.target.value)}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.members.map((m) => m + 1).join('·')}번 ({g.zone === 'home' ? '집' : g.node})
                    </option>
                  ))}
                </select>
                <input className="w-20 rounded border px-1" value={value} onChange={(e) => setValue(e.target.value)} aria-label="값" />
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={!gid} onClick={() => d({ cmd: 'setCargo', groupId: gid, value: Number(value) })}>
                  화물 설정
                </button>
                <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={!gid} onClick={() => d({ cmd: 'setMomentum', groupId: gid, value: Number(value) })}>
                  기세 설정
                </button>
                <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" onClick={() => d({ cmd: 'setTarget', value: Number(value) })}>
                  목표 설정
                </button>
              </div>
              <div className="flex gap-1">
                <select className="rounded border px-1" value={node} onChange={(e) => setNode(e.target.value)}>
                  {NODES.filter((n) => n.id !== 'o0').map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.id})
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-paper px-2 py-0.5 text-xs" disabled={!gid} onClick={() => d({ cmd: 'teleport', groupId: gid, node })}>
                  순간이동
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
