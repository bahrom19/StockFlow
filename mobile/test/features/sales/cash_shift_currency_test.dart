import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/features/sales/data/cash_shift_repository.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';

/// CURRENCY-4 — Cash Shift currency + POS ↔ Cash Shift synchronization.
///
/// The active CashShift is the source of truth for the POS currency: when a
/// shift becomes current, [currencyProvider] is re-aligned to the shift
/// currency so `Sale.currency == CashShift.currency` holds without a manual
/// per-sale selection (the backend enforces this invariant).
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('CashShift model currency', () {
    Map<String, dynamic> baseShiftJson([String? currency]) => {
          'id': 'shift-1',
          'companyId': 'c-1',
          'warehouseId': 'w-1',
          'cashierId': 'u-1',
          'status': 'OPEN',
          if (currency != null) 'currency': currency,
          'openedAt': '2026-07-26T10:00:00Z',
          'openingBalance': '10000.0000',
        };

    test('fromJson defaults to KZT when currency is missing', () {
      final shift = CashShift.fromJson(baseShiftJson());
      expect(shift.currency, 'KZT');
    });

    test('fromJson parses USD currency', () {
      final shift = CashShift.fromJson(baseShiftJson('USD'));
      expect(shift.currency, 'USD');
    });
  });

  group('OpenShiftRequest currency', () {
    test('defaults to KZT', () {
      final req = OpenShiftRequest(warehouseId: 'w-1', openingBalance: 1000);
      expect(req.currency, 'KZT');
      expect(req.toJson()['currency'], 'KZT');
    });

    test('USD payload travels in toJson', () {
      final req = OpenShiftRequest(
        warehouseId: 'w-1',
        openingBalance: 1000,
        currency: 'USD',
      );
      expect(req.toJson()['currency'], 'USD');
    });
  });

  group('POS ↔ Cash Shift currency sync', () {
    testWidgets('USD shift → POS currency becomes USD', (tester) async {
      final container = ProviderContainer(
        overrides: [
          cashShiftRepositoryProvider.overrideWith(
            (ref) => _FakeShiftRepo(
              ref,
              CashShift(
                id: 'shift-1',
                companyId: 'c-1',
                warehouseId: 'w-1',
                cashierId: 'u-1',
                status: 'OPEN',
                currency: 'USD',
                openedAt: DateTime(2026, 7, 26, 10),
              ),
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(cashShiftProvider.notifier).loadShift('w-1');
      // Flush the unawaited currencyProvider update.
      await tester.pump(const Duration(milliseconds: 20));

      expect(container.read(currencyProvider), 'USD');
    });

    testWidgets('KZT shift → POS currency becomes KZT', (tester) async {
      final container = ProviderContainer(
        overrides: [
          cashShiftRepositoryProvider.overrideWith(
            (ref) => _FakeShiftRepo(
              ref,
              CashShift(
                id: 'shift-1',
                companyId: 'c-1',
                warehouseId: 'w-1',
                cashierId: 'u-1',
                status: 'OPEN',
                currency: 'KZT',
                openedAt: DateTime(2026, 7, 26, 10),
              ),
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      // Start from a foreign currency — the shift is the source of truth.
      await container.read(currencyProvider.notifier).setCurrency('USD');

      await container.read(cashShiftProvider.notifier).loadShift('w-1');
      await tester.pump(const Duration(milliseconds: 20));

      expect(container.read(currencyProvider), 'KZT');
    });
  });
}

class _FakeShiftRepo extends CashShiftRepository {
  _FakeShiftRepo(Ref ref, this._next) : super(ref);

  final CashShift _next;

  @override
  Future<ShiftResult<CashShift>> getXReport({
    required String warehouseId,
  }) async {
    return ShiftSuccess<CashShift>(_next);
  }
}
