# StockFlow Architecture Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Flutter    │  │   Flutter    │  │   Flutter    │         │
│  │   Mobile     │  │   Mobile     │  │   Mobile     │         │
│  │  (Android)   │  │   (iOS)      │  │  (Future)    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┼─────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
├────────────────────────────┼─────────────────────────────────────┤
│         ┌──────────────────┴──────────────────┐                 │
│         │         NestJS Application           │                 │
│         │  ┌──────────────────────────────┐   │                 │
│         │  │  main.ts (Entry Point)       │   │                 │
│         │  │  - CORS                      │   │                 │
│         │  │  - ValidationPipe            │   │                 │
│         │  │  - Helmet (Security)         │   │                 │
│         │  │  - Compression                │   │                 │
│         │  │  - Swagger Documentation      │   │                 │
│         │  └──────────────┬───────────────┘   │                 │
│         │                 │                   │                 │
│         │  ┌──────────────▼───────────────┐   │                 │
│         │  │      AppModule               │   │                 │
│         │  │  - Request ID Middleware     │   │                 │
│         │  │  - Global Exception Filter   │   │                 │
│         │  └──────────────┬───────────────┘   │                 │
│         └─────────────────┼───────────────────┘                 │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    MODULE LAYER (DDD)                            │
├───────────────────────────┼─────────────────────────────────────┤
│  ┌────────────────────────┼─────────────────────────────────┐   │
│  │     Feature Modules    │                                 │   │
│  ├────────────────────────┼─────────────────────────────────┤   │
│  │                        │                                 │   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │    AuthModule    │  │  │   UsersModule    │         │   │
│  │  │  - Controller    │  │  │  - Controller    │         │   │
│  │  │  - Service       │  │  │  - Service       │         │   │
│  │  │  - Repository    │  │  │  - Repository    │         │   │
│  │  │  - DTOs          │  │  │  - DTOs          │         │   │
│  │  │  - Guards        │  │  │  - Entities      │         │   │
│  │  │  - Strategies    │  │  │                  │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  │                        │                                 │   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │  ProductsModule  │  │  │ InventoryModule  │         │   │
│  │  │  - Controller    │  │  │  - Controller    │         │   │
│  │  │  - Service       │  │  │  - Service       │         │   │
│  │  │  - Repository    │  │  │  - Repository    │         │   │
│  │  │  - DTOs          │  │  │  - DTOs          │         │   │
│  │  │  - Entities      │  │  │  - Entities      │         │   │
│  │  │  - Mappers       │  │  │                  │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  │                        │                                 │   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │ CustomersModule  │  │  │ SuppliersModule  │         │   │
│  │  │  - Controller    │  │  │  - Controller    │         │   │
│  │  │  - Service       │  │  │  - Service       │         │   │
│  │  │  - Repository    │  │  │  - Repository    │         │   │
│  │  │  - DTOs          │  │  │  - DTOs          │         │   │
│  │  │  - Entities      │  │  │  - Entities      │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  │                        │                                 │   │
│  └────────────────────────┼─────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────┼─────────────────────────────────┐   │
│  │     Shared Modules      │                                 │   │
│  ├────────────────────────┼─────────────────────────────────┤   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │   PrismaModule   │  │  │  AppConfigModule │         │   │
│  │  │  - PrismaService │  │  │  - ConfigService │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │  SharedModule    │  │  │  HealthModule    │         │   │
│  │  │  - Common DTOs   │  │  │  - Health Check  │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  └────────────────────────┼─────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│              INFRASTRUCTURE LAYER                                │
├───────────────────────────┼─────────────────────────────────────┤
│  ┌────────────────────────┼─────────────────────────────────┐   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │   Database       │  │  │      Cache       │         │   │
│  │  │   PostgreSQL     │  │  │     Redis        │         │   │
│  │  │                  │  │  │                  │         │   │
│  │  │  - Companies     │  │  │  - Session Data  │         │   │
│  │  │  - Users         │  │  │  - Rate Limiting │         │   │
│  │  │  - Products      │  │  │  - Caching       │         │   │
│  │  │  - Inventory     │  │  │                  │         │   │
│  │  │  - Customers     │  │  │                  │         │   │
│  │  │  - Suppliers     │  │  │                  │         │   │
│  │  │  - Audit Logs    │  │  │                  │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  │                        │                                 │   │
│  │  ┌──────────────────┐  │  ┌──────────────────┐         │   │
│  │  │  Prisma ORM      │  │  │   BullMQ Queue  │         │   │
│  │  │  - Schema        │  │  │  - Background    │         │   │
│  │  │  - Migrations    │  │  │    Jobs         │         │   │
│  │  │  - Client        │  │  │  - Notifications │         │   │
│  │  └──────────────────┘  │  └──────────────────┘         │   │
│  └────────────────────────┼─────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│              EXTERNAL SERVICES                                  │
├───────────────────────────┼─────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Email Service │  │   SMS Service   │  │ AI Service  │  │
│  │   (Future)      │  │   (Future)      │  │  (Future)   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Authentication

```
Client Request
     │
     ▼
┌─────────────────┐
│ AuthController  │
│ (POST /login)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AuthService     │
│ - Validate      │
│   credentials   │
│ - Generate JWT  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AuthRepository  │
│ - Query User    │
│ - Query Company │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prisma Service  │
│ - PostgreSQL    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Return Response │
│ - Access Token  │
│ - Refresh Token │
│ - User Data     │
└─────────────────┘
```

## Data Flow: Product Management

```
Client Request
     │
     ▼
┌─────────────────┐
│ ProductsController│
│ (POST /products)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ProductsService │
│ - Validate DTO  │
│ - Business Logic│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ProductsRepository│
│ - Prisma Query  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prisma Service  │
│ - PostgreSQL    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ ProductMapper   │
│ - Entity → DTO  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return Response │
│ - Product Entity│
└─────────────────┘
```

## Database Schema Relationships

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Company   │───────│ CompanyMember│───────│    User     │
│  (Tenant)   │ 1:N   │              │  N:1   │             │
└─────────────┘       └──────────────┘       └─────────────┘
       │                     │                       │
       │                     │                       │
       │ 1:N                 │ 1:N                   │ 1:N
       ▼                     ▼                       ▼
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Role      │◄──────│   UserRole   │       │   Session   │
│             │  N:1  │              │       │             │
└─────────────┘       └──────────────┘       └─────────────┘
       │
       │ N:M
       ▼
┌─────────────┐
│ Permission  │
└─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Product   │───────│    Stock    │───────│  Warehouse  │
│             │  N:1  │             │  N:1   │             │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                       │
       │ 1:N                 │ 1:N                   │ 1:N
       ▼                     ▼                       ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│StockMovement│       │StockMovement│       │StockMovement│
│             │       │             │       │             │
└─────────────┘       └─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│  Customer   │───────│CustomerGroup│
│             │  N:1  │             │
└─────────────┘       └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐
│CustomerAddr │
└─────────────┘

┌─────────────┐       ┌─────────────┐
│  Supplier   │───────│SupplierContact│
│             │  1:N  │              │
└─────────────┘       └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐
│SupplierAddr │
└─────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layer                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │   Helmet     │      │   CORS       │               │
│  │  (Headers)   │      │  Policy      │               │
│  └──────────────┘      └──────────────┘               │
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │ Rate Limiting│      │ Request ID   │               │
│  │  (Future)    │      │  Middleware  │               │
│  └──────────────┘      └──────────────┘               │
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │ JWT Auth     │      │  RBAC        │               │
│  │  Guard       │      │  Guard       │               │
│  └──────────────┘      └──────────────┘               │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │         JWT Token Structure             │         │
│  │  ┌──────────────────────────────────┐  │         │
│  │  │ {                                 │  │         │
│  │  │   "userId": "uuid",              │  │         │
│  │  │   "companyId": "uuid",           │  │         │
│  │  │   "roles": ["OWNER"],            │  │         │
│  │  │   "email": "user@example.com"    │  │         │
│  │  │ }                                 │  │         │
│  │  └──────────────────────────────────┘  │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Module Structure Pattern

```
src/modules/{module-name}/
├── {module-name}.module.ts      # Module definition
├── controllers/
│   └── {module}.controller.ts   # HTTP endpoints
├── services/
│   └── {module}.service.ts      # Business logic
├── repositories/
│   └── {module}.repository.ts   # Data access
├── dto/
│   ├── create-{module}.dto.ts   # Create validation
│   ├── update-{module}.dto.ts   # Update validation
│   └── {module}-query.dto.ts    # Query parameters
├── entities/
│   └── {module}.entity.ts       # Domain entity
├── mappers/                     # (Optional)
│   └── {module}.mapper.ts       # Entity ↔ DTO mapping
├── guards/                      # (Auth module)
│   └── {module}.guard.ts
├── strategies/                  # (Auth module)
│   └── {module}.strategy.ts
└── interfaces/
    └── {module}.interface.ts    # TypeScript interfaces
```

## Key Design Patterns

1. **Repository Pattern**: Abstract data access behind repository interfaces
2. **Dependency Injection**: NestJS DI container manages all dependencies
3. **Clean Architecture**: Separation of concerns (controllers, services, repositories)
4. **DTO Pattern**: Data Transfer Objects for API validation
5. **Entity Pattern**: Domain entities separate from database models
6. **Mapper Pattern**: Conversion between entities and DTOs
7. **Guard Pattern**: Authentication and authorization checks
8. **Middleware Pattern**: Cross-cutting concerns (request ID, logging)
9. **Strategy Pattern**: Pluggable authentication strategies
10. **Module Pattern**: Feature-based module organization

## Technology Stack Summary

**Backend Framework**: NestJS (Node.js/TypeScript)
**Database**: PostgreSQL with Prisma ORM
**Cache**: Redis (planned)
**Queue**: BullMQ (planned)
**Authentication**: JWT with refresh tokens
**API Documentation**: Swagger/OpenAPI
**Security**: Helmet, CORS, bcrypt
**Validation**: class-validator, class-transformer
**Containerization**: Docker, Docker Compose
**CI/CD**: GitHub Actions

## Multi-Tenancy Model

- **Shared Database, Shared Schema**: All companies share the same PostgreSQL database
- **Company Isolation**: Every table has a `companyId` foreign key
- **Row-Level Security**: All queries filtered by `companyId`
- **UUID Primary Keys**: Globally unique identifiers across all tenants
- **Soft Delete**: `deletedAt` timestamp for logical deletion
- **Audit Logging**: `AuditLog` table tracks all changes
