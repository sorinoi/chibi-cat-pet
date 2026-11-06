import { describe, expect, it } from 'vitest'
import { QUNS, isFullscreenState } from './notificationState'

describe('isFullscreenState', () => {
  it('treats fullscreen windows, D3D games and presentations as fullscreen', () => {
    expect(isFullscreenState(QUNS.BUSY)).toBe(true)
    expect(isFullscreenState(QUNS.RUNNING_D3D_FULL_SCREEN)).toBe(true)
    expect(isFullscreenState(QUNS.PRESENTATION_MODE)).toBe(true)
  })

  it('treats the normal desktop and everything else as not fullscreen', () => {
    for (const state of [
      QUNS.NOT_PRESENT,
      QUNS.ACCEPTS_NOTIFICATIONS,
      QUNS.QUIET_TIME,
      QUNS.APP,
      0,
      99
    ]) {
      expect(isFullscreenState(state)).toBe(false)
    }
  })
})
