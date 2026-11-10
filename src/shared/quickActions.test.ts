import { describe, expect, it } from 'vitest'
import { actionButtons, focusCommand } from './quickActions'
import { stringsFor } from './strings'

const en = stringsFor('en')
const th = stringsFor('th')

describe('quick buttons (requirement-v9.md FR-127..129)', () => {
  it('shows Feed, Focus, Settings, Hide in that order for an adopted cat', () => {
    const buttons = actionButtons(true, 'idle', en)
    expect(buttons.map((b) => b.id)).toEqual(['feed', 'focus', 'settings', 'hide'])
    expect(buttons.map((b) => b.label)).toEqual(['Feed', 'Start focus', 'Settings', 'Hide the cat'])
  })

  it('has no Feed button without a cat (FR-128)', () => {
    expect(actionButtons(false, 'idle', en).map((b) => b.id)).toEqual(['focus', 'settings', 'hide'])
  })

  it('the Focus button follows the timer (FR-129)', () => {
    const focus = (kind: Parameters<typeof actionButtons>[1]) =>
      actionButtons(true, kind, en).find((b) => b.id === 'focus')
    expect(focus('idle')).toMatchObject({ variant: 'focusStart', label: 'Start focus' })
    expect(focus('running')).toMatchObject({ variant: 'focusPause', label: 'Pause' })
    expect(focus('paused')).toMatchObject({ variant: 'focusResume', label: 'Resume' })
    expect(focus('waiting')).toMatchObject({ variant: 'focusStartBreak', label: 'Start break' })
    expect(focusCommand('idle')).toBe('startFocus')
    expect(focusCommand('running')).toBe('pause')
    expect(focusCommand('paused')).toBe('resume')
    expect(focusCommand('waiting')).toBe('startBreak')
  })

  it('labels follow the language (NFR-53)', () => {
    const labels = actionButtons(true, 'running', th).map((b) => b.label)
    expect(labels).toEqual(['ให้อาหาร', 'หยุดชั่วคราว', 'ตั้งค่า', 'ซ่อนน้องแมว'])
  })
})
