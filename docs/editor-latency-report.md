# Отчёт по локализации задержки ввода Monaco

Это диагностический стенд, а не оптимизация. Переключатели доступны только в dev-сборке. Для каждого запуска нижний правый индикатор показывает среднее и p95 для двух интервалов: `keydown → input` и `keydown → следующий animation frame`. Окно ограничено последними 500 вводами; `n` — число принятых замеров. Сравнивать режимы следует в одном браузере, на одной машине и после одинакового прогрева.

## Матрица измерений

| Что измеряем | Query | Что остаётся включено |
|---|---|---|
| 1. Textarea latency | `?disableEditor=true&editorOnly=true` | Нативный uncontrolled `textarea` |
| 2. Minimal Monaco latency | `?minimalEditor=true&editorOnly=true` | Monaco без Python language, `onChange`, decorations, callbacks, React state и `automaticLayout` |
| 3. Full Monaco latency | `?editorOnly=true` | Полная конфигурация Monaco, но без остального игрового UI |
| 4. Влияние canvas/layout | обычный URL, затем `?disableCanvas=true` и `?editorOnly=true` | Последовательно исключаются Phaser и двухколоночный layout |
| 5. Влияние `automaticLayout` | обычный URL, затем `?disableAutomaticLayout=true` | Меняется только `automaticLayout` полного Monaco |

Для каждого пункта нужно ввести один и тот же текст (рекомендуется не менее 100 печатных символов) и записать показанные `avg`, `p95` и `n`. Показатели намеренно не зашиты в этот файл: latency зависит от браузера и оборудования, а живой отчёт непосредственно на странице не позволяет принять результаты одной машины за универсальные.

## Интерпретация

1. Если textarea быстрая, а минимальный и полный Monaco одинаково медленные, источник локализован внутри базового Monaco/browser rendering.
2. Если замедляется только полный Monaco, источник — одна из исключённых интеграций; отдельная пара с `disableAutomaticLayout` проверяет layout observer.
3. Если все три редактора медленные только с игрой, сравнение `disableCanvas` показывает влияние Phaser, а `editorOnly` — влияние остального игрового UI/layout.
4. Если `disableCanvas` не помогает, но `editorOnly` помогает, причина находится в окружающем UI/layout, а не в отрисовке canvas.
5. Если включение и выключение `automaticLayout` не меняет p95 сверх обычного разброса повторов, оно не является источником наблюдаемой задержки.

Дополнительные уже существующие переключатели (`disableGameLoop`, `disablePython`, `disableDecorations`) можно комбинировать с матрицей для последующей локализации, не меняя production-поведение.

## Аудит Phaser и главного потока

По статическому аудиту точный виновник пока **не установлен**; это намеренно не заменяется предположением. Уже известный эксперимент исключает `Scene.update`, Python tick и decorations, но не исключает Phaser renderer: ранний `return` из `update` не останавливает очистку и отрисовку сцены на каждом Phaser frame.

* Мир острова имеет координаты `5200 × 5200`, однако это только bounds камеры. `Scale.RESIZE` задаёт backing canvas по размеру `.game-canvas` (ширина контейнера и `calc(100vh - 5.5rem)`), а не 5200 × 5200. Фон непрозрачный (`backgroundColor` задан и `transparent` не включён).
* Геометрия острова — 144 вершины и девять гармоник. Она генерируется один раз в `IslandScene.create`; берег и interior добавляются в один `Graphics` один раз. В `update` нет `clear`, `fill`, draw-вызовов, создания `Graphics`, текста или игровых объектов.
* Username, тело и шляпа создаются один раз. На каждом `update` собственный код сцены лишь раз в 50 ms получает snapshot клавиш и асинхронно запускает worker tick. После ответа меняется позиция контейнера. Проверка коллизии — один point-in-polygon проход по 144 рёбрам, не каждый animation frame.
* Камера получает bounds/follow один раз. Phaser внутренне обновляет follow во время шага, но код приложения не измеряет DOM и не вызывает camera layout в кадре. В tutorial resize handler вызывается только событием `Scale.RESIZE`, не из `update`.
* Phaser продолжает рендерить display list каждый frame, даже когда `disableGameLoop=true` заставляет `Scene.update` сразу вернуться. Следовательно, старый переключатель проверял update, но не rendering.
* Единственный явный `requestAnimationFrame` приложения до этого аудита — dev-only probe следующей отрисовки ввода. React effects выполняют загрузку/инициализацию и подписки; React `setState` на ввод Monaco не вызывается. В игровом update нет чтения `offset*`, `client*` или `getBoundingClientRect`. `automaticLayout` Monaco остаётся единственным library-owned resize observer и уже имеет отдельный switch.

## Новая диагностика (только dev)

На игровом canvas теперь отображаются `Phaser update avg`, `Phaser render avg`, FPS, количество кадров с измеренной работой больше 16 ms, среднее время работы Phaser frame и независимый средний интервал `requestAnimationFrame`. Окно — последние 300 samples, UI обновляется дважды в секунду, чтобы сам overlay не создавал React renders в каждом кадре.

Performance timeline получает marks `phaser-update-start/end`, `phaser-render-start/end`, `draw-island-start/end` и measure `draw-island`. Здесь `update avg` — длительность пользовательского `Scene.update`; `render avg` — интервал между core pre/post-render; `Frame work avg` — синхронная работа между Phaser pre-step и post-render; `rAF interval avg` включает время, которое прошло между browser callbacks.

## Строгий эксперимент для установления источника

В одном браузере и после одинакового прогрева сравнить latency probe (не менее 100 символов на режим):

| Query | Изолирует |
|---|---|
| обычный URL | baseline: scene + update + renderer |
| `?staticIsland=true` | подтверждает, что island draw-команды не пересоздаются после `create` |
| `?disableRendering=true` | оставляет Phaser scene, объекты и update, но использует HEADLESS и полностью исключает Canvas/WebGL render |
| `?disableScene=true` | не создаёт `Phaser.Game` вообще |

Решающий критерий сформулирован заранее: утверждать «рендеринг Phaser является причиной» можно только если лаг воспроизводится в baseline и исчезает с `disableRendering=true`, при этом update остаётся активным. Если лаг остаётся в HEADLESS, но исчезает с `disableScene=true`, следующий минимальный probe должен измерить Phaser TimeStep/input plugins. Если не исчезает и с `disableScene=true`, причина вне Phaser, и это также будет прямым результатом, а не догадкой.

На текущем этапе нельзя честно написать «при отключении X задержка исчезает»: в репозитории нет browser automation и аутентифицированной benchmark fixture, а предоставленные результаты ещё не содержат новых режимов. Поэтому внесена только минимальная диагностика и изоляция; production-сборка и архитектура не изменены.
