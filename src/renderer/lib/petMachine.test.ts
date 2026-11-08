import { describe, expect, it } from 'vitest'
import { clipFor, transition, type PetEvent, type PetState } from './petMachine'

function run(start: PetState, events: PetEvent[]): PetState {
  return events.reduce<PetState>((state, event) => transition(state, event) ?? state, start)
}

describe('pet state machine', () => {
  it('plays the click reaction once, then returns to idle', () => {
    expect(transition('idle', 'click')).toBe('click')
    expect(transition('click', 'clipFinished')).toBe('idle')
  })

  it('goes drag -> fall -> land -> idle (requirement-v5.md FR-60)', () => {
    expect(run('idle', ['dragStart', 'dragEnd'])).toBe('fall')
    expect(run('idle', ['dragStart', 'dragEnd', 'landed'])).toBe('land')
    expect(run('idle', ['dragStart', 'dragEnd', 'landed', 'clipFinished'])).toBe('idle')
  })

  it('can be picked up from any resting or moving state', () => {
    for (const state of ['idle', 'walk', 'click', 'land', 'sleep'] as const) {
      expect(transition(state, 'dragStart')).toBe('drag')
    }
  })

  it('ignores everything except release while dragged', () => {
    for (const event of ['click', 'wander', 'sleep', 'wake', 'clipFinished', 'arrived'] as const) {
      expect(transition('drag', event)).toBeNull()
    }
  })

  it('walks and returns to idle on arrival', () => {
    expect(run('idle', ['wander', 'arrived'])).toBe('idle')
  })

  it('sleeps from idle or walk, wakes on activity or a click', () => {
    expect(transition('idle', 'sleep')).toBe('sleep')
    expect(transition('walk', 'sleep')).toBe('sleep')
    expect(transition('sleep', 'wake')).toBe('idle')
    expect(transition('sleep', 'click')).toBe('click')
  })

  it('does not wander or sleep in the middle of a reaction', () => {
    expect(transition('click', 'wander')).toBeNull()
    expect(transition('click', 'sleep')).toBeNull()
    expect(transition('land', 'wander')).toBeNull()
  })
})

describe('pet state machine: v2 care', () => {
  it('feeds, pets and refuses food from idle, walk and sleep (feeding wakes it)', () => {
    for (const state of ['idle', 'walk', 'sleep'] as const) {
      expect(transition(state, 'feed')).toBe('eat')
      expect(transition(state, 'pet')).toBe('pet')
      expect(transition(state, 'refuseFood')).toBe('click')
      expect(transition(state, 'clickHappy')).toBe('happy')
    }
  })

  it('plays the hungry reminder only from idle', () => {
    expect(transition('idle', 'hungryReminder')).toBe('hungry')
    expect(transition('walk', 'hungryReminder')).toBeNull()
    expect(transition('sleep', 'hungryReminder')).toBeNull()
  })

  it('returns to idle after every care reaction and lets a drag interrupt it', () => {
    for (const state of ['eat', 'happy', 'hungry', 'pet'] as const) {
      expect(transition(state, 'clipFinished')).toBe('idle')
      expect(transition(state, 'dragStart')).toBe('drag')
    }
  })

  it('ignores care actions and clicks during another care animation', () => {
    for (const state of ['eat', 'happy', 'hungry', 'pet'] as const) {
      for (const event of ['feed', 'pet', 'click', 'clickHappy', 'wander', 'sleep'] as const) {
        expect(transition(state, event)).toBeNull()
      }
    }
  })

  it('does not feed or pet while dragged or landing', () => {
    expect(transition('drag', 'feed')).toBeNull()
    expect(transition('land', 'pet')).toBeNull()
  })
})

describe('pet state machine: adoption welcome', () => {
  it('plays the pet clip, then happy, then idle', () => {
    expect(clipFor('welcome')).toBe('pet')
    expect(transition('idle', 'welcome')).toBe('welcome')
    expect(transition('welcome', 'clipFinished')).toBe('happy')
    expect(transition('happy', 'clipFinished')).toBe('idle')
  })

  it('can start from any resting state, and a drag still wins', () => {
    for (const state of ['idle', 'walk', 'sleep', 'land'] as const) {
      expect(transition(state, 'welcome')).toBe('welcome')
    }
    expect(transition('welcome', 'dragStart')).toBe('drag')
    expect(transition('welcome', 'feed')).toBeNull()
  })
})

describe('focus timer reactions (requirement-v3.md section 10)', () => {
  const cues = [
    ['cueFocusStart', 'focusStart'],
    ['cueFocusDone', 'focusDone'],
    ['cueBreakOver', 'breakOver'],
    ['cueLongBreak', 'longBreak']
  ] as const

  it('start from idle, walk, sleep and land', () => {
    for (const [cue, state] of cues) {
      for (const from of ['idle', 'walk', 'sleep', 'land'] as const) {
        expect(transition(from, cue)).toBe(state)
      }
    }
  })

  it('do not interrupt a drag or another reaction (the renderer queues them)', () => {
    for (const [cue] of cues) {
      for (const from of ['drag', 'click', 'eat', 'happy', 'hungry', 'pet', 'focusDone'] as const) {
        expect(transition(from, cue)).toBeNull()
      }
    }
  })

  it('return to idle when the clip ends; a drag can interrupt', () => {
    for (const [, state] of cues) {
      expect(transition(state, 'clipFinished')).toBe('idle')
      expect(transition(state, 'dragStart')).toBe('drag')
    }
  })
})

describe('treats (requirement-v4.md FR-52)', () => {
  it('a treat plays eat, or happy when full, from a resting or moving cat', () => {
    for (const from of ['idle', 'walk', 'sleep'] as const) {
      expect(transition(from, 'treat')).toBe('eat')
      expect(transition(from, 'treatFull')).toBe('happy')
    }
  })

  it('is ignored during another care animation or a drag', () => {
    for (const from of ['eat', 'happy', 'pet', 'drag'] as const) {
      expect(transition(from, 'treat')).toBeNull()
    }
  })
})

describe('v4 life reactions (requirement-v4.md section 10)', () => {
  it('sad reminder, morning stretch and night yawn start from idle', () => {
    expect(transition('idle', 'sadReminder')).toBe('sad')
    expect(transition('idle', 'morningStretch')).toBe('stretch')
    expect(transition('idle', 'nightYawn')).toBe('yawn')
    expect(transition('walk', 'sadReminder')).toBeNull()
    expect(transition('sleep', 'nightYawn')).toBeNull()
  })

  it('return to idle when the clip ends; a drag can interrupt', () => {
    for (const state of ['sad', 'stretch', 'yawn'] as const) {
      expect(transition(state, 'clipFinished')).toBe('idle')
      expect(transition(state, 'dragStart')).toBe('drag')
      expect(transition(state, 'feed')).toBeNull()
    }
  })
})

describe('look at the mouse (requirement-v4.md FR-56)', () => {
  it('starts only from idle and ends when the cursor goes away', () => {
    expect(transition('idle', 'cursorNear')).toBe('look')
    expect(transition('walk', 'cursorNear')).toBeNull()
    expect(transition('sleep', 'cursorNear')).toBeNull()
    expect(transition('eat', 'cursorNear')).toBeNull()
    expect(transition('look', 'cursorAway')).toBe('idle')
  })

  it('a looking cat still reacts like a resting one', () => {
    expect(transition('look', 'click')).toBe('click')
    expect(transition('look', 'dragStart')).toBe('drag')
    expect(transition('look', 'feed')).toBe('eat')
    expect(transition('look', 'pet')).toBe('pet')
    expect(transition('look', 'cueFocusDone')).toBe('focusDone')
    expect(transition('look', 'sleep')).toBe('sleep')
  })

  it('the look clip loops, so it never finishes by itself', () => {
    expect(transition('look', 'clipFinished')).toBeNull()
    expect(transition('look', 'wander')).toBeNull()
  })
})

describe('climbing (requirement-v5.md FR-76, FR-77)', () => {
  it('walks to the wall, climbs, holds on and lets go', () => {
    expect(run('idle', ['climbWander'])).toBe('toWall')
    expect(clipFor('toWall')).toBe('walk')
    expect(run('idle', ['climbWander', 'atWall'])).toBe('climb')
    expect(run('idle', ['climbWander', 'atWall', 'holdPoint'])).toBe('hang')
    expect(run('idle', ['climbWander', 'atWall', 'holdPoint', 'fallStart', 'landed'])).toBe('land')
  })

  it('can be caught on the way and on the wall; nothing else interrupts', () => {
    for (const state of ['toWall', 'climb', 'hang'] as const) {
      expect(transition(state, 'dragStart')).toBe('drag')
      for (const event of ['click', 'feed', 'sleep', 'wander', 'cueFocusDone', 'jump'] as const) {
        expect(transition(state, event)).toBeNull()
      }
    }
  })

  it('a climb main ends early falls from the wall, or is just over on the floor', () => {
    expect(transition('climb', 'fallStart')).toBe('fall')
    expect(transition('toWall', 'landed')).toBe('idle')
  })
})

describe('jumping (requirement-v5.md section 10)', () => {
  it('jumps from idle and ends standing or falling', () => {
    expect(transition('idle', 'jump')).toBe('jump')
    expect(transition('jump', 'landed')).toBe('land')
    expect(transition('jump', 'fallStart')).toBe('fall')
    expect(run('idle', ['jump', 'fallStart', 'landed', 'clipFinished'])).toBe('idle')
  })

  it('can be caught mid-jump and ignores everything else (FR-77)', () => {
    expect(transition('jump', 'dragStart')).toBe('drag')
    const events: PetEvent[] = ['click', 'feed', 'pet', 'wander', 'sleep', 'cueFocusDone', 'jump']
    for (const event of events) expect(transition('jump', event)).toBeNull()
  })

  it('only an idle cat starts a jump', () => {
    for (const state of ['walk', 'sleep', 'look', 'drag', 'fall', 'land'] as const) {
      expect(transition(state, 'jump')).toBeNull()
    }
  })
})

describe('falling (requirement-v5.md section 10)', () => {
  it('can be caught again in the air (FR-62)', () => {
    expect(transition('fall', 'dragStart')).toBe('drag')
    expect(run('fall', ['dragStart', 'dragEnd', 'landed'])).toBe('land')
  })

  it('ignores clicks, care, wanders, sleep and focus cues until it lands (FR-62)', () => {
    const events: PetEvent[] = [
      'click',
      'clickHappy',
      'feed',
      'pet',
      'treat',
      'welcome',
      'wander',
      'sleep',
      'wake',
      'clipFinished',
      'cueFocusDone',
      'cursorNear',
      'fallStart',
      'dragEnd'
    ]
    for (const event of events) expect(transition('fall', event)).toBeNull()
  })

  it('a cat found in the air falls from rest or a reaction, and wakes up (FR-63)', () => {
    const states: PetState[] = [
      'idle',
      'walk',
      'sleep',
      'look',
      'click',
      'land',
      'eat',
      'happy',
      'focusDone',
      'sad',
      'stretch',
      'welcome'
    ]
    for (const state of states) expect(transition(state, 'fallStart')).toBe('fall')
  })

  it('a carried cat does not start a second fall; landed means nothing outside a fall', () => {
    expect(transition('drag', 'fallStart')).toBeNull()
    for (const state of ['idle', 'land', 'sleep', 'walk', 'drag'] as const) {
      expect(transition(state, 'landed')).toBeNull()
    }
  })

  it('plays the fall clip (drag until the art exists)', () => {
    expect(clipFor('fall')).toBe('fall')
  })
})
