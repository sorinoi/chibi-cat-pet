import { describe, expect, it } from 'vitest'
import { CLIP_NAMES, modelFrame, parseModelConfig, STANDARD_CLIPS } from './modelConfig'
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

  it('accepts the shipped cat model with every v1 and v2 clip', () => {
    const config = parseModelConfig(shipped)
    expect(Object.keys(config.clips).sort()).toEqual([...CLIP_NAMES].sort())
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
