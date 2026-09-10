# Pirates of the Aibbean

Monorepo-каркас браузерной учебной игры. Второй этап добавляет пользователей, cookie-сессии, роли и минимальный интерфейс администратора. Игровая механика и редактор кода намеренно не реализованы.

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

Сессия хранится на сервере, а браузер получает только случайный непрозрачный токен в HTTP-only cookie. Пароли хешируются Argon2.

### Frontend

Frontend запускается отдельно в development mode:

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`. Адрес API при необходимости задаётся через `VITE_API_URL`.

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
