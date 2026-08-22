import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/widgets/product_card.dart';

/// Phase 3A — Shared + Products localization.
///
/// Guard 1 (browser/E2E contract): EN values must stay byte-for-byte with the
/// pre-localization UI (E2E and semantics tests assert innerText).
/// Guard 2: RU/KK get natural ERP translations, not machine stubs.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — shared widgets', () {
    test('EntityTable chrome unchanged', () {
      expect(en().searchHint, 'Search…');
      expect(en().newLabel, 'New');
      expect(en().tableEmptyTitle, 'Nothing here yet');
      expect(en().tableEmptySubtitle, 'No records found.');
      expect(en().exportedRows(3), 'Exported 3 rows as CSV');
      expect(en().showingOf(10, 25), 'Showing 10 of 25');
      expect(en().loadMore, 'Load more');
      expect(en().loadingMore, 'Loading…');
      expect(en().filters, 'Filters');
      expect(en().exportCsv, 'Export CSV');
      expect(en().errorGeneric, 'Something went wrong');
      expect(en().tryAgain, 'Try Again');
      expect(en().dismiss, 'Dismiss');
    });

    test('requiredField composes EN message like the old validators', () {
      expect(en().requiredField(en().name), 'Name is required');
      expect(en().requiredField(en().price), 'Price is required');
    });
  });

  group('EN byte-for-byte contract — StatusBadge statuses', () {
    test('status labels match the historical title-cased rendering', () {
      expect(en().statusActive, 'Active');
      expect(en().statusInactive, 'Inactive');
      expect(en().statusDraft, 'Draft');
      expect(en().statusPending, 'Pending');
      expect(en().statusCompleted, 'Completed');
      expect(en().statusCancelled, 'Cancelled');
      expect(en().statusRefunded, 'Refunded');
      expect(en().statusApproved, 'Approved');
      expect(en().statusOrdered, 'Ordered');
      expect(en().statusReceived, 'Received');
      expect(en().statusOpen, 'Open');
      expect(en().statusClosed, 'Closed');
      expect(en().statusPaid, 'Paid');
      expect(en().statusExpired, 'Expired');
      expect(en().statusRejected, 'Rejected');
    });
  });

  group('EN byte-for-byte contract — Products', () {
    test('list/detail/form strings unchanged', () {
      expect(en().products, 'Products');
      expect(en().productsSubtitle,
          'Manage your catalog, pricing and stock levels');
      expect(en().searchByNameSkuBarcode,
          'Search by name, SKU, barcode or NTIN…');
      expect(en().newProduct, 'New Product');
      expect(en().name, 'Name');
      expect(en().sku, 'SKU');
      expect(en().barcode, 'Barcode');
      expect(en().ntin, 'NTIN');
      expect(en().category, 'Category');
      expect(en().brand, 'Brand');
      expect(en().unit, 'Unit');
      expect(en().price, 'Price');
      expect(en().cost, 'Cost');
      expect(en().stock, 'Stock');
      expect(en().status, 'Status');
      expect(en().productsEmptyTitle, 'No products found');
      expect(en().productsEmptySubtitle, 'Add your first product to get started');
      expect(en().levelOut, 'Out');
      expect(en().levelLow, 'Low');
      expect(en().product, 'Product');
      expect(en().edit, 'Edit');
      expect(en().delete, 'Delete');
      expect(en().pricing, 'Pricing');
      expect(en().costPrice, 'Cost Price');
      expect(en().margin, 'Margin');
      expect(en().quantity, 'Quantity');
      expect(en().details, 'Details');
      expect(en().description, 'Description');
      expect(en().metadata, 'Metadata');
      expect(en().created, 'Created');
      expect(en().updated, 'Updated');
      expect(en().deleteProduct, 'Delete Product');
      expect(en().deleteProductConfirm('Coffee'),
          'Are you sure you want to delete "Coffee"?');
      expect(en().productDeleted, 'Product deleted');
      expect(en().deleteProductFailed, 'Failed to delete product');
      expect(en().failedToLoadProduct, 'Failed to load product');
      expect(en().noChangesToSave, 'No changes to save');
      expect(en().productUpdated, 'Product updated');
      expect(en().updateFailed, 'Update failed');
      expect(en().productCreated, 'Product created');
      expect(en().createFailed, 'Create failed');
      expect(en().editProduct, 'Edit Product');
      expect(en().basicInformation, 'Basic Information');
      expect(en().nameRequired, 'Name *');
      expect(en().priceRequired, 'Price *');
      expect(en().unitHint, 'pcs, kg, m');
      expect(en().categoryHint, 'Electronics');
    });
  });

  group('Localized strings (RU/KK)', () {
    test('shared chrome localizes', () {
      expect(ru().tableEmptyTitle, 'Пока ничего нет');
      expect(kk().tableEmptyTitle, 'Әзірге ештеңе жоқ');
      expect(ru().loadMore, 'Показать ещё');
      expect(kk().loadMore, 'Қосымша көрсету');
      expect(ru().errorGeneric, 'Что-то пошло не так');
      expect(kk().errorGeneric, 'Қате орын алды');
      expect(ru().requiredField(ru().name), 'Название обязательно');
      expect(kk().requiredField(kk().name), 'Атауы қажет');
    });

    test('statuses localize (no raw enums in RU/KK)', () {
      expect(ru().statusOrdered, 'Заказан');
      expect(kk().statusOrdered, 'Тапсырылған');
      expect(ru().statusPartiallyReceived, 'Частично получен');
      expect(kk().statusPartiallyReceived, 'Жартылай қабылданған');
      expect(ru().statusPaid, 'Оплачен');
      expect(kk().statusPaid, 'Төленген');
    });

    test('products strings localize', () {
      expect(ru().newProduct, 'Новый товар');
      expect(kk().newProduct, 'Жаңа тауар');
      expect(ru().productsEmptyTitle, 'Товары не найдены');
      expect(kk().productsEmptyTitle, 'Тауарлар табылмады');
      expect(ru().levelOut, 'Нет');
      expect(kk().levelOut, 'Жоқ');
      expect(ru().levelLow, 'Мало');
      expect(kk().levelLow, 'Аз');
      expect(ru().deleteProductConfirm('Кофе'),
          'Вы уверены, что хотите удалить «Кофе»?');
    });
  });

  group('StatusBadge renders localized labels', () {
    Future<void> pump(WidgetTester tester, Locale locale, String status) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: StatusBadge(status: status)),
        ),
      );
    }

    testWidgets('EN: ACTIVE/INACTIVE/ORDERED/PARTIALLY_RECEIVED',
        (tester) async {
      await pump(tester, const Locale('en'), 'ACTIVE');
      expect(find.text('Active'), findsOneWidget);
      await pump(tester, const Locale('en'), 'INACTIVE');
      expect(find.text('Inactive'), findsOneWidget);
      await pump(tester, const Locale('en'), 'ORDERED');
      expect(find.text('Ordered'), findsOneWidget);
      await pump(tester, const Locale('en'), 'PARTIALLY_RECEIVED');
      expect(find.text('Partially received'), findsOneWidget);
    });

    testWidgets('RU: ORDERED → «Заказан», no raw enum', (tester) async {
      await pump(tester, const Locale('ru'), 'ORDERED');
      expect(find.text('Заказан'), findsOneWidget);
      expect(find.text('ORDERED'), findsNothing);
    });

    testWidgets('KK: PAID → «Төленген»', (tester) async {
      await pump(tester, const Locale('kk'), 'PAID');
      expect(find.text('Төленген'), findsOneWidget);
    });

    testWidgets('unknown status falls back to Formatters.status', (tester) async {
      await pump(tester, const Locale('ru'), 'SOME_NEW_STATUS');
      expect(find.text('Some New Status'), findsOneWidget);
    });
  });

  group('EntityTable localized defaults', () {
    Future<void> pump(WidgetTester tester, Locale locale) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: EntityTable<String>(
              items: const [],
              columns: const [DataColumn(label: Text('X'))],
              buildRow: (s) => DataRow(cells: [DataCell(Text(s))]),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('EN: default empty state', (tester) async {
      await pump(tester, const Locale('en'));
      expect(find.text('Nothing here yet'), findsOneWidget);
      expect(find.text('No records found.'), findsOneWidget);
      expect(find.text('Search…'), findsOneWidget);
    });

    testWidgets('RU: empty state localizes', (tester) async {
      await pump(tester, const Locale('ru'));
      expect(find.text('Пока ничего нет'), findsOneWidget);
      expect(find.text('Записи не найдены.'), findsOneWidget);
      expect(find.text('Поиск…'), findsOneWidget);
    });
  });

  group('ProductCard level badges localize', () {
    Product product({required int stock}) => Product(
          id: 'p1',
          companyId: 'c1',
          name: 'Coffee',
          price: '100',
          stockQuantity: stock,
          createdAt: '2026-08-12T10:00:00Z',
          updatedAt: '2026-08-12T10:00:00Z',
        );

    Future<void> pump(WidgetTester tester, Locale locale, int stock) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ProductCard(product: product(stock: stock), onTap: () {}),
          ),
        ),
      );
    }

    testWidgets('EN: Out / Low', (tester) async {
      await pump(tester, const Locale('en'), 0);
      expect(find.text('Out'), findsOneWidget);
      await pump(tester, const Locale('en'), 2);
      expect(find.text('Low'), findsOneWidget);
    });

    testWidgets('RU: Нет / Мало', (tester) async {
      await pump(tester, const Locale('ru'), 0);
      expect(find.text('Нет'), findsOneWidget);
      await pump(tester, const Locale('ru'), 2);
      expect(find.text('Мало'), findsOneWidget);
    });
  });
}
