# Security Audit — StockFlow

**Дата:** 30 июля 2026  
**Уровень:** Enterprise SaaS ERP

---

## Общая оценка безопасности: 6.5 / 10

---

## 1. JWT

### ✅ Хорошо
- JWT signed with secret (HMAC-SHA256 через `@nestjs/jwt`)
- Access token expires in 15 минут (короткий TTL)
- Refresh token rotation — старый токен отзывается при получении нового
- Refresh token хранится в БД в виде bcrypt hash
- Payload содержит `userId`, `companyId`, `roles`, `email`

### ❌ Критические проблемы

| # | Критичность | Файл:строка | Проблема |
|---|------------|-------------|----------|
| 1 | **Critical** | `.env` | **JWT_SECRET = `StockFlowSecret2026SuperStrongKey_123456`** — hardcoded weak secret в .env, который закоммичен в репозиторий! |
| 2 | **Critical** | `.env` | **DATABASE_URL содержит реальные credentials** — `postgresql://postgres:maxrGYiKenfDRrvCMHmjXSVqybeQDMbV@sakura.proxy.rlwy.net:36460/railway` — production credentials в репозитории! |
| 3 | **Critical** | `.env` | **REDIS_URL содержит реальный пароль** — `redis://default:ZBIdCwLAzNuQPMZDBeYIDJEuhgcveNHI@redis.railway.internal:6379` |
| 4 | **High** | `AuthService` | Access и Refresh токены используют **один и тот же секрет** (`jwt.secret`). Refresh token должен использовать отдельный секрет. |

---

## 2. RBAC / Permissions

### ✅ Хорошо
- `RolesGuard` проверяет permissions из БД
- `@RequirePermission('crm:create')` — декларативный подход
- Роли создаются при регистрации компании

### ❌ Проблемы

| # | Критичность | Проблема | Описание |
|---|------------|----------|----------|
| 1 | **Medium** | Permissions загружаются на каждый запрос | Нет кэширования permissions — каждый HTTP запрос делает запрос к БД для проверки прав |
| 2 | **Medium** | Нет endpoint-level rate limiting | Login endpoint не имеет отдельного rate limit |

---

## 3. Refresh Token

### ✅ Хорошо
- Хранится в БД как bcrypt hash
- Revoke on refresh (token rotation)
- Transactional revocation

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **Medium** | `AuthService` | Refresh token не имеет отдельного secret от access token |
| 2 | **Low** | `AuthRepository` | Нет автоматической очистки просроченных refresh токенов |

---

## 4. Password Hashing

### ✅ Хорошо
- Используется `bcrypt` с 10 rounds (в коде) — НО .env говорит `BCRYPT_ROUNDS=12`
- **Несоответствие:** в коде `bcrypt.hash(password, 10)`, а в .env `BCRYPT_ROUNDS=12`. Значение из .env не используется!

### ❌ Проблема

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **Medium** | `AuthService:149` | `bcrypt.hash(password, 10)` — hardcoded rounds, не используется `BCRYPT_ROUNDS` из env |
| 2 | **Medium** | `AuthService:303` | `bcrypt.hash(token, 10)` — тоже hardcoded |

---

## 5. SQL Injection

### ✅ Безопасно
- Prisma использует parameterized queries — SQL injection невозможен через ORM
- Все user input проходит через `class-validator` валидацию

---

## 6. XSS

### ✅ Хорошо
- Helmet установлен с дефолтными настройками
- CSP включён для production

### ❌ Low
- Swagger UI в development не имеет CSP — но это intentional

---

## 7. CSRF

### ❌ Medium

| # | Критичность | Проблема | Описание |
|---|------------|----------|----------|
| 1 | **Medium** | Нет CSRF защиты | В проекте не используется `csurf` или аналогичный пакет. Хотя API использует JWT (Bearer token, не cookie), это не защищает от CSRF если токен хранится в cookie/localStorage. |

---

## 8. Rate Limit

### ✅ Хорошо
- `@nestjs/throttler` настроен глобально с 3 уровнями:
  - Short: 10 req/s
  - Medium: 50 req/10s
  - Long: 200 req/60s
- `@SkipThrottle()` на health endpoints

### ❌ Medium
- **Login endpoint не имеет отдельного rate limit** — только глобальный short (10 req/s), что всё ещё позволяет до 600 попыток в минуту
- Рекомендация: отдельный rate limit 5 req/min на `/auth/login`

---

## 9. CORS

### ✅ Хорошо
- `app.enableCors()` настроен
- Production использует origin из конфига
- Development использует `*`

### ❌ Low
- `credentials: true` с `origin: '*'` в development может быть небезопасно

---

## 10. Security Headers

### ✅ Хорошо
- Helmet установлен
- Content Security Policy включён в production
- HSTS, X-Frame-Options, X-Content-Type-Options — все через Helmet

---

## 11. Secrets (.env)

### ❌ CRITICAL ⚠️

**.env файл закоммичен в репозиторий и содержит:**

1. **Production DATABASE_URL** с реальными credentials
2. **Production REDIS_URL** с реальным паролем
3. **Слабый JWT_SECRET** (не-random, readable string без спецсимволов)

### Рекомендация:
- Немедленно отозвать скомпрометированные credentials
- Добавить `.env` в `.gitignore`
- Использовать Railway secrets manager
- Сгенерировать новый JWT_SECRET через `openssl rand -base64 64`

---

## 12. Swagger Security

### ✅ Хорошо
- Swagger доступен только при `SWAGGER_ENABLED=true`
- `addBearerAuth()` — JWT авторизация через Swagger UI

### ❌ Medium
- В production Swagger может быть включён (если не установлен `SWAGGER_ENABLED=false`)

---

## Итоговая оценка: 6.5 / 10

### Критические проблемы (немедленно исправить):
1. **CRITICAL** — .env с продакшен credentials в репозитории
2. **CRITICAL** — Слабый JWT_SECRET
3. **CRITICAL** — Real DB/Redis credentials в открытом доступе
4. **HIGH** — Один secret для access и refresh токенов
5. **HIGH** — Hardcoded bcrypt rounds (не используется конфиг)
6. **MEDIUM** — Нет rate limit на /auth/login
7. **MEDIUM** — Нет CSRF защиты
