export const devDiagnosticsEnabled = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)

const query = devDiagnosticsEnabled && typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams()

export const debugSwitches = {
  disableGameLoop: query.get('disableGameLoop') === 'true',
  disablePython: query.get('disablePython') === 'true',
  disableDecorations: query.get('disableDecorations') === 'true',
} as const

export class DevTiming {
  private samples: number[] = []
  private count = 0

  constructor(private readonly label: string) {}

  add(durationMs: number): void {
    if (!devDiagnosticsEnabled) return
    this.count += 1
    this.samples.push(durationMs)
    if (this.samples.length > 100) this.samples.shift()
    if (this.count === 1 || this.count % 100 === 0) this.report()
  }

  report(): void {
    if (!devDiagnosticsEnabled || this.samples.length === 0) return
    const average = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length
    console.debug(`[diagnostics] ${this.label}: avg ${average.toFixed(3)}ms over last ${this.samples.length}; total #${this.count}`)
  }
}

export function devCount(label: string, count: number): void {
  if (devDiagnosticsEnabled) console.debug(`[diagnostics] ${label} #${count}`)
}
