import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACTIVE_MODEL } from '../shared/activeModel'

const MODELS = join(__dirname, '..', '..', 'assets', 'models')

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(join(MODELS, file))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('shipped looks share one layout (requirement-v7.md FR-101)', () => {
  const model = ACTIVE_MODEL
  const defaults = model.looks[model.defaultLook] ?? {}

  for (const [look, files] of Object.entries(model.looks)) {
    it(`look "${look}" has every sheet, each the size of the default's`, () => {
      expect(Object.keys(files).sort()).toEqual(Object.keys(model.sheets).sort())
      for (const [sheet, file] of Object.entries(files)) {
        expect(existsSync(join(MODELS, file)), file).toBe(true)
        const spec = model.sheets[sheet]
        expect(pngSize(file), file).toEqual({
          width: (spec?.columns ?? 0) * (spec?.cellWidth ?? 0),
          height: (spec?.rows ?? 0) * (spec?.cellHeight ?? 0)
        })
        expect(pngSize(file)).toEqual(pngSize(defaults[sheet] ?? ''))
      }
    })
  }
})
