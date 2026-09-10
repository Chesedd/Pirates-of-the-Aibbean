# Pirates of the Aibbean

Monorepo-каркас браузерной учебной игры. Обычный пользователь видит свой остров и может редактировать и сохранять личный `player.py`. Код хранится как текст и намеренно не выполняется и не управляет персонажем.

## Требования

- Node.js 20+ и npm;
- Python 3.12+;
- Docker с Docker Compose.

## Структура

```text
.
├── frontend/
│   └── src/{api,app,components,game,pages,styles}
├── backend/
│   ├── app/{api,core,database,models,schemas,services}
│   └── tests/
├── docker-compose.yml
└── .env.example
```

## Настройка

Создайте локальный файл окружения (он исключён из git):

```bash
cp .env.example .env
```

Перед использованием вне локальной разработки замените `POSTGRES_PASSWORD`.

### PostgreSQL

Запустить только базу данных:

```bash
docker compose up -d db
```

Остановить сервисы можно командой `docker compose down`; добавить `-v`, чтобы также удалить данные.

### Backend

Локальный запуск с hot reload:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

API будет доступен на `http://localhost:8000`, а health check — на `http://localhost:8000/health`. PostgreSQL и backend также можно вместе запустить из корня:

```bash
docker compose up --build
```

### Первый администратор

Публичной регистрации нет. После применения миграций однократно передайте учётные данные через окружение и запустите CLI:

```bash
cd backend
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_PASSWORD='replace-with-a-long-random-password' \
python -m app.bootstrap_admin
```

Команда идемпотентна: пользователь с таким именем повторно не создаётся. Не сохраняйте эти значения в `.env` после настройки. В production также включите `SESSION_COOKIE_SECURE=true`, используйте HTTPS и задайте точный HTTPS-origin frontend в `CORS_ORIGINS`.

### API авторизации и администрирования

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`;
- `GET /admin/users`, `POST /admin/users` (только роль `admin`).
- `GET /game/island` (личный остров текущего пользователя);
- `GET /game/code`, `PUT /game/code` (чтение и сохранение личного `player.py`).

Сессия хранится на сервере, а браузер получает только случайный непрозрачный токен в HTTP-only cookie. Пароли хешируются Argon2. Исходный текст `player.py` находится в отдельной таблице `player_codes`, связанной с пользователем уникальным внешним ключом.

### Frontend

Frontend запускается отдельно в development mode:

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`. Адрес API при необходимости задаётся через `VITE_API_URL`.
Игровая страница одновременно показывает Phaser-сцену и Monaco Editor с подсветкой Python. Кнопка Save только сохраняет текст на backend: запуска Python и передачи команд в игру нет.

## Проверки

```bash
cd backend && pytest
cd frontend && npm run lint
cd frontend && npm run build
```

Ручная проверка запущенного backend:

```bash
curl http://localhost:8000/health
```

Ответ содержит общий статус и результат проверки соединения с базой данных. Недоступная БД не скрывает работоспособность HTTP-сервиса: поле `database` будет равно `unavailable`.
