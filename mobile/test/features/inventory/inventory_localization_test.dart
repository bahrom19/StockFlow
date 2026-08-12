import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/widgets/inventory_card.dart';

/// Phase 3B — Inventory + Warehouses localization.
///
/// Guard 1 (browser/E2E contract): EN values must stay byte-for-byte with the
/// pre-localization UI (E2E and semantics tests assert innerText).
/// Guard 2: RU/KK get natural ERP translations; no raw movement-type/level
/// enums (SALE, PURCHASE, OUT, LOW...) may surface in RU/KK UI.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Inventory', () {
    test('inventory list chrome unchanged', () {
      expect(en().inventory, 'Inventory');
      expect(en().inventorySubtitle,
          'Live stock levels across all warehouses');
      expect(en().inventoryAdjust, 'Adjust');
      expect(en().inventoryTransfer, 'Transfer');
      expect(en().warehouse, 'Warehouse');
      expect(en().qty, 'Qty');
      expect(en().reserved, 'Reserved');
      expect(en().available, 'Available');
      expect(en().min, 'Min');
      expect(en().level, 'Level');
      expect(en().levelOut, 'Out');
      expect(en().levelLow, 'Low');
      expect(en().levelOk, 'OK');
      expect(en().inventoryEmptyTitle, 'No inventory items found');
      expect(en().inventoryEmptySubtitle,
          'Stock data will appear once products are sold or received');
      expect(en().inventoryLoadFirst, 'Load inventory first');
      expect(en().transferNeedTwoWarehouses,
          'Need at least two warehouses to transfer');
      expect(en().inventoryAvailable(12), '12 available');
      expect(en().inventoryReserved(3), 'Reserved: 3');
    });

    test('movements chrome unchanged', () {
      expect(en().stockMovements, 'Stock Movements');
      expect(en().movementsSubtitle,
          'Every change in stock — purchases, sales, transfers');
      expect(en().movementsSearchHint, 'Search movements…');
      expect(en().date, 'Date');
      expect(en().type, 'Type');
      expect(en().before, 'Before');
      expect(en().after, 'After');
      expect(en().reference, 'Reference');
      expect(en().movementsEmptyTitle, 'No movements');
      expect(en().movementsEmptySubtitle,
          'Stock movements will appear here');
    });

    test('movement types byte-for-byte', () {
      expect(en().movementSale, 'Sale');
      expect(en().movementPurchase, 'Purchase');
      expect(en().movementTransferIn, 'Transfer In');
      expect(en().movementTransferOut, 'Transfer Out');
      expect(en().movementAdjustment, 'Adjustment');
      expect(en().movementReturn, 'Return');
      expect(en().movementLoss, 'Loss');
      expect(en().movementCorrection, 'Correction');
    });
  });

  group('EN byte-for-byte contract — dialogs', () {
    test('adjustment dialog unchanged', () {
      expect(en().adjustStock, 'Adjust Stock');
      expect(en().increase, 'Increase');
      expect(en().decrease, 'Decrease');
      expect(en().quantityRequired, 'Quantity *');
      expect(en().positiveNumber, 'Must be a positive number');
      expect(en().reason, 'Reason');
      expect(en().reasonHint, 'e.g. Physical count correction');
      expect(en().comment, 'Comment');
      expect(en().submitAdjustment, 'Submit Adjustment');
      expect(en().stockAdjusted, 'Stock adjusted successfully');
      expect(en().adjustmentFailed, 'Adjustment failed');
      expect(en().selectProductAndWarehouse,
          'Select a product and warehouse');
      expect(en().quantityCannotBeZero, 'Quantity cannot be zero');
      expect(en().productRequired, 'Product *');
      expect(en().warehouseRequired, 'Warehouse *');
      expect(en().itemInStock(5), '(5 in stock)');
      expect(en().adjustHint,
          'Enter a positive value to add stock, negative to reduce.');
      expect(en().reasonComment, 'Reason / Comment');
      expect(en().applyAdjustment, 'Apply Adjustment');
    });

    test('transfer dialog unchanged', () {
      expect(en().transferStock, 'Transfer Stock');
      expect(en().fromWarehouse, 'From Warehouse *');
      expect(en().toWarehouse, 'To Warehouse *');
      expect(en().required, 'Required');
      expect(en().submitTransfer, 'Submit Transfer');
      expect(en().stockTransferred, 'Stock transferred successfully');
      expect(en().transferFailed, 'Transfer failed');
      expect(en().selectBothWarehouses, 'Please select both warehouses');
      expect(en().sourceDestinationDiffer,
          'Source and destination must differ');
      expect(en().quantityMustBePositive, 'Quantity must be positive');
      expect(en().selectProductAndBothWarehouses,
          'Select product and both warehouses');
    });
  });

  group('EN byte-for-byte contract — Warehouses', () {
    test('warehouses list/form unchanged', () {
      expect(en().warehouses, 'Warehouses');
      expect(en().warehousesSubtitle,
          'Manage your storage locations and default warehouse');
      expect(en().searchByNameOrCode, 'Search by name or code…');
      expect(en().newWarehouse, 'New Warehouse');
      expect(en().code, 'Code');
      expect(en().address, 'Address');
      expect(en().managerName, 'Manager Name');
      expect(en().defaultLabel, 'Default');
      expect(en().actions, 'Actions');
      expect(en().phone, 'Phone');
      expect(en().deleteWarehouseTitle, 'Delete warehouse?');
      expect(en().deleteWarehouseConfirm('Main', 'MAIN'),
          'Warehouse "Main" (MAIN) will be archived. This cannot be undone.');
      expect(en().warehouseDeleted, 'Warehouse deleted');
      expect(en().deleteFailed, 'Delete failed');
      expect(en().warehousesEmptyTitle, 'No warehouses');
      expect(en().warehousesEmptySubtitle,
          'Create your first warehouse to start tracking stock');
      expect(en().editWarehouse, 'Edit Warehouse');
      expect(en().warehouseName, 'Warehouse Name *');
      expect(en().warehouseNameHint, 'e.g. Main Store');
      expect(en().codeRequired, 'Code *');
      expect(en().codeHint, 'e.g. MAIN');
      expect(en().defaultWarehouse, 'Default warehouse');
      expect(en().defaultWarehouseSubtitle,
          'New stock will be assigned to this warehouse');
      expect(en().saveChanges, 'Save Changes');
      expect(en().createWarehouse, 'Create Warehouse');
      expect(en().warehouseUpdated, 'Warehouse updated');
      expect(en().warehouseCreated, 'Warehouse created');
    });
  });

  group('Localized strings (RU/KK) — movement types', () {
    test('movement types localize (no raw enums)', () {
      expect(ru().movementSale, 'Продажа');
      expect(kk().movementSale, 'Сатылым');
      expect(ru().movementPurchase, 'Закупка');
      expect(kk().movementPurchase, 'Сатып алу');
      expect(ru().movementTransferIn, 'Перевод внутрь');
      expect(kk().movementTransferIn, 'Ішке аударым');
      expect(ru().movementTransferOut, 'Перевод наружу');
      expect(kk().movementTransferOut, 'Сыртқа аударым');
      expect(ru().movementAdjustment, 'Корректировка');
      expect(kk().movementAdjustment, 'Түзету');
      expect(ru().movementReturn, 'Возврат');
      expect(kk().movementReturn, 'Қайтару');
      expect(ru().movementLoss, 'Потери');
      expect(kk().movementLoss, 'Жоғалту');
      expect(ru().movementCorrection, 'Исправление');
      expect(kk().movementCorrection, 'Түзетім');
    });

    test('stock levels localize', () {
      expect(ru().levelOut, 'Нет');
      expect(kk().levelOut, 'Жоқ');
      expect(ru().levelLow, 'Мало');
      expect(kk().levelLow, 'Аз');
      expect(ru().levelOk, 'ОК');
      expect(kk().levelOk, 'ОК');
    });
  });

  group('Localized strings (RU/KK) — dialogs and warehouses', () {
    test('dialogs localize', () {
      expect(ru().adjustStock, 'Корректировка остатков');
      expect(kk().adjustStock, 'Қорды түзету');
      expect(ru().stockAdjusted, 'Остатки скорректированы');
      expect(kk().stockAdjusted, 'Қор түзетілді');
      expect(ru().transferStock, 'Перемещение остатков');
      expect(kk().transferStock, 'Қорды аудару');
      expect(ru().stockTransferred, 'Остатки перемещены');
      expect(kk().stockTransferred, 'Қор аударылды');
      expect(ru().sourceDestinationDiffer,
          'Склад-источник и склад-назначение должны различаться');
      expect(kk().sourceDestinationDiffer,
          'Дереккөз және қабылдаушы қоймалар әртүрлі болуы керек');
    });

    test('warehouses localize', () {
      expect(ru().newWarehouse, 'Новый склад');
      expect(kk().newWarehouse, 'Жаңа қойма');
      expect(ru().warehouseDeleted, 'Склад удалён');
      expect(kk().warehouseDeleted, 'Қойма жойылды');
      expect(ru().deleteWarehouseConfirm('Главный', 'MAIN'),
          'Склад «Главный» (MAIN) будет архивирован. Это действие нельзя отменить.');
      expect(kk().deleteWarehouseConfirm('Басты', 'MAIN'),
          '«Басты» (MAIN) қоймасы мұрағатталады. Бұл әрекетті қайтару мүмкін емес.');
      expect(ru().defaultWarehouse, 'Склад по умолчанию');
      expect(kk().defaultWarehouse, 'Негізгі қойма');
    });
  });

  group('StatusBadge renders movement types', () {
    Future<void> pump(WidgetTester tester, Locale locale, String type) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: StatusBadge(status: type)),
        ),
      );
    }

    testWidgets('EN: SALE/TRANSFER_IN', (tester) async {
      await pump(tester, const Locale('en'), 'SALE');
      expect(find.text('Sale'), findsOneWidget);
      await pump(tester, const Locale('en'), 'TRANSFER_IN');
      expect(find.text('Transfer In'), findsOneWidget);
    });

    testWidgets('RU: SALE → «Продажа», no raw enum', (tester) async {
      await pump(tester, const Locale('ru'), 'SALE');
      expect(find.text('Продажа'), findsOneWidget);
      expect(find.text('SALE'), findsNothing);
    });

    testWidgets('KK: PURCHASE → «Сатып алу»', (tester) async {
      await pump(tester, const Locale('kk'), 'PURCHASE');
      expect(find.text('Сатып алу'), findsOneWidget);
    });
  });

  group('StockBadge levels localize', () {
    Future<void> pump(WidgetTester tester, Locale locale,
        {required int quantity, required bool outOfStock, required bool lowStock}) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: StockBadge(
              quantity: quantity,
              outOfStock: outOfStock,
              lowStock: lowStock,
            ),
          ),
        ),
      );
    }

    testWidgets('EN: Out / Low / quantity', (tester) async {
      await pump(tester, const Locale('en'),
          quantity: 0, outOfStock: true, lowStock: false);
      expect(find.text('Out'), findsOneWidget);
      await pump(tester, const Locale('en'),
          quantity: 2, outOfStock: false, lowStock: true);
      expect(find.text('Low'), findsOneWidget);
      await pump(tester, const Locale('en'),
          quantity: 10, outOfStock: false, lowStock: false);
      expect(find.text('10'), findsOneWidget);
    });

    testWidgets('RU: Нет / Мало / quantity for OK', (tester) async {
      await pump(tester, const Locale('ru'),
          quantity: 0, outOfStock: true, lowStock: false);
      expect(find.text('Нет'), findsOneWidget);
      await pump(tester, const Locale('ru'),
          quantity: 2, outOfStock: false, lowStock: true);
      expect(find.text('Мало'), findsOneWidget);
      // OK state renders the quantity number (StockBadge), not a label.
      await pump(tester, const Locale('ru'),
          quantity: 7, outOfStock: false, lowStock: false);
      expect(find.text('7'), findsOneWidget);
    });
  });

  group('MovementTile renders localized type', () {
    StockMovement movement(String type) => StockMovement(
          id: 'mv-1',
          companyId: 'c1',
          productId: 'p1',
          warehouseId: 'w1',
          type: type,
          quantity: -2,
          beforeQuantity: 10,
          afterQuantity: 8,
          createdAt: '2026-07-01T00:00:00.000Z',
        );

    Future<void> pump(WidgetTester tester, Locale locale, String type) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: MovementTile(movement: movement(type))),
        ),
      );
    }

    testWidgets('EN: SALE → Sale', (tester) async {
      await pump(tester, const Locale('en'), 'SALE');
      expect(find.text('Sale'), findsOneWidget);
    });

    testWidgets('RU: LOSS → «Потери»', (tester) async {
      await pump(tester, const Locale('ru'), 'LOSS');
      expect(find.text('Потери'), findsOneWidget);
      expect(find.text('LOSS'), findsNothing);
    });

    testWidgets('KK: CORRECTION → «Түзетім»', (tester) async {
      await pump(tester, const Locale('kk'), 'CORRECTION');
      expect(find.text('Түзетім'), findsOneWidget);
    });
  });
}
