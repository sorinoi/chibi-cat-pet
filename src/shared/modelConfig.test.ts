import { describe, expect, it } from 'vitest'
import { parseModelConfig, STANDARD_CLIPS } from './modelConfig'
import shipped from '../../assets/models/cat-sprite.json'

const valid = {
  id: 'cat-test',
  name: 'Test cat',
  file: 'cat-test.png',
  sheet: { columns: 8, rows: 6, cellWidth: 192, cellHeight: 192 },
  anchor: { x: 96, y: 177 },
  displayScale: 1,
  edgeOverflow: { x: 30, top: 0, bottom: 15 },
  walkFacing: 'right',
  clips: {
    idle: { row: 0, frames: 4, loop: true, fps: 8 },
    sleep: { row: 5, frames: 3, loop: true, loopFrom: 1, frameMs: [100, 200, 300] }
  },
  license: 'Self-made'
}

const withClips = (clips: Record<string, unknown>): unknown => ({ ...valid, clips })

describe('parseModelConfig', () => {
  it('accepts a valid config and expands fps into frame durations', () => {
    const config = parseModelConfig(valid)
    expect(config.clips.idle).toEqual({
      row: 0,
      frames: 4,
      loop: true,
      loopFrom: 0,
      frameMs: [125, 125, 125, 125]
    })
    expect(config.clips.sleep?.frameMs).toEqual([100, 200, 300])
  })

  it('never lets a frame be shorter than the fps cap', () => {
    const config = parseModelConfig(
      withClips({ idle: { row: 0, frames: 2, loop: true, fps: 120 } }),
      30
    )
    expect(config.clips.idle.frameMs[0]).toBeCloseTo(1000 / 30)
  })

  it('requires an idle clip and rejects unknown clips', () => {
    expect(() => parseModelConfig(withClips({ walk: valid.clips.idle }))).toThrow(/idle/)
    expect(() =>
      parseModelConfig(withClips({ idle: valid.clips.idle, dance: valid.clips.idle }))
    ).toThrow(/dance/)
  })

  it('rejects clips that do not fit the sheet', () => {
    expect(() =>
      parseModelConfig(withClips({ idle: { row: 6, frames: 1, loop: true, fps: 1 } }))
    ).toThrow(/row/)
    expect(() =>
      parseModelConfig(withClips({ idle: { row: 0, frames: 9, loop: true, fps: 1 } }))
    ).toThrow(/frames/)
    expect(() =>
      parseModelConfig(withClips({ idle: { row: 0, frames: 2, loop: true, loopFrom: 2, fps: 1 } }))
    ).toThrow(/loopFrom/)
    expect(() =>
      parseModelConfig(withClips({ idle: { row: 0, frames: 2, loop: true, frameMs: [100] } }))
    ).toThrow(/frameMs/)
  })

  it('rejects bad geometry and missing strings', () => {
    expect(() => parseModelConfig({ ...valid, anchor: { x: 500, y: 10 } })).toThrow(/anchor/)
    expect(() => parseModelConfig({ ...valid, walkFacing: 'up' })).toThrow(/walkFacing/)
    expect(() => parseModelConfig({ ...valid, file: '' })).toThrow(/file/)
    expect(() => parseModelConfig(null)).toThrow(/object/)
  })

  it('accepts the shipped cat model with every standard clip', () => {
    const config = parseModelConfig(shipped)
    expect(Object.keys(config.clips).sort()).toEqual([...STANDARD_CLIPS].sort())
  })
})
