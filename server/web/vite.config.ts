import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/** The dashboard pages (requirement-v6.md FR-96..FR-99), built into dist/web. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  plugins: [vue()],
  build: {
    outDir: fileURLToPath(new URL('../dist/web', import.meta.url)),
    emptyOutDir: true,
    // Everything as files: the page's Content-Security-Policy allows only its own files.
    assetsInlineLimit: 0
  },
  server: {
    // `npm run dev:web` talks to `npm run dev` (the API) on this PC.
    proxy: { '/api': 'http://127.0.0.1:3000' }
  }
})
