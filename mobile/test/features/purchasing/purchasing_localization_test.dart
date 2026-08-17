import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// Phase 5C — Purchasing localization.
///
/// Guard 1 (EN contract): every user-facing Purchasing string stays
/// byte-for-byte with the pre-localization UI.
/// Guard 2: RU/KK localize every known PO status — no raw backend enums
/// (DRAFT/PENDING/APPROVED/ORDERED/PARTIALLY_RECEIVED/RECEIVED/CANCELLED).
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Purchasing', () {
    test('list screen chrome', () {
      expect(en().purchasing, 'Purchasing');
      expect(en().purchasingSubtitle,
          'Purchase orders, goods receipts and returns');
      expect(en().poSearchHint, 'Search by order number…');
      expect(en().newOrder, 'New Order');
      expect(en().order, 'Order');
      expect(en().items, 'Items');
      expect(en().grandTotal, 'Grand Total');
      expect(en().noPurchaseOrders, 'No purchase orders');
      expect(en().poEmptySubtitle,
          'Create your first purchase order to start');
    });

    test('detail screen chrome', () {
      expect(en().purchaseOrder, 'Purchase Order');
      expect(en().orderDateLabel('2026-07-14'), 'Order Date: 2026-07-14');
      expect(en().expectedDateLabel('2026-07-20'), 'Expected: 2026-07-20');
      expect(en().approvedByLabel('John'), 'Approved by: John');
      expect(en().subtotal, 'Subtotal');
      expect(en().discount, 'Discount');
      expect(en().tax, 'Tax');
      expect(en().itemsCount(3), 'Items (3)');
      expect(en().productIdLabel('abc12345'), 'Product abc12345');
      expect(en().qtyReceivedLabel(5, 2), 'Qty: 5  |  Received: 2');
      expect(en().receiveGoods, 'Receive Goods');
      expect(en().areYouSure, 'Are you sure?');
      expect(en().approveOrderTitle, 'Approve Order');
      expect(en().orderOrderTitle, 'Order Order');
      expect(en().cancelOrderTitle, 'Cancel Order');
      expect(en().orderApproved, 'Order approved');
      expect(en().orderOrdered, 'Order ordered');
      expect(en().orderCancelled, 'Order cancelled');
    });

    test('form chrome', () {
      expect(en().newPurchaseOrder, 'New Purchase Order');
      expect(en().supplierRequired, 'Supplier *');
      expect(en().addItem, 'Add Item');
      expect(en().selectProduct, 'Select Product');
      expect(en().product, 'Product');
      expect(en().qty, 'Qty');
      expect(en().unitCost, 'Unit Cost');
      expect(en().selectSupplierFirst, 'Select a supplier');
      expect(en().purchaseOrderCreated, 'Purchase order created');
      expect(en().createPurchaseOrder, 'Create Purchase Order');
      expect(en().approve, 'Approve');
      expect(en().placeOrder, 'Order');
      expect(en().poCardDate('Jul 14, 2026'), 'Date: Jul 14, 2026');
    });
  });

  group('POStatus reference — every status in EN/RU/KK', () {
    // The exact strings POStatusBadge renders per backend status, using the
    // l10n keys it now resolves through (Phase 5C reference test — this
    // defect class (raw English in RU/KK) must never return).
    const statuses = [
      'DRAFT',
      'PENDING',
      'APPROVED',
      'ORDERED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CANCELLED',
    ];

    test('EN keeps the historical display byte-for-byte', () {
      expect(en().statusDraft, 'Draft');
      expect(en().statusPending, 'Pending');
      expect(en().statusApproved, 'Approved');
      expect(en().statusOrdered, 'Ordered');
      // POStatusBadge uses this dedicated key because its historical EN
      // display ("Partially Received") differs from the shared StatusBadge
      // ("Partially received").
      expect(en().poStatusPartiallyReceived, 'Partially Received');
      expect(en().statusReceived, 'Received');
      expect(en().statusCancelled, 'Cancelled');
    });

    test('RU localizes every PO status — no raw enums', () {
      expect(ru().statusDraft, 'Черновик');
      expect(ru().statusPending, 'В ожидании');
      expect(ru().statusApproved, 'Утверждён');
      expect(ru().statusOrdered, 'Заказан');
      expect(ru().poStatusPartiallyReceived, 'Частично получен');
      expect(ru().statusReceived, 'Получен');
      expect(ru().statusCancelled, 'Отменённый');
      for (final s in statuses) {
        expect(ru().poStatusPartiallyReceived.contains(s), isFalse,
            reason: 'raw $s in RU');
      }
    });

    test('KK localizes every PO status — no raw enums', () {
      expect(kk().statusDraft, 'Жоба');
      expect(kk().statusPending, 'Күтуде');
      expect(kk().statusApproved, 'Бекітілген');
      expect(kk().statusOrdered, 'Тапсырылған');
      expect(kk().poStatusPartiallyReceived, 'Жартылай қабылданған');
      expect(kk().statusReceived, 'Қабылданған');
      expect(kk().statusCancelled, 'Бас тартылған');
      for (final s in statuses) {
        expect(kk().poStatusPartiallyReceived.contains(s), isFalse,
            reason: 'raw $s in KK');
      }
    });

    test('all 7 statuses resolve to non-empty localized labels', () {
      for (final l in [en(), ru(), kk()]) {
        for (final s in statuses) {
          final label = switch (s) {
            'DRAFT' => l.statusDraft,
            'PENDING' => l.statusPending,
            'APPROVED' => l.statusApproved,
            'ORDERED' => l.statusOrdered,
            'PARTIALLY_RECEIVED' => l.poStatusPartiallyReceived,
            'RECEIVED' => l.statusReceived,
            'CANCELLED' => l.statusCancelled,
            _ => s,
          };
          expect(label.trim(), isNotEmpty, reason: '$s empty in ${l.localeName}');
        }
      }
    });
  });

  group('RU/KK translations — Purchasing', () {
    test('RU list + detail localize', () {
      expect(ru().purchasing, 'Закупки');
      expect(ru().purchasingSubtitle,
          'Заказы на закупку, приемка товаров и возвраты');
      expect(ru().poSearchHint, 'Поиск по номеру заказа…');
      expect(ru().newOrder, 'Новый заказ');
      expect(ru().order, 'Заказ');
      expect(ru().items, 'Позиции');
      expect(ru().grandTotal, 'Общий итог');
      expect(ru().noPurchaseOrders, 'Заказов на закупку нет');
      expect(ru().orderDateLabel('2026-07-14'), 'Дата заказа: 2026-07-14');
      expect(ru().approvedByLabel('Иван'), 'Утвердил: Иван');
      expect(ru().subtotal, 'Подытог');
      expect(ru().discount, 'Скидка');
      expect(ru().tax, 'Налог');
      expect(ru().receiveGoods, 'Принять товары');
      expect(ru().approveOrderTitle, 'Утвердить заказ');
      expect(ru().orderApproved, 'Заказ утвержден');
      expect(ru().addItem, 'Добавить позицию');
      expect(ru().unitCost, 'Цена за ед.');
      expect(ru().createPurchaseOrder, 'Создать заказ на закупку');
      expect(ru().purchaseOrderCreated, 'Заказ на закупку создан');
      expect(ru().poCardDate('14 июл 2026'), 'Дата: 14 июл 2026');
    });

    test('KK list + detail localize', () {
      expect(kk().purchasing, 'Сатып алу');
      expect(kk().purchasingSubtitle,
          'Сатып алу тапсырыстары, тауар қабылдау және қайтару');
      expect(kk().poSearchHint, 'Тапсырыс нөмірі бойынша іздеу…');
      expect(kk().newOrder, 'Жаңа тапсырыс');
      expect(kk().order, 'Тапсырыс');
      expect(kk().items, 'Позициялар');
      expect(kk().grandTotal, 'Жалпы қорытынды');
      expect(kk().noPurchaseOrders, 'Сатып алу тапсырыстары жоқ');
      expect(kk().orderDateLabel('2026-07-14'), 'Тапсырыс күні: 2026-07-14');
      expect(kk().subtotal, 'Аралық қорытынды');
      expect(kk().discount, 'Жеңілдік');
      expect(kk().tax, 'Салық');
      expect(kk().receiveGoods, 'Тауарларды қабылдау');
      expect(kk().approveOrderTitle, 'Тапсырысты бекіту');
      expect(kk().orderApproved, 'Тапсырыс бекітілді');
      expect(kk().addItem, 'Позиция қосу');
      expect(kk().unitCost, 'Бірл. баға');
      expect(kk().createPurchaseOrder, 'Сатып алу тапсырысын жасау');
      expect(kk().purchaseOrderCreated, 'Сатып алу тапсырысы жасалды');
      expect(kk().poCardDate('14 шіл 2026'), 'Күні: 14 шіл 2026');
    });
  });
}
