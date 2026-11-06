import { describe, expect, it } from 'vitest'
import { parseModelConfig } from './modelConfig'

const valid = {
  id: 'cat-test',
  name: 'Test cat',
  file: 'cat-test.glb',
  scale: 1,
  anchor: [0, 0, 0],
  clips: { idle: 'idle' },
  license: 'Self-made'
}

describe('parseModelConfig', () => {
  it('accepts a valid config', () => {
    expect(parseModelConfig(valid)).toEqual(valid)
  })

  it('requires an idle clip', () => {
    expect(() => parseModelConfig({ ...valid, clips: { walk: 'walk' } })).toThrow(/idle/)
  })

  it('rejects unknown clip names', () => {
    expect(() => parseModelConfig({ ...valid, clips: { idle: 'idle', dance: 'd' } })).toThrow(
      /dance/
    )
  })

  it('rejects a bad scale or anchor', () => {
    expect(() => parseModelConfig({ ...valid, scale: 0 })).toThrow(/scale/)
    expect(() => parseModelConfig({ ...valid, anchor: [0, 0] })).toThrow(/anchor/)
  })

  it('rejects missing strings', () => {
    expect(() => parseModelConfig({ ...valid, file: '' })).toThrow(/file/)
    expect(() => parseModelConfig(null)).toThrow(/object/)
  })
})
