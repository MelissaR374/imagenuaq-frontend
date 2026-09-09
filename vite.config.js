import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    // The API is called at /api, so the dev server has to stand in for the nginx that
    // serves both halves from one origin in production. Same-origin means no CORS and no
    // preflight in either environment, and it keeps the base URL identical in both -- see
    // src/api/client.js. Point VITE_API_URL somewhere else if the API is not on 3000.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
})
