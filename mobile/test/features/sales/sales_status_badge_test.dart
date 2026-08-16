import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/screens/sale_detail_screen.dart';
import 'package:stockflow/features/sales/presentation/widgets/sales_widgets.dart';

/// Phase 5D-7C-1 — sales status badge localization.
///
/// The duplicate raw-English `StatusBadge` in `sales_widgets.dart` was removed;
/// both live UI paths (sale detail and the sale-history card view) now render
/// the shared localized `core/widgets/status_badge.dart`. Guard 1: EN contract.
/// Guard 2: RU/KK never show raw enum statuses in the badge.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

const _statuses = [
  'DRAFT',
  'PENDING',
  'COMPLETED',
  'REFUNDED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
];

Sale _sale({String status = 'COMPLETED'}) => Sale(
      id: 's1',
      companyId: 'c1',
      warehouseId: 'w1',
      cashierId: 'u1',
      saleNumber: 'S-1001',
      status: status,
      subtotal: '150.00',
      discount: '0',
      tax: '0',
      total: '150.00',
      paidAmount: '150.00',
      changeAmount: '0',
      currency: 'KZT',
      createdAt: DateTime(2026, 8, 16, 12),
      updatedAt: DateTime(2026, 8, 16, 12),
    );

/// ApiClient is never exercised — the fake repository overrides [getById]
/// entirely — but the parent constructor needs a token storage.
class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super(tokenStorage: TokenStorage());
}

class _FakeSalesRepository extends SalesRepository {
  _FakeSalesRepository() : super(_FakeApiClient());

  @override
  Future<SalesResult<Sale>> getById(String id) async =>
      SalesSuccess(_sale());
}

Widget _app(Widget child, Locale locale) => MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  group('StatusBadge.statusLabel — reference mapping', () {
    test('EN keeps the display contract byte-for-byte', () {
      expect(StatusBadge.statusLabel('DRAFT', en()), 'Draft');
      expect(StatusBadge.statusLabel('PENDING', en()), 'Pending');
      expect(StatusBadge.statusLabel('COMPLETED', en()), 'Completed');
      expect(StatusBadge.statusLabel('REFUNDED', en()), 'Refunded');
      expect(StatusBadge.statusLabel('CANCELLED', en()), 'Cancelled');
      expect(StatusBadge.statusLabel('PARTIALLY_REFUNDED', en()),
          'Partially refunded');
    });

    test('RU localizes every status — no raw enum', () {
      expect(StatusBadge.statusLabel('DRAFT', ru()), 'Черновик');
      expect(StatusBadge.statusLabel('PENDING', ru()), 'В ожидании');
      expect(StatusBadge.statusLabel('COMPLETED', ru()), 'Завершённый');
      expect(StatusBadge.statusLabel('REFUNDED', ru()), 'Возвращённый');
      expect(StatusBadge.statusLabel('CANCELLED', ru()), 'Отменённый');
      expect(StatusBadge.statusLabel('PARTIALLY_REFUNDED', ru()),
          'Частично возвращён');
      for (final s in _statuses) {
        expect(StatusBadge.statusLabel(s, ru()),
            isNot(equals(s)),
            reason: 'RU must never show the raw enum $s');
      }
    });

    test('KK localizes every status — no raw enum', () {
      expect(StatusBadge.statusLabel('DRAFT', kk()), 'Жоба');
      expect(StatusBadge.statusLabel('PENDING', kk()), 'Күтуде');
      expect(StatusBadge.statusLabel('COMPLETED', kk()), 'Аяқталған');
      expect(StatusBadge.statusLabel('REFUNDED', kk()), 'Қайтарылған');
      expect(StatusBadge.statusLabel('CANCELLED', kk()), 'Бас тартылған');
      expect(StatusBadge.statusLabel('PARTIALLY_REFUNDED', kk()),
          'Жартылай қайтарылған');
      for (final s in _statuses) {
        expect(StatusBadge.statusLabel(s, kk()),
            isNot(equals(s)),
            reason: 'KK must never show the raw enum $s');
      }
    });

    test('unknown value falls back to the raw display', () {
      expect(StatusBadge.statusLabel('MYSTERY', en()), 'Mystery');
    });
  });

  group('SaleCard — sale history card view path', () {
    for (final (locale, label) in [
      (const Locale('en'), 'Completed'),
      (const Locale('ru'), 'Завершённый'),
      (const Locale('kk'), 'Аяқталған'),
    ]) {
      testWidgets('${locale.languageCode}: COMPLETED badge is localized',
          (tester) async {
        await tester.pumpWidget(
          _app(
            Scaffold(body: SaleCard(sale: _sale())),
            locale,
          ),
        );
        expect(find.byType(StatusBadge), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(StatusBadge),
            matching: find.text(label),
          ),
          findsOneWidget,
        );
        expect(find.text('COMPLETED'), findsNothing);
      });
    }
  });

  group('SaleDetailScreen — sale detail path', () {
    for (final (locale, label) in [
      (const Locale('en'), 'Completed'),
      (const Locale('ru'), 'Завершённый'),
      (const Locale('kk'), 'Аяқталған'),
    ]) {
      testWidgets('${locale.languageCode}: status badge is localized',
          (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              salesRepositoryProvider
                  .overrideWithValue(_FakeSalesRepository()),
            ],
            child: _app(const SaleDetailScreen(saleId: 's1'), locale),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.byType(StatusBadge), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(StatusBadge),
            matching: find.text(label),
          ),
          findsOneWidget,
        );
        expect(find.text('COMPLETED'), findsNothing);
        expect(find.text('S-1001'), findsWidgets);
      });
    }
  });
}
