# StockFlow — Deployment Guide

> **Версия:** 1.0.0-RC
> **Платформа:** Railway (рекомендовано) / Docker / Bare-metal

---

## 1. Первая установка

### 1.1 Требования

| Компонент | Версия | Примечание |
|-----------|--------|------------|
| Node.js | 22+ | |
| PostgreSQL | 16+ | Managed (Railway, AWS RDS, DigitalOcean) |
| Redis | 7+ | Managed или контейнер |
| npm | 10+ | |

### 1.2 Клонирование

```bash
git clone https://github.com/your-org/stockflow-backend.git
cd stockflow-backend
npm ci
```

### 1.3 Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
# ── Application ──────────────────────────────
NODE_ENV=production
PORT=3000
APP_URL=https://api.stockflow.app
SWAGGER_ENABLED=false

# ── Database ─────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/stockflow

# ── Redis ────────────────────────────────────
REDIS_URL=redis://default:password@host:6379

# ── JWT ──────────────────────────────────────
# Сгенерируйте: openssl rand -base64 32
JWT_SECRET=<your-64-char-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<your-64-char-random-refresh-secret>
JWT_REFRESH_EXPIRES_IN=7d

# ── Security ─────────────────────────────────
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://app.stockflow.app

# ── Logging ──────────────────────────────────
LOG_LEVEL=info
```

---

## 2. Миграции

```bash
# Генерация Prisma Client
npx prisma generate

# Применение миграций
npx prisma migrate deploy

# Проверка
npx prisma validate
```

**Важно:** В production используйте только `prisma migrate deploy` (никогда `prisma migrate dev`).

---

## 3. Создание администратора

Администратор создаётся автоматически при первой регистрации:

```bash
curl -X POST https://api.stockflow.app/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@stockflow.app",
    "password": "StrongPass123!",
    "companyName": "StockFlow Inc",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

При регистрации автоматически:
- Создаётся компания
- Создаётся пользователь с ролью Admin
- Роль Admin получает все существующие permissions
- Создаётся refresh token

---

## 4. Railway Deploy

### 4.1 Подготовка

1. Fork репозитория в GitHub
2. Создайте проект в [Railway](https://railway.app)
3. Подключите GitHub репозиторий

### 4.2 Переменные окружения в Railway

Установите в Railway Dashboard → Variables:

| Variable | Value | Примечание |
|----------|-------|------------|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Railway переопределяет автоматически |
| `DATABASE_URL` | `postgresql://...` | Используйте Railway PostgreSQL |
| `REDIS_URL` | `redis://...` | Используйте Railway Redis |
| `JWT_SECRET` | `<random>` | `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_SECRET` | `<random>` | Отдельный ключ от access |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `BCRYPT_ROUNDS` | `12` | |
| `CORS_ORIGIN` | `https://app.stockflow.app` | Домен вашего фронтенда |
| `SWAGGER_ENABLED` | `false` | Отключить в production |
| `LOG_LEVEL` | `info` | |

### 4.3 Deploy Command (Railway)

В Railway Dashboard → Settings → Deploy Command:

```bash
npx prisma generate && npx prisma migrate deploy
```

### 4.4 Start Command

По умолчанию используется `CMD ["node", "dist/main.js"]` из Dockerfile.
Railway переопределяет `PORT` автоматически.

### 4.5 Health Check

Railway использует `/api/health/live` (настроено в `railway.json`).

---

## 5. Docker

### 5.1 Локальный запуск

```bash
# PostgreSQL + Redis
docker compose up -d postgres redis

# Сборка и запуск приложения
docker compose up -d app
```

### 5.2 Production сборка

```bash
# Сборка
docker build -t stockflow-backend:latest .

# Запуск
docker run -d \
  --name stockflow \
  -p 3000:3000 \
  --env-file .env \
  stockflow-backend:latest

# Миграции (отдельно)
docker exec stockflow npx prisma migrate deploy
```

---

## 6. Backup

### 6.1 База данных (PostgreSQL)

```bash
# Daily backup
pg_dump --no-owner \
  "$DATABASE_URL" \
  > "backup-$(date +%Y-%m-%d).sql"

# Сжатие
gzip "backup-$(date +%Y-%m-%d).sql"

# Railway: используйте Railway Backup (встроенный)
# Или: pg_dump через Railway CLI
railway run pg_dump --no-owner "$DATABASE_URL" > backup.sql
```

### 6.2 Рекомендации

- **Daily backup** — полный дамп БД
- **Retention** — 30 дней ежедневных, 12 месяцев ежемесячных
- **Хранить** — отдельный S3/Cloud Storage (не на том же сервере)
- **Проверять** — раз в неделю тестовое восстановление

---

## 7. Restore

```bash
# Создать свежую БД
createdb stockflow_restore

# Восстановить из дампа
gunzip -c backup-2026-07-30.sql.gz | psql stockflow_restore

# Применить миграции (если дамп старый)
npx prisma migrate deploy

# Обновить DATABASE_URL и перезапустить
```

**Важно:** При restore убедитесь, что:
1. Версия Prisma совпадает (те же миграции)
2. Роли и permissions созданы
3. Пользователь-администратор существует

---

## 8. Проверка после деплоя

### 8.1 Health Check

```bash
# Liveness
curl -sSf https://api.stockflow.app/api/health/live

# Общий health
curl -s https://api.stockflow.app/api/health

# Readiness (если настроено)
curl -s https://api.stockflow.app/api/health/ready

# Metrics
curl -s https://api.stockflow.app/api/health/metrics
```

### 8.2 Smoke Tests

```bash
# 1. Регистрация
curl -s -X POST https://api.stockflow.app/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test123!","companyName":"Test"}'

# 2. Логин
TOKEN=$(curl -s -X POST https://api.stockflow.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test123!"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 3. Проверка auth
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.stockflow.app/api/auth/me

# 4. CRUD продукта
curl -s -X POST https://api.stockflow.app/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Product","price":1000,"sku":"TST-001"}'

# 5. Проверка Swagger (если включён)
curl -s https://api.stockflow.app/docs -o /dev/null -w "%{http_code}"
```

### 8.3 Проверка интеграций

- [ ] POST /auth/login → 200 + accessToken
- [ ] POST /auth/me → 200 + user profile
- [ ] GET /products → 200 + paginated response
- [ ] POST /sales → 201 + sale entity
- [ ] POST /inventory/stock/adjust → 201 + stock movement
- [ ] GET /reports/dashboard → 200 + dashboard data
- [ ] GET /api/health/live → 200
- [ ] GET /api/health/metrics → 200 + Prometheus format

---

## 9. Rollback

### 9.1 Автоматический rollback (CI/CD)

CD pipeline имеет `auto-rollback` stage, который срабатывает при:
- Health check fails после деплоя
- Smoke tests не проходят
- Любая ошибка в deploy-production stage

### 9.2 Ручной rollback (Docker)

```bash
# Предыдущая версия
docker pull stockflow-backend:previous-tag
docker stop stockflow
docker run -d --name stockflow --env-file .env stockflow-backend:previous-tag

# Railway: выберите предыдущий deploy в Railway Dashboard → Deploy
```

### 9.3 Rollback БД

```bash
# 1. Откатить миграцию (если проблема в ней)
npx prisma migrate resolve --rolled-back "migration_name"

# 2. Восстановить из бэкапа
gunzip -c backup-before-migration.sql.gz | psql "$DATABASE_URL"

# 3. Перезапустить приложение
```

---

## 10. Production ENV checklist

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` — **обязательно** заменить на случайный (не из .env.example)
- [ ] `JWT_REFRESH_SECRET` — отдельный случайный ключ
- [ ] `CORS_ORIGIN` — конкретный домен фронтенда (не `*`)
- [ ] `SWAGGER_ENABLED=false`
- [ ] `LOG_LEVEL=info` (не debug)
- [ ] `BCRYPT_ROUNDS=12`
- [ ] Redis подключен
- [ ] Health check настроен
- [ ] Backup настроен

---

## 11. Flutter Web deployment (Phase 3)

> **Статус:** автоматизировано через GitHub Actions (`web-deploy.yml`).
> Backend и Web — отдельные Railway-сервисы. Backend **не** раздаёт
> статику; Flutter Web раздаётся nginx-сервисом.

### 11.1 One-time provisioning (Railway)

Выполняется один раз в Railway Dashboard:

1. **Создайте static-сервис**: New Project → Deploy from Dockerfile →
   root directory = `web-deploy` (репозиторий должен быть подключён).
   Сервис соберёт `web-deploy/Dockerfile` (nginx:alpine) — без
   исходников мобильного приложения.
2. **Назовите сервис `stockflow-web`** (Service Settings → Name).
   Пайплайн деплоит **по имени сервиса** — Service ID не нужен.
3. **Добавьте один секрет в GitHub** (repo → Settings → Secrets → Actions):
   - `RAILWAY_TOKEN` — Railway Account token (Dashboard → Account → Tokens)

### 11.2 Пайплайн

`push → main` (изменения в `mobile/**` или workflow) запускает
`Web Deploy`:

| Шаг | Действие |
|-----|----------|
| Build | `flutter analyze` → `flutter test` → `flutter build web --release` |
| Stage | `build/web` копируется в `web-deploy/html/` |
| Deploy | `railway up` собирает nginx-образ и деплоит static-сервис |

Без секрета `RAILWAY_TOKEN` workflow **всё равно собирает и проходит** —
шаг деплоя пропускается с сообщением (безопасно для PR и локальных тестов).
Деплой выполняется командой `npx --yes @railway/cli@latest up
--service stockflow-web --ci` (имя сервиса задано в `env` workflow).

### 11.3 Проверка после деплоя

```bash
# SPA отдаётся
curl -sI https://<web-service>.up.railway.app/ | head -3

# Deep-link (SPA fallback) работает
curl -s -o /dev/null -w '%{http_code}\n' \
  https://<web-service>.up.railway.app/payments/details

# Хешированные ассеты кэшируются
curl -sI https://<web-service>.up.railway.app/main.dart.js | grep -i cache
```

### 11.4 Локальный превью сборки

```bash
cd mobile && flutter build web --release
mkdir -p ../web-deploy/html && cp -r build/web/. ../web-deploy/html/
docker build -t stockflow-web ../web-deploy
docker run -p 8080:80 stockflow-web
# → http://localhost:8080
```
