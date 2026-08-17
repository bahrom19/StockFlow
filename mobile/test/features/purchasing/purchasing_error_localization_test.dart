import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/purchasing/presentation/screens/purchase_order_detail_screen.dart';
import 'package:stockflow/features/purchasing/presentation/screens/purchase_order_form_screen.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

/// Phase 5C — purchase order form + detail failure localization.
///
/// Both screens previously rendered `error.message` raw, showing the
/// canonical English ErrorHandler fallback to RU/KK users. They now route
/// through `localizedErrorLabel`. Guard 1: EN keeps the canonical text.
/// Guard 2: RU/KK localize known canonical messages. Guard 3: arbitrary
/// backend/freeform messages pass through unchanged.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

Supplier _supplier() => Supplier(
      id: 's1',
      companyId: 'c1',
      companyName: 'Acme Supplies',
      createdAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 1),
    );

class _FakePurchasingRepo extends PurchasingRepository {
  _FakePurchasingRepo(super.api, this.message);
  final String message;

  @override
  Future<PurchasingResult<PurchaseOrder>> createOrder(
      CreatePurchaseOrderRequest request) async {
    return PurchasingFailure(NetworkFailure(message: message));
  }

  @override
  Future<PurchasingResult<PurchaseOrder>> getOrderById(String id) async {
    return PurchasingFailure(NetworkFailure(message: message));
  }
}

class _FakeSuppliersRepo extends SuppliersRepository {
  _FakeSuppliersRepo(super.api, super.ref);

  @override
  Future<SuppliersResult<SupplierListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    return SuppliersSuccess(SupplierListResponse(
      items: [_supplier()],
      total: 1,
      page: 1,
      limit: limit,
    ));
  }
}

void main() {
  group('PO form failure snackbar localization', () {
    Future<void> pumpAndSubmit(
      WidgetTester tester, {
      required Locale locale,
      required String canonical,
      required String expected,
    }) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });
      final api = ApiClient(tokenStorage: TokenStorage());
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            purchasingRepositoryProvider.overrideWith(
                (ref) => _FakePurchasingRepo(api, canonical)),
            suppliersRepositoryProvider
                .overrideWith((ref) => _FakeSuppliersRepo(api, ref)),
          ],
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const PurchaseOrderFormScreen(),
          ),
        ),
      );
      // Supplier list loads in initState → dropdown gets a value.
      await tester.pumpAndSettle();
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      expect(find.text(expected), findsOneWidget,
          reason: 'PO form, ${locale.languageCode}: expected snackbar');
      if (expected != canonical) {
        expect(find.text(canonical), findsNothing,
            reason: 'raw canonical must not leak in ${locale.languageCode}');
      }
    }

    testWidgets('EN keeps the canonical text', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('en'),
        canonical: ErrorMessages.connectionTimeout,
        expected: ErrorMessages.connectionTimeout,
      );
    });

    testWidgets('RU localizes connection timeout', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('ru'),
        canonical: ErrorMessages.connectionTimeout,
        expected: 'Превышено время ожидания. Проверьте интернет-соединение.',
      );
    });

    testWidgets('KK localizes connection timeout', (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('kk'),
        canonical: ErrorMessages.connectionTimeout,
        expected: 'Қосылу уақыты аяқталды. Интернет байланысын тексеріңіз.',
      );
    });

    testWidgets('freeform backend message passes through in RU',
        (tester) async {
      await pumpAndSubmit(
        tester,
        locale: const Locale('ru'),
        canonical: 'Supplier validation failed',
        expected: 'Supplier validation failed',
      );
    });
  });

  group('PO detail failure error-state localization', () {
    Future<void> pumpAndLoad(
      WidgetTester tester, {
      required Locale locale,
      required String canonical,
      required String expected,
    }) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });
      final api = ApiClient(tokenStorage: TokenStorage());
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            purchasingRepositoryProvider.overrideWith(
                (ref) => _FakePurchasingRepo(api, canonical)),
          ],
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const PurchaseOrderDetailScreen(orderId: 'o1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(expected), findsOneWidget,
          reason: 'PO detail, ${locale.languageCode}: expected error state');
      if (expected != canonical) {
        expect(find.text(canonical), findsNothing,
            reason: 'raw canonical must not leak in ${locale.languageCode}');
      }
      // Retry stays available (localized FilledButton.tonalIcon in the
      // error state — subtype check because tonalIcon is a private subclass).
      expect(find.byWidgetPredicate((w) => w is FilledButton), findsOneWidget,
          reason: 'retry button must render');
    }

    testWidgets('EN keeps the canonical text', (tester) async {
      await pumpAndLoad(
        tester,
        locale: const Locale('en'),
        canonical: ErrorMessages.noInternet,
        expected: ErrorMessages.noInternet,
      );
    });

    testWidgets('RU localizes no-internet canonical', (tester) async {
      await pumpAndLoad(
        tester,
        locale: const Locale('ru'),
        canonical: ErrorMessages.noInternet,
        expected: 'Нет подключения к интернету. Проверьте сеть.',
      );
    });

    testWidgets('KK localizes no-internet canonical', (tester) async {
      await pumpAndLoad(
        tester,
        locale: const Locale('kk'),
        canonical: ErrorMessages.noInternet,
        expected: 'Интернетке қосылым жоқ. Желіні тексеріңіз.',
      );
    });

    testWidgets('freeform backend message passes through in KK',
        (tester) async {
      await pumpAndLoad(
        tester,
        locale: const Locale('kk'),
        canonical: 'Order not found',
        expected: 'Order not found',
      );
    });
  });
}
