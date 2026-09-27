import { Test } from '@nestjs/testing';
import { AuthModule } from '../auth.module';
import { AuthService } from '../services/auth.service';
import { FiscalCalendarService } from '../../finance/services/fiscal-calendar.service';
import { AppConfigModule } from '../../../common/config/config.module';
import { EventBusModule } from '../../../common/events';
import { IdempotencyModule } from '../../../infrastructure/idempotency';
import { RbacModule } from '../../rbac/rbac.module';

/**
 * PRE-G1-P1-01 regression test.
 *
 * AuthService injects FiscalCalendarService (constructor index 6), which is
 * provided by FinanceModule. Before the fix AuthModule did not import
 * FinanceModule, so compiling the module failed with:
 *   UnknownDependenciesException
 *   "... the argument FiscalCalendarService at index [6] is available in the
 *    AuthModule module".
 *
 * No provider is mocked for FiscalCalendarService: if AuthModule no longer
 * resolves it, `.compile()` throws instead of passing.
 */
describe('PRE-G1-P1-01 AuthModule DI', () => {
  it('compiles without an UnknownDependenciesException', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        AppConfigModule,
        EventBusModule,
        IdempotencyModule,
        RbacModule,
      ],
    }).compile();

    expect(moduleRef).toBeDefined();

    await moduleRef.close();
  });

  it('injects the real FiscalCalendarService into AuthService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        AppConfigModule,
        EventBusModule,
        IdempotencyModule,
        RbacModule,
      ],
    }).compile();

    const authService = moduleRef.get(AuthService);
    const calendarService = (
      authService as unknown as {
        calendarService: FiscalCalendarService;
      }
    ).calendarService;

    expect(calendarService).toBeInstanceOf(FiscalCalendarService);

    await moduleRef.close();
  });
});
