/**
 * Cleans a sprite sheet for the app (requirement-v2.md section 9):
 * near-opaque alpha -> 255, faint stray specks cleared, report of each cell's art box.
 *
 * Run: npm run sprite:prepare -- <input.png> <output.png> [columns] [rows]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './lib/png.mts'
import { DEFAULT_PREP, prepareSheet } from './lib/spritePrep.mts'

const [input, output, columns, rows] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: npm run sprite:prepare -- <input.png> <output.png> [columns] [rows]')
  process.exit(1)
}

const image = decodePng(readFileSync(input))
const report = prepareSheet(image, {
  ...DEFAULT_PREP,
  columns: columns ? Number(columns) : DEFAULT_PREP.columns,
  rows: rows ? Number(rows) : DEFAULT_PREP.rows
})
writeFileSync(output, encodePng(image))

console.log(`${input} -> ${output}`)
console.log(`${image.width}x${image.height}, cells ${report.cellWidth}x${report.cellHeight}`)
console.log(`made solid: ${report.madeSolid} px, stray specks cleared: ${report.strayCleared} px`)
for (const row of [...new Set(report.cells.map((c) => c.row))]) {
  const boxes = report.cells
    .filter((c) => c.row === row)
    .map((c) => (c.box ? `${c.box.left}-${c.box.right}x${c.box.top}-${c.box.bottom}` : 'empty'))
  console.log(`row ${row}: ${boxes.join('  ')}`)
}
