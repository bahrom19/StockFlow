# StockFlow Enterprise — Project Rules

## Purpose

These rules define mandatory standards for the StockFlow Enterprise project.

Every developer and AI assistant must follow these rules.

Breaking these rules requires explicit approval.

---

# 1. Architecture

* Follow Modular Monolith architecture.
* Follow Domain-Driven Design (DDD).
* Follow Clean Architecture.
* Respect module boundaries.
* Do not introduce unnecessary dependencies.

---

# 2. Code Quality

Always write production-ready code.

Never write temporary solutions.

Never generate placeholder implementations unless explicitly requested.

Avoid duplicated code.

Prefer maintainability over cleverness.

---

# 3. TypeScript

Mandatory:

* strict mode
* explicit types
* readonly where appropriate

Forbidden:

* any
* @ts-ignore
* eslint-disable without explanation

---

# 4. NestJS

Each module must contain:

* controller
* service
* repository
* dto
* entities
* interfaces
* tests

Controllers must remain thin.

Business logic belongs in services.

Database access belongs in repositories.

---

# 5. Database

Use Prisma ORM.

Always create migrations.

Never modify production schemas manually.

Use:

* UUID
* indexes
* foreign keys
* timestamps

Support soft delete where appropriate.

---

# 6. Multi-Tenant

Every business entity must support multi-company architecture.

Never expose data between companies.

Always filter by company context.

---

# 7. Security

Passwords:

* bcrypt hashing only

Authentication:

* JWT Access Token
* Refresh Token

Authorization:

* RBAC

Never store secrets in source code.

Never commit .env files.

---

# 8. API

Every endpoint must include:

* DTO validation
* Swagger documentation
* proper HTTP status codes
* error handling

API changes should preserve backward compatibility whenever possible.

---

# 9. Logging

Log:

* authentication
* sales
* inventory changes
* finance operations
* critical errors

Never log passwords, tokens or sensitive personal information.

---

# 10. Testing

Business logic requires unit tests.

Critical workflows require integration tests.

New features should not reduce overall code quality.

---

# 11. Performance

Avoid N+1 queries.

Use pagination for large datasets.

Use transactions for critical operations.

Optimize only after measuring performance.

---

# 12. Git Workflow

Use Conventional Commits.

Examples:

feat:
fix:
refactor:
docs:
test:
chore:

Every commit should represent one logical change.

---

# 13. Documentation

Every public API must be documented.

Complex business rules must be explained.

Keep documentation synchronized with implementation.

---

# 14. AI Usage

AI may assist with development.

AI must not introduce architectural changes without review.

AI-generated code must be reviewed before merging.

---

# 15. Product Principles

StockFlow is a commercial SaaS product.

Every decision should prioritize:

* reliability
* scalability
* security
* maintainability
* user experience

Avoid shortcuts that create technical debt.

---

# Golden Rule

If there are multiple valid solutions, always choose the one that:

* is easier to maintain
* scales better
* is safer
* follows the project architecture
* improves long-term quality
