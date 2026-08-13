import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// Phase 3C — POS localization.
///
/// Guard 1 (browser/E2E contract): EN values must stay byte-for-byte with the
/// pre-localization UI (pos_semantics.spec.ts and pos_workspace_test.dart
/// assert these exact strings via innerText / find.text).
/// Guard 2: RU/KK get natural ERP translations, not machine stubs.
/// Guard 3: backend enums shown by the POS (stock levels OUT/LOW/OK) are
/// localized on the UI layer; unknown values fall back to the raw value.
/// Guard 4: provider validation messages localize only when l10n is passed.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — POS workspace', () {
    test('toolbar + hotkeys unchanged', () {
      expect(en().posCashierTerminal, 'Cashier Terminal');
      expect(en().posToolbarHints,
          'F2 search · F4 customer · F8 payment · F9 complete · '
          'Ctrl+Del clear · Enter add · ESC clear');
      expect(en().posItemsTotalSummary(r'$50.00', 2), r'2 items · $50.00');
      expect(en().posItemsCount(2), '2 items');
    });

    test('cart + totals + payment unchanged', () {
      expect(en().posCartItemsCount(2), 'Cart (2 items)');
      expect(en().posSubtotal, 'Subtotal');
      expect(en().posDiscount, 'Discount');
      expect(en().posTax, 'Tax');
      expect(en().posTotal, 'Total');
      expect(en().posPayment, 'Payment');
      expect(en().posPaid, 'Paid');
      expect(en().posChange, 'Change');
      expect(en().posCompleteSale(r'$100.00'), r'Complete Sale — $100.00');
      expect(en().posInsufficientPayment, 'Insufficient payment');
      expect(en().posCartFooterHints,
          'F9 to complete · F8 to payment · F4 customer');
      expect(en().posCartEmpty, 'Cart is empty');
      expect(en().posCartEmptyHint,
          'Search products on the left, then press Enter');
      expect(en().posClear, 'Clear');
    });

    test('catalog unchanged', () {
      expect(en().posCatalogSearchHint,
          'Search by name, SKU or barcode…  (F2)');
      expect(en().posCatalogFooter(10, 35),
          '10 of 35 · Enter to add · ↑↓ to navigate');
      expect(en().posNoProductsFound, 'No products found');
      expect(en().posTryDifferentSearch, 'Try a different search term');
      expect(en().loadMore, 'Load more');
    });

    test('shift strip + dialogs unchanged', () {
      expect(en().posShiftOpen, 'Shift OPEN');
      expect(en().posOpenShift, 'Open Shift');
      expect(en().posOpenShiftConfirm, 'Open shift');
      expect(en().posOpenCashShiftTitle, 'Open Cash Shift');
      expect(en().noOpenShift, 'No open shift');
      expect(en().posXReport, 'X Report');
      expect(en().posCashInLabel, 'Cash In');
      expect(en().posCashOutLabel, 'Cash Out');
      expect(en().posCloseShiftLabel, 'Close Shift');
      expect(en().posTooltipOpenShift, 'Open cash shift (F5)');
      expect(
        en().posShiftTotals('100.00', '200.00', '300.00', '400.00', '500.00',
            '600.00'),
        '· Cash 300.00 · Card 200.00 · QR 400.00 · Bank 100.00 · '
        'Wallet 600.00 · Total 500.00',
      );
    });

    test('X/Z report rows unchanged', () {
      expect(en().posZReport, 'Z Report');
      expect(en().posOpeningBalance, 'Opening balance');
      expect(en().posCashSales, 'Cash sales');
      expect(en().posCardSales, 'Card sales');
      expect(en().posQrSales, 'QR sales');
      expect(en().posBankSales, 'Bank transfer sales');
      expect(en().posWalletSales, 'Mobile wallet sales');
      expect(en().posTotalSales, 'Total sales');
      expect(en().posExpectedClosing, 'Expected closing');
      expect(en().posDifference, 'Difference');
      expect(en().posClosedAt('13 Aug, 10:00'), 'Closed 13 Aug, 10:00');
    });

    test('receipt + customer picker + held sales unchanged', () {
      expect(en().posSaleCompleted, 'Sale completed');
      expect(en().posNewSale, 'New sale');
      expect(en().posReceipt, 'Receipt');
      expect(en().posPayments, 'Payments');
      expect(en().posThankYou, 'Thank you for your purchase!');
      expect(en().posStatus('Completed'), 'Status: Completed');
      expect(en().posSelectCustomer, 'Select customer');
      expect(en().posNewCustomer, 'New customer');
      expect(en().posWalkInCustomerF4, 'Walk-in customer (F4)');
      expect(en().posResumeHeldSale, 'Resume held sale');
      expect(en().posNoHeldSales, 'No held sales');
    });

    test('payment method codes stay byte-for-byte in EN', () {
      expect(en().posPaymentCash, 'CASH');
      expect(en().posPaymentCard, 'CARD');
      expect(en().posPaymentQr, 'QR');
      expect(en().posPaymentSplit, 'Split');
      expect(en().posCash, 'Cash');
      expect(en().posCard, 'Card');
      expect(en().posQrOther, 'QR / Other');
    });

    test('validation + clear-cart composition unchanged', () {
      expect(en().posClearCartTitle, 'Clear cart?');
      expect(en().posClearCartButton, 'Clear cart');
      expect(en().posClearCartConfirm(r'$100.00', 2),
          r'Remove all 2 items ($100.00) from the cart?');
      expect(en().posCartEmpty, 'Cart is empty');
      expect(en().posInvalidQuantity('Croissant'),
          'Invalid quantity for Croissant');
      expect(en().posInvalidPrice('Croissant'), 'Invalid price for Croissant');
    });
  });

  group('RU translations — POS', () {
    test('toolbar + cart + catalog are natural Russian', () {
      expect(ru().posCashierTerminal, 'Кассовый терминал');
      expect(ru().posToolbarHints,
          'F2 поиск · F4 клиент · F8 оплата · F9 завершить · '
          'Ctrl+Del очистить · Enter добавить · ESC очистить');
      expect(ru().posCartEmpty, 'Корзина пуста');
      expect(ru().posSubtotal, 'Подытог');
      expect(ru().posDiscount, 'Скидка');
      expect(ru().posTax, 'Налог');
      expect(ru().posTotal, 'Итого');
      expect(ru().posPayment, 'Оплата');
      expect(ru().posPaid, 'Оплачено');
      expect(ru().posChange, 'Сдача');
      expect(ru().posOpenShift, 'Открыть смену');
      expect(ru().posNoProductsFound, 'Товары не найдены');
    });

    test('no raw enums leak in RU', () {
      expect(ru().posPaymentCash, 'НАЛИЧНЫЕ');
      expect(ru().posPaymentCard, 'КАРТА');
      expect(ru().posShiftOpen, 'СМЕНА ОТКРЫТА');
      expect(ru().levelOut, 'Нет');
      expect(ru().levelLow, 'Мало');
      expect(ru().levelOk, 'ОК');
    });
  });

  group('KK translations — POS', () {
    test('toolbar + cart + catalog are natural Kazakh', () {
      expect(kk().posCashierTerminal, 'Кассалық терминал');
      expect(kk().posToolbarHints,
          'F2 іздеу · F4 клиент · F8 төлем · F9 аяқтау · '
          'Ctrl+Del тазалау · Enter қосу · ESC тазалау');
      expect(kk().posCartEmpty, 'Себет бос');
      expect(kk().posSubtotal, 'Аралық сома');
      expect(kk().posDiscount, 'Жеңілдік');
      expect(kk().posTax, 'Салық');
      expect(kk().posTotal, 'Барлығы');
      expect(kk().posOpenShift, 'Ауысымды ашу');
      expect(kk().posNoProductsFound, 'Тауарлар табылмады');
    });

    test('no raw enums leak in KK', () {
      expect(kk().posPaymentCash, 'ҚОЛМА-ҚОЛ');
      expect(kk().posPaymentCard, 'КАРТА');
      expect(kk().posShiftOpen, 'АУЫСЫМ АШЫҚ');
      expect(kk().levelOut, 'Жоқ');
      expect(kk().levelLow, 'Аз');
      expect(kk().levelOk, 'ОК');
    });
  });

  group('Stock level statuses (OUT/LOW/OK)', () {
    test('EN keeps the historical title-cased rendering', () {
      expect(StatusBadge.statusLabel('OUT', en()), 'Out');
      expect(StatusBadge.statusLabel('LOW', en()), 'Low');
      expect(StatusBadge.statusLabel('OK', en()), 'OK');
    });

    test('RU/KK localize known values', () {
      expect(StatusBadge.statusLabel('OUT', ru()), ru().levelOut);
      expect(StatusBadge.statusLabel('LOW', kk()), kk().levelLow);
      expect(StatusBadge.statusLabel('OK', ru()), ru().levelOk);
    });

    test('unknown values fall back to the raw Formatters.status rendering', () {
      expect(StatusBadge.statusLabel('CUSTOM_STATUS', en()),
          Formatters.status('CUSTOM_STATUS'));
      expect(StatusBadge.statusLabel('CUSTOM_STATUS', ru()),
          Formatters.status('CUSTOM_STATUS'));
      expect(StatusBadge.statusLabel('CUSTOM_STATUS', kk()),
          Formatters.status('CUSTOM_STATUS'));
    });
  });

  group('Cart validation messages', () {
    test('localize only when l10n is passed (default stays English)', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(cartProvider.notifier);

      expect(notifier.validate(), 'Cart is empty');
      expect(notifier.validate(ru()), ru().posCartEmpty);
      expect(notifier.validate(kk()), kk().posCartEmpty);

      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'Croissant',
        productSku: 'CRS',
        quantity: 0,
        unitPrice: 50,
        costPrice: 20,
      ));
      expect(notifier.validate(), 'Invalid quantity for Croissant');
      expect(notifier.validate(ru()), ru().posInvalidQuantity('Croissant'));
      expect(notifier.validate(kk()), kk().posInvalidQuantity('Croissant'));

      notifier.clear();
      notifier.addItem(const CartItem(
        productId: 'p1',
        productName: 'Croissant',
        productSku: 'CRS',
        quantity: 1,
        unitPrice: -5,
        costPrice: 20,
      ));
      expect(notifier.validate(), 'Invalid price for Croissant');
      expect(notifier.validate(ru()), ru().posInvalidPrice('Croissant'));
      expect(notifier.validate(kk()), kk().posInvalidPrice('Croissant'));
    });
  });
}
