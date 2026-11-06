/**
 * Generates the procedural cat models into assets/models/.
 * Run: npm run model:build
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { ModelConfig } from '../src/shared/modelConfig.ts'
import { buildCat } from './cat/buildCat.mts'
import { COAT_PRESETS } from './cat/palette.mts'

/** GLTFExporter reads its Blob output through FileReader, which Node does not provide. */
class NodeFileReader {
  result: ArrayBuffer | null = null
  onload: (() => void) | null = null
  onloadend: (() => void) | null = null
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onload?.()
      this.onloadend?.()
    })
  }
}
;(globalThis as { FileReader?: unknown }).FileReader ??= NodeFileReader

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'models')
mkdirSync(outDir, { recursive: true })

const exporter = new GLTFExporter()

for (const preset of COAT_PRESETS) {
  const cat = buildCat(preset)
  const glb = await exporter.parseAsync(cat.root, { binary: true, animations: cat.clips })
  if (!(glb instanceof ArrayBuffer)) throw new Error('Expected binary glTF output')

  const id = `cat-${preset.id}`
  const config: ModelConfig = {
    id,
    name: `Cat (${preset.name})`,
    file: `${id}.glb`,
    scale: 1,
    anchor: [0, 0, 0],
    clips: Object.fromEntries(cat.clips.map((c) => [c.name, c.name])),
    license: 'Self-made. Generated in code by scripts/generate-cat.mts. No third-party assets.'
  }

  writeFileSync(join(outDir, config.file), Buffer.from(glb))
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(config, null, 2) + '\n')
  console.log(
    `${config.file}: ${cat.triangles} triangles, ${(glb.byteLength / 1024).toFixed(1)} KB, clips: ${cat.clips.map((c) => c.name).join(', ')}`
  )
}
