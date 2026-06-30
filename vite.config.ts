import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend dev server on 5173; /api proxied to the local backend on 3001.
//
// The `static` build mode (`npm run build:static`, which passes `--mode static`) targets GitHub
// Pages: no backend, content + progress handled client-side, served under a repo subpath. The
// deploy workflow sets BASE_PATH to `/<repo-name>/`; the fallback matches a repo named "anti-duo".
export default defineConfig(({ mode }) => ({
  base: mode === 'static' ? (process.env.BASE_PATH ?? '/anti-duo/') : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
}))
