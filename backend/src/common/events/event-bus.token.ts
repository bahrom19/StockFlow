/**
 * NestJS injection token for the {@code EventBus} interface.
 *
 * Because TypeScript interfaces do not exist at runtime, NestJS
 * cannot use {@code EventBus} directly as a provider token.
 * This constant bridges the gap — use it with {@code @Inject()}
 * or in module provider/exports arrays:
 *
 * ```ts
 * @Inject(EVENT_BUS) private readonly eventBus: EventBus
 * ```
 */
export const EVENT_BUS = Symbol('EVENT_BUS');
