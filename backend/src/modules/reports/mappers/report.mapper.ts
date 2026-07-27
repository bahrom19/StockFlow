/**
 * Reports are read-only aggregations from Prisma.
 * All Decimal → string conversion is handled inline in the service layer
 * using Prisma.Decimal arithmetic and .toString().
 *
 * No entity mapping is required since reports don't map to a single DB model.
 */
export class ReportMapper {}
