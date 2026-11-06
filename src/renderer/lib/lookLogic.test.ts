import { describe, expect, it } from 'vitest'
import { lookSide } from './lookLogic'

const win = { width: 160, height: 160, overPet: false }

describe('look at the mouse (requirement-v4.md FR-56)', () => {
  it('looks toward a nearby cursor on either side', () => {
    expect(lookSide({ ...win, x: 300, y: 80 })).toBe('right')
    expect(lookSide({ ...win, x: -100, y: 80 })).toBe('left')
    expect(lookSide({ ...win, x: 120, y: -150 })).toBe('right')
  })

  it('ignores a cursor farther than 200 DIP from the window', () => {
    expect(lookSide({ ...win, x: 361, y: 80 })).toBeNull()
    expect(lookSide({ ...win, x: 360, y: 80 })).toBe('right')
    // Diagonal distance counts.
    expect(lookSide({ ...win, x: 160 + 150, y: 160 + 150 })).toBeNull()
  })

  it('does not look while the cursor is over the cat', () => {
    expect(lookSide({ ...win, x: 80, y: 80, overPet: true })).toBeNull()
    // Inside the window but over a transparent area: still a look.
    expect(lookSide({ ...win, x: 20, y: 20 })).toBe('left')
  })
})
