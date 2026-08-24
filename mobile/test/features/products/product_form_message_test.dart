import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/screens/product_form_screen.dart';

/// Regression — product CREATE vs UPDATE success messages.
///
/// The product form shows a success snackbar after saving. Adding a product
/// must announce the CREATE operation ("Product added successfully" family),
/// never the UPDATE message ("Product updated") — and an edit must keep its
/// own separate UPDATE message. The message text itself lives exclusively in
/// l10n (`productCreated` / `productUpdated`) — no hardcoded strings.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

Product _fixture({String name = 'Coffee'}) => Product(
      id: 'prod-1',
      companyId: 'comp-1',
      name: name,
      sku: 'SKU-100',
      barcode: '4870001234567',
      ntin: '123456789',
      price: '150',
      stockQuantity: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    );

class _FakeProductsRepo extends ProductsRepository {
  _FakeProductsRepo(super.ref);

  final List<String> calls = [];
  bool createCalled = false;
  bool updateCalled = false;
  CreateProductRequest? createdRequest;
  String? updatedId;
  Map<String, dynamic>? updatedPayload;

  @override
  Future<ProductsResult<Product>> getById(String id) async {
    calls.add('getById:$id');
    return ProductsSuccess(_fixture());
  }

  @override
  Future<ProductsResult<Product>> create(CreateProductRequest request) async {
    calls.add('create');
    createCalled = true;
    createdRequest = request;
    return ProductsSuccess(_fixture(name: request.name));
  }

  @override
  Future<ProductsResult<Product>> update(
    String id,
    Map<String, dynamic> data,
  ) async {
    calls.add('update:$id');
    updateCalled = true;
    updatedId = id;
    updatedPayload = data;
    return ProductsSuccess(
        _fixture(name: (data['name'] as String?) ?? 'Coffee'));
  }

  @override
  Future<ProductsResult<ProductListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? sortBy,
    String? sortOrder,
  }) async =>
      const ProductsSuccess(ProductListResponse(
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      ));
}

/// Pumps [ProductFormScreen]: without [productId] → create mode, with it →
/// edit mode (loads the fixture through the fake repository first).
Future<_FakeProductsRepo> _pumpForm(
  WidgetTester tester, {
  required Locale locale,
  String? productId,
}) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  final router = GoRouter(
    initialLocation: productId == null ? '/new' : '/edit',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(body: SizedBox.shrink()),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const ProductFormScreen(),
          ),
          GoRoute(
            path: 'edit',
            builder: (context, state) =>
                const ProductFormScreen(productId: 'prod-1'),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        productsRepositoryProvider
            .overrideWith((ref) => _FakeProductsRepo(ref)),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  // Flush initState microtasks (edit mode loads the product asynchronously)
  // and settle every resulting frame deterministically.
  await tester.pump();
  await tester.pumpAndSettle();
  if (productId != null) {
    var guard = 0;
    while (find.byType(CircularProgressIndicator).evaluate().isNotEmpty &&
        guard++ < 50) {
      await tester.pump(const Duration(milliseconds: 20));
    }
  }
  // The provider owns the fake instance — read it back to assert call records.
  final ctx = tester.element(find.byType(ProductFormScreen));
  return ProviderScope.containerOf(ctx)
      .read(productsRepositoryProvider) as _FakeProductsRepo;
}

Future<void> _fill(WidgetTester tester, int index, String text) async {
  final finder = find.byType(TextFormField).at(index);
  await tester.ensureVisible(finder);
  await tester.enterText(finder, text);
}

/// Fills the add-product form: name, SKU, barcode, NTIN, price — the exact
/// UX scenario from the bug report.
Future<void> _fillNewProduct(WidgetTester tester) async {
  await _fill(tester, 0, 'Test Coffee');
  await _fill(tester, 1, 'SKU-100');
  await _fill(tester, 2, '4870001234567');
  await _fill(tester, 3, '123456789');
  await _fill(tester, 4, '150');
}

Future<void> _tapSave(WidgetTester tester, AppLocalizations l10n) async {
  await tester.tap(find.widgetWithText(TextButton, l10n.save));
  await tester.pumpAndSettle();
}

void main() {
  group('CREATE success message', () {
    testWidgets(
        'EN: adding a product shows "Product added successfully", not update',
        (tester) async {
      final repo = await _pumpForm(tester, locale: const Locale('en'));
      expect(find.text(en().newProduct), findsOneWidget,
          reason: 'form must be in create mode');

      await _fillNewProduct(tester);
      await _tapSave(tester, en());

      expect(repo.createCalled, isTrue,
          reason: 'save must call POST /products (create)');
      expect(repo.updateCalled, isFalse,
          reason: 'create must never call PATCH (update)');
      expect(find.text(en().productCreated), findsOneWidget,
          reason:
              'success snackbar must be "${en().productCreated}" (CREATE)');
      expect(find.text(en().productUpdated), findsNothing,
          reason: 'UPDATE message must NOT appear after ADD');
      expect(find.byType(SnackBar), findsOneWidget);

      // SKU / Barcode / NTIN keep flowing into the create payload untouched.
      expect(repo.createdRequest?.sku, 'SKU-100');
      expect(repo.createdRequest?.barcode, '4870001234567');
      expect(repo.createdRequest?.ntin, '123456789');
      expect(repo.createdRequest?.name, 'Test Coffee');
      expect(repo.createdRequest?.price, '150');
    });

    testWidgets('RU: «Товар успешно добавлен» after ADD', (tester) async {
      final repo = await _pumpForm(tester, locale: const Locale('ru'));

      await _fillNewProduct(tester);
      await _tapSave(tester, ru());

      expect(repo.createCalled, isTrue);
      expect(find.text(ru().productCreated), findsOneWidget,
          reason: 'RU snackbar must be «${ru().productCreated}»');
      expect(ru().productCreated, 'Товар успешно добавлен');
      expect(find.text(ru().productUpdated), findsNothing,
          reason: '«${ru().productUpdated}» must NOT appear after ADD');
    });

    testWidgets('KK: «Тауар сәтті қосылды» after ADD', (tester) async {
      final repo = await _pumpForm(tester, locale: const Locale('kk'));

      await _fillNewProduct(tester);
      await _tapSave(tester, kk());

      expect(repo.createCalled, isTrue);
      expect(find.text(kk().productCreated), findsOneWidget,
          reason: 'KK snackbar must be «${kk().productCreated}»');
      expect(kk().productCreated, 'Тауар сәтті қосылды');
      expect(find.text(kk().productUpdated), findsNothing,
          reason: '«${kk().productUpdated}» must NOT appear after ADD');
    });
  });

  group('UPDATE keeps its own message', () {
    testWidgets(
        'EN: editing shows "Product updated", never the CREATE message',
        (tester) async {
      final repo = await _pumpForm(tester,
          locale: const Locale('en'), productId: 'prod-1');
      expect(find.text(en().editProduct), findsOneWidget,
          reason: 'form must be in edit mode');
      expect(repo.calls, contains('getById:prod-1'),
          reason: 'edit form loads the product by id on open');

      await _fill(tester, 0, 'Coffee Renamed');
      await _tapSave(tester, en());

      expect(repo.updateCalled, isTrue,
          reason: 'save must call PATCH (update)');
      expect(repo.updatedId, 'prod-1');
      expect(repo.createCalled, isFalse,
          reason: 'edit must never call POST (create)');
      expect(find.text(en().productUpdated), findsOneWidget,
          reason: 'success snackbar must be "${en().productUpdated}" (UPDATE)');
      expect(find.text(en().productCreated), findsNothing,
          reason: 'CREATE message must NOT appear after EDIT');
    });
  });

  group('l10n contract: CREATE vs UPDATE stay distinct', () {
    test('exact strings for all three locales', () {
      expect(en().productCreated, 'Product added successfully');
      expect(ru().productCreated, 'Товар успешно добавлен');
      expect(kk().productCreated, 'Тауар сәтті қосылды');

      expect(en().productUpdated, 'Product updated');
      expect(ru().productUpdated, 'Товар обновлён');
      expect(kk().productUpdated, 'Тауар жаңартылды');
    });

    test('CREATE text never equals UPDATE text (no cross-showing)', () {
      for (final l10n in [en(), ru(), kk()]) {
        expect(l10n.productCreated == l10n.productUpdated, isFalse,
            reason: 'create and update messages must differ');
      }
    });
  });
}


