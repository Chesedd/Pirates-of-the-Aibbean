import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

export type TutorialState = { current_task: number | null; completed: number[] }
type TutorialResult = TutorialState & { correct: boolean; output: string; error: string | null }

const tasks = {
  1: {
    title: 'Проверить запасы',
    story: 'Часть страниц журнала размокла. Осталась запись о припасах.',
    condition: <><p>В ящике находилось:</p><ul><li>7 бутылок воды;</li><li>4 банки еды;</li><li>3 сухих пайка.</li></ul><p>Создай переменные и вычисли общее количество припасов. Выведи результат с помощью <code>print()</code>.</p></>,
    expected: 'Ожидаемый результат: 14',
  },
  2: {
    title: 'Восстановить координаты',
    story: 'На карте сохранились последние координаты корабля.',
    condition: <><p><code>x = 12</code><br/><code>y = 8</code></p><p>Течение сдвинуло корабль на <strong>+5</strong> по X и <strong>−3</strong> по Y.</p><p>Измени значения координат и выведи сначала X, затем Y.</p></>,
    expected: 'Ожидаемый результат: 17, затем 5',
  },
} as const

export function TutorialJournal({ initialState, onClose, onProgress }: {
  initialState: TutorialState
  onClose: () => void
  onProgress: (state: TutorialState) => void
}) {
  const [state, setState] = useState(initialState)
  const [code, setCode] = useState('')
  const [result, setResult] = useState('')
  const [checking, setChecking] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => setState(initialState), [initialState])
  const taskNumber = state.current_task
  const task = taskNumber === 1 || taskNumber === 2 ? tasks[taskNumber] : null

  async function check() {
    if (!taskNumber || checking) return
    setChecking(true)
    setResult('')
    try {
      const response = await apiRequest<TutorialResult>('/game/tutorial/check', {
        method: 'POST', body: JSON.stringify({ task: taskNumber, code }),
      })
      if (!response.correct) {
        const renderedOutput = response.output ? `Вывод:\n${response.output}` : ''
        setResult([renderedOutput, response.error].filter(Boolean).join('\n'))
        return
      }
      setSuccess(true)
      setResult('✓ Запись восстановлена')
      window.setTimeout(() => {
        const next = { current_task: response.current_task, completed: response.completed }
        setState(next)
        onProgress(next)
        setCode('')
        setResult('')
        setSuccess(false)
      }, 850)
    } catch (reason) {
      setResult(reason instanceof Error ? reason.message : 'Не удалось проверить запись.')
    } finally {
      setChecking(false)
    }
  }

  return <div className="journal-backdrop" role="presentation" onClick={onClose}>
    <section className="journal-dialog" role="dialog" aria-modal="true" aria-labelledby="journal-title" onClick={(event) => event.stopPropagation()}>
      <header className="journal-heading"><h2 id="journal-title">Судовой журнал</h2><button className="journal-close" type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
      {task ? <div className={`journal-spread ${success ? 'journal-success' : ''}`}>
        <article className="journal-page journal-story">
          <p className="journal-entry">Запись {taskNumber} из 2</p><h3>{task.title}</h3><p>{task.story}</p>{task.condition}<p className="journal-expected">{task.expected}</p>
        </article>
        <article className="journal-page journal-work">
          <label htmlFor="tutorial-code">Python</label>
          <textarea id="tutorial-code" className="tutorial-editor" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} placeholder="# Восстанови запись здесь…" />
          <button type="button" onClick={() => void check()} disabled={checking || !code.trim()}>{checking ? 'Проверяем…' : 'Проверить'}</button>
          <div className="tutorial-result" role="status">{result}</div>
        </article>
      </div> : <div className="journal-finale"><h3>Координаты восстановлены.</h3><p>На следующей странице капитан оставил заметки<br/>о принятии решений.</p></div>}
    </section>
  </div>
}
