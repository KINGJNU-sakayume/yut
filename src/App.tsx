import { useMemo, useState } from 'react'
import { PIECE_SKINS, YUT_SKINS } from './data/unlocks'
import { useGameStore } from './hooks/useGameStore'
import { Toasts } from './components/common/Toasts'
import { CompendiumScreen } from './screens/CompendiumScreen'
import { GameScreen } from './screens/GameScreen'
import { SettingsModal } from './screens/SettingsModal'
import { TitleScreen } from './screens/TitleScreen'
import { SettingsContext, isDebugEnabled, type UiSettings } from './ui/settings'

export default function App() {
  const store = useGameStore()
  const { meta, run } = store
  const [view, setView] = useState<'title' | 'compendium'>('title')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const ui: UiSettings = useMemo(
    () => ({
      reducedMotion: meta.settings.reducedMotion,
      showOdds: meta.settings.showOdds,
      pieceSkin: PIECE_SKINS[meta.settings.pieceSkin] ?? PIECE_SKINS.default,
      yutSkin: YUT_SKINS[meta.settings.yutSkin] ?? YUT_SKINS.default,
      debug: isDebugEnabled(),
    }),
    [meta.settings],
  )

  return (
    <SettingsContext.Provider value={ui}>
      <div className={`min-h-screen ${ui.reducedMotion ? 'reduce-motion' : 'motion-auto'}`}>
        {run ? (
          <GameScreen run={run} store={store} onSettings={() => setSettingsOpen(true)} />
        ) : view === 'compendium' ? (
          <CompendiumScreen meta={meta} onBack={() => setView('title')} onBuy={store.buyUnlock} />
        ) : (
          <TitleScreen
            meta={meta}
            saved={store.saved}
            onContinue={store.continueRun}
            onNewRun={store.startRun}
            onDeleteSave={store.deleteSave}
            onCompendium={() => setView('compendium')}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
        {settingsOpen && <SettingsModal meta={meta} onChange={store.updateSettings} onClose={() => setSettingsOpen(false)} />}
        <Toasts toasts={store.toasts} />
      </div>
    </SettingsContext.Provider>
  )
}
