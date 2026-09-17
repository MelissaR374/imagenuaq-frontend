import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
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
      local: { rules: { 'consistent-import-case': consistentImportCase } },
    },
    rules: {
      // Windows resolves imports case-insensitively; Vite's HMR graph and the Linux build in
      // Dockerfile do not. See the rule for the full explanation.
      'local/consistent-import-case': 'error',
    },
  },
])
