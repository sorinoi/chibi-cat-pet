/**
 * requirement-v6.md section 9: bundles the server (with src/shared/activity.ts) into dist/ and
 * builds the dashboard pages into dist/web. Dependencies stay outside the server bundle; the
 * VPS installs them with `npm ci --omit=dev`.
 */
import { build } from 'esbuild'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build as buildWeb } from 'vite'

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

await buildWeb({
  configFile: fileURLToPath(new URL('../web/vite.config.ts', import.meta.url)),
  logLevel: 'warn'
})
console.log('  dist/web built')
