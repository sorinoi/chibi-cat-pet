import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {},
  preload: {
    build: {
      // Sandboxed preloads cannot require local chunks, so each entry must be standalone.
      isolatedEntries: true,
      rolldownOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          settings: resolve(__dirname, 'src/preload/settings.ts'),
          adopt: resolve(__dirname, 'src/preload/adopt.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [vue()],
    build: {
      rolldownOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html'),
          adopt: resolve(__dirname, 'src/renderer/adopt.html')
        }
      }
    },
    // Pre-bundle up front: a first-run optimize + reload left the dev window blank.
    optimizeDeps: {
      include: ['vue']
    }
  }
})
