import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_contact_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_address_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_product_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';
import 'package:stockflow/features/suppliers/presentation/screens/supplier_detail_screen.dart';

/// G2 — SupplierDetailScreen widget/regression tests.
///
/// Read-only coverage of the production screen (no production changes):
///  * loading state (spinner before the parallel fetch completes)
///  * successful render: header, contacts, addresses, finance summary,
///    purchase analytics, reliability, order pipeline, products
///  * error state + retry recovery
const _supplierId = 'sup-1';

Supplier _supplierFixture() => Supplier(
      id: _supplierId,
      companyId: 'comp-1',
      companyName: 'Alpha Supply',
      bin: 'BIN12345',
      email: 'alpha@example.com',
      phone: '+77001234567',
      website: 'https://alpha.example',
      notes: 'Main vendor',
      isActive: true,
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
    );

SupplierContact _contactFixture() => SupplierContact(
      id: 'contact-1',
      supplierId: _supplierId,
      firstName: 'Anna',
      lastName: 'Seller',
      phone: '+77005556677',
      email: 'anna@alpha.example',
      position: 'Sales manager',
      isPrimary: true,
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
    );

SupplierAddress _addressFixture() => SupplierAddress(
      id: 'addr-1',
      supplierId: _supplierId,
      street: 'Abay Ave 1',
      city: 'Almaty',
      country: 'Kazakhstan',
      postalCode: '050000',
      isDefault: true,
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
    );

SupplierFinanceSummary _financeSummaryFixture() => const SupplierFinanceSummary(
      supplierId: _supplierId,
      totalInvoiced: '550000',
      totalPaid: '300000',
      totalReturned: '50000',
      outstanding: '200000',
      invoiceCount: 4,
      paymentCount: 3,
    );

SupplierPayment _paymentFixture() => SupplierPayment(
      id: 'pay-1',
      companyId: 'comp-1',
      supplierId: _supplierId,
      purchaseInvoiceId: 'inv-1',
      paymentNumber: 'SP-0001',
      paymentDate: DateTime(2026, 2, 1),
      amount: '100000',
      method: 'BANK_TRANSFER',
      currency: 'KZT',
      createdAt: DateTime(2026, 2, 1),
      updatedAt: DateTime(2026, 2, 1),
    );

SupplierProduct _supplierProductFixture() => SupplierProduct(
      id: 'sp-1',
      companyId: 'comp-1',
      supplierId: _supplierId,
      productId: 'prod-1',
      supplierSku: 'ALPHA-MLK',
      purchasePrice: '2000',
      currency: 'KZT',
      isPreferred: true,
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
      product: const SupplierProductProduct(
          id: 'prod-1', name: 'Milk 1L', sku: 'MLK-001'),
    );

SupplierPurchaseSummary _purchaseSummaryFixture() =>
    const SupplierPurchaseSummary(
      dateFrom: '2026-01-01',
      dateTo: '2026-09-01',
      totalInvoiced: '500000',
      totalReturned: '50000',
      netPurchaseSpend: '450000',
      totalPurchasedQuantity: 250,
      weightedAverageUnitCost: '2000',
      invoiceCount: 5,
      returnCount: 1,
      currentTotalPaid: '300000',
      currentOutstanding: '150000',
      monthlySpend: [MonthlySpend(month: '2026-01', amount: '500000')],
    );

SupplierReliability _reliabilityFixture() => const SupplierReliability(
      dateFrom: '2026-01-01',
      dateTo: '2026-09-01',
      totalOrders: 10,
      totalReceipts: 8,
      onTimeDeliveryRate: 87.5,
      averageLeadTimeDays: 5.2,
      minLeadTimeDays: 2,
      maxLeadTimeDays: 12,
      ordersReceived: 8,
      ordersPartiallyReceived: 0,
      ordersCancelled: 2,
      cancellationRate: 20,
    );

SupplierPaymentAging _paymentAgingFixture() => const SupplierPaymentAging(
      totalOutstanding: '150000',
      aging: PaymentAgingBuckets(
        current: '100000',
        days1To30: '50000',
        days31To60: '0',
        days61To90: '0',
        overdue90Plus: '0',
      ),
      invoiceCount: 4,
      overdueCount: 1,
    );

SupplierReturnSummary _returnSummaryFixture() => const SupplierReturnSummary(
      dateFrom: '2026-01-01',
      dateTo: '2026-09-01',
      totalReturnedAmount: '50000',
      totalReturnedQuantity: 10,
      returnCount: 1,
      totalPurchaseSpend: '500000',
      totalPurchasedQuantity: 250,
      amountReturnRate: 10.0,
      quantityReturnRate: 4.0,
    );

SupplierPerformance _performanceFixture() => const SupplierPerformance(
      dateFrom: '2026-01-01',
      dateTo: '2026-09-01',
      purchase: PurchasePerformance(
          netPurchaseSpend: '450000', totalPurchasedQuantity: 250, invoiceCount: 5),
      delivery: DeliveryPerformance(
          onTimeDeliveryRate: 87.5, averageLeadTimeDays: 5.2, cancellationRate: 20),
      returns: ReturnPerformance(
          amountReturnRate: 10.0, quantityReturnRate: 4.0, returnCount: 1),
      financialRisk: FinancialRisk(
          totalOutstanding: '150000', overdueCount: 1, overdue90plus: '0'),
    );

SupplierOrderPipeline _orderPipelineFixture() => SupplierOrderPipeline(
      dateFrom: '2026-01-01',
      dateTo: '2026-09-01',
      summary: const OrderPipelineSummary(
        totalOrders: 10,
        totalOrderValue: '5000000',
        draftCount: 1,
        pendingCount: 1,
        approvedCount: 1,
        orderedCount: 5,
        partiallyReceivedCount: 1,
        receivedCount: 0,
        cancelledCount: 1,
      ),
      recentOrders: [
        RecentOrder(
          orderId: 'po-1',
          orderNumber: 'PO-1001',
          orderDate: DateTime(2026, 8, 1).toIso8601String(),
          status: 'ORDERED',
          grandTotal: '500000',
        ),
      ],
    );

class _FakeSuppliersRepo extends SuppliersRepository {
  _FakeSuppliersRepo(super.api, super.ref);

  final List<String> calls = [];
  bool getByIdFails = false;
  Duration? getByIdDelay;

  SuppliersResult<T> _success<T>(T data) => SuppliersSuccess<T>(data);
  SuppliersResult<T> _failure<T>() =>
      SuppliersFailure<T>(const ServerFailure(message: 'backend exploded'));

  @override
  Future<SuppliersResult<Supplier>> getById(String id) async {
    calls.add('getById');
    if (getByIdDelay != null) {
      await Future<void>.delayed(getByIdDelay!);
    }
    return getByIdFails ? _failure<Supplier>() : _success(_supplierFixture());
  }

  @override
  Future<SuppliersResult<List<SupplierContact>>> getContacts(
      String supplierId) async {
    calls.add('getContacts');
    return _success<List<SupplierContact>>([_contactFixture()]);
  }

  @override
  Future<SuppliersResult<List<SupplierAddress>>> getAddresses(
      String supplierId) async {
    calls.add('getAddresses');
    return _success<List<SupplierAddress>>([_addressFixture()]);
  }

  @override
  Future<SuppliersResult<SupplierFinanceSummary>> getFinanceSummary(
      String supplierId) async {
    calls.add('getFinanceSummary');
    return _success<SupplierFinanceSummary>(_financeSummaryFixture());
  }

  @override
  Future<SuppliersResult<SupplierPaymentListResponse>> getPayments(
      String supplierId, {int page = 1, int limit = 20}) async {
    calls.add('getPayments');
    return _success<SupplierPaymentListResponse>(SupplierPaymentListResponse(
      items: [_paymentFixture()],
      total: 1,
      page: page,
      limit: limit,
    ));
  }

  @override
  Future<SuppliersResult<SupplierProductListResponse>> getSupplierProducts(
      String supplierId, {int page = 1, int limit = 20, String? search, bool? isPreferred}) async {
    calls.add('getSupplierProducts');
    return _success<SupplierProductListResponse>(SupplierProductListResponse(
      items: [_supplierProductFixture()],
      total: 1,
      page: page,
      limit: limit,
    ));
  }

  @override
  Future<SuppliersResult<SupplierPurchaseSummary>> getPurchaseSummary(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    calls.add('getPurchaseSummary');
    return _success<SupplierPurchaseSummary>(_purchaseSummaryFixture());
  }

  @override
  Future<SuppliersResult<ProductPurchaseListResponse>> getProductPurchases(
      String supplierId, {String? dateFrom, String? dateTo, int page = 1, int limit = 20, String? search, String sortBy = 'totalPurchaseSpend', String sortOrder = 'desc'}) async {
    calls.add('getProductPurchases');
    return _success<ProductPurchaseListResponse>(ProductPurchaseListResponse(
      items: [
        const ProductPurchaseDetail(
          productId: 'prod-1',
          productName: 'Milk 1L',
          sku: 'MLK-001',
          totalPurchasedQuantity: 250,
          totalPurchaseSpend: '500000',
          weightedAverageUnitCost: '2000',
          minUnitCost: '1800',
          maxUnitCost: '2200',
          totalReturnedQuantity: 10,
          totalReturnedSpend: '50000',
          netPurchasedQuantity: 240,
          netPurchaseSpend: '450000',
          invoiceCount: 5,
        ),
      ],
      total: 1,
      page: page,
      limit: limit,
    ));
  }

  @override
  Future<SuppliersResult<SupplierReliability>> getReliability(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    calls.add('getReliability');
    return _success<SupplierReliability>(_reliabilityFixture());
  }

  @override
  Future<SuppliersResult<SupplierPaymentAging>> getPaymentAging(
      String supplierId) async {
    calls.add('getPaymentAging');
    return _success<SupplierPaymentAging>(_paymentAgingFixture());
  }

  @override
  Future<SuppliersResult<SupplierReturnSummary>> getReturnSummary(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    calls.add('getReturnSummary');
    return _success<SupplierReturnSummary>(_returnSummaryFixture());
  }

  @override
  Future<SuppliersResult<SupplierPerformance>> getPerformance(
      String supplierId, {String? dateFrom, String? dateTo}) async {
    calls.add('getPerformance');
    return _success<SupplierPerformance>(_performanceFixture());
  }

  @override
  Future<SuppliersResult<SupplierOrderPipeline>> getOrderPipeline(
      String supplierId, {String? dateFrom, String? dateTo, String? status}) async {
    calls.add('getOrderPipeline');
    return _success<SupplierOrderPipeline>(_orderPipelineFixture());
  }
}

Future<_FakeSuppliersRepo> _pumpDetail(
  WidgetTester tester, {
  bool getByIdFails = false,
  Duration? getByIdDelay,
}) async {
  tester.view.physicalSize = const Size(900, 2600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  final api = ApiClient(tokenStorage: TokenStorage());
  final router = GoRouter(
    initialLocation: '/detail',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(body: SizedBox.shrink()),
        routes: [
          GoRoute(
            path: 'detail',
            builder: (context, state) =>
                const SupplierDetailScreen(supplierId: _supplierId),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        suppliersRepositoryProvider.overrideWith((ref) =>
            _FakeSuppliersRepo(api, ref)
              ..getByIdFails = getByIdFails
              ..getByIdDelay = getByIdDelay),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pump(); // first frame — loading state
  final ctx = tester.element(find.byType(SupplierDetailScreen));
  return ProviderScope.containerOf(ctx)
      .read(suppliersRepositoryProvider) as _FakeSuppliersRepo;
}

void main() {
  testWidgets('shows a loading spinner while detail data is in flight',
      (tester) async {
    // Gate getById behind a delay so the loading frame is observable.
    await _pumpDetail(tester, getByIdDelay: const Duration(seconds: 1));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Alpha Supply'), findsNothing);

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.text('Alpha Supply'), findsWidgets);
  });

  testWidgets(
      'renders supplier detail: header, contacts, addresses, finance, analytics, pipeline',
      (tester) async {
    final repo = await _pumpDetail(tester);
    await tester.pumpAndSettle();

    // ── Header / general info ──
    expect(find.text('Alpha Supply'), findsWidgets); // AppBar + header card
    expect(find.text('BIN12345'), findsOneWidget);
    expect(find.text('alpha@example.com'), findsOneWidget);
    expect(find.text('+77001234567'), findsOneWidget);
    expect(find.text('Main vendor'), findsOneWidget);

    // ── Contacts ──
    expect(find.text('Anna Seller'), findsOneWidget);
    expect(find.textContaining('Sales manager'), findsOneWidget);

    // ── Addresses ──
    expect(find.text('Abay Ave 1, Almaty, Kazakhstan, 050000'), findsOneWidget);

    // ── Finance summary / payments ──
    expect(find.textContaining('550000'), findsWidgets);
    expect(find.textContaining('300000'), findsWidgets);
    expect(find.textContaining('200000'), findsWidgets);
    expect(find.textContaining('SP-0001'), findsWidgets);

    // ── Purchase analytics ──
    expect(find.textContaining('450000'), findsWidgets);
    expect(find.textContaining('Milk 1L'), findsWidgets);
    expect(find.textContaining('87.5'), findsWidgets);

    // ── Order pipeline ──
    expect(find.textContaining('PO-1001'), findsWidgets);
    expect(find.textContaining('5000000'), findsWidgets);

    // ── All repository calls issued by the screen ──
    for (final expected in [
      'getById',
      'getContacts',
      'getAddresses',
      'getFinanceSummary',
      'getPayments',
      'getSupplierProducts',
      'getPurchaseSummary',
      'getProductPurchases',
      'getReliability',
      'getPaymentAging',
      'getReturnSummary',
      'getPerformance',
      'getOrderPipeline',
    ]) {
      expect(repo.calls, contains(expected), reason: '$expected was not called');
    }
  });

  testWidgets('shows error and recovers on retry', (tester) async {
    final repo = await _pumpDetail(tester, getByIdFails: true);
    await tester.pumpAndSettle();

    // Error state with retry affordance (FilledButton.tonalIcon renders a
    // FilledButton subclass, so match on the refresh icon instead)
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
    expect(find.textContaining('backend exploded'), findsOneWidget);
    expect(find.byIcon(Icons.refresh), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);

    // Retry succeeds → full render
    repo.getByIdFails = false;
    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pumpAndSettle();

    expect(find.text('Alpha Supply'), findsWidgets);
    expect(find.byIcon(Icons.error_outline), findsNothing);
  });
}
