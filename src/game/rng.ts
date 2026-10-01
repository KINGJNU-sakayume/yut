// Seeded, serializable RNG. Every random decision in the engine goes through here.
// State is a single uint32 so it can be stored in save files and snapshots.

/** mulberry32 step: returns [value in [0,1), next state]. */
export function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, a >>> 0]
}

/** FNV-1a 32-bit hash for strings. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // Final avalanche so similar seeds diverge quickly.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Convert a user-visible seed (any string) into the numeric run seed. */
export function seedToNumber(seed: string): number {
  const trimmed = seed.trim()
  if (/^\d{1,9}$/.test(trimmed)) {
    // Numeric seeds are hashed too, but stay stable for a given string.
    return hashString(`n:${trimmed}`)
  }
  return hashString(`s:${trimmed}`)
}

/** Derive an independent stream state from the run seed and labels. */
export function deriveStream(seedNum: number, ...parts: (string | number)[]): number {
  return hashString(`${seedNum}|${parts.join('|')}`)
}

/** A mutable holder for one stream; engine code mutates drafts only. */
export interface StreamHolder {
  [key: string]: number
}

export function draw<T extends StreamHolder>(holder: T, key: keyof T & string): number {
  const [value, next] = nextRandom(holder[key])
  ;(holder as StreamHolder)[key] = next
  return value
}

export function drawInt<T extends StreamHolder>(holder: T, key: keyof T & string, maxExclusive: number): number {
  return Math.floor(draw(holder, key) * maxExclusive)
}

export function pickWeighted<T, H extends StreamHolder>(
  holder: H,
  key: keyof H & string,
  items: readonly T[],
  weight: (item: T) => number,
): T | null {
  let total = 0
  for (const item of items) total += Math.max(0, weight(item))
  if (total <= 0 || items.length === 0) return null
  let roll = draw(holder, key) * total
  for (const item of items) {
    const w = Math.max(0, weight(item))
    if (roll < w) return item
    roll -= w
  }
  return items[items.length - 1]
}

/** Generate a fresh human-friendly seed (only used outside the engine, e.g. "New Run"). */
export function randomSeedString(): string {
  const n = Math.floor(Math.random() * 900000) + 100000
  return String(n)
}
