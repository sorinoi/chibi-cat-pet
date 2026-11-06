import { describe, expect, it } from 'vitest'
import { frameAt } from './spriteTimeline'
import type { SpriteClip } from '../../shared/modelConfig'

const clip = (overrides: Partial<SpriteClip>): SpriteClip => ({
  row: 0,
  frames: 3,
  loop: true,
  loopFrom: 0,
  frameMs: [100, 200, 300],
  ...overrides
})

describe('frameAt', () => {
  it('walks through frames by their durations', () => {
    const c = clip({})
    expect(frameAt(c, 0)).toEqual({ frame: 0, finished: false, nextChangeMs: 100 })
    expect(frameAt(c, 99).frame).toBe(0)
    expect(frameAt(c, 100)).toEqual({ frame: 1, finished: false, nextChangeMs: 200 })
    expect(frameAt(c, 350)).toEqual({ frame: 2, finished: false, nextChangeMs: 250 })
  })

  it('loops back to the first frame', () => {
    const c = clip({})
    expect(frameAt(c, 600).frame).toBe(0)
    expect(frameAt(c, 750).frame).toBe(1)
  })

  it('plays the intro once, then loops from loopFrom', () => {
    const c = clip({ loopFrom: 1 })
    expect(frameAt(c, 50).frame).toBe(0)
    // After the first pass (600 ms) the loop is frames 1..2 (500 ms).
    expect(frameAt(c, 600).frame).toBe(1)
    expect(frameAt(c, 850).frame).toBe(2)
    expect(frameAt(c, 1100).frame).toBe(1)
    expect([600, 1100, 1600, 5100].map((t) => frameAt(c, t).frame)).toEqual([1, 1, 1, 1])
  })

  it('holds the last frame and reports finished for a one-shot clip', () => {
    const c = clip({ loop: false })
    expect(frameAt(c, 599).finished).toBe(false)
    expect(frameAt(c, 600)).toEqual({ frame: 2, finished: true, nextChangeMs: null })
    expect(frameAt(c, 10_000).frame).toBe(2)
  })

  it('treats negative time as the start', () => {
    expect(frameAt(clip({}), -50).frame).toBe(0)
  })
})
