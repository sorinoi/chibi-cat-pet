/**
 * requirement-v6.md section 9: bundles the server (with src/shared/activity.ts) into dist/.
 * Dependencies stay outside the bundle; the VPS installs them with `npm ci --omit=dev`.
 */
import { build } from 'esbuild'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true })

await build({
  absWorkingDir: root,
  entryPoints: { server: 'src/main.ts', cli: 'src/cli.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info'
})
