import { CodeArea } from '../components/CodeArea'
import { GameCanvas } from '../game/GameCanvas'

export function HomePage() {
  return (
    <main className="workspace">
      <section className="panel game-panel" aria-labelledby="game-heading">
        <h1 id="game-heading">Game Area</h1>
        <GameCanvas />
      </section>
      <section className="panel code-panel" aria-labelledby="code-heading">
        <h2 id="code-heading">Code Area</h2>
        <CodeArea />
      </section>
    </main>
  )
}
