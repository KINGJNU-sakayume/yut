import { useCallback, useEffect, useMemo, useState } from 'react'
import { BRANCH_LABELS, NODE_MAP } from '../game/boardGraph'
import { throwAvailability } from '../game/board'
import { goblinPlansView, pendingViews, previewMove } from '../game/selectors'
import type { BoardState, GameAction, RunState } from '../game/types'
import { HomeTray } from '../components/Board/HomeTray'
import { YutBoard, type PathOptionView } from '../components/Board/YutBoard'
import { ConsumableBar } from '../components/Side/ConsumableBar'
import { GoalDecisionModal } from '../components/Side/GoalDecisionModal'
import { GoblinIntents, GroupInfo, LogPanel, MoveOptions, PendingResults } from '../components/Side/SidePanel'
import { TalismanBar } from '../components/Talismans/TalismanBar'
import { ThrowPanel } from '../components/Yut/ThrowPanel'
import { CashOutOverlay } from '../components/ScoreBreakdown/CashOutOverlay'
import { BoardEndModal } from './BoardEndModal'
import { T } from '../i18n/ko'
import { useUiSettings } from '../ui/settings'

interface BoardScreenProps {
  run: RunState
  board: BoardState
  dispatch: (a: GameAction) => void
  dispatchIf: (pred: (r: RunState) => boolean, a: GameAction) => void
}

function optionLabel(view: { option: PathOptionView['option'] }): string {
  const o = view.option
  if (o.destZone === 'home') return '집으로'
  if (o.destZone === 'goal') return `참먹이 도착${o.branch ? ` (${BRANCH_LABELS[o.branch]})` : ''}`
  const name = o.dest ? (NODE_MAP[o.dest]?.name ?? o.dest) : ''
  return o.branch ? `${BRANCH_LABELS[o.branch]} · ${name}` : name
}

export function BoardScreen({ run, board, dispatch, dispatchIf }: BoardScreenProps) {
  const { reducedMotion } = useUiSettings()
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null)
  const [pickedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [focusedOption, setFocusedOption] = useState<number | null>(null)
  const [cashOutDone, setCashOutDone] = useState<number | null>(board.lastCashOut?.seq ?? null)

  const views = useMemo(() => pendingViews(run, board), [run, board])
  const plans = useMemo(() => goblinPlansView(run, board), [run, board])

  // A picked group may disappear (stacked into another group, captured, finished).
  const selectedGroupId = pickedGroupId && board.groups.some((g) => g.id === pickedGroupId) ? pickedGroupId : null
  const activeResultId = views.some((v) => v.result.id === selectedResultId) ? selectedResultId : (views[0]?.result.id ?? null)
  const activeView = views.find((v) => v.result.id === activeResultId) ?? null
  const legalGroupIds = useMemo(
    () => new Set(activeView ? activeView.legal.moves.filter((m) => m.options.length > 0).map((m) => m.groupId) : []),
    [activeView],
  )
  const selectedGroup = board.groups.find((g) => g.id === selectedGroupId) ?? null

  const optionViews: PathOptionView[] = useMemo(() => {
    if (!activeView || !selectedGroupId || board.phase !== 'play') return []
    const move = activeView.legal.moves.find((m) => m.groupId === selectedGroupId)
    if (!move) return []
    return move.options.map((option, index) => ({
      index,
      option,
      preview: previewMove(run, activeView.result.id, selectedGroupId, index),
      label: optionLabel({ option }),
    }))
  }, [activeView, selectedGroupId, run, board.phase])

  const choose = (index: number) => {
    if (!activeView || !selectedGroupId) return
    dispatch({ type: 'MOVE', resultId: activeView.result.id, groupId: selectedGroupId, pathIndex: index })
    setFocusedOption(null)
  }

  // Space throws.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return
      if (throwAvailability(board).can) {
        e.preventDefault()
        dispatch({ type: 'THROW' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, dispatch])

  const showCashOut = board.lastCashOut && board.lastCashOut.seq !== cashOutDone ? board.lastCashOut : null
  const showCashOutSeq = showCashOut?.seq ?? null
  const dismissCashOut = useCallback(() => setCashOutDone(showCashOutSeq), [showCashOutSeq])

  // The goblin phase resolves on its own after the player's move animation (paused during score juice).
  const moveLen = board.lastMove?.path.length ?? 0
  useEffect(() => {
    if (board.phase !== 'goblinTurn' || showCashOutSeq != null) return
    const delay = reducedMotion ? 250 : Math.min(1200, moveLen * 110 + 450)
    const timer = window.setTimeout(() => dispatchIf((r) => r.board?.phase === 'goblinTurn', { type: 'RESOLVE_GOBLINS' }), delay)
    return () => window.clearTimeout(timer)
  }, [board.phase, moveLen, reducedMotion, dispatchIf, showCashOutSeq])
  const lastGoblinCaptures = board.lastGoblinPhase?.moves.filter((m) => m.captured.length > 0) ?? []

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="relative mx-auto aspect-square w-full max-w-[min(78vh,760px)]">
          <YutBoard
            run={run}
            board={board}
            plans={plans}
            legalGroupIds={board.phase === 'play' ? legalGroupIds : new Set()}
            selectedGroupId={selectedGroupId}
            options={optionViews}
            focusedOption={focusedOption}
            onSelectGroup={(id) => {
              setSelectedGroupId(id)
              setFocusedOption(null)
            }}
            onChooseOption={choose}
            onFocusOption={setFocusedOption}
          />
          {board.phase === 'goblinTurn' && (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
              <span className="animate-rise rounded-full border-2 border-goblin-dark bg-goblin px-4 py-1 font-serif text-sm font-black text-paper shadow-lg">
                👹 {T.play.goblinTurn}
              </span>
            </div>
          )}
          {board.phase === 'play' && lastGoblinCaptures.length > 0 && !board.turnActive && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
              <span className="animate-rise rounded-lg border-2 border-goblin-dark bg-night-2/90 px-3 py-1 text-center text-xs font-bold text-[#ffd3c9]">
                {lastGoblinCaptures.map((m) => `도깨비가 ${m.captured.map((c) => c + 1).join('·')}번 말을 잡아 화물 ${m.stolen}을 빼앗았다`).join(' / ')}
              </span>
            </div>
          )}
        </div>
        <HomeTray
          run={run}
          board={board}
          legalGroupIds={board.phase === 'play' ? legalGroupIds : new Set()}
          selectedGroupId={selectedGroupId}
          onSelectGroup={(id) => {
            setSelectedGroupId(id)
            setFocusedOption(null)
          }}
        />
      </div>

      <aside className="flex min-w-0 flex-col gap-2">
        <PendingResults
          views={views}
          selectedId={activeResultId}
          onSelect={(id) => {
            setSelectedResultId(id)
            setFocusedOption(null)
          }}
          onDiscard={(id) => dispatch({ type: 'DISCARD_RESULT', resultId: id })}
        />
        {views.length > 0 && !selectedGroupId && <p className="px-1 text-xs text-paper/80">👉 {T.play.pickGroup}</p>}
        {views.length > 0 && selectedGroupId && !legalGroupIds.has(selectedGroupId) && (
          <p className="px-1 text-xs text-paper/80">이 무리는 이 결과로 움직일 수 없습니다. 반짝이는 말을 고르세요.</p>
        )}
        <MoveOptions options={optionViews} focused={focusedOption} onChoose={choose} onFocus={setFocusedOption} />
        <GroupInfo run={run} group={selectedGroup} />
        <GoblinIntents plans={plans} board={board} />
        <LogPanel board={board} />
      </aside>

      <div className="wood-panel flex flex-wrap items-end justify-between gap-4 p-3 lg:col-span-2">
        <ThrowPanel run={run} board={board} dispatch={dispatch} />
        <TalismanBar run={run} board={board} dispatch={dispatch} />
        <ConsumableBar run={run} board={board} dispatch={dispatch} />
      </div>

      {board.phase === 'goalDecision' && !showCashOut && <GoalDecisionModal run={run} board={board} dispatch={dispatch} />}
      {showCashOut && <CashOutOverlay record={showCashOut} onDone={dismissCashOut} />}
      {run.phase === 'boardEnd' && run.boardEnd && !showCashOut && <BoardEndModal run={run} summary={run.boardEnd} dispatch={dispatch} />}
    </div>
  )
}
