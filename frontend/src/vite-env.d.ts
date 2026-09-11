/// <reference types="vite/client" />

// Kept intentionally narrow; the worker wraps the runtime behind our protocol.
declare module 'pyodide' {
  export function loadPyodide(options: { indexURL: string }): Promise<unknown>
}
