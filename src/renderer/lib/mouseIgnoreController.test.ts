import { describe, expect, it, vi } from 'vitest'
import { createMouseIgnoreController } from './mouseIgnoreController'

describe('createMouseIgnoreController', () => {
  it('starts click-through and sends nothing while the cursor stays off the pet', () => {
    const send = vi.fn()
    const ctrl = createMouseIgnoreController(send)
    ctrl.setOverPet(false)
    ctrl.setOverPet(false)
    expect(send).not.toHaveBeenCalled()
    expect(ctrl.overPet).toBe(false)
  })

  it('turns mouse input on when entering the pet and off when leaving', () => {
    const send = vi.fn()
    const ctrl = createMouseIgnoreController(send)
    ctrl.setOverPet(true)
    expect(send).toHaveBeenLastCalledWith(false)
    ctrl.setOverPet(false)
    expect(send).toHaveBeenLastCalledWith(true)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('does not resend while the state is unchanged', () => {
    const send = vi.fn()
    const ctrl = createMouseIgnoreController(send)
    for (let i = 0; i < 10; i++) ctrl.setOverPet(true)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
