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
    // Only used when VITE_API_URL is left as the bare path "/api": the dev server then
    // stands in for the nginx that is meant to serve both halves from one origin in
    // production, so the base URL is identical in both and CORS never applies. With
    // VITE_API_URL set to an absolute URL -- the default in .env.example -- the browser
    // talks to the backend directly and this block is dead weight. See src/config.js.
    //
    // `localhost` on purpose, not 127.0.0.1: the backend's HOST=localhost makes Node bind
    // the IPv6 loopback only, and an IPv4 target gets an ECONNRESET through this proxy.
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
