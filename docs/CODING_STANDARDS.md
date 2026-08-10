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

---

# Flutter Web Semantics

When non-interactive text sits beside an interactive CTA/action inside the
same Row/Column, Flutter Web may hoist the text into a role="group"
aria-label, hiding it from document.body.innerText.

* Wrap the text block in a label-less Semantics(container: true) boundary.
* Keep the CTA as a separate sibling semantics node (still tappable).
* Add the boundary only when needed — not for whole-card InkWell/Material
  rows or components without interactive children.

Full rule, examples and testing guidance:
docs/ux/flutter_web_semantics_guideline.md
