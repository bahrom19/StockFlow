import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/purchasing/presentation/screens/purchase_order_form_screen.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

/// CURRENCY-4 — Purchase Order form currency gating.
///
/// New / DRAFT orders allow choosing the currency; a non-DRAFT order locks
/// the CurrencySelector read-only (backend freezes PO currency after DRAFT).
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> pumpForm(
    WidgetTester tester, {
    PurchaseOrder? initial,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          suppliersRepositoryProvider.overrideWith(
            (ref) => _FakeSuppliersRepository(ref),
          ),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: CurrencyScope(
            code: 'KZT',
            child: PurchaseOrderFormScreen(initial: initial),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  DropdownButton<String> currencyDropdown(WidgetTester tester) =>
      tester.widget<DropdownButton<String>>(
        find.descendant(
          of: find.byKey(const Key('currency_selector')),
          matching: find.byType(DropdownButton<String>),
        ),
      );

  testWidgets('new order: currency selector is editable',
      (tester) async {
    await pumpForm(tester);
    expect(currencyDropdown(tester).onChanged, isNotNull);
  });

  testWidgets('non-DRAFT order: currency selector is read-only',
      (tester) async {
    final approved = PurchaseOrder(
      id: 'po-1',
      companyId: 'c-1',
      supplierId: 's-1',
      orderNumber: 'PO-0001',
      orderDate: DateTime(2026, 7, 26),
      currency: 'USD',
      status: 'APPROVED',
      subtotal: '100.0000',
      discountAmount: '0.0000',
      taxAmount: '0.0000',
      grandTotal: '100.0000',
      paidAmount: '0.0000',
      createdAt: DateTime(2026, 7, 26),
      updatedAt: DateTime(2026, 7, 26),
    );
    await pumpForm(tester, initial: approved);
    final dropdown = currencyDropdown(tester);
    // Read-only: no onChanged callback AND the loaded USD value is kept.
    expect(dropdown.onChanged, isNull);
    expect(dropdown.value, 'USD');
  });
}

/// Suppliers repository double — the form loads suppliers in initState; the
/// currency gating tests do not depend on the (empty) supplier list.
class _FakeSuppliersRepository extends SuppliersRepository {
  _FakeSuppliersRepository(Ref ref)
      : super(ApiClient(tokenStorage: TokenStorage()), ref);

  @override
  Future<SuppliersResult<SupplierListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    return SuppliersSuccess<SupplierListResponse>(
      SupplierListResponse(items: const [], total: 0, page: 1, limit: limit),
    );
  }
}
