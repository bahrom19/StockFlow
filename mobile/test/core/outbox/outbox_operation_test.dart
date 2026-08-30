import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';

void main() {
  group('OutboxOperation model (Phase F3: generalized operation model)', () {
    test('fresh CREATE_SALE op has schemaVersion 1 and NO idempotencyKey',
        () {
      const op = OutboxOperation(
        clientOperationId: 'op-1',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: {'saleNumber': 'OFF-op-1'},
      );

      expect(OutboxOperation.currentSchemaVersion, 1);
      expect(op.schemaVersion, 1);
      expect(op.idempotencyKey, isNull);
    });

    test('legacy v1 JSON without the new fields loads with safe defaults',
        () {
      // Exactly the shape the 1B-min build persisted: no schemaVersion,
      // no idempotencyKey. It must read back without any migration.
      final legacy = <String, dynamic>{
        'clientOperationId': 'legacy-1',
        'kind': 'createSale',
        'companyId': 'company-1',
        'userId': 'user-1',
        'payload': <String, dynamic>{
          'saleNumber': 'OFF-legacy-1',
          'items': <Object>[],
        },
        'status': 'pending',
        'attempts': 2,
        'nextAttemptAt': 1767225600000,
        'createdAt': 1000,
        'lastError': 'HTTP 503',
      };

      final op = OutboxOperation.fromJson(legacy);

      expect(op.clientOperationId, 'legacy-1');
      expect(op.kind, OutboxOperationKind.createSale);
      expect(op.payload, {'saleNumber': 'OFF-legacy-1', 'items': <Object>[]});
      expect(op.status, OutboxStatus.pending);
      expect(op.attempts, 2);
      expect(op.nextAttemptAt, DateTime.fromMillisecondsSinceEpoch(1767225600000));
      expect(op.createdAt, DateTime.fromMillisecondsSinceEpoch(1000));
      expect(op.lastError, 'HTTP 503');
      // Defaults provided by F3 — old entries keep working.
      expect(op.schemaVersion, 1);
      expect(op.idempotencyKey, isNull);
    });

    test('unknown kind throws and is NEVER coerced into createSale', () {
      const poisoned = <String, dynamic>{
        'clientOperationId': 'ghost-1',
        'kind': 'adjustStock',
        'companyId': 'company-1',
        'userId': 'user-1',
        'payload': {'warehouseId': 'w-1', 'quantity': 999},
        'status': 'pending',
      };

      expect(
        () => OutboxOperation.fromJson(poisoned),
        throwsFormatException,
      );
    });

    test('toJson/fromJson roundtrip preserves idempotencyKey and '
        'schemaVersion', () {
      final op = OutboxOperation(
        clientOperationId: 'keyed-1',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: const {'saleNumber': 'OFF-keyed-1'},
        idempotencyKey: 'idem-key-1',
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );

      final restored = OutboxOperation.fromJson(
        (jsonDecode(jsonEncode(op.toJson())) as Map).cast<String, dynamic>(),
      );

      expect(restored.idempotencyKey, 'idem-key-1');
      expect(restored.schemaVersion, 1);
      expect(restored.toJson(), op.toJson());
    });

    test('CREATE_SALE entry persists exactly in the v1 layout + schemaVersion',
        () {
      final op = OutboxOperation(
        clientOperationId: 'v1-compatible',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: const {'saleNumber': 'OFF-v1'},
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );

      // No idempotencyKey field at all when null; schemaVersion is the only
      // addition over the original v1 entry layout.
      expect(op.toJson(), <String, dynamic>{
        'clientOperationId': 'v1-compatible',
        'kind': 'createSale',
        'companyId': 'company-1',
        'userId': 'user-1',
        'payload': {'saleNumber': 'OFF-v1'},
        'status': 'pending',
        'attempts': 0,
        'nextAttemptAt': null,
        'createdAt': 1000,
        'lastError': null,
        'schemaVersion': 1,
      });
    });

    test('copyWith never touches idempotencyKey or schemaVersion '
        '(immutable across retries)', () {
      final op = OutboxOperation(
        clientOperationId: 'keyed-2',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: const {'saleNumber': 'OFF-keyed-2'},
        idempotencyKey: 'idem-key-2',
        createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
      );

      final mutated = op.copyWith(
        status: OutboxStatus.pending,
        attempts: 5,
        nextAttemptAt: DateTime(2026, 1, 2),
        lastError: 'HTTP 503',
      );

      expect(mutated.idempotencyKey, 'idem-key-2');
      expect(mutated.schemaVersion, 1);
      expect(mutated.attempts, 5);
    });
  });
}