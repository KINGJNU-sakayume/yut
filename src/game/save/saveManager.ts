// localStorage persistence with versioned formats and graceful failure.

import { SAVE_VERSION } from '../config'
import { META_VERSION, createMeta, type MetaState } from '../meta'
import type { RunState } from '../types'

export const RUN_KEY = 'yut-roguelike:run'
export const META_KEY = 'yut-roguelike:meta'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type LoadResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'empty' }
  | { status: 'incompatible'; reason: string }
  | { status: 'corrupt'; reason: string }

interface RunEnvelope {
  kind: 'yut-roguelike-save'
  version: number
  savedAt: number
  run: RunState
}

const RUN_PHASES = new Set(['wager', 'board', 'boardEnd', 'event', 'shop', 'victory', 'defeat'])

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function serializeRun(run: RunState, savedAt = 0): string {
  const envelope: RunEnvelope = { kind: 'yut-roguelike-save', version: SAVE_VERSION, savedAt, run }
  return JSON.stringify(envelope)
}

export function deserializeRun(raw: string | null): LoadResult<RunState> {
  if (raw == null || raw === '') return { status: 'empty' }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { status: 'corrupt', reason: '저장 데이터를 읽을 수 없습니다 (JSON 오류)' }
  }
  if (!isObject(data) || data.kind !== 'yut-roguelike-save') return { status: 'corrupt', reason: '알 수 없는 저장 형식입니다' }
  if (data.version !== SAVE_VERSION) {
    return { status: 'incompatible', reason: `저장 버전(${String(data.version)})이 현재 버전(${SAVE_VERSION})과 다릅니다` }
  }
  const run = data.run
  if (!isObject(run) || run.format !== 'yut-roguelike-run' || run.version !== SAVE_VERSION) {
    return { status: 'incompatible', reason: '진행 데이터 형식이 맞지 않습니다' }
  }
  const ok =
    typeof run.seed === 'string' &&
    typeof run.seedNum === 'number' &&
    typeof run.boardIndex === 'number' &&
    typeof run.coins === 'number' &&
    RUN_PHASES.has(String(run.phase)) &&
    Array.isArray(run.talismans) &&
    Array.isArray(run.pieces) &&
    Array.isArray(run.sticks) &&
    isObject(run.mods) &&
    isObject(run.rng) &&
    (run.board === null || isObject(run.board))
  if (!ok) return { status: 'corrupt', reason: '진행 데이터가 손상되었습니다' }
  if (run.phase === 'board' && !isObject(run.board)) return { status: 'corrupt', reason: '판 데이터가 없습니다' }
  return { status: 'ok', value: run as unknown as RunState }
}

export function loadRun(storage: StorageLike): LoadResult<RunState> {
  try {
    return deserializeRun(storage.getItem(RUN_KEY))
  } catch {
    return { status: 'corrupt', reason: '저장소에 접근할 수 없습니다' }
  }
}

export function saveRun(storage: StorageLike, run: RunState, savedAt = Date.now()): boolean {
  try {
    storage.setItem(RUN_KEY, serializeRun(run, savedAt))
    return true
  } catch {
    return false
  }
}

export function clearRun(storage: StorageLike): void {
  try {
    storage.removeItem(RUN_KEY)
  } catch {
    // ignore
  }
}

export function serializeMeta(meta: MetaState): string {
  return JSON.stringify(meta)
}

/** Load meta progression; never throws. Unknown/corrupt data falls back to a fresh profile. */
export function deserializeMeta(raw: string | null, reducedMotion = false): { meta: MetaState; status: 'ok' | 'empty' | 'reset' } {
  if (!raw) return { meta: createMeta(reducedMotion), status: 'empty' }
  try {
    const data = JSON.parse(raw) as unknown
    if (!isObject(data) || data.format !== 'yut-roguelike-meta' || data.version !== META_VERSION) {
      return { meta: createMeta(reducedMotion), status: 'reset' }
    }
    const base = createMeta(reducedMotion)
    const meta = data as unknown as MetaState
    // Fill in fields that may be missing from older saves of the same version.
    return {
      meta: {
        ...base,
        ...meta,
        discovered: { ...base.discovered, ...meta.discovered },
        stats: { ...base.stats, ...meta.stats },
        settings: { ...base.settings, ...meta.settings },
      },
      status: 'ok',
    }
  } catch {
    return { meta: createMeta(reducedMotion), status: 'reset' }
  }
}

export function loadMeta(storage: StorageLike, reducedMotion = false): { meta: MetaState; status: 'ok' | 'empty' | 'reset' } {
  try {
    return deserializeMeta(storage.getItem(META_KEY), reducedMotion)
  } catch {
    return { meta: createMeta(reducedMotion), status: 'reset' }
  }
}

export function saveMeta(storage: StorageLike, meta: MetaState): boolean {
  try {
    storage.setItem(META_KEY, serializeMeta(meta))
    return true
  } catch {
    return false
  }
}

/** In-memory storage for tests and for browsers with storage disabled. */
export function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}
