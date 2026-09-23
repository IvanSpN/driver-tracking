# Driver Tracking — спецификация MVP

Система учёта водителей-вахтовиков: кто когда на вахте, сколько начислено (белая/чёрная),
сколько уже выплачено и сколько осталось должен за месяц.

**Стек:** NestJS + PostgreSQL + Sequelize (бэк), Vue 3 + TypeScript (фронт), адаптив под мобилку + PWA.
**Пользователей:** пока один (админ), но таблица `users` и авторизация закладываются сразу.

---

## 1. Принятые решения (фундамент, на котором стоит всё остальное)

| Решение | Значение | Почему |
|---|---|---|
| Период расчёта ЗП | Календарный месяц | «Долг на остаток месяца» считается прямо. Вахта может идти через границу месяцев — начисление всё равно ляжет на нужный месяц. |
| Вахты | Отдельная таблица `shifts` | Водитель ездит вахтами многократно, нужна история. Карточка показывает текущую + архив. |
| Сумма начисления | Вводится вручную за каждый месяц | Максимально гибко (переработки, штрафы, неполный месяц) и минимум кода. Автоначисление по ставке — задел на v2. |
| Деньги | `BIGINT` в минорных единицах (копейки) | Никаких float. Если копейки не нужны — суммы просто кратны 100. Валюта фиксированная (RUB), поле валюты в MVP не заводим. |
| Каналы выплат | `WHITE` / `BLACK` | Разделение сквозное: начисление, выплаты, баланс — всё считается по двум каналам независимо. |
| Тип выплаты | `ADVANCE` (аванс) / `SALARY` (получка) | В реальности 2 выплаты за период — аванс и окончательный расчёт. Это просто ярлык для истории/UI, на баланс не влияет: обе идут в зачёт одного `period` и `channel`. |
| Увольнение водителя | Soft delete (`deleted_at`), с возможностью восстановить | Вахтовики часто возвращаются через несколько месяцев; история вахт и выплат не должна исчезать. |

### Ключевая формула

Для каждой пары **(водитель, месяц)**:

```
due_white = accrued_white − SUM(payments where channel = WHITE)
due_black = accrued_black − SUM(payments where channel = BLACK)
due_total = due_white + due_black
```

- `due > 0` → долг перед водителем
- `due < 0` → переплата (не запрещаем, показываем отдельным бейджем)
- Общий долг водителя = сумма `due_total` по всем месяцам (переплата одного месяца гасит долг другого).

Выплата всегда привязана к **двум** датам:

- `period` — за какой месяц платим (нужно для баланса),
- `paid_at` — когда реально отдали деньги (нужно для истории и дашборда).

Это позволяет 5 октября закрыть долг за сентябрь, и обе цифры останутся корректными.

---

## 2. Модель данных

### 2.1 Sequelize модели

NestJS-интеграция — `@nestjs/sequelize` + `sequelize-typescript` (декораторы вместо ручного
`sequelize.define`, ближе по духу к Nest). Подключение через `SequelizeModule.forRootAsync`
с `DATABASE_URL` из конфига.

```ts
import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  ForeignKey, BelongsTo, HasMany, Unique, AllowNull,
} from 'sequelize-typescript'

export enum UserRole { ADMIN = 'ADMIN', MANAGER = 'MANAGER' }
export enum PayChannel { WHITE = 'WHITE', BLACK = 'BLACK' }
export enum PaymentType { ADVANCE = 'ADVANCE', SALARY = 'SALARY' }
export enum PaymentMethod { CASH = 'CASH', BANK = 'BANK', CARD = 'CARD', OTHER = 'OTHER' }

@Table({ tableName: 'users', underscored: true })
export class User extends Model {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  id: string

  @Unique @AllowNull(false) @Column(DataType.STRING)
  email: string

  @AllowNull(false) @Column({ type: DataType.STRING, field: 'password_hash' })
  passwordHash: string

  @AllowNull(false) @Column({ type: DataType.STRING, field: 'full_name' })
  fullName: string

  @Default(UserRole.ADMIN) @Column(DataType.ENUM(...Object.values(UserRole)))
  role: UserRole

  @Default(true) @Column({ type: DataType.BOOLEAN, field: 'is_active' })
  isActive: boolean

  @HasMany(() => Driver) createdDrivers: Driver[]
  @HasMany(() => Accrual) createdAccruals: Accrual[]
  @HasMany(() => Payment) createdPayments: Payment[]
}

@Table({
  tableName: 'drivers',
  underscored: true,
  paranoid: true, // deletedAt вместо жёсткого DELETE
  indexes: [
    { fields: ['last_name', 'first_name'] },
    { fields: ['deleted_at'] },
  ],
})
export class Driver extends Model {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  id: string

  @AllowNull(false) @Column({ type: DataType.STRING, field: 'last_name' })
  lastName: string

  @AllowNull(false) @Column({ type: DataType.STRING, field: 'first_name' })
  firstName: string

  @Column({ type: DataType.STRING, field: 'middle_name' })
  middleName?: string

  @Column(DataType.STRING)
  phone?: string

  // Текущий статус занятости. Снапшот на момент вахты лежит в shifts.is_official.
  @Default(false) @Column({ type: DataType.BOOLEAN, field: 'is_official' })
  isOfficial: boolean

  @Column(DataType.TEXT)
  note?: string

  @ForeignKey(() => User) @Column({ type: DataType.UUID, field: 'created_by_id' })
  createdById?: string

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  createdBy?: User

  @HasMany(() => Shift) shifts: Shift[]
  @HasMany(() => Accrual) accruals: Accrual[]
  @HasMany(() => Payment) payments: Payment[]
}

@Table({
  tableName: 'shifts',
  underscored: true,
  indexes: [{ fields: ['driver_id', 'start_date'] }],
})
export class Shift extends Model {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  id: string

  @ForeignKey(() => Driver) @AllowNull(false) @Column({ type: DataType.UUID, field: 'driver_id' })
  driverId: string

  @BelongsTo(() => Driver, { onDelete: 'CASCADE' })
  driver: Driver

  @AllowNull(false) @Column({ type: DataType.DATEONLY, field: 'start_date' })
  startDate: string

  @Column({ type: DataType.DATEONLY, field: 'end_date' })
  endDate?: string | null // null = вахта идёт прямо сейчас

  @AllowNull(false) @Column({ type: DataType.BOOLEAN, field: 'is_official' })
  isOfficial: boolean // снапшот с водителя на момент создания

  @Column(DataType.TEXT)
  note?: string
}

// Начисление за месяц: ровно одна строка на (водитель, месяц)
@Table({
  tableName: 'accruals',
  underscored: true,
  indexes: [{ unique: true, fields: ['driver_id', 'period'] }],
})
export class Accrual extends Model {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  id: string

  @ForeignKey(() => Driver) @AllowNull(false) @Column({ type: DataType.UUID, field: 'driver_id' })
  driverId: string

  @BelongsTo(() => Driver, { onDelete: 'CASCADE' })
  driver: Driver

  @AllowNull(false) @Column(DataType.DATEONLY) // всегда 1-е число месяца
  period: string

  @Default(0) @Column({ type: DataType.BIGINT, field: 'white_minor' })
  whiteMinor: string // BIGINT из pg приходит строкой, см. §2.4

  @Default(0) @Column({ type: DataType.BIGINT, field: 'black_minor' })
  blackMinor: string

  @Column(DataType.TEXT)
  note?: string

  @ForeignKey(() => User) @Column({ type: DataType.UUID, field: 'created_by_id' })
  createdById?: string

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  createdBy?: User
}

// Факт выплаты. Строк на месяц может быть сколько угодно (обычно минимум 2 — аванс и получка).
@Table({
  tableName: 'payments',
  underscored: true,
  indexes: [
    { fields: ['driver_id', 'period'] },
    { fields: ['paid_at'] },
  ],
})
export class Payment extends Model {
  @PrimaryKey @Default(DataType.UUIDV4) @Column(DataType.UUID)
  id: string

  @ForeignKey(() => Driver) @AllowNull(false) @Column({ type: DataType.UUID, field: 'driver_id' })
  driverId: string

  @BelongsTo(() => Driver, { onDelete: 'CASCADE' })
  driver: Driver

  @AllowNull(false) @Column(DataType.DATEONLY) // за какой месяц
  period: string

  @AllowNull(false) @Column(DataType.ENUM(...Object.values(PayChannel)))
  channel: PayChannel

  @AllowNull(false) @Column(DataType.ENUM(...Object.values(PaymentType)))
  type: PaymentType

  @AllowNull(false) @Column({ type: DataType.BIGINT, field: 'amount_minor' })
  amountMinor: string

  @AllowNull(false) @Column({ type: DataType.DATEONLY, field: 'paid_at' }) // когда фактически отдали
  paidAt: string

  @Default(PaymentMethod.CASH) @Column(DataType.ENUM(...Object.values(PaymentMethod)))
  method: PaymentMethod

  @Column(DataType.TEXT)
  note?: string

  @ForeignKey(() => User) @Column({ type: DataType.UUID, field: 'created_by_id' })
  createdById?: string

  @BelongsTo(() => User, { onDelete: 'SET NULL' })
  createdBy?: User
}
```

`underscored: true` в каждой модели переводит camelCase-атрибуты (`createdAt`, `driverId`, …)
в snake_case-колонки автоматически, включая служебные `created_at` / `updated_at` / `deleted_at`.

### 2.2 Констрейнты, которые Sequelize-модели не выражают

Добавить руками в миграцию (`npx sequelize-cli migration:generate --name add-constraints`,
внутри — `queryInterface.sequelize.query(...)` с сырым SQL):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Даты вахты в правильном порядке
ALTER TABLE shifts ADD CONSTRAINT shifts_dates_order
  CHECK (end_date IS NULL OR end_date >= start_date);

-- У водителя не может быть двух открытых вахт
CREATE UNIQUE INDEX shifts_one_open_per_driver
  ON shifts (driver_id) WHERE end_date IS NULL;

-- Вахты одного водителя не пересекаются
ALTER TABLE shifts ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (
    driver_id WITH =,
    daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
  );

-- period — всегда первое число месяца
ALTER TABLE accruals ADD CONSTRAINT accruals_period_month_start
  CHECK (period = date_trunc('month', period)::date);
ALTER TABLE payments ADD CONSTRAINT payments_period_month_start
  CHECK (period = date_trunc('month', period)::date);

-- Суммы
ALTER TABLE accruals ADD CONSTRAINT accruals_amounts_non_negative
  CHECK (white_minor >= 0 AND black_minor >= 0);
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive
  CHECK (amount_minor > 0);
```

> `EXCLUDE USING gist` даёт защиту от пересечения вахт на уровне БД — в сервисе всё равно
> проверяй заранее, чтобы отдать человеку понятную ошибку, а не 500.

### 2.3 Запрос баланса по периодам

```sql
WITH periods AS (
  SELECT period FROM accruals WHERE driver_id = $1
  UNION
  SELECT period FROM payments WHERE driver_id = $1
),
paid AS (
  SELECT period,
         COALESCE(SUM(amount_minor) FILTER (WHERE channel = 'WHITE'), 0) AS white,
         COALESCE(SUM(amount_minor) FILTER (WHERE channel = 'BLACK'), 0) AS black
  FROM payments
  WHERE driver_id = $1
  GROUP BY period
)
SELECT
  pr.period,
  COALESCE(a.white_minor, 0)                        AS accrued_white,
  COALESCE(a.black_minor, 0)                        AS accrued_black,
  COALESCE(p.white, 0)                              AS paid_white,
  COALESCE(p.black, 0)                              AS paid_black,
  COALESCE(a.white_minor, 0) - COALESCE(p.white, 0) AS due_white,
  COALESCE(a.black_minor, 0) - COALESCE(p.black, 0) AS due_black
FROM periods pr
LEFT JOIN accruals a ON a.driver_id = $1 AND a.period = pr.period
LEFT JOIN paid     p ON p.period = pr.period
ORDER BY pr.period DESC;
```

Для списка водителей тот же расчёт агрегируется по всем водителям одним запросом
(`GROUP BY driver_id`) — не делай N+1 на каждого водителя.

### 2.4 BIGINT и типы в JS

В отличие от Prisma (которая отдаёт `BIGINT` как нативный JS `bigint` и потом не сериализуется
в JSON без патча), Sequelize поверх драйвера `pg` возвращает `BIGINT`-колонки **строкой** —
так `pg` защищается от потери точности за пределами `Number.MAX_SAFE_INTEGER`. Для JSON это
не проблема (строка сериализуется как есть), но в DTO её нужно осознанно привести к числу:

```ts
// common/money.ts
// суммы в копейках безопасно влезают в Number (до 9e15)
export const toNumber = (v: string | number): number => Number(v)
```

Для MVP это самый простой вариант. Если когда-нибудь суммы приблизятся к границе безопасного
диапазона — держать поле строкой сквозно (и в API, и во фронте) и не приводить вовсе.

---

## 3. Бэкенд (NestJS)

### 3.1 Структура модулей

```
src/
  main.ts
  app.module.ts
  config/              # @nestjs/config + валидация env через zod
  common/
    guards/            # JwtAuthGuard (глобально), @Public() декоратор
    filters/           # HttpExceptionFilter, SequelizeExceptionFilter (UniqueConstraintError → 409)
    money.ts           # toMinor / fromMinor / formatRub
    period.ts          # parsePeriod('2026-09') → '2026-09-01'
  database/            # SequelizeModule.forRootAsync, models/ (User, Driver, Shift, Accrual, Payment)
  auth/                # login / refresh / logout / me
  users/               # в MVP: seed + смена пароля
  drivers/             # CRUD + список с агрегатами
  shifts/              # вахты, close-шорткат
  payroll/             # accruals + payments + расчёт баланса
  dashboard/           # сводка
```

### 3.2 Авторизация

- `POST /auth/login` → access JWT (15 мин) + refresh JWT (30 дней), **оба в httpOnly cookie**
  (`sameSite: 'lax'`, `secure` в проде). Фронт вообще не хранит токены в localStorage.
- `JwtAuthGuard` подключён глобально через `APP_GUARD`; публичные ручки помечаются `@Public()`.
- Пароли — `argon2` (или `bcrypt`, 12 раундов).
- Первый пользователь создаётся CLI-скриптом: `npm run seed:admin -- --email=… --password=…`.
  Регистрации в UI нет.
- Rate limit на `/auth/login` — `@nestjs/throttler`, 5 попыток / 15 мин.

### 3.3 REST API

Базовый префикс `/api`. Все ручки, кроме `/auth/login` и `/auth/refresh`, требуют авторизации.

**Auth**

```
POST   /auth/login          { email, password }             → { user }
POST   /auth/refresh                                        → 204
POST   /auth/logout                                         → 204
GET    /auth/me                                             → { user }
PATCH  /auth/password       { currentPassword, newPassword } → 204
```

**Водители**

```
GET    /drivers?search=&onShift=true|false&official=true|false&hasDebt=true&archived=true|false&page=1&limit=20&sort=lastName
POST   /drivers             { lastName, firstName, middleName?, phone?, isOfficial, note? }
GET    /drivers/:id
PATCH  /drivers/:id
DELETE /drivers/:id          # увольнение = soft delete, уходит в архив
POST   /drivers/:id/restore  # вернуть из архива (вышел на новую вахту)
```

По умолчанию (`archived` не передан) список показывает только активных водителей;
`archived=true` — архив (уволенные), `archived` можно не комбинировать с `onShift`/`hasDebt`,
это отдельный экран.

Элемент списка `GET /drivers`:

```json
{
  "id": "0d6f…",
  "fullName": "Иванов Иван Иванович",
  "phone": "+7 701 000 00 00",
  "isOfficial": true,
  "currentShift": { "id": "…", "startDate": "2026-09-01", "endDate": "2026-10-15", "daysLeft": 23 },
  "currentPeriod": { "period": "2026-09", "dueWhiteMinor": 15000000, "dueBlackMinor": 5000000 },
  "totalDueMinor": 20000000
}
```

**Вахты**

```
GET    /drivers/:id/shifts
POST   /drivers/:id/shifts   { startDate, endDate?, note? }
PATCH  /shifts/:id           { startDate?, endDate?, note? }
POST   /shifts/:id/close     { endDate }        # шорткат «вахта закончилась»
DELETE /shifts/:id
```

**Зарплата**

```
GET    /drivers/:id/payroll?from=2026-01&to=2026-12
         → [{ period, accruedWhiteMinor, accruedBlackMinor,
               paidWhiteMinor, paidBlackMinor, dueWhiteMinor, dueBlackMinor,
               payments: [...] }]

PUT    /drivers/:id/accruals/:period      { whiteMinor, blackMinor, note? }   # upsert, period = "2026-09"
DELETE /drivers/:id/accruals/:period

GET    /drivers/:id/payments?period=2026-09
POST   /drivers/:id/payments  { period, channel, type, amountMinor, paidAt, method, note? }
PATCH  /payments/:id
DELETE /payments/:id
```

`type` — `ADVANCE` (аванс) или `SALARY` (получка), только для истории/UI, на расчёт `due` не влияет.

**Дашборд**

```
GET    /dashboard/summary?period=2026-09
{
  "driversTotal": 12,
  "onShiftNow": 5,
  "period": "2026-09",
  "accrued": { "whiteMinor": …, "blackMinor": … },
  "paid":    { "whiteMinor": …, "blackMinor": … },
  "due":     { "whiteMinor": …, "blackMinor": … },
  "totalDueAllPeriodsMinor": …,
  "shiftsEndingSoon": [ { "driverId", "fullName", "endDate", "daysLeft" } ],
  "recentPayments":   [ { "driverId", "fullName", "channel", "type", "amountMinor", "paidAt" } ]
}
```

### 3.4 Валидация и ошибки

- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` глобально.
- `period` в URL — строка `YYYY-MM`, нормализуется в дату первого числа.
- Суммы приходят **в минорных единицах целым числом** (`@IsInt()`), конвертацию из рублей делает фронт.
- Осмысленные 4xx: пересечение вахт → `409 SHIFT_OVERLAP`, вторая открытая вахта → `409 SHIFT_ALREADY_OPEN`,
  дата выплаты в будущем → `400 PAYMENT_IN_FUTURE`.
- Swagger на `/api/docs` (только вне прода) — пригодится, чтобы генерить типы для фронта.

---

## 4. Фронтенд (Vue 3)

### 4.1 Стек

| Задача | Выбор |
|---|---|
| Сборка | Vite + TypeScript |
| Состояние | Pinia (`auth`, `drivers`, `ui`) |
| Роутинг | Vue Router + `meta.requiresAuth` guard |
| Стили | Tailwind CSS поверх CSS-переменных (см. §5) |
| Формы | vee-validate + zod |
| HTTP | `ofetch`/axios-обёртка, `credentials: 'include'`, авто-`refresh` на 401 |
| Утилиты | VueUse (`useDark`, `useMediaQuery`, `useStorage`) |
| PWA | `vite-plugin-pwa` |
| Даты | `date-fns` + локаль `ru` |

### 4.2 Структура

```
src/
  api/          # client.ts + drivers.ts, shifts.ts, payroll.ts, auth.ts
  stores/       # auth.ts, drivers.ts, ui.ts (тема, состояние сайдбара)
  router/
  layouts/      # AppLayout.vue (шелл), AuthLayout.vue
  components/
    ui/         # BaseButton, BaseInput, MoneyInput, MoneyText, Badge,
                # AdaptiveDialog, DataList, StatCard, EmptyState, ConfirmDialog,
                # PeriodPicker, ThemeToggle, BottomNav
    drivers/    # DriverCard, DriverForm, DriverFilters
    payroll/    # PeriodRow, PaymentForm, AccrualForm, BalanceBar
  views/
  styles/tokens.css
```

### 4.3 Экраны

1. **Login** — email + пароль, ничего лишнего.
2. **Дашборд** — 4 плитки (водителей всего / на вахте сейчас / начислено за месяц / долг за месяц),
   блок «вахты заканчиваются в ближайшие 7 дней», лента последних выплат.
3. **Список водителей** — поиск по ФИО, фильтры (на вахте / официальные / есть долг),
   переключатель «Активные / Архив» (уволенные, восстанавливаются кнопкой),
   у каждого водителя видны статус вахты и долг за текущий месяц.
4. **Карточка водителя** — три вкладки:
   - *Обзор*: ФИО, телефон, статус (официально/нет), текущая вахта, сводный долг;
   - *Вахты*: список с датами, кнопки «Закрыть вахту» / «Новая вахта»;
   - *Зарплата*: строки по месяцам — начислено (белая/чёрная), выплачено, остаток;
     раскрытие строки показывает выплаты этого месяца.
5. **Формы** — водитель, вахта, начисление за месяц, выплата (канал белая/чёрная + тип
   аванс/получка, модалка на десктопе, bottom sheet на мобилке — один компонент `AdaptiveDialog`).
6. **Настройки** — тема, смена пароля.

### 4.4 Как показывать деньги

- `MoneyInput` — работает в рублях, наружу отдаёт `amountMinor` (`×100`), маска с пробелами-разделителями.
- `MoneyText` — форматирует `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })`,
  всегда `font-variant-numeric: tabular-nums`, чтобы цифры в колонках не прыгали.
- Белая/чёрная различаются **не цветом**, а формой бейджа: белая — контурный, чёрная — залитый.
  Так разделение читается в обеих темах и при ч/б печати.
- Долг → жирный текст + подпись «осталось»; переплата → бейдж «переплата» вместо минуса.

---

## 5. Дизайн-система: нейтральная монохромная, две темы

### 5.1 Токены

```css
:root {
  color-scheme: light;

  --bg:            #ffffff;
  --surface:       #fafafa;
  --surface-hover: #f5f5f5;
  --border:        #e5e5e5;
  --border-strong: #d4d4d4;
  --text:          #0a0a0a;
  --text-muted:    #737373;
  --text-subtle:   #a3a3a3;

  --accent:        #0a0a0a;   /* primary-кнопка */
  --accent-fg:     #ffffff;

  --positive:      #15803d;   /* «выплачено полностью» */
  --warning:       #b45309;   /* «есть остаток» */
  --danger:        #b91c1c;   /* удаление */

  --radius:        8px;
  --radius-sm:     6px;
  --shadow:        0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.1);
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --bg:            #0a0a0a;
  --surface:       #141414;
  --surface-hover: #1f1f1f;
  --border:        #262626;
  --border-strong: #3f3f3f;
  --text:          #fafafa;
  --text-muted:    #a3a3a3;
  --text-subtle:   #737373;

  --accent:        #fafafa;
  --accent-fg:     #0a0a0a;

  --positive:      #4ade80;
  --warning:       #fbbf24;
  --danger:        #f87171;
  --shadow:        0 1px 2px rgb(0 0 0 / 0.4), 0 1px 3px rgb(0 0 0 / 0.5);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* те же значения, что и у [data-theme="dark"] */ }
}
```

Семантические цвета используются **только для текста и иконок**, не заливкой — иначе интерфейс
перестанет быть нейтральным. Вся структура держится на фоне, границе и типографике.

### 5.2 Тема

- Три состояния: `light` / `dark` / `system`, хранится в `localStorage` (`ui` store).
- Класс ставится на `<html>` как `data-theme`, чтобы не было вспышки — inline-скрипт в `index.html`
  до загрузки бандла.
- Tailwind: `darkMode: ['selector', '[data-theme="dark"]']`, а цвета в конфиге маппятся на
  переменные: `colors: { bg: 'var(--bg)', surface: 'var(--surface)', … }`.
- `<meta name="theme-color">` — два тега с `media="(prefers-color-scheme: …)"`, чтобы строка
  состояния на мобилке совпадала с темой.

### 5.3 Типографика и ритм

- Шрифт: системный стек (`ui-sans-serif, -apple-system, "Segoe UI", Roboto, …`) — быстрый и нейтральный.
- Размеры: 12 / 14 / 16 / 20 / 28. Основной текст 14, суммы 16–20.
- Шкала отступов кратна 4px, радиус 8px, границы 1px — никаких крупных теней.

---

## 6. Мобильная адаптация

- **Mobile-first**, единственный существенный брейкпоинт — `768px`.
- Навигация: на десктопе боковое меню, на мобилке — нижняя панель (Дашборд / Водители / Выплата / Ещё),
  с `padding-bottom: env(safe-area-inset-bottom)`.
- Таблицы на мобилке превращаются в карточки (`DataList` рендерит либо `<table>`, либо список карточек).
- Модалки на мобилке — bottom sheet со свайпом вниз.
- Тач-таргеты ≥ 44px, поля ввода `font-size: 16px` (иначе iOS зумит форму).
- Быстрое действие «Добавить выплату» — FAB на мобилке, кнопка в шапке на десктопе.
  Это самый частый сценарий: зашёл, выбрал водителя, вбил сумму, выбрал белая/чёрная, сохранил.
- PWA: `vite-plugin-pwa` с `registerType: 'autoUpdate'`, манифест (иконки 192/512, `display: standalone`),
  офлайн — только кеш оболочки; данные всегда с сети (в MVP офлайн-запись не делаем).

---

## 7. Репозиторий и запуск

```
driver-tracking/
  docker-compose.yml        # postgres:17-alpine + adminer (опц.)
  apps/
    api/                    # NestJS
      migrations/           # sequelize-cli миграции (таблицы + констрейнты из §2.2)
      src/
        database/models/    # User, Driver, Shift, Accrual, Payment
      .env.example
    web/                    # Vue
      src/
      .env.example
  docs/
    mvp-spec.md             # этот файл
```

Монорепо на npm workspaces — достаточно, Nx/Turborepo для двух приложений излишни.

`apps/api/.env.example`:

```
DATABASE_URL=postgresql://driver:driver@localhost:5432/driver_tracking
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
ACCESS_TTL=15m
REFRESH_TTL=30d
CORS_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

`apps/web/.env.example`:

```
VITE_API_URL=http://localhost:3000/api
```

`docker-compose.yml` — только Postgres (приложения в MVP гоняем локально):

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: driver
      POSTGRES_PASSWORD: driver
      POSTGRES_DB: driver_tracking
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```

---

## 8. План реализации

| Этап | Что делаем | Готово, когда |
|---|---|---|
| 0 | Скелет монорепо, docker-compose, Sequelize init (`sequelize-cli`), первая миграция, `seed:admin` | `sequelize-cli db:migrate` проходит, админ создан |
| 1 | Auth: login/refresh/logout/me, глобальный guard, страница логина | вход работает, защищённая ручка отдаёт 401 без куки |
| 2 | Drivers CRUD + список с поиском и фильтрами | можно завести водителя и найти его |
| 3 | Shifts: создать, закрыть, редактировать, защита от пересечений | вахты ведутся, пересечение даёт понятную ошибку |
| 4 | Payroll: начисление за месяц, выплаты, расчёт баланса | вкладка «Зарплата» показывает начислено/выплачено/остаток |
| 5 | Дашборд | видно сводку по текущему месяцу |
| 6 | Темы, мобильный layout, PWA | на телефоне пользоваться удобно, тема переключается без вспышки |
| 7 | Полировка: пустые состояния, подтверждения удаления, тосты, формат ошибок | ничего не падает молча |

Тесты в MVP: e2e на `payroll` (расчёт баланса, множественные выплаты, переплата) —
это единственное место с реальной логикой. Остальное — CRUD, покрывать необязательно.

---

## 9. Граничные случаи, которые стоит решить сразу

- **Вахта через границу месяца.** Начисление всё равно вводится помесячно — разбивка на совести
  пользователя. Подсказка в форме: показывать, сколько дней вахты попало в выбранный месяц.
- **Выплата без начисления.** Разрешаем: получится отрицательный `due` (аванс). Показываем «переплата».
- **Изменение статуса официально/нет.** Меняется на водителе, в закрытых вахтах остаётся снапшот.
- **Увольнение водителя.** Soft delete; в основном списке скрыт, попадает в «Архив».
  Можно восстановить (`POST /drivers/:id/restore`) — вахтовики часто возвращаются на новую вахту.
  Жёсткое удаление — только из БД.
- **Удаление выплаты.** Разрешаем (опечатки бывают), но с подтверждением; `updated_at` + `created_by`
  дают минимальный след.
- **Часовые пояса.** Все даты — `DATE`, без времени. На фронте никогда не гоняй их через `new Date()`
  с таймзоной — работай со строками `YYYY-MM-DD`.

---

## 10. Осознанно вне MVP

Автоначисление по ставке · штрафы отдельным типом начисления · экспорт в Excel/PDF ·
загрузка документов и сканов · уведомления об окончании вахты · роли и разграничение доступа ·
аудит-лог в UI · мультивалютность · офлайн-режим с записью · графики и аналитика.

Ничто из этого не ломает текущую схему: начисления и выплаты уже разделены по каналам и месяцам,
роль у пользователя есть, `created_by` пишется.
