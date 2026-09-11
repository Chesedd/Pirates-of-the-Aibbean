import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The npm package contains the core interpreter assets, not Pyodide's full
  // package repository. Vite serves/copies these files from our own origin.
  publicDir: 'node_modules/pyodide',
  server: {
    port: 5173,
  },
})
