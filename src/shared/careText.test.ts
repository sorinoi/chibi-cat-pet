import { describe, expect, it } from 'vitest'
import { careSummary, percent } from './careText'

describe('careSummary', () => {
  it('shows name, rounded needs and the mood', () => {
    expect(
      careSummary({ name: 'มะลิ', needs: { hunger: 71.6, happiness: 84.4 }, mood: 'content' })
    ).toBe('มะลิ · Fed 72% · Happy 84% · Content')
  })

  it('says so when there is no cat', () => {
    expect(careSummary(null)).toBe('No cat yet')
  })

  it('clamps percentages', () => {
    expect(percent(-3)).toBe(0)
    expect(percent(100.4)).toBe(100)
  })
})
