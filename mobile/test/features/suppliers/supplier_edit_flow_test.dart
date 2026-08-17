import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/presentation/screens/supplier_form_screen.dart';

/// Phase 6A — Supplier Edit Flow regression.
///
/// F-01: the `supplierDetail` route passed `supplier: null`, so opening a
/// supplier always rendered the empty Create form. The form now accepts a
/// `supplierId`, loads the supplier on open (mirroring the customer/product/
/// warehouse pattern) and updates the existing record on save.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

Supplier _fixture() => Supplier(
      id: 'sup-1',
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

class _FakeSuppliersRepo extends SuppliersRepository {
  _FakeSuppliersRepo(super.api, super.ref);

  final List<String> calls = [];
  String? updatedId;
  Map<String, dynamic>? updatedPayload;
  bool createCalled = false;

  @override
  Future<SuppliersResult<Supplier>> getById(String id) async {
    calls.add('getById:$id');
    return SuppliersSuccess(_fixture());
  }

  @override
  Future<SuppliersResult<Supplier>> update(
      String id, Map<String, dynamic> data) async {
    calls.add('update:$id');
    updatedId = id;
    updatedPayload = data;
    return SuppliersSuccess(_fixture());
  }

  @override
  Future<SuppliersResult<Supplier>> create(
      CreateSupplierRequest request) async {
    calls.add('create');
    createCalled = true;
    return SuppliersSuccess(_fixture());
  }
}

Future<_FakeSuppliersRepo> pumpEditForm(
  WidgetTester tester, {
  required Locale locale,
  String? supplierId = 'sup-1',
}) async {
  tester.view.physicalSize = const Size(800, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  final api = ApiClient(tokenStorage: TokenStorage());
  final router = GoRouter(
    initialLocation: '/edit',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) =>
            const Scaffold(body: SizedBox.shrink()),
        routes: [
          GoRoute(
            path: 'edit',
            builder: (context, state) =>
                SupplierFormScreen(supplierId: supplierId),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        suppliersRepositoryProvider.overrideWith(
            (ref) => _FakeSuppliersRepo(api, ref)),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
  // The provider owns the fake instance — read it back to assert call records.
  final ctx = tester.element(find.byType(SupplierFormScreen));
  return ProviderScope.containerOf(ctx)
      .read(suppliersRepositoryProvider) as _FakeSuppliersRepo;
}

Future<void> pumpCreateForm(WidgetTester tester) async {
  tester.view.physicalSize = const Size(800, 2200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  final api = ApiClient(tokenStorage: TokenStorage());
  final router = GoRouter(
    initialLocation: '/new',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) =>
            const Scaffold(body: SizedBox.shrink()),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const SupplierFormScreen(),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        suppliersRepositoryProvider.overrideWith(
            (ref) => _FakeSuppliersRepo(api, ref)),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('Supplier edit flow (F-01 regression)', () {
    testWidgets('EN: edit form receives supplier identity and loads data',
        (tester) async {
      final repo = await pumpEditForm(tester, locale: const Locale('en'));
      expect(repo.calls, contains('getById:sup-1'),
          reason: 'form must load the supplier by id on open');
      // Edit mode chrome.
      expect(find.text(en().editSupplier), findsOneWidget,
          reason: 'title must be "Edit Supplier"');
      expect(find.text(en().update), findsOneWidget,
          reason: 'button must be "Update"');
      // Populated fields.
      expect(find.widgetWithText(TextFormField, 'Alpha Supply'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'BIN12345'), findsOneWidget);
      expect(
          find.widgetWithText(TextFormField, 'alpha@example.com'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '+77001234567'), findsOneWidget);
      expect(
          find.widgetWithText(TextFormField, 'https://alpha.example'),
          findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Main vendor'), findsOneWidget);
    });

    testWidgets('EN: save updates the existing supplier, no create',
        (tester) async {
      final repo = await pumpEditForm(tester, locale: const Locale('en'));
      await tester.enterText(
          find.widgetWithText(TextFormField, 'Alpha Supply'), 'Alpha Renamed');
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('update:sup-1'),
          reason: 'save must call update with the existing id');
      expect(repo.updatedId, 'sup-1');
      expect(repo.updatedPayload?['companyName'], 'Alpha Renamed');
      expect(repo.createCalled, isFalse,
          reason: 'no accidental create during edit');
      expect(find.text(en().supplierUpdated), findsOneWidget,
          reason: 'success snackbar must be "Supplier updated"');
    });

    testWidgets('RU: edit chrome and labels are localized', (tester) async {
      await pumpEditForm(tester, locale: const Locale('ru'));
      expect(find.text(ru().editSupplier), findsOneWidget);
      expect(find.text(ru().update), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Alpha Supply'), findsOneWidget);
    });

    testWidgets('KK: edit chrome and labels are localized', (tester) async {
      await pumpEditForm(tester, locale: const Locale('kk'));
      expect(find.text(kk().editSupplier), findsOneWidget);
      expect(find.text(kk().update), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Alpha Supply'), findsOneWidget);
    });

    testWidgets('create form (no id) still renders Create chrome',
        (tester) async {
      await pumpCreateForm(tester);
      expect(find.text(en().newSupplier), findsOneWidget);
      expect(find.text(en().create), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Alpha Supply'), findsNothing,
          reason: 'create form must start empty');
    });
  });
}
