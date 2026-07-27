# StockFlow Enterprise — Security Guide

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** Security Team  

---

## 1. Security Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  API Gateway  │────▶│  Application  │
│   (HTTPS)    │     │  (TLS 1.3)   │     │  (Helmet)     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                 ▼
                                          ┌──────────────┐
                                          │  PostgreSQL   │
                                          │  (Encrypted)  │
                                          └──────────────┘
```

- **TLS**: All traffic encrypted (TLS 1.3 minimum)
- **Application**: Helmet security headers, CSP, HSTS
- **Database**: Encrypted at rest (AES-256), encrypted in transit (TLS)
- **Redis**: Password-protected, isolated network
- **Secrets**: GitHub Secrets / Vault

---

## 2. Authentication

### 2.1 JWT Authentication

| Setting | Value |
|---------|-------|
| Algorithm | RS256 (preferred) / HS256 |
| Token expiry | 15 minutes (access) |
| Refresh token expiry | 7 days |
| Min secret length | 32 characters |
| Token storage | HTTP-only secure cookies (preferred) / Authorization header |

### 2.2 Password Policy

| Requirement | Value |
|-------------|-------|
| Minimum length | 12 characters |
| Complexity | Upper + lower + digit + special char |
| Hash algorithm | bcrypt (cost factor 12) |
| Max login attempts | 5 before rate limit |
| Account lockout | 15 minutes after 5 failed attempts |
| Password expiry | 90 days |
| Password history | 5 previous passwords |

### 2.3 Rate Limiting

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| `/api/auth/login` | 10 req/min | 20 |
| `/api/auth/register` | 3 req/min | 5 |
| All other endpoints | 200 req/min | 300 |
| Report endpoints | 30 req/min | 50 |

---

## 3. Authorization (RBAC)

### 3.1 Permission Groups

| Group | Permissions |
|-------|-------------|
| `admin` | All permissions |
| `manager` | Read all, write most (excluding financial close) |
| `cashier` | Sales CRUD, customer read |
| `accountant` | Finance CRUD, report read |
| `viewer` | Read-only |

### 3.2 Permission Mapping

Each endpoint is protected by `@RequirePermission('module:action')`:

```typescript
@Post()
@RequirePermission('sales:create')
@UseGuards(JwtAuthGuard, RolesGuard)
async create(@Body() dto: CreateSaleDto): Promise<SaleEntity> {
  // ...
}
```

---

## 4. Network Security

### 4.1 Security Headers (Helmet)

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'` | Prevent XSS |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Restrict APIs |

### 4.2 CORS

```typescript
app.enableCors({
  origin: isProduction
    ? ['https://stockflow.example.com', 'https://admin.stockflow.example.com']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
  exposedHeaders: ['x-request-id'],
  maxAge: 86400,
});
```

---

## 5. API Security

### 5.1 Input Validation

- All DTOs validated with `class-validator`
- No raw SQL (Prisma ORM prevents injection)
- File upload: size limit (10MB), type validation
- JSON parsing: size limit (1MB)

### 5.2 Output Security

- No stack traces in production responses
- Consistent error format (no information leakage)
- Decimal values serialized as strings
- Sensitive fields excluded from responses (password hashes, tokens)

### 5.3 Rate Limiting

```typescript
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,  // 1 second
    limit: 10,   // 10 requests
  },
  {
    name: 'long',
    ttl: 60000, // 1 minute
    limit: 200,  // 200 requests
  },
]);
```

---

## 6. Database Security

### 6.1 Connection Security

- TLS required for all database connections
- Connection pooling via PgBouncer (transaction mode)
- Read-only users for reporting/analytics
- Connection limits per application instance

### 6.2 Data Protection

- Passwords: bcrypt (cost 12)
- PII: Consider field-level encryption
- Multi-tenancy: `companyId` filter on every query
- Soft delete: `deletedAt` on all entities
- Audit log: Immutable record of all mutations

---

## 7. Secrets Management

### 7.1 Secret Storage

| Secret | Location | Rotation |
|--------|----------|----------|
| `DATABASE_URL` | GitHub Secret | 180 days |
| `JWT_SECRET` | GitHub Secret | 90 days |
| `JWT_REFRESH_SECRET` | GitHub Secret | 90 days |
| `REDIS_URL` | GitHub Secret | 180 days |
| `ENCRYPTION_KEY` | GitHub Secret | 365 days |

### 7.2 Secret Rotation Process

```bash
# 1. Generate new secret
openssl rand -base64 32 > new_secret.txt

# 2. Update GitHub Secret
gh secret set JWT_SECRET < new_secret.txt

# 3. Restart application
kubectl rollout restart deployment/stockflow-backend -n stockflow-production
```

---

## 8. Container Security

### 8.1 Docker Security

- Non-root user (`appuser`)
- Minimal base image (`alpine:3.21`)
- No build tools in production image
- Read-only root filesystem compatible
- Image signed with cosign
- Regular Trivy scanning in CI

### 8.2 Image Scanning

```bash
# Local scan
trivy image ghcr.io/stockflow/backend:latest

# CI scan (automated)
trivy image --severity CRITICAL,HIGH \
  --exit-code 1 \
  ghcr.io/stockflow/backend:$TAG
```

---

## 9. Dependency Security

### 9.1 Automated Scanning

- **npm audit**: Runs in CI (fails on critical)
- **Dependabot**: Weekly automated PRs for minor/patch updates
- **SBOM**: CycloneDX generation per build
- **License checker**: MIT, Apache-2.0, BSD, ISC only

### 9.2 Vulnerability Response

| Severity | Response Time | Action |
|----------|---------------|--------|
| Critical | 24 hours | Immediate patch |
| High | 72 hours | Patch within week |
| Medium | 14 days | Patch within sprint |
| Low | Next release | Defer or suppress |

---

## 10. Audit Logging

Every mutation creates an audit log entry:

```typescript
{
  id: "uuid",
  companyId: "uuid",
  userId: "uuid",
  entityType: "Sale",
  entityId: "uuid",
  action: "CREATE",
  before: { status: "DRAFT" },  // null for CREATE
  after: { status: "COMPLETED" },
  timestamp: "2026-07-26T14:30:00.000Z",
  requestId: "uuid"
}
```

---

## 11. Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR | Partial | PII audit required |
| SOC 2 | Planned | Audit log enables evidence |
| SOX | Planned | Financial controls needed |
| PCI DSS | N/A | No card processing (third-party) |
| ISO 27001 | Planned | ISMS documentation needed |
| Kazakhstan Accounting | Planned | Localization v2.0 |
