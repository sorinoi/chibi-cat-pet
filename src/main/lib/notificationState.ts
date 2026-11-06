/**
 * Values of QUERY_USER_NOTIFICATION_STATE (shellapi.h), returned by
 * SHQueryUserNotificationState. Pure, so it is unit tested without Windows.
 */
export const QUNS = {
  NOT_PRESENT: 1,
  BUSY: 2,
  RUNNING_D3D_FULL_SCREEN: 3,
  PRESENTATION_MODE: 4,
  ACCEPTS_NOTIFICATIONS: 5,
  QUIET_TIME: 6,
  APP: 7
} as const

/**
 * FR-16: true when something fullscreen owns the screen: a fullscreen window (video,
 * browser F11, borderless game), an exclusive Direct3D game, or presentation mode.
 * NOT_PRESENT (lock screen, screen saver) is not fullscreen: the pet sleeps there anyway.
 */
export function isFullscreenState(state: number): boolean {
  return (
    state === QUNS.BUSY ||
    state === QUNS.RUNNING_D3D_FULL_SCREEN ||
    state === QUNS.PRESENTATION_MODE
  )
}
