# Coding Standards

## General Rules

* TypeScript Strict Mode
* No `any`
* ESLint without warnings
* Prettier formatting

---

# Naming

Classes:

* PascalCase

Variables:

* camelCase

Constants:

* UPPER_CASE

Files:

* kebab-case

---

# NestJS

Every module contains:

* controller
* service
* repository
* dto
* entities
* interfaces

---

# Error Handling

Never throw raw Error.

Use custom exceptions.

---

# Logging

Every request must be logged.

Critical actions must be audited.

---

# Testing

Every business module must contain unit tests.

---

# Comments

Explain WHY, not WHAT.
