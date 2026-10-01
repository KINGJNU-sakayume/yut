import { describe, expect, it } from 'vitest'
import { deriveStream, nextRandom, seedToNumber } from '../rng'
import type { StickFace, StickState } from '../types'
import { baseThrowSetup, facesToResult, finalizeSetup, outcomeDistribution, resolveFaces, rollThrow } from '../yut'

const B: StickFace = 'back'
const F: StickFace = 'front'
const plain: StickState[] = [0, 1, 2, 3].map(() => ({ modId: null, twinOf: null }))

describe('Yut result mapping', () => {
  it('maps the number of back (flat) faces to the classic results', () => {
    expect(facesToResult([F, F, F, F])).toBe('mo')
    expect(facesToResult([F, B, F, F])).toBe('do')
    expect(facesToResult([B, B, F, F])).toBe('gae')
    expect(facesToResult([B, B, B, F])).toBe('geol')
    expect(facesToResult([B, B, B, B])).toBe('yut')
  })

  it('a single back face on the marked stick is Backdo', () => {
    expect(facesToResult([B, F, F, F], 0)).toBe('backdo')
    expect(facesToResult([F, F, F, B], 0)).toBe('do')
    expect(facesToResult([F, F, F, B], 3)).toBe('backdo')
    // Two backs including the marked stick is still Gae.
    expect(facesToResult([B, B, F, F], 0)).toBe('gae')
  })

  it('base distribution matches four fair sticks', () => {
    const d = outcomeDistribution(finalizeSetup(baseThrowSetup(plain, [])))
    expect(d.mo).toBeCloseTo(1 / 16)
    expect(d.backdo).toBeCloseTo(1 / 16)
    expect(d.do).toBeCloseTo(3 / 16)
    expect(d.gae).toBeCloseTo(6 / 16)
    expect(d.geol).toBeCloseTo(4 / 16)
    expect(d.yut).toBeCloseTo(1 / 16)
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

describe('Yut stick modifications', () => {
  it('heavy / light shift the back-face probability and stay clamped', () => {
    const sticks: StickState[] = [
      { modId: 'heavy', twinOf: null },
      { modId: 'light', twinOf: null },
      { modId: null, twinOf: null },
      { modId: null, twinOf: null },
    ]
    const setup = finalizeSetup(baseThrowSetup(sticks, []))
    expect(setup.backProb[0]).toBeCloseTo(0.65)
    expect(setup.backProb[1]).toBeCloseTo(0.35)
    const extreme = finalizeSetup({ ...setup, backProb: [2, -1, 0.5, 0.5] })
    expect(extreme.backProb[0]).toBeLessThanOrEqual(0.95)
    expect(extreme.backProb[1]).toBeGreaterThanOrEqual(0.05)
    const d = outcomeDistribution(setup)
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('twin mirrors its source, invert flips, locks are final', () => {
    const sticks: StickState[] = [
      { modId: null, twinOf: null },
      { modId: 'twin', twinOf: 0 },
      { modId: 'invert', twinOf: null },
      { modId: null, twinOf: null },
    ]
    const setup = finalizeSetup(baseThrowSetup(sticks, [null, null, null, 'back']))
    expect(resolveFaces([B, F, B, F], setup, false)).toEqual([B, B, F, B])
    expect(resolveFaces([F, B, F, F], setup, false)).toEqual([F, F, B, B])
  })

  it('haunting syncs unlocked sticks to the marked stick', () => {
    const setup = finalizeSetup({ ...baseThrowSetup(plain, []), hauntedSyncChance: 1 })
    expect(resolveFaces([B, F, F, F], setup, true)).toEqual([B, B, B, B])
    // Haunting is capped at 90%; the remaining 10% throws normally (Yut or Mo = 2/16).
    expect(setup.hauntedSyncChance).toBe(0.9)
    const d = outcomeDistribution(setup)
    expect(d.yut + d.mo).toBeCloseTo(0.9 + 0.1 * (2 / 16))
  })
})

describe('seeded RNG', () => {
  it('is reproducible for the same seed and differs between streams', () => {
    const seq = (s: number) => {
      const out: number[] = []
      let state = s
      for (let i = 0; i < 5; i++) {
        const [v, next] = nextRandom(state)
        out.push(v)
        state = next
      }
      return out
    }
    const seed = seedToNumber('12345')
    expect(seq(seed)).toEqual(seq(seedToNumber('12345')))
    expect(seq(seed)).not.toEqual(seq(seedToNumber('12346')))
    expect(deriveStream(seed, 'throw', 0)).not.toBe(deriveStream(seed, 'goblin', 0))
    for (const v of seq(seed)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('rollThrow always consumes the same number of random values', () => {
    let calls = 0
    const rand = () => {
      calls++
      return 0.3
    }
    rollThrow(finalizeSetup(baseThrowSetup(plain, [])), rand)
    expect(calls).toBe(5)
  })
})
