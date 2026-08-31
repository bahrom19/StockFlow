import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';
import 'package:stockflow/features/inventory/presentation/widgets/stock_action_dialogs.dart';

/// Phase 5D-7D — stock adjustment/transfer error snackbar localization.
///
/// The dialogs previously rendered `state.error.toString()` raw, which showed
/// the canonical English ErrorHandler message to RU/KK users (bypassing the
/// AppSnackbar chokepoint). They now route through `localizedErrorLabel`.
/// Guard 1: EN keeps the canonical text. Guard 2: RU/KK localize known
/// canonical messages. Guard 3: arbitrary backend/freeform messages use a
/// safe localized fallback in RU/KK. Both dialogs (adjust + transfer) are exercised through
/// the real widget path.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

Warehouse _wh(String id) => Warehouse(
      id: id,
      companyId: 'c1',
      name: 'Warehouse $id',
      code: id,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    );

StockItem _item(String warehouseId) => StockItem(
      id: 'st1',
      companyId: 'c1',
      productId: 'p1',
      warehouseId: warehouseId,
      productName: 'Test Product',
      quantity: 10,
      availableQuantity: 10,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    );

class _FakeAdjustmentNotifier extends AdjustmentNotifier {
  _FakeAdjustmentNotifier(super.ref, this.message);
  final String message;

  @override
  Future<StockMovement?> adjust(AdjustStockDto dto,
      {String? offlineMessage}) async {
    state = AsyncError(message, StackTrace.current);
    return null;
  }
}

class _FakeTransferNotifier extends TransferNotifier {
  _FakeTransferNotifier(super.ref, this.message);
  final String message;

  @override
  Future<List<StockMovement>?> transfer(TransferStockDto dto,
      {String? offlineMessage}) async {
    state = AsyncError(message, StackTrace.current);
    return null;
  }
}

void main() {
  // (dialog launcher, provider override, submit interaction, expected finder)
  for (final (name, launcher, override, interact) in [
    (
      'Adjustment',
      (BuildContext c, List<StockItem> items, List<Warehouse> whs) =>
          showAdjustmentDialog(c,
              items: items, warehouses: whs, preselected: items.first),
      (String msg) =>
          adjustmentProvider.overrideWith((ref) => _FakeAdjustmentNotifier(ref, msg)),
      (WidgetTester t) async {
        await t.enterText(find.byType(TextFormField).first, '5');
      },
    ),
    (
      'Transfer',
      (BuildContext c, List<StockItem> items, List<Warehouse> whs) =>
          showTransferDialog(c,
              items: items, warehouses: whs, preselected: items.first),
      (String msg) =>
          transferProvider.overrideWith((ref) => _FakeTransferNotifier(ref, msg)),
      (WidgetTester t) async {},
    ),
  ]) {
    group('$name dialog — error snackbar localization', () {
      Future<void> pumpAndSubmit(
        WidgetTester tester, {
        required Locale locale,
        required String canonical,
        required String expected,
      }) async {
        final items = [_item('w1')];
        final warehouses = [_wh('w1'), _wh('w2')];
        await tester.pumpWidget(
          ProviderScope(
            overrides: [override(canonical)],
            child: MaterialApp(
              locale: locale,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: Builder(
                builder: (context) => Scaffold(
                  body: Center(
                    child: ElevatedButton(
                      onPressed: () => launcher(context, items, warehouses),
                      child: const Text('open dialog'),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('open dialog'));
        await tester.pumpAndSettle();
        await interact(tester);
        await tester.tap(find.byType(FilledButton).last);
        await tester.pumpAndSettle();

        expect(find.text(expected), findsOneWidget,
            reason: '$name dialog, ${locale.languageCode}: expected snackbar');
        // The no-leak guard only applies when the localized label actually
        // differs from the raw canonical (RU/KK known messages); for EN and
        // for the EN fallback they are the same string by design.
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

      testWidgets('RU localizes no-internet canonical', (tester) async {
        await pumpAndSubmit(
          tester,
          locale: const Locale('ru'),
          canonical: ErrorMessages.noInternet,
          expected: 'Нет подключения к интернету. Проверьте сеть.',
        );
      });

      testWidgets('freeform backend message uses the safe fallback in RU',
          (tester) async {
        await pumpAndSubmit(
          tester,
          locale: const Locale('ru'),
          canonical: 'Backend rejected the request',
          expected: 'Не удалось выполнить операцию. Повторите попытку.',
        );
      });
    });
  }
}
