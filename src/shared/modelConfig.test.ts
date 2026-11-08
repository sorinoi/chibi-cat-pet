import { describe, expect, it } from 'vitest'
import {
  CLIP_NAMES,
  lookOf,
  sheetFile,
  MOVE_CLIPS,
  modelFrame,
  parseModelConfig,
  resolveClip,
  STANDARD_CLIPS
} from './modelConfig'
import shipped from '../../assets/models/cat-sprite.json'

const sheet = {
  file: 'cat-test.png',
  columns: 8,
  rows: 6,
  cellWidth: 192,
  cellHeight: 192,
  anchor: { x: 96, y: 177 }
}

const valid = {
  id: 'cat-test',
  name: 'Test cat',
  sheets: { main: sheet },
  displayScale: 1,
  edgeOverflow: { x: 30, top: 0, bottom: 15 },
  walkFacing: 'right',
  clips: {
    idle: { sheet: 'main', row: 0, frames: 4, loop: true, fps: 8 },
    sleep: { sheet: 'main', row: 5, frames: 3, loop: true, loopFrom: 1, frameMs: [100, 200, 300] }
  },
  license: 'Self-made'
}

const withClips = (clips: Record<string, unknown>): unknown => ({ ...valid, clips })
const idleClip = (extra: Record<string, unknown>): Record<string, unknown> => ({
  idle: { sheet: 'main', row: 0, frames: 2, loop: true, fps: 1, ...extra }
})

describe('parseModelConfig', () => {
  it('accepts a valid config and expands fps into frame durations', () => {
    const config = parseModelConfig(valid)
    expect(config.clips.idle).toEqual({
      sheet: 'main',
      row: 0,
      column: 0,
      frames: 4,
      loop: true,
      loopFrom: 0,
      frameMs: [125, 125, 125, 125]
    })
    expect(config.clips.sleep?.frameMs).toEqual([100, 200, 300])
    expect(config.sheets.main.scale).toBe(1)
  })

  it('never lets a frame be shorter than the fps cap', () => {
    const config = parseModelConfig(withClips(idleClip({ fps: 120 })), 30)
    expect(config.clips.idle.frameMs[0]).toBeCloseTo(1000 / 30)
  })

  it('requires an idle clip and rejects unknown clips', () => {
    expect(() => parseModelConfig(withClips({ walk: valid.clips.idle }))).toThrow(/idle/)
    expect(() => parseModelConfig(withClips({ ...idleClip({}), dance: valid.clips.idle }))).toThrow(
      /dance/
    )
  })

  it('accepts the v2 care clips', () => {
    const config = parseModelConfig(withClips({ ...idleClip({}), eat: valid.clips.idle }))
    expect(config.clips.eat?.row).toBe(0)
  })

  it('rejects clips that do not fit their sheet or name a missing sheet', () => {
    expect(() => parseModelConfig(withClips(idleClip({ row: 6 })))).toThrow(/row/)
    expect(() => parseModelConfig(withClips(idleClip({ frames: 9 })))).toThrow(/frames/)
    expect(() => parseModelConfig(withClips(idleClip({ loopFrom: 2 })))).toThrow(/loopFrom/)
    expect(() => parseModelConfig(withClips(idleClip({ frameMs: [100] })))).toThrow(/frameMs/)
    expect(() => parseModelConfig(withClips(idleClip({ sheet: 'care' })))).toThrow(/unknown sheet/)
  })

  it('reads a wall point for wall clips, inside the cell (requirement-v5.md section 8)', () => {
    expect(parseModelConfig(withClips(idleClip({ wallX: 150 }))).clips.idle.wallX).toBe(150)
    expect(parseModelConfig(withClips(idleClip({}))).clips.idle.wallX).toBeUndefined()
    expect(() => parseModelConfig(withClips(idleClip({ wallX: 500 })))).toThrow(/wallX/)
    expect(() => parseModelConfig(withClips(idleClip({ wallX: -1 })))).toThrow(/wallX/)
  })

  it('lets a clip start in the middle of a row, inside the sheet (requirement-v5.md)', () => {
    expect(parseModelConfig(withClips(idleClip({ column: 2 }))).clips.idle.column).toBe(2)
    expect(() => parseModelConfig(withClips(idleClip({ column: 7 })))).toThrow(/column/)
    expect(() => parseModelConfig(withClips(idleClip({ column: -1 })))).toThrow(/column/)
    expect(() => parseModelConfig(withClips(idleClip({ column: 1.5 })))).toThrow(/column/)
  })

  it('rejects bad sheets and missing strings', () => {
    const bad = (s: Record<string, unknown>): unknown => ({
      ...valid,
      sheets: { main: { ...sheet, ...s } }
    })
    expect(() => parseModelConfig(bad({ anchor: { x: 500, y: 10 } }))).toThrow(/anchor/)
    expect(() => parseModelConfig(bad({ file: '' }))).toThrow(/file/)
    expect(() => parseModelConfig({ ...valid, sheets: {} })).toThrow(/at least one/)
    expect(() => parseModelConfig({ ...valid, walkFacing: 'up' })).toThrow(/walkFacing/)
    expect(() => parseModelConfig(null)).toThrow(/object/)
  })

  it('accepts the shipped cat model with every clip', () => {
    const config = parseModelConfig(shipped)
    expect(Object.keys(config.clips).sort()).toEqual([...CLIP_NAMES].sort())
    for (const clip of MOVE_CLIPS) expect(config.clips[clip]?.sheet).toBe('move')
    expect(config.clips.fall?.column).toBe(3)
    for (const clip of ['focusStart', 'focusDone', 'breakOver', 'longBreak'] as const) {
      expect(config.clips[clip]?.sheet).toBe('focus')
    }
    for (const clip of STANDARD_CLIPS) expect(config.clips[clip]?.sheet).toBe('main')
  })
})

describe('modelFrame', () => {
  it('equals the cell for a single sheet', () => {
    expect(modelFrame({ sheets: { main: { ...sheet, scale: 1 } } })).toEqual({
      width: 192,
      height: 192,
      feetX: 96,
      feetY: 177
    })
  })

  it('fits every sheet with all feet on one point', () => {
    const frame = modelFrame({
      sheets: {
        main: { ...sheet, scale: 1 },
        care: { ...sheet, cellWidth: 224, cellHeight: 224, anchor: { x: 112, y: 210 }, scale: 1 }
      }
    })
    // Feet: the larger anchor; below the feet: the larger margin (192 - 177 = 15 vs 14).
    expect(frame).toEqual({ width: 224, height: 225, feetX: 112, feetY: 210 })
  })

  it('applies each sheet scale', () => {
    const frame = modelFrame({ sheets: { main: { ...sheet, scale: 0.5 } } })
    expect(frame).toEqual({ width: 96, height: 96, feetX: 48, feetY: 88.5 })
  })
})

describe('resolveClip (requirement-v3.md section 5 fallbacks)', () => {
  const v2 = { idle: 1, click: 1, happy: 1, eat: 1 }
  it('plays the clip itself when the model has it', () => {
    expect(resolveClip('eat', v2)).toBe('eat')
    expect(resolveClip('focusDone', { ...v2, focusDone: 1 })).toBe('focusDone')
  })

  it('falls back for focus reactions until their art exists', () => {
    expect(resolveClip('focusStart', v2)).toBe('click')
    expect(resolveClip('focusDone', v2)).toBe('happy')
    expect(resolveClip('breakOver', v2)).toBe('click')
    expect(resolveClip('longBreak', v2)).toBe('happy')
    expect(resolveClip('longBreak', { ...v2, focusDone: 1 })).toBe('focusDone')
  })

  it('a v1-style model without happy uses click; anything else ends at idle', () => {
    expect(resolveClip('focusDone', { idle: 1, click: 1 })).toBe('click')
    expect(resolveClip('eat', { idle: 1 })).toBe('idle')
  })

  it('holding on plays climb until a hang clip exists (requirement-v5.md FR-76)', () => {
    expect(resolveClip('hang', { idle: 1, climb: 1 })).toBe('climb')
  })

  it('a falling cat plays drag until a fall clip exists (requirement-v5.md FR-60)', () => {
    expect(resolveClip('fall', { idle: 1, drag: 1 })).toBe('drag')
    expect(resolveClip('fall', { idle: 1, drag: 1, fall: 1 })).toBe('fall')
  })
})

describe('looks (requirement-v7.md FR-100..FR-103)', () => {
  const twoSheets = { ...valid, sheets: { main: sheet, care: { ...sheet, file: 'cat-care.png' } } }

  it('without "looks" the model has one look, "default", using the sheet files', () => {
    const m = parseModelConfig(valid)
    expect(m.defaultLook).toBe('default')
    expect(m.looks).toEqual({ default: { main: 'cat-test.png' } })
  })

  it('a look names a file for every sheet; unknown looks fall back to the default', () => {
    const m = parseModelConfig({
      ...twoSheets,
      defaultLook: 'orange',
      looks: { gray: { main: 'cat-test-gray.png', care: 'cat-care-gray.png' } }
    })
    expect(Object.keys(m.looks)).toEqual(['orange', 'gray'])
    expect(sheetFile(m, 'gray', 'care')).toBe('cat-care-gray.png')
    expect(sheetFile(m, null, 'care')).toBe('cat-care.png')
    expect(sheetFile(m, 'pink', 'main')).toBe('cat-test.png')
    expect(lookOf(m, 'pink')).toBe('orange')
    expect(lookOf(m, 'gray')).toBe('gray')
  })

  it('refuses a look that misses a sheet, names an unknown sheet or has a bad id', () => {
    const bad = (looks: unknown): unknown => ({ ...twoSheets, defaultLook: 'orange', looks })
    expect(() => parseModelConfig(bad({ gray: { main: 'a.png' } }))).toThrow(/looks.gray.care/)
    expect(() =>
      parseModelConfig(bad({ gray: { main: 'a.png', care: 'b.png', move: 'c.png' } }))
    ).toThrow(/unknown sheet "move"/)
    expect(() => parseModelConfig(bad({ Gray: { main: 'a.png', care: 'b.png' } }))).toThrow(
      /lowercase/
    )
  })

  it('the shipped model has the default look "orange"', () => {
    const m = parseModelConfig(shipped)
    expect(m.defaultLook).toBe('orange')
    expect(m.looks['orange']?.['main']).toBe('cat-sprite.png')
  })
})
