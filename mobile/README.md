# StockFlow Mobile

Enterprise ERP mobile client built with Flutter.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.16+ | UI Framework |
| Dart | 3.2+ | Language |
| Riverpod | 2.6+ | State Management |
| go_router | 14.6+ | Navigation |
| Dio | 5.7+ | HTTP Client |
| Material 3 | — | Design System |
| intl | 0.19+ | Localization |

## Architecture

```
lib/
├── core/                    # Shared infrastructure
│   ├── api/                 # HTTP client, interceptors, endpoints
│   ├── auth/                # Authentication, token storage
│   ├── config/              # Environment configuration
│   ├── constants/           # App and API constants
│   ├── errors/              # Exceptions, failures, error handler
│   ├── extensions/          # BuildContext and string extensions
│   ├── logger/              # Structured logging
│   ├── navigation/          # GoRouter configuration
│   ├── services/            # Connectivity and platform services
│   ├── storage/             # Secure and shared preferences
│   ├── theme/               # Material 3 theming (light/dark)
│   ├── utils/               # Validators, formatters
│   └── widgets/             # Reusable UI components
├── features/                # Feature modules
│   ├── auth/                # Login, splash
│   ├── dashboard/           # Main dashboard
│   └── settings/            # Settings, profile
├── shared/                  # Shared widgets
│   └── widgets/
└── l10n/                    # Localization (en, ru, kk)
```

## Clean Architecture Layers

```
UI (Screens/Widgets)
    ↓
State (Riverpod Providers)
    ↓
Service/Repository (Business Logic)
    ↓
API/Storage (Data Sources)
```

## Project Structure

### Phase 1 (Current) — Enterprise Foundation
- ✅ Project structure & architecture
- ✅ Material 3 theming (light + dark)
- ✅ Design tokens & spacing system
- ✅ Dio HTTP client with interceptors
- ✅ JWT auth & auto-refresh
- ✅ Token storage (flutter_secure_storage)
- ✅ GoRouter with protected routes
- ✅ Riverpod state management
- ✅ Localization (EN, RU, KK)
- ✅ Base screens (Splash, Login, Dashboard, Settings, Profile)
- ✅ System screens (404, Maintenance, No Internet)
- ✅ Error handling & state widgets
- ✅ Connectivity monitoring
- ✅ Logger & crash handler scaffold
- ✅ Flutter analysis: zero errors
- ✅ Tests: theme, widgets

### Phase 2 — Authentication (Next)
- Connect to NestJS backend
- Login flow
- Token refresh
- Auto-login
- Role-based UI

### Phase 3 — Dashboard
- Real-time KPIs
- Charts & graphs
- Recent activity

### Phase 4+ — Feature Modules
- Products, Inventory, Sales, CRM, Finance, AI

## Getting Started

### Prerequisites

```bash
flutter --version  # 3.16+
dart --version     # 3.2+
```

### Setup

```bash
# Install dependencies
flutter pub get

# Run code generation (when using freezed/json_serializable)
dart run build_runner build --delete-conflicting-outputs

# Run on device/emulator
flutter run

# Run tests
flutter test

# Analyze code
flutter analyze
```

### Environment Configuration

The environment is selected at build time and decides which bundled
configuration asset the application loads.

```bash
# Development (default for debug/profile builds)
flutter run --dart-define=ENV=dev

# End-to-end test build
flutter run --dart-define=ENV=e2e

# Production (a release build REQUIRES an explicit environment)
flutter build web --release --dart-define=ENV=prod
```

`--dart-define=ENV=<name>` is required for profile and release builds. Without
it a debug build selects `dev`; a profile or release build aborts at startup
with `EnvironmentConfigError` rather than assuming an environment.

Environment files:

| File | Environment | API target |
|------|-------------|------------|
| `env/.env.dev` | `dev`, `test` | `http://localhost:3000/api` |
| `env/.env.e2e` | `e2e` | `http://localhost:3000/api` |
| `env/.env.prod` | `prod` | production API |

Safety rules enforced by `core/config/environment.dart`:

- There is **no implicit API target**. A missing `API_BASE_URL` throws
  `EnvironmentConfigError` before the first frame instead of falling back to a
  default.
- `ENV` must be set explicitly for profile and release builds. There is no
  implicit production environment: a release build without the define refuses
  to start instead of silently loading the development configuration.
- A Railway host (`*.up.railway.app`) is reachable **only** when `ENV=prod`.
  In `dev`, `test`, and `e2e` it is rejected.
- The value is parsed with the standard URL parser. Values carrying
  credentials, an IPv6 literal, a missing or non-numeric port, a port outside
  1-65535, whitespace, or a control character are rejected.
- Error reasons never contain the configured URL or its credentials.
- `debugOverrideForTesting` exists only in debug builds and throws in profile
  and release builds.

To point a build at a different backend, edit the matching file in `env/` —
do not hardcode a target in Dart source.

## Dependencies

| Package | Purpose |
|---------|---------|
| flutter_riverpod | State management |
| go_router | Declarative routing |
| dio | HTTP client |
| flutter_secure_storage | Secure token storage |
| shared_preferences | Local preferences |
| connectivity_plus | Network monitoring |
| intl | Internationalization |
| logger | Structured logging |
| flutter_dotenv | Environment config |
| package_info_plus | App version info |

## Design System

- Material 3 (M3) with custom color scheme
- 4px spacing grid system
- Status colors for business states
- Financial colors (revenue green, expense red)
- Responsive breakpoints (mobile/tablet/desktop)

## Localization

Supported locales:
- `en_US` — English
- `ru_RU` — Russian
- `kk_KZ` — Kazakh

## Contributing

Follow the architecture freeze:
- Repository Pattern
- Event-Driven Architecture
- Multi-tenancy via companyId
- Soft delete (deletedAt)
- Optimistic locking (rowVersion)
- Audit logging
- RBAC permissions
