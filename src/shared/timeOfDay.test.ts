import { describe, expect, it } from 'vitest'
import { inHourWindow, isMorning, isNight, morningStretchDue, sleepAfterSeconds } from './timeOfDay'

const at = (h: number, m = 0, day = 6): number => new Date(2026, 10, day, h, m).getTime()

describe('time of day (requirement-v4.md FR-58, FR-59)', () => {
  it('handles windows that cross midnight', () => {
    expect(inHourWindow(23, 23, 5)).toBe(true)
    expect(inHourWindow(2, 23, 5)).toBe(true)
    expect(inHourWindow(5, 23, 5)).toBe(false)
    expect(inHourWindow(12, 23, 5)).toBe(false)
    expect(inHourWindow(5, 5, 11)).toBe(true)
    expect(inHourWindow(11, 5, 11)).toBe(false)
  })

  it('morning is 05:00-10:59, night is 23:00-04:59', () => {
    expect(isMorning(at(5))).toBe(true)
    expect(isMorning(at(10, 59))).toBe(true)
    expect(isMorning(at(11))).toBe(false)
    expect(isNight(at(23, 30))).toBe(true)
    expect(isNight(at(4, 59))).toBe(true)
    expect(isNight(at(22, 59))).toBe(false)
  })

  it('stretches once per morning', () => {
    expect(morningStretchDue(at(7), null)).toBe(true)
    expect(morningStretchDue(at(8), '2026-11-06')).toBe(false)
    expect(morningStretchDue(at(8, 0, 7), '2026-11-06')).toBe(true)
    expect(morningStretchDue(at(14), null)).toBe(false)
  })

  it('gets sleepy in half the time at night, at least one minute', () => {
    expect(sleepAfterSeconds(5, at(14))).toBe(300)
    expect(sleepAfterSeconds(5, at(23, 30))).toBe(150)
    expect(sleepAfterSeconds(1, at(1))).toBe(60)
  })
})
