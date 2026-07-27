# ADR-008: RBAC Authorization

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

StockFlow serves multiple companies with different organizational structures. A small company may have one user with full access; a large enterprise may have dozens of roles (Cashier, Accountant, Manager, Admin) with granular permissions per module.

## Problem

How should authorization work in StockFlow to support fine-grained, configurable, and auditable access control?

## Decision

**Role-Based Access Control (RBAC) with permission-level granularity, loaded from the database.**

**Architecture:**

```
User ──── UserRole ──── Role ──── RolePermission ──── Permission
   │                                                        │
   └──────────────────── JWT ───────────────────────────────┘
                         │
                    permissions: ['sales:create', 'sales:read', ...]
```

**Components:**

1. **Permission** — a string like `sales:create`, `finance:read`, `reports:read`
2. **Role** — a named collection of permissions (e.g., "Cashier", "Accountant")
3. **UserRole** — assigns a role to a user within a company
4. **JWT** — carries the user's permissions as an array at login

**Enforcement:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('finance:create')
@Post()
async create(@Body() dto: CreateDto, @CurrentUser() user: JwtPayload) {
  // user.permissions includes 'finance:create'
}
```

**Rules:**

1. **Every endpoint must be protected.** No unprotected endpoints in any module.
2. **JwtAuthGuard** validates the token exists and is valid.
3. **RolesGuard** checks that the user has the required permission.
4. **@RequirePermission() decorator** specifies the required permission(s).
5. **Permissions follow `<module>:<action>` convention**: `sales:create`, `purchasing:read`, `inventory:update`, `reports:read`.
6. **Permissions are loaded at login** and cached in the JWT — no database call per request.
7. **Company isolation** is enforced by the repository layer, not by RBAC.
8. **Super-admin** bypasses permission checks (reserved for system-level support).

**Permission matrix:**

| Module | create | read | update | delete | refund | cancel | shift | close |
|---|---|---|---|---|---|---|---|---|
| sales | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| purchasing | ✅ | ✅ | ✅ | ✅ | | | | |
| inventory | ✅ | ✅ | ✅ | ✅ | | | | |
| finance | ✅ | ✅ | ✅ | ✅ | | | | |
| reports | | ✅ | | | | | | |
| customers | ✅ | ✅ | ✅ | ✅ | | | | |
| suppliers | ✅ | ✅ | ✅ | ✅ | | | | |
| users | ✅ | ✅ | ✅ | ✅ | | | | |
| rbac | ✅ | ✅ | ✅ | ✅ | | | | |

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **ACL (Access Control Lists)** | Too granular for an ERP; every entity would need an ACL entry; maintenance nightmare |
| **ABAC (Attribute-Based)** | Over-engineering at current scale; useful for phase 2 (conditional access by warehouse, department) |
| **Hardcoded roles (admin/user only)** | Not flexible enough for enterprise customers |
| **Casbin** | External library adds complexity; not needed for current requirements |

## Consequences

**Positive:**
- Permissions are database-driven — configurable per tenant without code changes
- JWT caching means zero database calls per request for authorization
- Granular enough for enterprise requirements
- Self-service: companies can create their own roles

**Negative:**
- Role changes require re-login (JWT contains cached permissions)
- Permission checks add boilerplate to every endpoint
- Complex permission queries require optimization (eager-load roles on login)

**Neutral:**
- Permission names follow a consistent convention
- RBAC can be extended to ABAC without breaking changes

## Future Considerations

- **ABAC extensions** — add warehouse-scoped permissions (e.g., `sales:create:warehouse-123`)
- **Permission inheritance** — `module:*` grants all actions on a module
- **Temporary permissions** — time-bound role assignments for shift-based access
- **API key permissions** — for external integrations
