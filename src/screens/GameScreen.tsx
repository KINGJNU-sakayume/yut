import { useState } from 'react'
import type { GameStore } from '../hooks/useGameStore'
import type { RunState } from '../game/types'
import { TopHud } from '../components/HUD/TopHud'
import { DebugPanel } from '../components/Debug/DebugPanel'
import { BoardScreen } from './BoardScreen'
import { EventScreen } from './EventScreen'
import { MenuModal } from './MenuModal'
import { RunEndScreen } from './RunEndScreen'
import { ShopScreen } from './ShopScreen'
import { WagerScreen } from './WagerScreen'
import { useUiSettings } from '../ui/settings'

interface GameScreenProps {
  run: RunState
  store: GameStore
  onSettings: () => void
}

export function GameScreen({ run, store, onSettings }: GameScreenProps) {
  const [menu, setMenu] = useState(false)
  const { debug } = useUiSettings()
  const copySeed = () => {
    void navigator.clipboard?.writeText(run.seed).then(
      () => store.pushToast(`씨앗 ${run.seed} 복사됨`),
      () => store.pushToast(`씨앗: ${run.seed}`),
    )
  }
  const ended = run.phase === 'victory' || run.phase === 'defeat'
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-3 p-2 md:p-3">
      {!ended && <TopHud run={run} board={run.phase === 'board' || run.phase === 'boardEnd' ? run.board : null} onMenu={() => setMenu(true)} onCopySeed={copySeed} />}
      {run.phase === 'wager' && <WagerScreen run={run} dispatch={store.dispatch} />}
      {(run.phase === 'board' || run.phase === 'boardEnd') && run.board && (
        <BoardScreen key={run.board.index} run={run} board={run.board} dispatch={store.dispatch} dispatchIf={store.dispatchIf} />
      )}
      {run.phase === 'shop' && <ShopScreen run={run} dispatch={store.dispatch} />}
      {run.phase === 'event' && <EventScreen run={run} dispatch={store.dispatch} />}
      {ended && <RunEndScreen run={run} onNewRun={() => store.startRun(String(Math.floor(Math.random() * 900000) + 100000), run.debtLevel)} onTitle={store.exitToTitle} onCopySeed={copySeed} />}
      {menu && (
        <MenuModal
          onClose={() => setMenu(false)}
          onSettings={() => {
            setMenu(false)
            onSettings()
          }}
          onTitle={() => {
            setMenu(false)
            store.exitToTitle()
          }}
          onAbandon={() => {
            setMenu(false)
            store.abandonRun()
          }}
        />
      )}
      {debug && !ended && <DebugPanel run={run} dispatch={store.dispatch} />}
    </div>
  )
}
