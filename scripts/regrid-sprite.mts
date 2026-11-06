/**
 * Rebuilds an off-spec sprite sheet onto a clean grid (see lib/spriteRegrid.mts):
 * hazy background removed, frames cut out by their art, scaled, feet on one line.
 *
 * Run: npm run sprite:regrid -- <input.png> <output.png> [scale] [columns] [rows]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './lib/png.mts'
import { DEFAULT_REGRID, regridSheet } from './lib/spriteRegrid.mts'

const [input, output, scale, columns, rows] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: npm run sprite:regrid -- <input.png> <output.png> [scale] [columns] [rows]')
  process.exit(1)
}

const options = {
  ...DEFAULT_REGRID,
  scale: scale ? Number(scale) : DEFAULT_REGRID.scale,
  columns: columns ? Number(columns) : DEFAULT_REGRID.columns,
  rows: rows ? Number(rows) : DEFAULT_REGRID.rows
}
const { image, cells } = regridSheet(decodePng(readFileSync(input)), options)
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
