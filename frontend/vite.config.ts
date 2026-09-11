import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pyodide loads its WASM and Python data files at runtime, so its loader must
  // remain intact rather than being rewritten by Vite's dependency optimizer.
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  // The npm package contains the core interpreter assets, not Pyodide's full
  // package repository. Vite serves/copies these files from our own origin.
  publicDir: 'node_modules/pyodide',
  server: {
    port: 5173,
  },
})
