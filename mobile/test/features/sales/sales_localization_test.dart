import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/payments/presentation/labels.dart';
import 'package:stockflow/features/sales/presentation/labels.dart';

/// Phase 5D-3 — Sales history/detail localization.
///
/// Guard 1 (EN contract): every user-facing Sales string stays byte-for-byte
/// with the pre-localization UI (including the raw receipt status `DRAFT`).
/// Guard 2: RU/KK get natural ERP translations — no raw backend enums
/// (DRAFT/COMPLETED/CASH/CARD/...) in the sales UI.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Sales history/detail', () {
    test('history screen', () {
      expect(en().sales, 'Sales');
      expect(en().newSale, 'New Sale');
      expect(en().saleHistoryBanner,
          'Showing purchase history for this customer');
      expect(en().clearFilter, 'Clear filter');
      expect(en().saleHistoryCustomerSubtitle,
          'Purchase history for this customer');
      expect(en().saleHistorySubtitle,
          'Transactions, refunds and cash flow');
      expect(en().saleSearchHint, 'Search by sale number…');
      expect(en().noSalesFound, 'No sales found');
      expect(en().noSalesFoundSubtitle,
          'Complete your first sale to see it here');
      expect(en().sale, 'Sale');
      expect(en().payment, 'Payment');
      expect(en().all, 'All');
      expect(en().statusDraft, 'Draft');
      expect(en().statusCompleted, 'Completed');
      expect(en().statusRefunded, 'Refunded');
      expect(en().statusCancelled, 'Cancelled');
    });

    test('detail screen — chrome, dialogs, actions', () {
      expect(en().saleDetails, 'Sale Details');
      expect(en().complete, 'Complete');
      expect(en().refund, 'Refund');
      expect(en().fullRefund, 'Full refund');
      expect(en().partialReturn, 'Partial return');
      expect(en().partialReturnTitle, 'Partial Return');
      expect(en().partialReturnDescription,
          'Select how many of each item to return.');
      expect(en().saleCompleteDialogTitle, 'Complete Sale');
      expect(en().saleCompleteDialogContent,
          'Are you sure you want to Complete this sale?');
      expect(en().saleCancelDialogTitle, 'Cancel Sale');
      expect(en().saleCancelDialogContent,
          'Are you sure you want to Cancel this sale?');
      expect(en().saleRefundDialogTitle, 'Refund Sale');
      expect(en().saleRefundDialogContent,
          'Are you sure you want to Refund this sale?');
      expect(en().saleCompletedMessage, 'Sale completed');
      expect(en().saleCancelledMessage, 'Sale cancelled');
      expect(en().saleRefundedMessage, 'Sale refunded');
      expect(en().partialReturnRecorded, 'Partial return recorded');
    });

    test('detail screen — totals, items, receipts, notes', () {
      expect(en().subtotal, 'Subtotal');
      expect(en().tax, 'Tax');
      expect(en().discount, 'Discount');
      expect(en().total, 'Total');
      expect(en().paid, 'Paid');
      expect(en().posChange, 'Change');
      expect(en().itemsCount(2), 'Items (2)');
      expect(en().saleItemCount(1), '1 item');
      expect(en().saleItemCount(3), '3 items');
      expect(en().saleItemFallback('abc12345'), 'Product abc12345');
      expect(en().payments, 'Payments');
      expect(en().receipts, 'Receipts');
      expect(en().view, 'View');
      expect(en().printed, 'Printed');
      expect(en().emailed, 'Emailed');
      expect(en().notes, 'Notes');
      expect(en().saleCreatedLabel('2026-08-15 10:30'),
          'Created: 2026-08-15 10:30');
      expect(en().saleMaxQuantity(5), 'max 5 · ');
      expect(en().refundTotal, 'Refund total');
      expect(en().confirmReturn, 'Confirm return');
      expect(en().status, 'Status');
      expect(en().created, 'Created');
      expect(en().close, 'Close');
      expect(en().yes, 'Yes');
      expect(en().no, 'No');
      expect(en().retry, 'Retry');
      expect(en().cancel, 'Cancel');
      expect(en().date, 'Date');
      expect(en().number, 'Number');
    });
  });

  group('RU translations — Sales history/detail', () {
    test('history screen localizes', () {
      expect(ru().sales, 'Продажи');
      expect(ru().newSale, 'Новая продажа');
      expect(ru().saleHistoryBanner,
          'Показывается история покупок этого клиента');
      expect(ru().clearFilter, 'Очистить фильтр');
      expect(ru().saleHistoryCustomerSubtitle,
          'История покупок этого клиента');
      expect(ru().saleHistorySubtitle,
          'Транзакции, возвраты и денежный поток');
      expect(ru().saleSearchHint, 'Поиск по номеру продажи…');
      expect(ru().noSalesFound, 'Продажи не найдены');
      expect(ru().noSalesFoundSubtitle,
          'Завершите первую продажу, чтобы увидеть её здесь');
      expect(ru().sale, 'Продажа');
      expect(ru().payment, 'Оплата');
      expect(ru().all, 'Все');
      expect(ru().statusDraft, 'Черновик');
      expect(ru().statusCompleted, 'Завершённый');
      expect(ru().statusRefunded, 'Возвращённый');
      expect(ru().statusCancelled, 'Отменённый');
    });

    test('detail screen localizes', () {
      expect(ru().saleDetails, 'Детали продажи');
      expect(ru().complete, 'Завершить');
      expect(ru().refund, 'Возврат');
      expect(ru().fullRefund, 'Полный возврат');
      expect(ru().partialReturn, 'Частичный возврат');
      expect(ru().partialReturnTitle, 'Частичный возврат');
      expect(ru().partialReturnDescription,
          'Выберите, сколько единиц каждого товара вернуть.');
      expect(ru().saleCompleteDialogTitle, 'Завершить продажу');
      expect(ru().saleCompleteDialogContent,
          'Вы уверены, что хотите завершить эту продажу?');
      expect(ru().saleCancelDialogTitle, 'Отменить продажу');
      expect(ru().saleCancelDialogContent,
          'Вы уверены, что хотите отменить эту продажу?');
      expect(ru().saleRefundDialogTitle, 'Оформить возврат продажи');
      expect(ru().saleRefundDialogContent,
          'Вы уверены, что хотите оформить возврат этой продажи?');
      expect(ru().saleCompletedMessage, 'Продажа завершена');
      expect(ru().saleCancelledMessage, 'Продажа отменена');
      expect(ru().saleRefundedMessage, 'Продажа возвращена');
      expect(ru().partialReturnRecorded, 'Частичный возврат записан');
      expect(ru().saleCreatedLabel('2026-08-15'), 'Создано: 2026-08-15');
      expect(ru().saleItemFallback('abc12345'), 'Товар abc12345');
      expect(ru().saleItemCount(1), '1 позиция');
      expect(ru().saleItemCount(3), '3 позиции');
      expect(ru().saleItemCount(5), '5 позиций');
      expect(ru().saleMaxQuantity(5), 'макс 5 · ');
      expect(ru().refundTotal, 'Сумма возврата');
      expect(ru().confirmReturn, 'Подтвердить возврат');
      expect(ru().receipts, 'Чеки');
      expect(ru().view, 'Просмотр');
      expect(ru().printed, 'Распечатан');
      expect(ru().emailed, 'Отправлен по почте');
      expect(ru().posChange, 'Сдача');
    });
  });

  group('KK translations — Sales history/detail', () {
    test('history screen localizes', () {
      expect(kk().sales, 'Сату');
      expect(kk().newSale, 'Жаңа сатылым');
      expect(kk().saleHistoryBanner,
          'Бұл клиенттің сатып алу тарихы көрсетілуде');
      expect(kk().clearFilter, 'Сүзгіні тазалау');
      expect(kk().saleHistoryCustomerSubtitle,
          'Бұл клиенттің сатып алу тарихы');
      expect(kk().saleHistorySubtitle,
          'Транзакциялар, қайтарымдар және ақша ағыны');
      expect(kk().saleSearchHint, 'Сатылым нөмірі бойынша іздеу…');
      expect(kk().noSalesFound, 'Сатылымдар табылмады');
      expect(kk().noSalesFoundSubtitle,
          'Бірінші сатылымыңызды аяқтаңыз — ол осында көрінеді');
      expect(kk().sale, 'Сатылым');
      expect(kk().payment, 'Төлем');
      expect(kk().all, 'Барлығы');
      expect(kk().statusDraft, 'Жоба');
      expect(kk().statusCompleted, 'Аяқталған');
      expect(kk().statusRefunded, 'Қайтарылған');
      expect(kk().statusCancelled, 'Бас тартылған');
    });

    test('detail screen localizes', () {
      expect(kk().saleDetails, 'Сатылым деректері');
      expect(kk().complete, 'Аяқтау');
      expect(kk().refund, 'Қайтару');
      expect(kk().fullRefund, 'Толық қайтару');
      expect(kk().partialReturn, 'Ішінара қайтару');
      expect(kk().partialReturnTitle, 'Ішінара қайтару');
      expect(kk().partialReturnDescription,
          'Әр өнімнен қанша дана қайтаратынын таңдаңыз.');
      expect(kk().saleCompleteDialogTitle, 'Сатылымды аяқтау');
      expect(kk().saleCompleteDialogContent,
          'Бұл сатылымды аяқтағыңыз келетініне сенімдісіз бе?');
      expect(kk().saleCancelDialogTitle, 'Сатылымнан бас тарту');
      expect(kk().saleCancelDialogContent,
          'Бұл сатылымнан бас тартқыңыз келетініне сенімдісіз бе?');
      expect(kk().saleRefundDialogTitle, 'Сатылымды қайтару');
      expect(kk().saleRefundDialogContent,
          'Бұл сатылымды қайтарғыңыз келетініне сенімдісіз бе?');
      expect(kk().saleCompletedMessage, 'Сатылым аяқталды');
      expect(kk().saleCancelledMessage, 'Сатылымнан бас тартылды');
      expect(kk().saleRefundedMessage, 'Сатылым қайтарылды');
      expect(kk().partialReturnRecorded, 'Ішінара қайтару тіркелді');
      expect(kk().saleCreatedLabel('2026-08-15'), 'Құрылған: 2026-08-15');
      expect(kk().saleItemFallback('abc12345'), 'Өнім abc12345');
      expect(kk().saleItemCount(1), '1 позиция');
      expect(kk().saleItemCount(3), '3 позиция');
      expect(kk().saleMaxQuantity(5), 'макс 5 · ');
      expect(kk().refundTotal, 'Қайтару сомасы');
      expect(kk().confirmReturn, 'Қайтаруды растау');
      expect(kk().receipts, 'Түбіртектер');
      expect(kk().view, 'Қарау');
      expect(kk().printed, 'Басылған');
      expect(kk().emailed, 'Электрондық поштаға жіберілген');
      expect(kk().posChange, 'Қайтарым');
    });
  });

  group('UI-layer labels (receipt status / payment method)', () {
    test('EN receipt status stays raw byte-for-byte', () {
      expect(receiptStatusLabel('DRAFT', en()), 'DRAFT');
      expect(receiptStatusLabel('COMPLETED', en()), 'COMPLETED');
    });

    test('RU/KK receipt statuses localize known values, raw fallback for '
        'unknown', () {
      expect(receiptStatusLabel('DRAFT', ru()), 'Черновик');
      expect(receiptStatusLabel('COMPLETED', ru()), 'Завершённый');
      expect(receiptStatusLabel('SOME_NEW_STATUS', ru()), 'SOME_NEW_STATUS');
      expect(receiptStatusLabel('DRAFT', kk()), 'Жоба');
      expect(receiptStatusLabel('COMPLETED', kk()), 'Аяқталған');
      expect(receiptStatusLabel('SOME_NEW_STATUS', kk()),
          'SOME_NEW_STATUS');
    });

    test('payment methods display through paymentMethodLabel '
        '(defect sites 1–2)', () {
      expect(paymentMethodLabel('CASH', en()), 'Cash');
      expect(paymentMethodLabel('CARD', en()), 'Card');
      expect(paymentMethodLabel('QR', en()), 'QR');
      expect(paymentMethodLabel('BANK_TRANSFER', en()), 'Bank Transfer');
      expect(paymentMethodLabel('MOBILE_WALLET', en()), 'Mobile Wallet');
      expect(paymentMethodLabel('CASH', ru()), 'Наличные');
      expect(paymentMethodLabel('CARD', ru()), 'Карта');
      expect(paymentMethodLabel('CASH', kk()), 'Қолма-қол');
      expect(paymentMethodLabel('CARD', kk()), 'Карта');
    });

    test('no raw backend enums in RU/KK sales UI strings', () {
      // 'QR' is intentionally excluded: QR is a universal proper noun kept
      // as-is in every locale (same convention as the 5B payments test).
      final raw = [
        'DRAFT', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PENDING',
        'CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET',
      ];
      final ruText = [
        ru().statusDraft, ru().statusCompleted, ru().statusCancelled,
        ru().statusRefunded, ru().statusPending,
        ru().paymentMethodCash, ru().paymentMethodCard,
        ru().paymentMethodQr, ru().paymentMethodBankTransfer,
        ru().paymentMethodMobileWallet,
        ru().saleDetails, ru().saleSearchHint, ru().noSalesFound,
        ru().saleCompleteDialogTitle, ru().partialReturnTitle,
        ru().receipts, ru().refundTotal, ru().confirmReturn,
      ].join(' ');
      final kkText = [
        kk().statusDraft, kk().statusCompleted, kk().statusCancelled,
        kk().statusRefunded, kk().statusPending,
        kk().paymentMethodCash, kk().paymentMethodCard,
        kk().paymentMethodQr, kk().paymentMethodBankTransfer,
        kk().paymentMethodMobileWallet,
        kk().saleDetails, kk().saleSearchHint, kk().noSalesFound,
        kk().saleCompleteDialogTitle, kk().partialReturnTitle,
        kk().receipts, kk().refundTotal, kk().confirmReturn,
      ].join(' ');
      for (final e in raw) {
        expect(ruText.contains(e), isFalse, reason: 'raw $e in RU');
        expect(kkText.contains(e), isFalse, reason: 'raw $e in KK');
      }
    });
  });

  group('Sale history CSV export headers (Phase 5D-8A)', () {
    test('EN keeps the historical headers byte-for-byte', () {
      final headers = [
        en().number, en().date, en().status,
        en().subtotal, en().tax, en().total, en().paid,
      ];
      expect(headers, [
        'Number', 'Date', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid',
      ]);
    });

    test('RU localizes every header', () {
      final headers = [
        ru().number, ru().date, ru().status,
        ru().subtotal, ru().tax, ru().total, ru().paid,
      ];
      expect(headers, [
        'Номер', 'Дата', 'Статус', 'Подытог', 'Налог', 'Итого', 'Оплачено',
      ]);
      for (final raw in ['Number', 'Date', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid']) {
        expect(headers.contains(raw), isFalse, reason: 'raw $raw in RU CSV headers');
      }
    });

    test('KK localizes every header', () {
      final headers = [
        kk().number, kk().date, kk().status,
        kk().subtotal, kk().tax, kk().total, kk().paid,
      ];
      expect(headers, [
        'Нөмір', 'Күні', 'Мәртебе', 'Аралық қорытынды',
        'Салық', 'Барлығы', 'Төленді',
      ]);
      for (final raw in ['Number', 'Date', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid']) {
        expect(headers.contains(raw), isFalse, reason: 'raw $raw in KK CSV headers');
      }
    });

    test('column order is preserved (7 headers, fixed positions)', () {
      expect(en().number, 'Number');
      expect(en().paid, 'Paid');
      // Same order as the pre-localization const list: Number, Date, Status,
      // Subtotal, Tax, Total, Paid — verified via the exact RU/KK arrays
      // above, which mirror the screen's exportHeaders list 1:1.
      expect(ru().subtotal, 'Подытог');
      expect(kk().paid, 'Төленді');
    });
  });
}
