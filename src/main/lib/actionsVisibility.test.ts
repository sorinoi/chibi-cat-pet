import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createActionsVisibility } from './actionsVisibility'

describe('actions visibility (requirement-v9.md FR-121)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const onHide = vi.fn()
    const v = createActionsVisibility({ hideDelayMs: 600, onHide })
    return { v, onHide }
  }

  it('stays open while the pointer rests on the cat', () => {
    const { v, onHide } = setup()
    v.open()
    vi.advanceTimersByTime(10_000)
    expect(v.isOpen()).toBe(true)
    expect(onHide).not.toHaveBeenCalled()
  })

  it('hides a moment after the pointer leaves both the cat and the buttons', () => {
    const { v, onHide } = setup()
    v.open()
    v.setPointer('pet', false)
    vi.advanceTimersByTime(599)
    expect(onHide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onHide).toHaveBeenCalledTimes(1)
    expect(v.isOpen()).toBe(false)
  })

  it('stays open when the pointer crosses the gap to a button in time', () => {
    const { v, onHide } = setup()
    v.open()
    v.setPointer('pet', false)
    vi.advanceTimersByTime(300)
    v.setPointer('buttons', true)
    vi.advanceTimersByTime(5_000)
    expect(onHide).not.toHaveBeenCalled()
    // Leaving the button starts the delay again.
    v.setPointer('buttons', false)
    vi.advanceTimersByTime(600)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('back on the cat cancels the pending hide', () => {
    const { v, onHide } = setup()
    v.open()
    v.setPointer('pet', false)
    vi.advanceTimersByTime(400)
    v.setPointer('pet', true)
    vi.advanceTimersByTime(5_000)
    expect(onHide).not.toHaveBeenCalled()
  })

  it('close hides at once, only once, and ignores pointer reports afterwards', () => {
    const { v, onHide } = setup()
    v.open()
    v.close()
    v.close()
    expect(onHide).toHaveBeenCalledTimes(1)
    v.setPointer('pet', false)
    vi.advanceTimersByTime(5_000)
    expect(onHide).toHaveBeenCalledTimes(1)
  })

  it('a pointer report while closed does nothing', () => {
    const { v, onHide } = setup()
    v.setPointer('buttons', false)
    vi.advanceTimersByTime(5_000)
    expect(onHide).not.toHaveBeenCalled()
  })

  it('reopening forgets an old pending hide', () => {
    const { v, onHide } = setup()
    v.open()
    v.setPointer('pet', false)
    v.open()
    vi.advanceTimersByTime(5_000)
    expect(onHide).not.toHaveBeenCalled()
  })
})
