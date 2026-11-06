import { describe, expect, it } from 'vitest'
import { createFrameLimiter } from './frameLimiter'

const FRAME_60 = 1000 / 60

function countRendered(limiter: ReturnType<typeof createFrameLimiter>, frames: number): number {
  let rendered = 0
  for (let i = 0; i < frames; i++) {
    if (limiter.tick(i * FRAME_60) !== null) rendered++
  }
  return rendered
}

describe('createFrameLimiter', () => {
  it('renders about 30 of 60 display frames per second', () => {
    expect(countRendered(createFrameLimiter(30), 60)).toBe(30)
  })

  it('renders the first frame with zero delta', () => {
    expect(createFrameLimiter(30).tick(1234)).toBe(0)
  })

  it('clamps long gaps (for example after the window was hidden)', () => {
    const limiter = createFrameLimiter(30, 0.1)
    limiter.tick(0)
    expect(limiter.tick(5000)).toBe(0.1)
    // Cadence restarts from the late frame instead of bursting to catch up.
    expect(limiter.tick(5000 + FRAME_60)).toBeNull()
  })

  it('starts over after reset', () => {
    const limiter = createFrameLimiter(30)
    limiter.tick(0)
    limiter.reset()
    expect(limiter.tick(10)).toBe(0)
  })
})
