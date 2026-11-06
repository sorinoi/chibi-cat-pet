import { describe, expect, it } from 'vitest'
import { careSummary, percent } from './careText'
import { stringsFor } from './strings'

const en = stringsFor('en')
const th = stringsFor('th')
const mali = { name: 'มะลิ', needs: { hunger: 71.6, happiness: 84.4 }, mood: 'content' as const }

describe('careSummary', () => {
  it('shows name, rounded needs and the mood', () => {
    expect(careSummary(mali, en)).toBe('มะลิ · Fed 72% · Happy 84% · Content')
  })

  it('uses the chosen language (FR-43)', () => {
    expect(careSummary(mali, th)).toBe('มะลิ · อิ่ม 72% · สุข 84% · สบายดี')
    expect(careSummary(null, th)).toBe('ยังไม่มีน้องแมว')
  })

  it('says so when there is no cat', () => {
    expect(careSummary(null, en)).toBe('No cat yet')
  })

  it('clamps percentages', () => {
    expect(percent(-3)).toBe(0)
    expect(percent(100.4)).toBe(100)
  })
})
