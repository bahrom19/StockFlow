import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/screens/product_detail_screen.dart';
import 'package:stockflow/features/products/presentation/screens/product_form_screen.dart';

/// Regression for the "saved successfully but the old value still shows" bug.
///
/// Root cause (UI state, Variant 2): PATCH really persisted to the DB, but
/// ProductDetailScreen stays mounted under the pushed edit route and
/// productDetailProvider is a family StateNotifierProvider that is NOT
/// autoDispose — after popping back from the edit form, initState does not
/// re-run and the provider kept serving the stale pre-edit Product. The fix
/// reloads the product when the edit route is popped; this test pins it.
Product _product({String name = 'Молоко'}) => Product(
      id: 'prod-1',
      companyId: 'comp-1',
      name: name,
      price: '150',
      stockQuantity: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    );

class _FakeProductsRepo extends ProductsRepository {
  _FakeProductsRepo(super.ref);

  int getByIdCalls = 0;
  bool updateCalled = false;
  String currentName = 'Молоко';

  @override
  Future<ProductsResult<Product>> getById(String id) async {
    getByIdCalls++;
    return ProductsSuccess(_product(name: currentName));
  }

  @override
  Future<ProductsResult<Product>> update(
    String id,
    Map<String, dynamic> data,
  ) async {
    updateCalled = true;
    currentName = (data['name'] as String?) ?? currentName;
    return ProductsSuccess(_product(name: currentName));
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

Future<WidgetTester> _pumpDetail(WidgetTester tester) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  final router = GoRouter(
    initialLocation: '/products/prod-1',
    routes: [
      GoRoute(
        path: '/products/prod-1',
        builder: (context, state) =>
            const ProductDetailScreen(productId: 'prod-1'),
      ),
      GoRoute(
        path: '/products/prod-1/edit',
        builder: (context, state) =>
            const ProductFormScreen(productId: 'prod-1'),
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
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pump(); // flush initState microtask (loadProduct)
  await tester.pumpAndSettle();
  return tester;
}

_FakeProductsRepo _repoOf(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(ProductDetailScreen)))
        .read(productsRepositoryProvider) as _FakeProductsRepo;

void main() {
  testWidgets(
      'after editing and saving, popping back shows the NEW name '
      '(detail provider is reloaded)', (tester) async {
    await _pumpDetail(tester);
    final repo = _repoOf(tester);

    // Detail rendered with the pre-edit value.
    expect(find.text('Молоко'), findsWidgets);
    expect(repo.getByIdCalls, 1, reason: 'initial detail load');

    // Open the edit screen.
    await tester.tap(find.byTooltip('Edit'));
    await tester.pumpAndSettle();
    expect(find.byType(ProductFormScreen), findsOneWidget);
    expect(find.text('Молоко'), findsWidgets); // pre-filled controller

    // Rename and save.
    await tester.enterText(find.byType(TextFormField).first, 'Молоко 1 л');
    await tester.tap(find.widgetWithText(TextButton, 'Save'));
    await tester.pumpAndSettle();

    expect(repo.updateCalled, isTrue, reason: 'save must PATCH the product');

    // The form popped back onto the detail screen; the stale provider must
    // have been reloaded so the user sees the persisted value, not the old one.
    expect(find.byType(ProductFormScreen), findsNothing);
    expect(repo.getByIdCalls, greaterThanOrEqualTo(2),
        reason: 'detail must re-fetch after returning from edit');
    expect(find.text('Молоко 1 л'), findsWidgets,
        reason: 'detail must render the NEW name after save');
    expect(find.text('Молоко'), findsNothing,
        reason: 'stale pre-edit name must be gone');
  });
}
