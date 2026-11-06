export interface MouseIgnoreController {
  /** Report whether the cursor is currently over the pet. Sends IPC only on change. */
  setOverPet(over: boolean): void
  readonly overPet: boolean
}

/**
 * Tracks the window's click-through state. The window starts ignoring mouse input
 * (main process sets this on creation), so the first `setOverPet(false)` is a no-op.
 */
export function createMouseIgnoreController(
  send: (ignore: boolean) => void
): MouseIgnoreController {
  let overPet = false
  return {
    setOverPet(over) {
      if (over === overPet) return
      overPet = over
      send(!over)
    },
    get overPet() {
      return overPet
    }
  }
}
