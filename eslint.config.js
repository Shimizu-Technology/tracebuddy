import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['mobile/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [{
          name: 'phosphor-react-native',
          message: 'Import icons through mobile/src/ui/icons.ts so only the icons we use are bundled.',
          allowTypeImports: true,
        }],
      }],
    },
  },
])
