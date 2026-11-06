import { describe, expect, it } from 'vitest'
import { FOCUS } from './focusConfig'
import { focusNotice, focusReaction, focusStatus, type FocusView } from './focusText'
import { stringsFor } from './strings'

const en = stringsFor('en')
const th = stringsFor('th')
const S = FOCUS.defaults
const view = (v: Partial<FocusView>): FocusView => ({
  kind: 'idle',
  phase: null,
  minutesLeft: null,
  completedToday: 0,
  week: [],
  ...v
})

describe('focusStatus (FR-36)', () => {
  it('shows phase, minutes left and today', () => {
    const running = view({ kind: 'running', phase: 'focus', minutesLeft: 12, completedToday: 3 })
    expect(focusStatus(running, en)).toBe('Focus · 12 min left · Today: 3 🍅')
    expect(focusStatus(running, th)).toBe('โฟกัส · เหลือ 12 นาที · วันนี้: 3 🍅')
  })

  it('paused, waiting and idle', () => {
    expect(focusStatus(view({ kind: 'paused', phase: 'shortBreak', minutesLeft: 4 }), en)).toBe(
      'Paused (Short break) · 4 min left · Today: 0 🍅'
    )
    expect(focusStatus(view({ kind: 'waiting', phase: 'longBreak', completedToday: 4 }), th)).toBe(
      'พร้อมพักยาวแล้ว · วันนี้: 4 🍅'
    )
    expect(focusStatus(view({ completedToday: 2 }), en)).toBe('Today: 2 🍅')
  })
})

describe('focusNotice (FR-37)', () => {
  const inBreak = view({ kind: 'running', phase: 'shortBreak', minutesLeft: 5 })

  it('focus completed with an automatic break', () => {
    const n = focusNotice(
      [{ type: 'focusCompleted' }, { type: 'breakStarted', phase: 'longBreak' }],
      inBreak,
      S,
      en
    )
    expect(n).toEqual({ title: 'Focus complete 🍅', body: 'Nice work! Long break: 15 minutes.' })
  })

  it('focus completed with the break waiting', () => {
    const waiting = view({ kind: 'waiting', phase: 'shortBreak' })
    expect(focusNotice([{ type: 'focusCompleted' }], waiting, S, th)?.body).toBe(
      'เก่งมาก! พร้อมเมื่อไหร่ก็เริ่มพักสั้นได้เลย'
    )
  })

  it('break over, with and without the next focus starting', () => {
    expect(focusNotice([{ type: 'breakOver' }], view({}), S, en)?.body).toBe(
      'Ready for the next focus?'
    )
    expect(
      focusNotice([{ type: 'breakOver' }, { type: 'focusStarted' }], view({}), S, en)?.body
    ).toBe('Next focus started: 25 minutes.')
  })

  it('interrupted focus', () => {
    expect(focusNotice([{ type: 'focusInterrupted' }], view({}), S, en)?.title).toBe(
      'Focus interrupted'
    )
  })

  it('no notification for actions the user just took', () => {
    expect(focusNotice([{ type: 'focusStarted' }], view({}), S, en)).toBeNull()
    expect(focusNotice([{ type: 'breakStarted', phase: 'shortBreak' }], inBreak, S, en)).toBeNull()
    expect(focusNotice([], view({}), S, en)).toBeNull()
  })
})

describe('focusReaction (section 5)', () => {
  it('picks one reaction per step', () => {
    expect(focusReaction([{ type: 'focusStarted' }])).toBe('focusStart')
    expect(
      focusReaction([{ type: 'focusCompleted' }, { type: 'breakStarted', phase: 'shortBreak' }])
    ).toBe('focusDone')
    expect(
      focusReaction([{ type: 'focusCompleted' }, { type: 'breakStarted', phase: 'longBreak' }])
    ).toBe('longBreak')
    expect(focusReaction([{ type: 'breakOver' }, { type: 'focusStarted' }])).toBe('breakOver')
    expect(focusReaction([{ type: 'focusInterrupted' }])).toBeNull()
    expect(focusReaction([{ type: 'breakStarted', phase: 'shortBreak' }])).toBeNull()
  })
})
