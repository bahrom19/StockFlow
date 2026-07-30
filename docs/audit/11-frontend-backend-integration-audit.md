# Frontend ↔ Backend Integration Audit

**Дата:** 30 июля 2026  
**Backend:** NestJS (TypeScript)  
**Frontend:** Flutter Mobile (Dart)  

---

## Сводка найденных несовместимостей

| # | Критичность | Компонент | Проблема |
|---|-------------|-----------|----------|
| 1 | **CRITICAL** | Auth | **GET /auth/me endpoint не существует в backend** |
| 2 | **HIGH** | Auth | Backend `AuthResponse` не включает `permissions` поле |
| 3 | **MEDIUM** | Auth | `expiresIn`/`refreshExpiresIn` — тип `string` vs `number` |
| 4 | **HIGH** | Customers | Mobile: `/crm/customers` — Backend: `/customers` |
| 5 | **HIGH** | Inventory | Mobile: `/inventory` — Backend: `/inventory/stock` |
| 6 | **HIGH** | Inventory | Mobile: `/inventory/adjustments` — Backend: `/inventory/stock/adjust` |
| 7 | **HIGH** | Inventory | Mobile: `/inventory/transfers` — Backend: `/inventory/stock/transfer` |
| 8 | **MEDIUM** | Products | Mobile: `/products/barcodes` — Backend: `/inventory/barcodes` |
| 9 | **MEDIUM** | Products | Mobile: `/products/variants` — Backend: `/inventory/variants` (вероятно) |
| 10 | **MEDIUM** | Sales | Mobile: `PATCH /sales/:id/status?status=X` vs Backend: `POST /sales/:id/complete` и `POST /sales/:id/cancel` |
| 11 | **LOW** | Sales | Mobile: `/sales/receipt` — Backend: `/sales/receipt/:id` |
| 12 | **LOW** | Billing | Mobile: `/billing/portal` — требует проверки |
| 13 | **LOW** | Payment Enums | Mobile expects `QR`, `GIFT_CARD`, `STORE_CREDIT` — нужно сверить с Prisma schema |

---

## 1. Auth — GET /auth/me (CRITICAL)

### Проблема
Mobile вызывает `GET /auth/me` для получения профиля пользователя:
```dart
// mobile/lib/core/api/api_endpoints.dart
static const String me = '/auth/me';
```

Backend **не имеет** этого эндпоинта. В `AuthController` только:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Последствия
- После перезапуска приложения, `checkAuthStatus()` вызывает `getProfile()` → `GET /auth/me`
- Backend возвращает 404
- Приложение переходит в `AuthUnauthenticated`, хотя токены валидны
- **Это ломает auto-login при перезапуске приложения**

### Решение
Добавить `GET /auth/me` controller в backend, который возвращает `CurrentUser` из JWT payload.

---

## 2. Auth — отсутствует `permissions` поле (HIGH)

### Проблема
Mobile `CurrentUser` ожидает поле `permissions`:
```dart
@Default(<String>[]) List<String> permissions,
```

Backend `AuthResponse.user` не содержит `permissions`:
```typescript
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    companyId: string;
    roles: string[];
    // permissions отсутствует!
  };
}
```

### Последствия
- `currentUserPermissionsProvider` возвращает пустой `[]`
- UI не может проверять permissions на фронтенде
- Блоки управления, требующие прав, могут быть некорректно отображены

### Решение
Добавить `permissions` в `AuthResponse.user`, загружать permissions из БД при login/refresh

---

## 3. Auth — `expiresIn` тип string vs number (MEDIUM)

### Проблема
Mobile API contract test ожидает числа:
```dart
'expiresIn': 3600,
'refreshExpiresIn': 604800,
```

Backend возвращает строки:
```typescript
expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '15m',
refreshExpiresIn: this.configService.get<string>('jwt.refreshExpiresIn') ?? '30d',
```

### Последствия
- В Dart это не ломает парсинг, т.к. `String?` может быть `null`
- Но если frontend использует `expiresIn` для таймеров, строка '15m' не парсится как число
- **Рекомендация:** унифицировать — backend отдаёт секунды (number), frontend использует их

---

## 4. Customers — путь /crm/customers vs /customers (HIGH)

### Проблема
Mobile:
```dart
static const String customers = '/crm/customers';
```

Backend:
```typescript
@Controller('customers')
export class CustomersController { ... }
```

### Последствия
- Все запросы к customers с мобильного приложения падают с 404
- **CRUD для клиентов полностью не работает с мобильного приложения**

### Решение
Изменить путь в mobile `api_endpoints.dart` с `/crm/customers` на `/customers`
Или добавить alias в backend. Предпочтительно — исправить в mobile.

---

## 5. Inventory — пути /inventory vs /inventory/stock (HIGH)

### Проблема
Mobile вызывает:
```dart
static const String inventory = '/inventory';
```

Backend:
```typescript
@Controller('inventory/stock')
export class StockController { ... }
```

### Последствия
- `GET /inventory` возвращает 404
- Получение остатков с мобильного приложения не работает

### Решение
Изменить в mobile на `/inventory/stock` или добавить route alias в backend

---

## 6. Inventory — пути /inventory/adjustments и /inventory/transfers (HIGH)

### Проблема
Mobile:
```dart
static const String stockAdjustments = '/inventory/adjustments';
static const String stockTransfers = '/inventory/transfers';
```

Backend:
```typescript
@Post('adjust')  // → /inventory/stock/adjust
@Post('transfer') // → /inventory/stock/transfer
```

### Последствия
- `POST /inventory/adjustments` и `POST /inventory/transfers` — 404
- Корректировка и перемещение запасов с мобильного приложения не работает

### Решение
Исправить пути в mobile:
- `/inventory/stock/adjust` вместо `/inventory/adjustments`
- `/inventory/stock/transfer` вместо `/inventory/transfers`

---

## 7. Products — путь /products/barcodes (MEDIUM)

### Проблема
Mobile:
```dart
static const String productBarcodes = '/products/barcodes';
```

Backend:
```typescript
@Controller('inventory/barcodes')
export class BarcodeController { ... }
```

### Последствия
- GET /products/barcodes — 404
- Поиск по штрих-коду с мобильного приложения не работает

### Решение
Изменить в mobile на `/inventory/barcodes`

---

## 8. Products — путь /products/variants (MEDIUM)

### Проблема
Mobile:
```dart
static const String productVariants = '/products/variants';
```

Backend:
Вероятно `/inventory/variants` (нужно проверить `VariantController`).

### Решение
Требуется проверка backend controller'а для variants

---

## 9. Sales — status transition API (MEDIUM)

### Проблема
Mobile API contract тест ожидает `PATCH /sales/:id/status?status=X`:
```dart
group('PATCH /sales/:id/status', () {
  test('query param status is required enum', () { ... });
});
```

Backend поддерживает оба подхода:
- `PATCH /sales/:id/status?status=COMPLETED` (через query param)
- `POST /sales/:id/complete` (convenience endpoint)
- `POST /sales/:id/cancel` (convenience endpoint)
- `POST /sales/:id/refund` (convenience endpoint)

### Решение
Оба подхода работают. Mobile должен использовать любой из них. Это не блокер, но нужно выбрать единый подход.

---

## 10. Payment Methods Enums (LOW)

### Проблема
Mobile contract test ожидает:
```dart
final methods = ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'GIFT_CARD', 'STORE_CREDIT'];
```

Backend Prisma schema имеет `enum PaymentMethod`:
Необходимо проверить, совпадают ли значения.

### Решение
Сверить с Prisma schema. Если не совпадают — исправить enum.

---

## Итог

| Критичность | Количество | Действие |
|-------------|-----------|----------|
| CRITICAL | 1 | Немедленно |
| HIGH | 5 | До следующего релиза |
| MEDIUM | 3 | До v1.0 |
| LOW | 2 | По возможности |

### 3 главные проблемы, блокирующие интеграцию:

1. **CRITICAL:** `GET /auth/me` не существует — auto-login сломан
2. **HIGH:** `permissions` не возвращаются в `AuthResponse` — RBAC на фронтенде не работает
3. **HIGH:** 4 route mismatch (customers, inventory) — базовые CRUD операции не работают
