import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import commentPolicy from './eslint-rules/comment-policy.js'
import consistentImportCase from './eslint-rules/consistent-import-case.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      local: {
        rules: {
          'comment-policy': commentPolicy,
          'consistent-import-case': consistentImportCase,
        },
      },
    },
    rules: {
      'local/comment-policy': 'error',
      'local/consistent-import-case': 'error',
    },
  },
])
