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

  group('OutboxStorage (Phase F3: v1 backward compatibility)', () {
    test('legacy v1 JSON without new fields loads with safe defaults',
        () async {
      final prefs = await warmedPrefs();
      // Raw v1 entry, exactly as the 1B-min build persisted it: no
      // schemaVersion, no idempotencyKey.
      await prefs.setStringList('outbox_ops_v1', [
        jsonEncode(<String, dynamic>{
          'clientOperationId': 'legacy-1',
          'kind': 'createSale',
          'companyId': 'company-1',
          'userId': 'user-1',
          'payload': <String, dynamic>{'saleNumber': 'OFF-legacy-1'},
          'status': 'pending',
          'attempts': 1,
          'nextAttemptAt': null,
          'createdAt': 1000,
          'lastError': null,
        }),
      ]);
      final storage = OutboxStorage(prefs);

      final loaded = await storage.load();

      expect(loaded, hasLength(1));
      final legacy = loaded.single;
      expect(legacy.kind, OutboxOperationKind.createSale);
      expect(legacy.idempotencyKey, isNull); // safe default
      expect(legacy.schemaVersion, 1); // safe default
      expect(legacy.payload, {'saleNumber': 'OFF-legacy-1'});
    });

    test('entries with an unknown kind are dropped and never dispatched',
        () async {
      final prefs = await warmedPrefs();
      await prefs.setStringList('outbox_ops_v1', [
        jsonEncode(op(id: 'keeper').toJson()),
        jsonEncode(<String, dynamic>{
          'clientOperationId': 'ghost',
          'kind': 'mysteryKind',
          'companyId': 'company-1',
          'userId': 'user-1',
          'payload': <String, dynamic>{'warehouseId': 'w-1'},
          'status': 'pending',
        }),
      ]);
      final storage = OutboxStorage(prefs);

      final loaded = await storage.load();

      expect(loaded.map((o) => o.clientOperationId), ['keeper']);
    });

    test('idempotencyKey round-trips through save/load unchanged', () async {
      final prefs = await warmedPrefs();
      final storage = OutboxStorage(prefs);
      final keyed = op(id: 'keyed-1');
      // The model keeps the key immutable — an F4-style keyed op reaches
      // storage exactly the way persistence restores it (v1 JSON + key).
      final json = keyed.toJson()..['idempotencyKey'] = 'idem-key-1';
      await prefs.setStringList(
        'outbox_ops_v1',
        [jsonEncode(json)],
      );

      final loaded = await storage.load();

      expect(loaded.single.idempotencyKey, 'idem-key-1');
      expect(loaded.single.schemaVersion, 1);
    });
  });
}