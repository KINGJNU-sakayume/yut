// App-level state: the active run (driven by the pure engine reducer), meta progression,
// persistence to localStorage and toasts. React never implements game rules here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACHIEVEMENT_MAP } from '../data/achievements'
import { EngineError } from '../game/errors'
import {
  buyUnlock as buyUnlockMeta,
  evaluateAchievements,
  recordRunEnd,
  syncDiscoveries,
  type MetaSettings,
  type MetaState,
} from '../game/meta'
import { gameReducer } from '../game/reducer'
import { createRun } from '../game/run'
import {
  clearRun,
  loadMeta,
  loadRun,
  memoryStorage,
  saveMeta,
  saveRun,
  type LoadResult,
  type StorageLike,
} from '../game/save/saveManager'
import type { GameAction, RunState } from '../game/types'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error' | 'achievement'
}

function safeStorage(): StorageLike {
  try {
    const ls = window.localStorage
    const probe = '__yut_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    return memoryStorage()
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function useGameStore() {
  const storage = useMemo(() => safeStorage(), [])
  const [meta, setMeta] = useState<MetaState>(() => loadMeta(storage, prefersReducedMotion()).meta)
  const [saved, setSaved] = useState<LoadResult<RunState>>(() => loadRun(storage))
  const [run, setRun] = useState<RunState | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSeq = useRef(0)
  const metaRef = useRef(meta)
  const runRef = useRef(run)
  useEffect(() => {
    metaRef.current = meta
    runRef.current = run
  }, [meta, run])

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    toastSeq.current += 1
    const id = toastSeq.current
    setToasts((ts) => [...ts.slice(-3), { id, text, kind }])
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), kind === 'achievement' ? 4200 : 2600)
  }, [])

  const dispatch = useCallback((action: GameAction) => {
    setRun((prev) => (prev ? gameReducer(prev, action) : prev))
  }, [])

  /** Dispatch only if the current run satisfies a predicate (used by timed auto-advances). */
  const dispatchIf = useCallback((predicate: (run: RunState) => boolean, action: GameAction) => {
    setRun((prev) => (prev && predicate(prev) ? gameReducer(prev, action) : prev))
  }, [])

  // Rule violations come back as `notice`.
  useEffect(() => {
    if (run?.notice) pushToast(run.notice, 'error')
  }, [run, pushToast])

  // Persist the active run after every meaningful change.
  useEffect(() => {
    if (!run) return
    if (run.phase === 'victory' || run.phase === 'defeat') clearRun(storage)
    else saveRun(storage, run)
  }, [run, storage])

  // Discoveries, achievements and run-end bookkeeping.
  useEffect(() => {
    if (!run) return
    let next = syncDiscoveries(metaRef.current, run)
    const ach = evaluateAchievements(next, run)
    next = ach.meta
    for (const a of ach.earned) pushToast(`업적 「${ACHIEVEMENT_MAP[a.id]?.name}」 — 도깨비불 +${a.reward}`, 'achievement')
    if (run.phase === 'victory' || run.phase === 'defeat') {
      next = recordRunEnd(next, run, run.phase === 'victory' ? 'win' : 'loss', Date.now()).meta
    }
    if (next !== metaRef.current) setMeta(next)
  }, [run, pushToast])

  useEffect(() => {
    saveMeta(storage, meta)
  }, [meta, storage])

  const startRun = useCallback(
    (seed: string, debtLevel: number) => {
      const fresh = createRun({ seed, debtLevel, unlocked: metaRef.current.unlocked, startedAt: Date.now() })
      setRun(fresh)
    },
    [],
  )

  const continueRun = useCallback(() => {
    const loaded = loadRun(storage)
    setSaved(loaded)
    if (loaded.status === 'ok') setRun(loaded.value)
    else pushToast('저장된 판을 불러오지 못했습니다', 'error')
  }, [storage, pushToast])

  const exitToTitle = useCallback(() => {
    setRun(null)
    setSaved(loadRun(storage))
  }, [storage])

  const abandonRun = useCallback(() => {
    const current = runRef.current
    if (current) setMeta((m) => recordRunEnd(m, current, 'abandon', Date.now()).meta)
    setRun(null)
    clearRun(storage)
    setSaved({ status: 'empty' })
  }, [storage])

  const deleteSave = useCallback(() => {
    clearRun(storage)
    setSaved({ status: 'empty' })
  }, [storage])

  const updateSettings = useCallback((patch: Partial<MetaSettings>) => {
    setMeta((m) => ({ ...m, settings: { ...m.settings, ...patch } }))
  }, [])

  const buyUnlock = useCallback(
    (id: string) => {
      try {
        setMeta(buyUnlockMeta(metaRef.current, id))
        pushToast('해금했습니다!', 'info')
      } catch (err) {
        pushToast(err instanceof EngineError ? err.message : '해금할 수 없습니다', 'error')
      }
    },
    [pushToast],
  )

  return {
    meta,
    run,
    saved,
    toasts,
    dispatch,
    dispatchIf,
    startRun,
    continueRun,
    exitToTitle,
    abandonRun,
    deleteSave,
    updateSettings,
    buyUnlock,
    pushToast,
  }
}

export type GameStore = ReturnType<typeof useGameStore>
