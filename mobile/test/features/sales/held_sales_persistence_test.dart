import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/currency/money.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/held_sales_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// Phase 5D-6C — held-sale web persistence lifecycle.
///
/// These tests prove REAL storage round-trips (SharedPreferences mock), not
/// in-memory behavior:
///   * save → storage contains the `held_sales_v1` payload;
///   * a brand-new provider/container (reload-equivalent) restores saved sales;
///   * multiple sales survive save + reload;
///   * resume/discard update the persisted payload;
///   * the persisted payload stays schema-compatible (round-trips through
///     `HeldSale.fromJson`/`CartItem.fromJson`).
///
/// The storage is reached through `preferencesStorageProvider` — the exact DI
/// wiring used in production — so these tests fail if the provider ever stops
/// initializing its instance (the original web-persistence bug).
const _storageKey = 'held_sales_v1';

CartState _cart(String sku, double unitPrice, {String? customerName}) =>
    CartState(
      items: [
        CartItem(
          productId: 'p-$sku',
          productName: 'Item $sku',
          productSku: sku,
          quantity: 2,
          unitPrice: Money.fromMinorUnits((unitPrice * 100).round(), 'KZT'),
          costPrice: Money.fromMinorUnits((unitPrice * 50).round(), 'KZT'),
        ),
      ],
      customerId: customerName == null ? null : 'c-$sku',
      customerName: customerName,
    );

Future<String?> _storedRaw() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_storageKey);
}

void main() {
  group('HeldSalesNotifier web persistence', () {
    test('hold persists the payload to SharedPreferences under held_sales_v1',
        () async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(heldSalesProvider.notifier);

      await notifier.hold(_cart('ESP', 10), label: 'Test hold');

      // In-memory state.
      expect(container.read(heldSalesProvider).held.length, 1);
      expect(
        container.read(heldSalesProvider).held.first.total,
        Money.fromMinorUnits(2000, 'KZT'),
      );

      // Real storage round-trip through the DI provider.
      final raw = await _storedRaw();
      expect(raw, isNotNull, reason: 'held_sales_v1 must exist in storage');
      final list = jsonDecode(raw!) as List<dynamic>;
      expect(list, hasLength(1));
      final first = list.first as Map<String, dynamic>;
      expect(first['label'], 'Test hold');
      expect(first['id'], isNotEmpty);
      expect(first['heldAt'], isNotEmpty);
      expect(first['items'], isA<List<dynamic>>());

      // Payload schema-compatible: round-trips through fromJson unchanged.
      final parsed = HeldSale.fromJson(first);
      expect(parsed.label, 'Test hold');
      expect(parsed.items.length, 1);
      expect(parsed.items.first.productName, 'Item ESP');
      expect(parsed.total, Money.fromMinorUnits(2000, 'KZT'));
    });

    test('a new provider instance restores saved sales (reload-equivalent)',
        () async {
      SharedPreferences.setMockInitialValues({});
      // Session 1: hold two sales.
      final session1 = ProviderContainer();
      addTearDown(session1.dispose);
      await session1.read(heldSalesProvider.notifier).hold(
            _cart('A1', 10, customerName: 'Anna'),
            label: 'First',
          );
      await session1.read(heldSalesProvider.notifier).hold(
            _cart('B2', 25),
            label: 'Second',
          );
      expect(session1.read(heldSalesProvider).held.length, 2);

      // Session 2: brand-new container/provider reads the same storage.
      final session2 = ProviderContainer();
      addTearDown(session2.dispose);
      await session2.read(heldSalesProvider.notifier).load();
      final held = session2.read(heldSalesProvider).held;
      expect(held, hasLength(2));
      expect(held.map((h) => h.label), containsAll(['First', 'Second']));
      final first = held.firstWhere((h) => h.label == 'First');
      expect(first.total, Money.fromMinorUnits(2000, 'KZT'));
      expect(first.customerName, 'Anna');
      expect(first.customerId, 'c-A1');
    });

    test('multiple held sales survive save + reload in order', () async {
      SharedPreferences.setMockInitialValues({});
      final session1 = ProviderContainer();
      addTearDown(session1.dispose);
      await session1.read(heldSalesProvider.notifier).hold(
            _cart('X1', 5),
            label: 'Oldest',
          );
      await session1.read(heldSalesProvider.notifier).hold(
            _cart('X2', 7),
            label: 'Newest',
          );

      // Newest-first ordering is preserved on restore.
      final session2 = ProviderContainer();
      addTearDown(session2.dispose);
      await session2.read(heldSalesProvider.notifier).load();
      final labels =
          session2.read(heldSalesProvider).held.map((h) => h.label).toList();
      expect(labels, ['Newest', 'Oldest']);
    });

    test('resume removes the sale from persisted storage', () async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(heldSalesProvider.notifier);

      await notifier.hold(_cart('R1', 12), label: 'To resume');
      final id = container.read(heldSalesProvider).held.first.id;

      final resumed = await notifier.resume(id);
      expect(resumed, isNotNull);
      expect(container.read(heldSalesProvider).held, isEmpty);

      final raw = await _storedRaw();
      expect(raw, isNotNull);
      expect(jsonDecode(raw!) as List<dynamic>, isEmpty,
          reason: 'resumed sale must be removed from storage');
    });

    test('discard removes the sale from persisted storage', () async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(heldSalesProvider.notifier);

      await notifier.hold(_cart('D1', 8), label: 'Discard me');
      await notifier.hold(_cart('D2', 9), label: 'Keep me');
      final discardId = container
          .read(heldSalesProvider)
          .held
          .firstWhere((h) => h.label == 'Discard me')
          .id;

      await notifier.discard(discardId);
      expect(container.read(heldSalesProvider).held.length, 1);
      expect(container.read(heldSalesProvider).held.first.label, 'Keep me');

      final raw = await _storedRaw();
      final list = jsonDecode(raw!) as List<dynamic>;
      expect(list, hasLength(1));
      expect((list.first as Map<String, dynamic>)['label'], 'Keep me');
    });
  });
}
