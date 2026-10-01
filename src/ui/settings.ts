import { createContext, useContext } from 'react'
import { PIECE_SKINS, YUT_SKINS } from '../data/unlocks'

export interface UiSettings {
  reducedMotion: boolean
  showOdds: boolean
  pieceSkin: (typeof PIECE_SKINS)[string]
  yutSkin: (typeof YUT_SKINS)[string]
  debug: boolean
}

export const defaultUiSettings: UiSettings = {
  reducedMotion: false,
  showOdds: true,
  pieceSkin: PIECE_SKINS.default,
  yutSkin: YUT_SKINS.default,
  debug: false,
}

export const SettingsContext = createContext<UiSettings>(defaultUiSettings)

export function useUiSettings(): UiSettings {
  return useContext(SettingsContext)
}

export function isDebugEnabled(): boolean {
  try {
    return import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')
  } catch {
    return false
  }
}

export function urlSeed(): string | null {
  try {
    const seed = new URLSearchParams(window.location.search).get('seed')
    return seed && seed.trim() ? seed.trim().slice(0, 40) : null
  } catch {
    return null
  }
}
