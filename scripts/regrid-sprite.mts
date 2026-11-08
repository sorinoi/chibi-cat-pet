/**
 * Rebuilds an off-spec sprite sheet onto a clean grid (see lib/spriteRegrid.mts):
 * hazy background removed, frames cut out by their art, scaled, feet on one line.
 * With --painted-background, a checkerboard painted into an opaque image is first turned
 * into real transparency (see lib/paintedBackground.mts).
 *
 * Run: npm run sprite:regrid -- <input.png> <output.png> [scale] [columns] [rows] [--painted-background]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './lib/png.mts'
import { clearPaintedBackground } from './lib/paintedBackground.mts'
import { DEFAULT_REGRID, regridSheet } from './lib/spriteRegrid.mts'

const PAINTED = '--painted-background'
const args = process.argv.slice(2)
const painted = args.includes(PAINTED)
const [input, output, scale, columns, rows] = args.filter((a) => !a.startsWith('--'))
if (!input || !output) {
  console.error(
    `Usage: npm run sprite:regrid -- <input.png> <output.png> [scale] [columns] [rows] [${PAINTED}]`
  )
  process.exit(1)
}

const options = {
  ...DEFAULT_REGRID,
  scale: scale ? Number(scale) : DEFAULT_REGRID.scale,
  columns: columns ? Number(columns) : DEFAULT_REGRID.columns,
  rows: rows ? Number(rows) : DEFAULT_REGRID.rows
}
let source = decodePng(readFileSync(input))
if (painted) {
  const report = clearPaintedBackground(source)
  source = report.image
  console.log(
    `painted background: ${report.cleared} px cleared, ${report.fringe} edge px un-blended`
  )
}
const { image, cells } = regridSheet(source, options)
writeFileSync(output, encodePng(image))

console.log(`${input} -> ${output}`)
console.log(
  `${image.width}x${image.height}, cells ${options.cell} px, feet at y = ${options.feetY}, scale ${options.scale}`
)
for (let r = 0; r < options.rows; r++) {
  const line = cells
    .filter((c) => c.row === r)
    .map((c) =>
      c.box
        ? `${c.box.left}-${c.box.right}x${c.box.top}-${c.box.bottom}${c.clipped ? ' CLIPPED' : ''}`
        : 'empty'
    )
  console.log(`row ${r}: ${line.join('  ')}`)
}
