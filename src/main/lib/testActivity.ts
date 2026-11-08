/** Test helper (only imported by tests): a valid activity event with a counting id. */
import type { ActivityEvent } from '../../shared/activity'

export function testEvent(at: number, i: number): ActivityEvent {
  const hex = i.toString(16).padStart(12, '0')
  return {
    v: 1,
    id: `00000000-0000-4000-8000-${hex}`,
    type: 'care.pet',
    at,
    tz: 420,
    device: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    app: '6.0.0',
    pet: {
      id: '11111111-2222-4333-8444-555555555555',
      name: 'Mochi',
      adoptedAt: 1,
      hunger: 80,
      happiness: 80,
      mood: 'happy'
    },
    data: { counted: true }
  }
}
