# Quick Wins — Исправления менее чем за 1 час

**Дата:** 30 июля 2026

---

Эти исправления можно сделать за < 1 часа каждое, с немедленным положительным эффектом.

---

## 1. 🟢 Добавить .env в .gitignore (5 минут)

**Проблема:** `.env` с production credentials закоммичен в репозиторий  
**Действие:**
1. Добавить `.env` в `.gitignore` на уровне `backend/`
2. Удалить `.env` из индекса: `git rm --cached backend/.env`
3. Создать `.env.example` с placeholder-значениями (уже существует)

**Эффект:** Предотвращает утечку production credentials

---

## 2. 🟢 Сгенерировать новый JWT_SECRET (2 минуты)

```bash
openssl rand -base64 64
```

**Проблема:** `JWT_SECRET=StockFlowSecret2026SuperStrongKey_123456` — слабый  
**Действие:** Сгенерировать новый secret, обновить в Railway secrets manager

**Эффект:** Защита от подделки JWT токенов

---

## 3. 🟢 Отозвать production credentials (10 минут)

**Проблема:** DATABASE_URL и REDIS_URL с реальными паролями в Git  
**Действие:**
1. Сменить пароль PostgreSQL в Railway
2. Сменить пароль Redis в Railway
3. Обновить secrets manager
4. Перезапустить инстанс

**Эффект:** Немедленная защита данных

---

## 4. 🟢 Разделить secrets для access и refresh токенов (20 минут)

**Файл:** `backend/src/modules/auth/services/auth.service.ts`

**Изменение:**
```typescript
// В конфиг JWT добавить:
JWT_REFRESH_SECRET

// В AuthService:
private async signRefreshToken(payload: JwtPayload): Promise<string> {
  const secret = this.configService.get<string>('jwt.refreshSecret');
  // ...
  return this.jwtService.signAsync(payload, {
    secret,
    expiresIn: '30d' as const,
  });
}
```

**Эффект:** Если access token secret скомпрометирован, refresh токены остаются защищёнными

---

## 5. 🟢 Использовать bcrypt rounds из конфига (5 минут)

**Файл:** `backend/src/modules/auth/services/auth.service.ts`

**Изменение:**
```typescript
// Вместо hardcoded:
const passwordHash = await bcrypt.hash(password, 10);
// Использовать из конфига:
const rounds = this.configService.get<number>('auth.bcryptRounds', 12);
const passwordHash = await bcrypt.hash(password, rounds);
```

**Эффект:** Соответствие конфигурации

---

## 6. 🟢 Добавить rate limit на /auth/login (15 минут)

**Файл:** `backend/src/modules/auth/controllers/auth.controller.ts`

**Изменение:**
```typescript
import { SkipThrottle, Throttle } from '@nestjs/throttler';

@Post('login')
@Throttle({ default: { limit: 5, ttl: 60000 } })
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

**Эффект:** Защита от brute force (5 попыток в минуту)

---

## 7. 🟢 Удалить companyId из DTO (30 минут)

**Файлы:** `CreateCustomerDto`, `CustomerQueryDto` и др.

**Изменение:**
- Удалить `companyId` из всех DTO
- Сервисы уже используют `currentUser.companyId` — достаточно убрать из DTO

**Эффект:** Устранение вектора меж-tenant атаки

---

## 8. 🟢 Кэшировать permissions в Redis (45 минут)

**Файл:** `RolesGuard`

**Изменение:**
```typescript
// В RolesGuard добавить кэширование:
const cacheKey = `permissions:${user.companyId}:${roleNames.sort().join(',')}`;
let permissionCodes = await this.cacheService.get<string[]>(cacheKey);

if (!permissionCodes) {
  permissionCodes = await this.rolesRepository.findPermissionCodesByRoleNames(
    roleNames,
    user.companyId,
  );
  await this.cacheService.set(cacheKey, permissionCodes, 300); // 5 min TTL
}
```

**Эффект:** Снижение нагрузки на БД (каждый HTTP запрос не делает query permissions)

---

## 9. 🟢 Использовать CacheInterceptor на частых endpoints (30 минут)

**Эффект:** Кэширование GET /customers, GET /products и т.д.

---

## 10. 🟢 Удалить PrismaBaseRepository (10 минут)

**Файл:** `backend/src/infrastructure/repositories/base-prisma.repository.ts`

**Изменение:** Удалить файл и его импорты — он не используется ни одним репозиторием

**Эффект:** Меньше мёртвого кода

---

## 11. 🟢 Исправить дублирование Prisma.PrismaClientKnownRequestError (5 минут)

**Файл:** `backend/src/common/filters/global-exception.filter.ts`

**Проблема:** `Prisma.PrismaClientKnownRequestError` проверяется дважды в `getStatusCode`  
**Решение:** Удалить дублирующуюся проверку

---

## 12. 🟢 Заменить хардкод UUID в AuditLog (15 минут)

**Файл:** `AuthService`

**Проблема:** `companyId: '00000000-0000-0000-0000-000000000000'`  
**Решение:** Использовать `companyId` из `companyMember.companyId` или null

---

## Сводка

| # | Исправление | Время | Сложность | Эффект |
|---|-------------|-------|-----------|--------|
| 1 | .env в .gitignore | 5 мин | 🔵 Easy | Critical security |
| 2 | Новый JWT_SECRET | 2 мин | 🔵 Easy | Critical security |
| 3 | Отозвать credentials | 10 мин | 🔵 Easy | Critical security |
| 4 | Разделить secrets | 20 мин | 🟡 Medium | High security |
| 5 | bcrypt из конфига | 5 мин | 🔵 Easy | Medium security |
| 6 | Rate limit login | 15 мин | 🔵 Easy | High security |
| 7 | Удалить companyId из DTO | 30 мин | 🟡 Medium | High security |
| 8 | Кэш permissions | 45 мин | 🟡 Medium | Performance |
| 9 | CacheInterceptor | 30 мин | 🟡 Medium | Performance |
| 10 | Удалить мёртвый код | 10 мин | 🔵 Easy | Maintainability |
| 11 | Фикс дублирования | 5 мин | 🔵 Easy | Code quality |
| 12 | Хардкод UUID | 15 мин | 🔵 Easy | Code quality |

**Итого:** ~3 часа работы, которые радикально повысят безопасность и качество кода.
