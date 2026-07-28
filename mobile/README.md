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

```bash
# Development (default)
flutter run --dart-define=ENV=dev

# Production
flutter run --dart-define=ENV=prod
```

Environment files:
- `env/.env.dev` — Development API endpoints
- `env/.env.prod` — Production API endpoints

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
