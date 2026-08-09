# Dashboard v3.3 — Stage E: Revenue + Monthly Goal (план, черновик)

**Статус:** черновик для утверждения. Реализация НЕ начата.
**Scope:** только Revenue KPI + Monthly Goal progress (presentation layer).
**Правило:** только существующие данные/провайдеры, ноль новых запросов, ноль изменений backend/API/Prisma.

---

## 1. Текущее состояние (аудит)

**KPI-секция** (`mobile/lib/features/dashboard/presentation/screens/dashboard_screen.dart` → `_KpiSection._cards()`):
5 компактных карточек: Today's Revenue, Today's Sales, Gross Profit, Inventory Value, Customers. Revenue — `KpiCard(title: "Today's Revenue", value: todaySales.revenue, subtitle: 'vs yesterday', changePercent: _revenueTrend(), ...)`.

**Уже доступные данные (dashboardProvider → DashboardData.summary, БЕЗ новых запросов):**

| Поле | Назначение для Stage E |
|---|---|
| `todaySales.revenue` (string) | Текущая выручка дня |
| `todaySales.count` | Число продаж сегодня |
| `todaySales.averageReceipt` | Средний чек (не нужен для Stage E) |
| `yesterdaySales.revenue` | Тренд «vs вчера» |
| `monthSales.revenue` | Выручка за месяц → числитель прогресса |
| `monthSales.count` | Продаж за месяц (подпись под баром) |
| `grossProfit`, `ordersCount` | Не используются в Stage E |

**Инфраструктура:**
- `preferencesStorageProvider` (`mobile/lib/core/storage/preferences_storage.dart`) — типизированная обёртка SharedPreferences, инициализируется в `main.dart`, есть `getDouble/setDouble`. Годен для локальной цели месяца (UI-only, без backend) — ровно вариант (a) из `docs/ux/dashboard_v32_wireframe.md §7.1`, утверждённый владельцем.
- `KpiCard` поддерживает `emphasized` (акцентная рамка/подложка) и `compact` — Revenue-карточку делаем emphasized.
- Скелетоны: `KpiCardSkeleton` / `ShimmerBox`. Дизайн-токены: `DesignTokens.revenue` (зелёный), `success`, `primary`.

---

## 2. UX-предложение

### 2.1 Revenue KPI (карточка №1, emphasized)

```
┌─────────────────────────────────────────────┐
│ [icon]  469 000 ₸                 ▲ +18%    │  ← крупный tabular-номер + trend chip
│          Today's Revenue                    │
│ ──────────────────────────────────────────  │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░  62%                       │  ← LinearProgressIndicator (minHeight ~6, rounded)
│ 1 240 000 ₸ из 2 000 000 ₸ · 128 продаж     │  ← месяц: achieved из goal · count
│ [✎]                                         │  ← редактирование цели (pencil)
└─────────────────────────────────────────────┘
```

- Число — `todaySales.revenue` (крупный, tabular figures, hero-акцент).
- Trend chip — существующий `_TrendChip` (`changePercent`), «—» при отсутствии вчерашней базы.
- **Подпись «Месяц»**: `monthSales.revenue` против локальной цели. Формат: `"{monthRevenue} из {goal} · {percent}%"` + `· {count} продаж`.
- **Кнопка «✎»**: открывает диалог «Месячная цель» — поле ввода суммы + Save/Cancel. Цель сохраняется в SharedPreferences (`getDouble/setDouble`), ключ `monthly_goal`.
- Цель по умолчанию **0** → бар скрыт, вместо него строка «Задайте цель месяца» + кнопка «✎» (не выглядит сломанным, провоцирует онбординг-действие).

### 2.2 Progress-бар

- `progress = monthSales.revenue / goal`, clamp 0..1 для заполнения; текст показывает реальный % (может быть >100%).
- `goal == 0` → бар не рисуется (состояние «цель не задана»).
- `progress >= 1` → заполнение 100%, цвет `DesignTokens.success` + подпись «Цель достигнута» / «+X сверх цели».

### 2.3 Состояния

| Состояние | Поведение |
|---|---|
| Loading (`DashboardLoading`) | Существующий `_KpiSkeletonGrid` (карточка не рендерится отдельно) |
| Error (`DashboardError`) | Существующий `ErrorStateWidget` всей страницы (не трогаем) |
| Empty (0 продаж, цель 0) | Revenue = «0 ₸», trend «—», строка «Задайте цель месяца» + ✎ |
| Данные устарели (keep-alive) | `ref.watch(dashboardProvider)` пересобирает при новых данных |

### 2.4 Light/Dark

- Все цвета из темы + `DesignTokens`; emphasized-подложка `color.withOpacity(0.07)` как в `KpiCard` — работает в обеих темах.

### 2.5 Responsive (1440 / 1024 / 768)

- **1440+ (breakpointWide)**: 5 карточек в строку (как сейчас), Revenue — emphasized, бар под числом вписывается.
- **1024–1199 (desktop)**: Wrap 3-up — карточка Revenue сохраняет ту же структуру.
- **768 (tablet)**: Wrap 2-up — номер чуть меньше (`FittedBox`/ellipsis как в `_buildCompact`), бар на всю ширину карточки, подпись переносится на 2 строки при необходимости.
- **Без горизонтального overflow** (проверка `scrollWidth == clientWidth` на 1440/1024/768).

---

## 3. Файлы

### Изменить (минимально)

| Файл | Что |
|---|---|
| `mobile/lib/features/dashboard/presentation/widgets/kpi_card.dart` | (опционально) добавить опциональный `progress`-слот (double? progress, String? progressLabel, onEditGoal) — ИЛИ вынести в отдельный виджет |
| `mobile/lib/features/dashboard/presentation/widgets/revenue_goal_card.dart` | **новый**: Revenue KPI + progress-бар + диалог цели (если не расширяем KpiCard) |
| `mobile/lib/features/dashboard/presentation/screens/dashboard_screen.dart` | в `_cards()`: первая карточка — RevenueGoalCard (emphasized) вместо обычной Revenue KpiCard |
| `mobile/lib/features/dashboard/presentation/providers/monthly_goal_provider.dart` | **новый**: `StateNotifierProvider<double?>` — чтение/запись `preferencesStorageProvider` (`monthly_goal`), `load()`, `set(goal)` |
| `mobile/test/features/dashboard/revenue_goal_card_test.dart` | **новый**: unit/widget-тесты |
| `docs/ux/dashboard_v33_action_center.md` (или отдельный doc) | зафиксировать решение по цели месяца (Decision) |

### НЕ менять

- Action Center, Cash Drawer Hero, OnboardingHero, X-report polling, auth, UX-shell, POS, sidebar semantics, bootstrap 404 — **отдельный scope, не трогаем**.
- Backend / API / Prisma / DTO — **никаких изменений**.

### Network

- **0 новых запросов.** Всё из уже загруженного `dashboardProvider` (Future.wait из `_fetchAll`) + локальное хранилище. Никаких запросов на таймерах.

---

## 4. Acceptance criteria (предложение)

**Revenue:**
1. Значение = `todaySales.revenue`, формат `Formatters.currency`, tabular figures.
2. Trend chip: `_revenueTrend()`; «—» при `yesterday <= 0`.

**Monthly Goal / progress:**
3. Бар показывает `monthSales.revenue / goal`, подпись `"{month} из {goal} · {percent}%"` + `· {count} продаж`.
4. `goal == 0` → бар скрыт, строка «Задайте цель месяца» + ✎.
5. `progress >= 1` → заполнение 100%, `DesignTokens.success`, подпись «Цель достигнута».
6. Редактирование цели: диалог, валидация (число > 0), сохранение в SharedPreferences, переживает рестарт.
7. Клик по ✎ не триггерит навигацию/другие действия (информационная карточка, как Hero).

**Loading/Error/Empty:**
8. Loading → существующий `_KpiSkeletonGrid` (без двойного рендера).
9. Error → существующий `ErrorStateWidget` страницы (не трогаем).
10. Empty → «0 ₸» + «Задайте цель месяца»; никакого «No data».

**Responsive:**
11. 1440/1024/768 — без горизонтального overflow (`scrollWidth <= clientWidth`).
12. Карточка читаема на всех трёх ширинах (номер не обрезается, подпись переносится).

**Accessibility:**
13. Бар имеет `Semantics(label: 'Прогресс месяца 62%')`.
14. ✎ — реальная кнопка с tooltip/label, focusable (InkWell/IconButton).

**Light/Dark:**
15. Проверено в обеих темах: контраст, подложки, цвета из DesignTokens.

**Network:**
16. 0 новых запросов; цель только локальная; нет запросов на 20s/30s таймерах.

**Tests:**
17. Unit: расчёт прогресса, clamp, формат подписи, `goal==0` → скрытие, перевыполнение.
18. Widget: отображение revenue, диалог цели (валидация, save), скелетон/пустое состояние.
19. `flutter analyze` 0 errors (изменённые файлы), полный `flutter test` зелёный, `flutter build web --release` ✓.
20. Браузер: 1440/1024/768 light+dark, console errors 0, overflow 0.

---

## 5. Открытые вопросы

1. Расширять ли `KpiCard` прогресс-слотом или создать отдельный `RevenueGoalCard`? (предложение: отдельный виджет — меньше риска для остальных KPI)
2. Куда класть цель: только через ✎ на карточке, или ещё пункт в Settings («Месячная цель»)? (предложение: оба — Settings как вторичный вход, дёшево)
3. Валютный формат ввода в диалоге: число с плавающей точкой vs целое? (предложение: double, >0, формат как Formatters)

*Жду утверждения плана и критериев. Реализация — только после approval.*
