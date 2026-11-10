/**
 * requirement-v9.md FR-121: when the quick buttons hide. They stay while the pointer is on the
 * cat or on a button, and hide a short moment after it is on neither (so the pointer can cross
 * the gap from the cat to the buttons). Other reasons close them at once.
 */
export interface ActionsVisibility {
  /** The buttons were shown; the pointer rests on the cat. */
  open(): void
  isOpen(): boolean
  /** Where the pointer is, as the pet and buttons windows report it. */
  setPointer(on: 'pet' | 'buttons', over: boolean): void
  /** Hide now (click, drag, hidden, ...). Does nothing when already closed. */
  close(): void
  dispose(): void
}

export interface ActionsVisibilityOptions {
  hideDelayMs: number
  onHide(): void
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

export function createActionsVisibility(options: ActionsVisibilityOptions): ActionsVisibility {
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  let open = false
  let overPet = false
  let overButtons = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopTimer(): void {
    if (timer) clearTimer(timer)
    timer = null
  }

  function close(): void {
    stopTimer()
    if (!open) return
    open = false
    overPet = false
    overButtons = false
    options.onHide()
  }

  function update(): void {
    if (!open) return
    if (overPet || overButtons) stopTimer()
    else if (!timer) timer = setTimer(close, options.hideDelayMs)
  }

  return {
    open() {
      stopTimer()
      open = true
      overPet = true
      overButtons = false
    },
    isOpen: () => open,
    setPointer(on, over) {
      if (on === 'pet') overPet = over
      else overButtons = over
      update()
    },
    close,
    dispose() {
      stopTimer()
      open = false
    }
  }
}
