import { useEffect, useRef, useState } from 'react'

/**
 * Steps an index from 0 to length-1 every `stepMs` whenever `key` changes.
 * Returns null when idle. The key present at mount is never animated (e.g. after loading a save).
 */
export function useSequence(key: number | null, length: number, stepMs: number, enabled: boolean): number | null {
  const initialKey = useRef(key)
  const [state, setState] = useState<{ key: number; index: number } | null>(null)
  useEffect(() => {
    if (key == null || key === initialKey.current || !enabled || length <= 1) {
      setState(null)
      return
    }
    initialKey.current = null
    let index = 0
    setState({ key, index })
    const timer = window.setInterval(() => {
      index += 1
      if (index >= length) {
        window.clearInterval(timer)
        setState(null)
      } else setState({ key, index })
    }, stepMs)
    return () => window.clearInterval(timer)
  }, [key, length, stepMs, enabled])
  return state && state.key === key ? state.index : null
}
