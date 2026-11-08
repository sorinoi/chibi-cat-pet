import { describe, expect, it } from 'vitest'
import { actionItems, timerItems } from './focusActivity'
import type { FocusSettings, TimerState } from '../../shared/focusTimer'

const S: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false
}
const idle: TimerState = { kind: 'idle', run: 0 }
const focusing: TimerState = { kind: 'running', phase: 'focus', endsAt: 10, run: 1 }
const longBreak: TimerState = { kind: 'running', phase: 'longBreak', endsAt: 10, run: 4 }
const paused: TimerState = { kind: 'paused', phase: 'shortBreak', remainingMs: 5, run: 1 }
const waiting: TimerState = { kind: 'waiting', phase: 'shortBreak', run: 1 }

describe('timerItems (requirement-v6.md FR-80)', () => {
  it('turns timer events into started and phaseEnded items with planned minutes', () => {
    expect(
      timerItems(
        focusing,
        [{ type: 'focusCompleted' }, { type: 'breakStarted', phase: 'longBreak' }],
        S
      )
    ).toEqual([
      { type: 'focus.phaseEnded', data: { phase: 'focus', completed: true } },
      { type: 'focus.started', data: { phase: 'longBreak', minutes: 15 } }
    ])
    expect(timerItems(idle, [{ type: 'focusStarted' }], S)).toEqual([
      { type: 'focus.started', data: { phase: 'focus', minutes: 25 } }
    ])
  })

  it('names the break that ended, and a focus cut short by sleep as not completed', () => {
    expect(timerItems(longBreak, [{ type: 'breakOver' }], S)).toEqual([
      { type: 'focus.phaseEnded', data: { phase: 'longBreak', completed: true } }
    ])
    expect(timerItems(focusing, [{ type: 'focusInterrupted' }], S)).toEqual([
      { type: 'focus.phaseEnded', data: { phase: 'focus', completed: false } }
    ])
  })
})

describe('actionItems (requirement-v6.md FR-80)', () => {
  it('reports pause, resume, skip and stop with the phase they hit', () => {
    expect(
      actionItems('pause', focusing, { ...focusing, kind: 'paused', remainingMs: 1 } as TimerState)
    ).toEqual([{ type: 'focus.paused', data: { phase: 'focus' } }])
    expect(actionItems('resume', paused, focusing)).toEqual([
      { type: 'focus.resumed', data: { phase: 'shortBreak' } }
    ])
    expect(actionItems('skip', waiting, idle)).toEqual([
      { type: 'focus.skipped', data: { phase: 'shortBreak' } }
    ])
    expect(actionItems('stop', focusing, idle)).toEqual([
      { type: 'focus.stopped', data: { phase: 'focus' } }
    ])
    expect(actionItems('stop', waiting, idle)).toEqual([
      { type: 'focus.stopped', data: { phase: null } }
    ])
  })

  it('reports nothing when the action changed nothing, or for starts (the timer reports those)', () => {
    expect(actionItems('pause', idle, idle)).toEqual([])
    expect(actionItems('stop', idle, idle)).toEqual([])
    expect(actionItems('startFocus', idle, focusing)).toEqual([])
  })
})
