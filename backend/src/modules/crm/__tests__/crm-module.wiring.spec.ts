import 'reflect-metadata';
import { CrmModule } from '../crm.module';
import { CustomerAddressService } from '../services/customer-address.service';
import { CustomerCreditLedgerService } from '../services/customer-credit-ledger.service';
import { CustomerAddressRepository } from '../repositories/customer-address.repository';
import { CustomerCreditLedgerRepository } from '../repositories/customer-credit-ledger.repository';
import { CustomerCreditController } from '../controllers/customer-credit.controller';

/**
 * G11-F2 remediation (F2-6) — module wiring smoke test.
 *
 * The post-implementation audit found that the F2 implementation had
 * silently REPLACED CustomerAddressRepository with the new credit-ledger
 * providers in CrmModule — a DI regression invisible to the existing
 * suites (CustomerAddressService would fail to resolve at boot). This
 * smoke test pins the provider wiring so such a regression can never
 * recur silently.
 */
describe('CrmModule wiring (F2-6 smoke)', () => {
  const providers: Array<unknown> =
    Reflect.getMetadata('providers', CrmModule) ?? [];
  const controllers: Array<unknown> =
    Reflect.getMetadata('controllers', CrmModule) ?? [];
  const exports: Array<unknown> =
    Reflect.getMetadata('exports', CrmModule) ?? [];

  it('provides the CustomerAddress stack (F2-1 regression guard)', () => {
    expect(providers).toContain(CustomerAddressService);
    expect(providers).toContain(CustomerAddressRepository);
  });

  it('provides the customer credit ledger service + repository', () => {
    expect(providers).toContain(CustomerCreditLedgerService);
    expect(providers).toContain(CustomerCreditLedgerRepository);
  });

  it('exports CustomerCreditLedgerService for sales / sales-refund modules', () => {
    expect(exports).toContain(CustomerCreditLedgerService);
  });

  it('registers CustomerCreditController exactly once (no route duplication)', () => {
    expect(
      controllers.filter((c) => c === CustomerCreditController),
    ).toHaveLength(1);
  });
});
