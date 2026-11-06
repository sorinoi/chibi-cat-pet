import { parseModelConfig, type ModelConfig } from '../../shared/modelConfig'

export interface ModelEntry {
  config: ModelConfig
  url: string
}

// Every model is a .json + .glb pair in assets/models/. Adding a model needs no code change.
const configs = import.meta.glob<unknown>('../../../assets/models/*.json', {
  eager: true,
  import: 'default'
})
const files = import.meta.glob<string>('../../../assets/models/*.glb', {
  eager: true,
  query: '?url',
  import: 'default'
})

function fileKey(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

const fileUrls = new Map(Object.entries(files).map(([path, url]) => [fileKey(path), url]))

const entries = new Map<string, ModelEntry>()
for (const [path, raw] of Object.entries(configs)) {
  try {
    const config = parseModelConfig(raw)
    const url = fileUrls.get(config.file)
    if (!url) throw new Error(`missing file ${config.file}`)
    entries.set(config.id, { config, url })
  } catch (err) {
    console.error(`Skipping model ${fileKey(path)}:`, err)
  }
}

export function getModel(id: string): ModelEntry {
  const entry = entries.get(id)
  if (!entry) throw new Error(`Unknown model "${id}". Available: ${[...entries.keys()].join(', ')}`)
  return entry
}

export function listModels(): ModelConfig[] {
  return [...entries.values()].map((e) => e.config)
}
