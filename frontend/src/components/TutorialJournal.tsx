import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

export type TutorialState = { current_task: number | null; completed: number[] }
type TutorialResult = TutorialState & { correct: boolean; output: string; error: string | null }
type JournalTab = 'theory' | 'final' | 1 | 2 | 3 | 4

const tasks = {
  1: {
    title: 'Проверка запасов',
    story: 'Часть страниц размокла, но запись о припасах ещё можно восстановить.',
    condition: <><p>В ящике было:</p><ul><li>7 бутылок воды;</li><li>4 банки еды;</li><li>3 сухих пайка.</li></ul><p>Создай переменные, вычисли общее количество припасов и выведи результат.</p></>,
    expected: 'В журнале должно появиться число 14.',
  },
  2: {
    title: 'Восстановление координат',
    story: 'На полях карты сохранились последние координаты корабля и заметка о течении.',
    condition: <><p><code>x = 12</code><br/><code>y = 8</code></p><p>Течение сдвинуло корабль на <strong>+5</strong> по X и <strong>−3</strong> по Y. Измени оба значения и выведи сначала X, затем Y.</p></>,
    expected: 'Верный курс: 17, затем 5.',
  },
  3: {
    title: 'Запас воды',
    story: 'Капитан отмечал опасно низкие запасы, чтобы команда вовремя наполнила бочки.',
    condition: <><p>Воды должно оставаться не меньше 10 литров. Сейчас: <code>water = 6</code>.</p><p>Если воды меньше 10, выведи <code>refill</code>.</p></>,
    expected: 'Используй только простой if — без else и elif.',
  },
  4: {
    title: 'Сигнальный фонарь',
    story: 'Над палубой сгущаются сумерки. В сигнальном фонаре осталось немного топлива.',
    condition: <><p><code>fuel = 3</code></p><p>Если топлива больше нуля, выведи <code>light</code>.</p></>,
    expected: 'Закрепи простой if, не добавляя новых конструкций.',
  },
} as const

const roman = ['I', 'II', 'III', 'IV'] as const

export function TutorialJournal({ initialState, onClose, onProgress, onFinished }: {
  initialState: TutorialState
  onClose: () => void
  onProgress: (state: TutorialState) => void
  onFinished: () => void
}) {
  const [state, setState] = useState(initialState)
  const [selectedTab, setSelectedTab] = useState<JournalTab>(initialState.current_task as JournalTab || 'final')
  const [drafts, setDrafts] = useState<Partial<Record<1 | 2 | 3 | 4, string>>>({})
  const [result, setResult] = useState('')
  const [checking, setChecking] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => setState(initialState), [initialState])
  const currentTask = state.current_task
  const allComplete = currentTask === null
  const taskNumber = typeof selectedTab === 'number' ? selectedTab : null
  const displayedTask = taskNumber ?? 1
  const task = taskNumber ? tasks[taskNumber] : null
  const code = taskNumber ? drafts[taskNumber] ?? '' : ''
  const reachedStage = allComplete ? 4 : Math.max(currentTask ?? 1, ...state.completed, 1)

  function selectTab(tab: JournalTab) {
    setSelectedTab(tab)
    setResult('')
    setSuccess(false)
  }

  async function check() {
    if (!taskNumber || taskNumber !== currentTask || checking) return
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
        setResult('')
        setSuccess(false)
        setSelectedTab(response.current_task ? response.current_task as JournalTab : 'final')
      }, 850)
    } catch (reason) {
      setResult(reason instanceof Error ? reason.message : 'Не удалось проверить запись.')
    } finally {
      setChecking(false)
    }
  }

  return <div className="journal-backdrop" role="presentation" onClick={onClose}>
    <section className="journal-shell" role="dialog" aria-modal="true" aria-labelledby="journal-title" onClick={(event) => event.stopPropagation()}>
      <nav className="journal-tabs" aria-label="Разделы судового журнала">
        <button className={selectedTab === 'theory' ? 'active theory-tab' : 'theory-tab'} type="button" onClick={() => selectTab('theory')}> Заметки </button>
        {roman.map((number, index) => {
          const tab = (index + 1) as 1 | 2 | 3 | 4
          const available = allComplete || state.completed.includes(tab) || currentTask === tab
          return <button key={tab} className={selectedTab === tab ? 'active' : ''} type="button" disabled={!available} aria-label={`Запись ${number}${available ? '' : ', закрыта'}`} onClick={() => selectTab(tab)}>
            <span aria-hidden="true">{number}</span>{state.completed.includes(tab) && <span className="tab-check" aria-label="пройдено">✓</span>}
          </button>
        })}
      </nav>
      <div className="journal-book">
        <header className="journal-heading"><h2 id="journal-title">Судовой журнал</h2><button className="journal-close" type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
        {selectedTab === 'theory' ? <TheorySpread reachedStage={reachedStage} /> : selectedTab === 'final' ? <FinalSpread onFinished={onFinished} /> : task ? <div className={`journal-spread ${success ? 'journal-success' : ''}`}>
          <article className="journal-page journal-story">
            <p className="journal-entry">Запись {roman[displayedTask - 1]}</p><h3>{task.title}</h3><p className="journal-story-lead">{task.story}</p>
            <section className="journal-assignment"><h4>Задание</h4>{task.condition}</section><p className="journal-expected">{task.expected}</p>
          </article>
          <article className="journal-page journal-work">
            <div className="journal-page-caption"><span>Рабочая запись</span>{state.completed.includes(displayedTask) && <span className="completed-mark">выполнено ✓</span>}</div>
            <label htmlFor={`tutorial-code-${taskNumber}`}>Python</label>
            <textarea id={`tutorial-code-${taskNumber}`} className="tutorial-editor" value={code} onChange={(event) => setDrafts((current) => ({ ...current, [displayedTask]: event.target.value }))} spellCheck={false} placeholder="# Восстанови запись здесь…" />
            {taskNumber === currentTask ? <button className="journal-check" type="button" onClick={() => void check()} disabled={checking || !code.trim()}>{checking ? 'Проверяем…' : 'Проверить запись'}</button> : <p className="revisit-note">Эта запись уже восстановлена. Её можно перечитать и изменить черновик.</p>}
            <div className={`tutorial-result ${result ? 'visible' : ''}`} role="status">{result || 'Здесь появится результат проверки.'}</div>
          </article>
        </div> : null}
      </div>
    </section>
  </div>
}

function TheorySpread({ reachedStage }: { reachedStage: number }) {
  return <div className="journal-spread theory-spread">
    <article className="journal-page"><p className="journal-entry">Открытые знания</p><h3>Капитанские заметки</h3><TheoryNote title="Переменные" code="water = 7">Переменная хранит значение под именем.</TheoryNote><TheoryNote title="Арифметика" code="total = water + food">Значения переменных можно использовать в вычислениях.</TheoryNote><TheoryNote title="print" code="print(total)"><code>print()</code> показывает результат работы программы.</TheoryNote></article>
    <article className="journal-page"><p className="journal-page-number">II</p>{reachedStage >= 2 ? <TheoryNote title="Изменение значения" code={'x = x + 5\nx += 5'}>Обе записи увеличивают <code>x</code> на 5. Вторая — короткая форма.</TheoryNote> : <LockedTheory />}{reachedStage >= 3 ? <TheoryNote title="Условие if" code={'if water < 10:\n    print("refill")'}>Код внутри <code>if</code> выполняется только тогда, когда условие истинно.</TheoryNote> : <LockedTheory />}</article>
  </div>
}

function TheoryNote({ title, code, children }: { title: string; code: string; children: React.ReactNode }) {
  return <section className="theory-note"><h4>{title}</h4><pre><code>{code}</code></pre><p>{children}</p></section>
}

function LockedTheory() { return <div className="theory-locked" aria-label="Новая заметка пока недоступна"><span>◇</span><p>Здесь появится новая заметка.</p></div> }

function FinalSpread({ onFinished }: { onFinished: () => void }) {
  return <div className="journal-spread journal-finale"><article className="journal-page"><p className="journal-entry">Последняя запись</p><h3>Курс снова проложен</h3><p>«Чтобы управлять кораблём, недостаточно знать, куда ты хочешь попасть. Нужно действовать, когда выполняется нужное условие».</p><div className="final-seal">✶</div><p><strong>Ты снова чувствуешь ноги.</strong></p></article><article className="journal-page final-code"><h4>Заметка на полях</h4><pre><code>{'if key_pressed("d"):\n    x += 8'}</code></pre><p><code>key_pressed("d")</code> проверяет клавишу, а <code>if</code> решает, выполнять ли действие. Переменные <code>x</code> и <code>y</code> тебе уже знакомы.</p><details><summary>Подсказка для player.py</summary><pre><code>{'speed = 8\n\nif key_pressed("w"):\n    y -= speed\n\nif key_pressed("s"):\n    y += speed\n\nif key_pressed("a"):\n    x -= speed\n\nif key_pressed("d"):\n    x += speed'}</code></pre><p>Открой <code>player.py</code>, введи управление и сам нажми Apply.</p></details><button className="journal-check" type="button" onClick={onFinished}>Закрыть журнал</button></article></div>
}
