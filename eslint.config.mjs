import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'server/dist/**', 'server/node_modules/**'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting
)
