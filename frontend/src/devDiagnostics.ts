export const devDiagnosticsEnabled = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)

const query = devDiagnosticsEnabled && typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams()

export const debugSwitches = {
  disableEditor: query.get('disableEditor') === 'true',
  minimalEditor: query.get('minimalEditor') === 'true',
  disableCanvas: query.get('disableCanvas') === 'true',
  editorOnly: query.get('editorOnly') === 'true',
  disableAutomaticLayout: query.get('disableAutomaticLayout') === 'true',
  disableGameLoop: query.get('disableGameLoop') === 'true',
  disablePython: query.get('disablePython') === 'true',
  disableDecorations: query.get('disableDecorations') === 'true',
  disableRendering: query.get('disableRendering') === 'true',
  disableScene: query.get('disableScene') === 'true',
  staticIsland: query.get('staticIsland') === 'true',
} as const

export type EditorDiagnosticMode = 'textarea' | 'minimal Monaco' | 'full Monaco'

/** Measures native input and next-paint latency without React or editor callbacks. */
export function installInputLatencyProbe(host: HTMLElement, mode: EditorDiagnosticMode): () => void {
  if (!devDiagnosticsEnabled) return () => undefined
  const inputSamples: number[] = []
  const paintSamples: number[] = []
  let keyStarted: number | null = null
  const output = document.createElement('output')
  output.className = 'editor-diagnostics'
  output.setAttribute('aria-live', 'off')
  host.append(output)

  const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * 0.95) - 1)] ?? 0
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
  const render = () => {
    output.textContent = `${mode} · input avg ${average(inputSamples).toFixed(2)} ms / p95 ${p95(inputSamples).toFixed(2)} ms · next paint avg ${average(paintSamples).toFixed(2)} ms / p95 ${p95(paintSamples).toFixed(2)} ms · n=${inputSamples.length}`
  }
  render()
  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) keyStarted = performance.now()
  }
  const onInput = () => {
    if (keyStarted === null) return
    const started = keyStarted
    keyStarted = null
    inputSamples.push(performance.now() - started)
    if (inputSamples.length > 500) inputSamples.shift()
    requestAnimationFrame(() => {
      paintSamples.push(performance.now() - started)
      if (paintSamples.length > 500) paintSamples.shift()
      render()
    })
  }
  host.addEventListener('keydown', onKeyDown, true)
  host.addEventListener('input', onInput, true)
  return () => {
    host.removeEventListener('keydown', onKeyDown, true)
    host.removeEventListener('input', onInput, true)
    output.remove()
  }
}

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

type PhaserDiagnosticSample = 'update' | 'render' | 'frame' | 'rafGap'

const phaserSamples: Record<PhaserDiagnosticSample, number[]> = {
  update: [], render: [], frame: [], rafGap: [],
}

function addPhaserSample(kind: PhaserDiagnosticSample, duration: number): void {
  const samples = phaserSamples[kind]
  samples.push(duration)
  if (samples.length > 300) samples.shift()
}

/** Called by scenes so the UI reports only Scene.update, not the whole Phaser step. */
export function recordPhaserUpdate(duration: number): void {
  if (devDiagnosticsEnabled) addPhaserSample('update', duration)
}

/** Adds a dev-only, DOM-independent probe around Phaser's update and render phases. */
export function installPhaserDiagnostics(game: import('phaser').Game, host: HTMLElement): () => void {
  if (!devDiagnosticsEnabled) return () => undefined
  const output = document.createElement('output')
  output.className = 'phaser-diagnostics'
  output.setAttribute('aria-live', 'off')
  host.append(output)

  let frameStarted = 0
  let renderStarted = 0
  let lastRaf = 0
  let rafId = 0
  let reportTimer = 0
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
  const mark = (name: string) => performance.mark(name)
  const preStep = () => {
    frameStarted = performance.now()
    mark('phaser-update-start')
  }
  const postStep = () => mark('phaser-update-end')
  const preRender = () => {
    renderStarted = performance.now()
    mark('phaser-render-start')
  }
  const postRender = () => {
    const now = performance.now()
    addPhaserSample('render', now - renderStarted)
    addPhaserSample('frame', now - frameStarted)
    mark('phaser-render-end')
  }
  const rafProbe = (now: number) => {
    if (lastRaf) addPhaserSample('rafGap', now - lastRaf)
    lastRaf = now
    rafId = requestAnimationFrame(rafProbe)
  }
  const report = () => {
    const gaps = phaserSamples.rafGap
    const fps = gaps.length ? 1000 / average(gaps) : 0
    const longFrames = phaserSamples.frame.filter((duration) => duration > 16).length
    output.textContent = [
      `Phaser update avg: ${average(phaserSamples.update).toFixed(2)} ms`,
      `Phaser render avg: ${average(phaserSamples.render).toFixed(2)} ms`,
      `FPS: ${fps.toFixed(1)}`,
      `Long frames (>16ms): ${longFrames}/${phaserSamples.frame.length}`,
      `Frame work avg: ${average(phaserSamples.frame).toFixed(2)} ms`,
      `rAF interval avg: ${average(gaps).toFixed(2)} ms`,
    ].join('\n')
  }

  game.events.on('prestep', preStep)
  game.events.on('poststep', postStep)
  game.events.on('prerender', preRender)
  game.events.on('postrender', postRender)
  rafId = requestAnimationFrame(rafProbe)
  reportTimer = window.setInterval(report, 500)
  report()
  return () => {
    game.events.off('prestep', preStep)
    game.events.off('poststep', postStep)
    game.events.off('prerender', preRender)
    game.events.off('postrender', postRender)
    cancelAnimationFrame(rafId)
    clearInterval(reportTimer)
    output.remove()
  }
}
