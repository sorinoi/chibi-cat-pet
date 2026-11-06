// Sprite sheets in assets/models/, bundled by Vite. The JSON next to each one says which file it uses.
const sheets = import.meta.glob<string>('../../../assets/models/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

const byFileName = new Map(
  Object.entries(sheets).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url])
)

/** URL of a sprite sheet by its file name (ModelConfig.file). */
export function spriteSheetUrl(file: string): string {
  const url = byFileName.get(file)
  if (!url) throw new Error(`Sprite sheet "${file}" not found in assets/models/`)
  return url
}
