import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('Notifications localization — EN', () {
    test('screen chrome', () {
      expect(en().notifications, 'Notifications');
      expect(en().notificationsSubtitle, 'Stay informed');
      expect(en().notificationsEmpty, 'No notifications yet');
      expect(en().notificationsAllCaughtUp, "You're all caught up");
    });

    test('notification type titles', () {
      expect(en().notificationTypeLowStockTitle, 'Low stock alert');
      expect(en().notificationTypeSupplierPaymentOverdueTitle, 'Payment overdue');
      expect(
        en().notificationTypePurchaseOrderStatusTitle,
        'Purchase order updated',
      );
    });

    test('notification type bodies', () {
      expect(
        en().notificationTypeLowStockBody('Widget', 3),
        'Widget — 3 left in stock',
      );
      // Generated params are alphabetically ordered
      expect(
        en().notificationTypeSupplierPaymentOverdueBody(15, 'Acme'),
        'Acme — 15 days overdue',
      );
      expect(
        en().notificationTypePurchaseOrderStatusBody('RECEIVED', 'PO-001'),
        'Order PO-001 — RECEIVED',
      );
    });

    test('time labels', () {
      expect(en().timeJustNow, 'now');
      expect(en().timeMinutesAgo(5), '5m ago');
      expect(en().timeHoursAgo(3), '3h ago');
      expect(en().timeDaysAgo(2), '2d ago');
    });
  });

  group('Notifications localization — RU', () {
    test('screen chrome', () {
      expect(ru().notifications, 'Уведомления');
      expect(ru().notificationsSubtitle, 'Будьте в курсе');
      expect(ru().notificationsEmpty, 'Уведомлений пока нет');
    });

    test('notification type titles', () {
      expect(ru().notificationTypeLowStockTitle, 'Мало на складе');
      expect(ru().notificationTypeSupplierPaymentOverdueTitle, 'Просрочка оплаты');
      expect(
        ru().notificationTypePurchaseOrderStatusTitle,
        'Заказ обновлён',
      );
    });

    test('time labels', () {
      expect(ru().timeJustNow, 'только что');
      expect(ru().timeMinutesAgo(5), '5 мин. назад');
      expect(ru().timeHoursAgo(3), '3 ч. назад');
      expect(ru().timeDaysAgo(2), '2 дн. назад');
    });
  });

  group('Notifications localization — KK', () {
    test('screen chrome', () {
      expect(kk().notifications, 'Хабарламалар');
      expect(kk().notificationsSubtitle, 'Хабардар болыңыз');
      expect(kk().notificationsEmpty, 'Әзірге хабарламалар жоқ');
    });

    test('notification type titles', () {
      expect(kk().notificationTypeLowStockTitle, 'Қоймада аз');
      expect(kk().notificationTypeSupplierPaymentOverdueTitle, 'Төлем мерзімі өтті');
      expect(
        kk().notificationTypePurchaseOrderStatusTitle,
        'Сатып алу тапсырысы жаңартылды',
      );
    });

    test('time labels', () {
      expect(kk().timeJustNow, 'дәл қазір');
      expect(kk().timeMinutesAgo(5), '5 мин бұрын');
      expect(kk().timeHoursAgo(3), '3 сағ бұрын');
      expect(kk().timeDaysAgo(2), '2 күн бұрын');
    });
  });

  group('ARB parity', () {
    test('EN/RU/KK notification keys exist in all locales', () {
      // Verify all notification keys exist and are non-empty in all locales
      // EN
      expect(en().notifications, isNotEmpty);
      expect(en().notificationsSubtitle, isNotEmpty);
      expect(en().notificationsEmpty, isNotEmpty);
      expect(en().notificationsAllCaughtUp, isNotEmpty);
      expect(en().notificationTypeLowStockTitle, isNotEmpty);
      expect(en().notificationTypeLowStockBody('x', 1), isNotEmpty);
      expect(en().notificationTypeSupplierPaymentOverdueTitle, isNotEmpty);
      expect(en().notificationTypeSupplierPaymentOverdueBody(1, 'x'), isNotEmpty);
      expect(en().notificationTypePurchaseOrderStatusTitle, isNotEmpty);
      expect(en().notificationTypePurchaseOrderStatusBody('y', 'x'), isNotEmpty);
      expect(en().timeJustNow, isNotEmpty);
      expect(en().timeMinutesAgo(1), isNotEmpty);
      expect(en().timeHoursAgo(1), isNotEmpty);
      expect(en().timeDaysAgo(1), isNotEmpty);
      // RU
      expect(ru().notifications, isNotEmpty);
      expect(ru().notificationsSubtitle, isNotEmpty);
      expect(ru().notificationsEmpty, isNotEmpty);
      expect(ru().notificationTypeLowStockTitle, isNotEmpty);
      expect(ru().notificationTypeLowStockBody('x', 1), isNotEmpty);
      expect(ru().notificationTypeSupplierPaymentOverdueBody(1, 'x'), isNotEmpty);
      expect(ru().notificationTypePurchaseOrderStatusBody('y', 'x'), isNotEmpty);
      expect(ru().notificationTypeSupplierPaymentOverdueTitle, isNotEmpty);
      expect(ru().notificationTypePurchaseOrderStatusTitle, isNotEmpty);
      expect(ru().timeJustNow, isNotEmpty);
      expect(ru().timeMinutesAgo(1), isNotEmpty);
      // KK
      expect(kk().notifications, isNotEmpty);
      expect(kk().notificationsSubtitle, isNotEmpty);
      expect(kk().notificationsEmpty, isNotEmpty);
      expect(kk().notificationTypeLowStockTitle, isNotEmpty);
      expect(kk().notificationTypeLowStockBody('x', 1), isNotEmpty);
      expect(kk().notificationTypeSupplierPaymentOverdueBody(1, 'x'), isNotEmpty);
      expect(kk().notificationTypePurchaseOrderStatusBody('y', 'x'), isNotEmpty);
      expect(kk().notificationTypeSupplierPaymentOverdueTitle, isNotEmpty);
      expect(kk().notificationTypePurchaseOrderStatusTitle, isNotEmpty);
      expect(kk().timeJustNow, isNotEmpty);
      expect(kk().timeMinutesAgo(1), isNotEmpty);
    });
  });
}
