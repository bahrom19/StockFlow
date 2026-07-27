# GitHub Copilot Instructions for StockFlow Enterprise

## Project Goal

You are contributing to **StockFlow Enterprise**, a production-grade SaaS ERP platform for retail, inventory management, POS, finance, CRM, analytics and AI.

The project is intended for commercial use. Every piece of code must be production-ready.

---

# Architecture

Always follow:

* Modular Monolith
* Domain-Driven Design (DDD)
* Clean Architecture
* SOLID Principles
* Repository Pattern
* Dependency Injection

Never break module boundaries.

---

# Backend Stack

* NestJS
* TypeScript
* Prisma ORM
* PostgreSQL
* Redis
* BullMQ
* Swagger

---

# Frontend Stack

* Flutter
* Riverpod
* GoRouter
* Dio

---

# General Rules

Always generate:

* clean code
* readable code
* scalable code
* testable code

Avoid quick hacks.

Avoid duplicated code.

Avoid unnecessary complexity.

---

# TypeScript

Always use:

* strict mode
* explicit typing
* interfaces
* enums when appropriate

Never use:

* any
* @ts-ignore
* non-null assertions unless absolutely necessary

---

# NestJS

Each business module should contain:

* controller
* service
* repository
* dto
* entities
* interfaces
* tests

Use constructor dependency injection.

Keep controllers thin.

Business logic belongs in services.

Database access belongs in repositories.

---

# API

Every endpoint must have:

* Swagger decorators
* DTO validation
* proper HTTP status codes
* error handling

---

# Validation

Always use:

* class-validator
* class-transformer

Never trust client input.

---

# Database

Use:

* UUID primary keys
* timestamps
* soft delete where appropriate
* indexes
* foreign keys

Never generate raw SQL unless explicitly requested.

---

# Security

Always:

* hash passwords with bcrypt
* validate JWT
* sanitize input
* use RBAC
* protect sensitive endpoints

Never store plain text passwords.

---

# Logging

Use centralized logging.

Log important business events.

Do not log passwords or secrets.

---

# Error Handling

Never throw raw Error.

Use NestJS exceptions.

Return meaningful messages.

---

# Documentation

Document public classes and complex business logic.

Explain WHY, not WHAT.

---

# Testing

Generate unit tests for business logic.

Critical modules should also have integration tests.

---

# Performance

Prefer readability first.

Optimize only when necessary.

Avoid N+1 queries.

Use pagination.

---

# AI Assistant

AI features must be isolated from core business logic.

Do not couple AI with inventory, sales or finance modules.

---

# Code Quality

Every generated code should be suitable for production.

If multiple solutions exist, prefer the one that is:

* simpler
* safer
* more maintainable
* easier to extend

Never sacrifice architecture for speed.
