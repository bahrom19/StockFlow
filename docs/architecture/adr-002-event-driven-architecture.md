# ADR-002: Event-Driven Architecture

**Status**: Accepted  
**Date**: 2026-07-25  
**Author**: Lead ERP Architect  
**Deciders**: Architecture Team  

---

## Context

StockFlow modules (Sales, Finance, Inventory, Purchasing) need to react to state changes in other modules. The initial implementation used direct service injection (SalesService calling FinanceIntegrationService directly), creating tight coupling that prevented independent module evolution.

## Problem

How should modules communicate without creating coupling? How should cross-domain workflows (e.g., a completed sale generating journal entries and decreasing inventory) be orchestrated?

## Decision

Modules communicate exclusively through an **in-process Domain Event Bus**.

```
SalesService                     FinanceModule
  │                                  │
  │  publish(SaleCompletedEvent)     │
  ├────────────────────────────────► │
  │                                  │
  │         EventBus                 │
  │    (InMemoryEventBus)            │
  │                                  │
  │  subscribe('sale.completed')     │
  │                                  │
  │         SaleCompletedEventHandler
```

**Architecture:**

1. **DomainEvent interface** — every event has `eventName`, `eventId`, `occurredOn`, and a typed `payload`
2. **EventBus interface** — `publish(event, options?)` and `subscribe(eventName, handler)`
3. **InMemoryEventBus** — synchronous in-process implementation; no network overhead
4. **EVENT_BUS injection token** — a `Symbol` used because TypeScript interfaces cannot be NestJS providers
5. **@Global() EventBusModule** — provides the bus to all modules without explicit imports
6. **Handlers are NestJS providers** registered via `OnModuleInit.subscribe()`
7. **Transaction context** passed through `PublishOptions.context.transactionClient` so handlers run inside the originating Prisma transaction
8. **Errors propagate** — the InMemoryEventBus has no try/catch; handler errors bubble up and trigger transaction rollback

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| **Direct service injection** (Sales → Finance) | Creates coupling; violates module independence |
| **RabbitMQ / Kafka** | Over-engineering at current scale; introduces network latency and serialization overhead |
| **NestJS EventEmitter** | Built-in but not designed for domain events; no structured payload, no event metadata |
| **Message bus as a Library** (e.g., @nestjs/cqrs) | Adds opinionated CQRS constraints; reduces flexibility |
| **Webhooks** | Only needed for external integrations, not internal module communication |

## Consequences

**Positive:**
- Modules are fully decoupled — Sales knows nothing about Finance
- Adding new subscribers requires zero changes to publishers
- Future outbox pattern can be swapped without changing business code
- Transactional consistency: events fire inside the same Prisma transaction as the business operation

**Negative:**
- Synchronous in-process: handlers add latency to the originating HTTP request
- Error propagation: one failing handler rolls back the entire transaction (mitigated by handlers catching non-critical errors internally)
- Debugging: event flows are indirect, requiring tracing tools

**Neutral:**
- Handlers must be idempotent (same event delivered twice → same result)
- Event schemas must be versioned for backward compatibility

## Future Considerations

- **Outbox pattern**: Replace InMemoryEventBus with OutboxEventBus that writes events to an outbox table within the same transaction. An OutboxRelayService polls the table and dispatches to RabbitMQ/Kafka.
- **Distributed bus**: Replace InMemoryEventBus with a message-bridge that serializes events to Kafka topics.
- **Event sourcing**: The DomainEvent structure is compatible with event sourcing if needed in the future.
- **CloudEvents standard**: For inter-service communication, adopt CNCF CloudEvents specification.
