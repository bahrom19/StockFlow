import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_storage.dart';
import 'package:stockflow/core/storage/preferences_storage.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<PreferencesStorage> warmedPrefs() async {
    final prefs = PreferencesStorage();
    await prefs.initialize();
    return prefs;
  }

  OutboxOperation op({
    required String id,
    OutboxStatus status = OutboxStatus.pending,
    DateTime? createdAt,
  }) {
    return OutboxOperation(
      clientOperationId: id,
      kind: OutboxOperationKind.createSale,
      companyId: 'company-1',
      userId: 'user-1',
      payload: {'saleNumber': 'OFF-$id'},
      status: status,
      createdAt: createdAt ?? DateTime.fromMillisecondsSinceEpoch(1000),
    );
  }

  group('OutboxStorage', () {
    test('save + load roundtrip preserves FIFO order and all fields', () async {
      final storage = OutboxStorage(await warmedPrefs());
      final first = op(id: 'a', createdAt: DateTime(2026, 1, 1));
      final second = op(id: 'b', createdAt: DateTime(2026, 1, 2));

      await storage.save([first, second]);
      final loaded = await storage.load();

      expect(loaded.map((o) => o.clientOperationId), ['a', 'b']);
      expect(loaded.first.kind, OutboxOperationKind.createSale);
      expect(loaded.first.companyId, 'company-1');
      expect(loaded.first.userId, 'user-1');
      expect(loaded.first.payload, {'saleNumber': 'OFF-a'});
      expect(loaded.first.createdAt, DateTime(2026, 1, 1));
    });

    test('persistence survives a simulated restart (new storage instance)',
        () async {
      final before = OutboxStorage(await warmedPrefs());
      await before.save([op(id: 'restart-1')]);

      // "Restart": brand-new storage over the same backing preferences.
      final after = OutboxStorage(await warmedPrefs());
      final loaded = await after.load();

      expect(loaded, hasLength(1));
      expect(loaded.single.clientOperationId, 'restart-1');
    });

    test('SENDING entries found after a restart are reset to PENDING',
        () async {
      final storage = OutboxStorage(await warmedPrefs());
      await storage.save([
        op(id: 'in-flight', status: OutboxStatus.sending),
      ]);

      final loaded = await storage.load();

      expect(loaded.single.status, OutboxStatus.pending);
    });

    test('corrupted entries are dropped without breaking the queue',
        () async {
      final prefs = await warmedPrefs();
      final good = jsonEncode(op(id: 'good').toJson());
      await prefs.setStringList(
        'outbox_ops_v1',
        [good, '{not-json', jsonEncode(op(id: 'good2').toJson())],
      );
      final storage = OutboxStorage(prefs);

      final loaded = await storage.load();

      expect(loaded.map((o) => o.clientOperationId), ['good', 'good2']);
    });

    test('clear removes the persisted queue', () async {
      final storage = OutboxStorage(await warmedPrefs());
      await storage.save([op(id: 'to-wipe')]);
      expect(await storage.load(), hasLength(1));

      await storage.clear();

      expect(await storage.load(), isEmpty);
    });
  });
}