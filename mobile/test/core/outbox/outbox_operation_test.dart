import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';

void main() {
  group('OutboxOperation model (Phase F3: generalized operation model)', () {
    test('fresh CREATE_SALE op has schemaVersion 1 and NO idempotencyKey', () {
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

    test('legacy v1 JSON without the new fields loads with safe defaults', () {
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
      expect(
          op.nextAttemptAt, DateTime.fromMillisecondsSinceEpoch(1767225600000));
      expect(op.createdAt, DateTime.fromMillisecondsSinceEpoch(1000));
      expect(op.lastError, 'HTTP 503');
      // Defaults provided by F3 — old entries keep working.
      expect(op.schemaVersion, 1);
      expect(op.idempotencyKey, isNull);
    });

    test('unknown kind throws and is NEVER coerced into createSale', () {
      // A name that is not (and must never become) an OutboxOperationKind.
      // The formerly-unknown 'adjustStock' became a declared kind in F4-A,
      // so the poisoned-entry guard needs a genuinely unknown name here.
      const poisoned = <String, dynamic>{
        'clientOperationId': 'ghost-1',
        'kind': 'teleportStock',
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

    test(
        'toJson/fromJson roundtrip preserves idempotencyKey and '
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

    test(
        'copyWith never touches idempotencyKey or schemaVersion '
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

  group('OutboxOperation kinds (Phase F4-A: keyed mutation kinds)', () {
    test('the enum declares exactly the six expected kinds', () {
      expect(
        OutboxOperationKind.values.map((k) => k.name),
        <String>[
          'createSale',
          'cashIn',
          'cashOut',
          'adjustStock',
          'transferStock',
          'goodsReceipt',
        ],
      );
    });

    test('round-trip preserves the kind of every operation', () {
      for (final kind in OutboxOperationKind.values) {
        final op = OutboxOperation(
          clientOperationId: 'rt-${kind.name}',
          kind: kind,
          companyId: 'company-1',
          userId: 'user-1',
          payload: {'kindProbe': kind.name},
          createdAt: DateTime.fromMillisecondsSinceEpoch(1000),
        );

        final restored = OutboxOperation.fromJson(
          (jsonDecode(jsonEncode(op.toJson())) as Map).cast<String, dynamic>(),
        );

        expect(restored.kind, kind, reason: kind.name);
        expect(restored.payload, {'kindProbe': kind.name}, reason: kind.name);
      }
    });

    test('keyed F4 kinds round-trip their idempotencyKey verbatim', () {
      for (final kind in OutboxOperationKind.values) {
        if (kind == OutboxOperationKind.createSale) continue;
        final op = OutboxOperation(
          clientOperationId: 'keyed-${kind.name}',
          kind: kind,
          companyId: 'company-1',
          userId: 'user-1',
          payload: const <String, dynamic>{},
          idempotencyKey: 'idem-${kind.name}',
        );

        final json = jsonDecode(jsonEncode(op.toJson())) as Map;
        final restored = OutboxOperation.fromJson(json.cast<String, dynamic>());

        // Persisted verbatim: F4-C transport will send exactly this value as
        // the Idempotency-Key header, unchanged on every retry.
        expect(json['idempotencyKey'], 'idem-${kind.name}', reason: kind.name);
        expect(restored.idempotencyKey, 'idem-${kind.name}', reason: kind.name);
        expect(restored.schemaVersion, 1, reason: kind.name);
      }
    });

    test('CREATE_SALE stays key-less — only the F4 kinds are keyed', () {
      const op = OutboxOperation(
        clientOperationId: 'sale-plain',
        kind: OutboxOperationKind.createSale,
        companyId: 'company-1',
        userId: 'user-1',
        payload: {'saleNumber': 'OFF-sale-plain'},
      );

      expect(op.idempotencyKey, isNull);
      // No key field may leak into the CREATE_SALE persistence layout.
      expect(op.toJson().containsKey('idempotencyKey'), isFalse);
    });
  });

  // G16-N-3 P2-B-4 Phase 0 (F1/F4) — display-only operation age.
  _phase0AgeTests();
}

// ─────────────────────────────────────────────────────────────────────────
// G16-N-3 P2-B-4 Phase 0 (F1/F4) — display-only operation age.
//
// These tests pin the INVARIANT that matters most: age is presentation, never
// policy. Every helper here is pure and takes `now` explicitly, and nothing in
// the outbox lifecycle consults them.
// ─────────────────────────────────────────────────────────────────────────
void _phase0AgeTests() {
  final now = DateTime(2026, 6, 15, 12);

  OutboxOperation op({DateTime? createdAt, DateTime? nextAttemptAt}) =>
      OutboxOperation(
        clientOperationId: 'age-op',
        kind: OutboxOperationKind.cashIn,
        companyId: 'company-1',
        userId: 'user-1',
        payload: const {'amount': 10},
        idempotencyKey: 'age-op',
        createdAt: createdAt,
        nextAttemptAt: nextAttemptAt,
      );

  group('OutboxOperation age — Phase 0 (display only)', () {
    // A: null createdAt (legacy v1 entries persisted before the field existed).
    test('createdAt == null yields a null age, never a fabricated one', () {
      final o = op();
      expect(o.createdAt, isNull);
      expect(o.ageAt(now), isNull);
      // An unknown age is NOT stale: the user cannot be warned about something
      // unknown, and treating it as stale would make legacy entries awkward.
      expect(o.isStaleAt(now), isFalse);
    });

    // B: deterministic label from an injected clock, coarsest unit wins.
    test('known createdAt yields a deterministic age from the injected now',
        () {
      OutboxOperationAge age(Duration ago) =>
          op(createdAt: now.subtract(ago)).ageAt(now)!;

      expect(age(const Duration(seconds: 30)).value, 0);
      expect(age(const Duration(seconds: 30)).unit,
          OutboxOperationAgeUnit.minutes);

      expect(age(const Duration(minutes: 5)).value, 5);
      expect(
          age(const Duration(minutes: 5)).unit, OutboxOperationAgeUnit.minutes);

      // 59m is still minutes; 60m flips to hours.
      expect(age(const Duration(minutes: 59)).unit,
          OutboxOperationAgeUnit.minutes);
      expect(age(const Duration(minutes: 60)).value, 1);
      expect(
          age(const Duration(minutes: 60)).unit, OutboxOperationAgeUnit.hours);

      // 23h is hours; 24h flips to days.
      expect(age(const Duration(hours: 23)).unit, OutboxOperationAgeUnit.hours);
      expect(age(const Duration(hours: 24)).value, 1);
      expect(age(const Duration(hours: 24)).unit, OutboxOperationAgeUnit.days);

      expect(age(const Duration(days: 3)).value, 3);
      expect(age(const Duration(days: 3)).unit, OutboxOperationAgeUnit.days);
    });

    test('age is null-safe against clock skew (future createdAt clamps to 0)',
        () {
      final o = op(createdAt: now.add(const Duration(days: 2)));
      final age = o.ageAt(now)!;
      expect(age.value, 0);
      expect(age.isStale, isFalse);
    });

    test('OutboxOperationAge has value equality', () {
      expect(
          const OutboxOperationAge.days(3), const OutboxOperationAge.days(3));
      expect(const OutboxOperationAge.days(3).hashCode,
          const OutboxOperationAge.days(3).hashCode);
      expect(const OutboxOperationAge.days(3),
          isNot(const OutboxOperationAge.hours(3)));
    });

    // C: the exact 30-day cosmetic threshold.
    test('exactly staleAfterDays is stale; one second short is not', () {
      const threshold = OutboxOperationAge.staleAfterDays;
      expect(threshold, 30);

      final justUnder = op(
        createdAt: now.subtract(
          const Duration(
              days: threshold - 1, hours: 23, minutes: 59, seconds: 59),
        ),
      );
      expect(justUnder.ageAt(now)!.value, threshold - 1);
      expect(justUnder.isStaleAt(now), isFalse);

      final exactly =
          op(createdAt: now.subtract(const Duration(days: threshold)));
      expect(exactly.ageAt(now)!.value, threshold);
      expect(exactly.isStaleAt(now), isTrue);

      final wellPast = op(createdAt: now.subtract(const Duration(days: 400)));
      expect(wellPast.isStaleAt(now), isTrue);
    });

    test('a sub-day age can never be stale', () {
      expect(
          op(createdAt: now.subtract(const Duration(hours: 23))).isStaleAt(now),
          isFalse);
    });

    // Invariant: age must not leak into the behavioural surface.
    test('age helpers do not affect isDue / status / attempts / identity', () {
      final old = op(createdAt: DateTime(2020, 1, 1));
      final fresh = op(createdAt: now);

      // Both are due exactly when their backoff says so — age is irrelevant.
      expect(old.isDue(now), isTrue);
      expect(fresh.isDue(now), isTrue);
      expect(
        op(
                createdAt: DateTime(2020, 1, 1),
                nextAttemptAt: now.add(const Duration(minutes: 5)))
            .isDue(now),
        isFalse,
      );

      // The age accessors are pure: identity and status are untouched.
      old.ageAt(now);
      old.isStaleAt(now);
      expect(old.clientOperationId, 'age-op');
      expect(old.idempotencyKey, 'age-op');
      expect(old.status, OutboxStatus.pending);
      expect(old.attempts, 0);
      expect(old.nextAttemptAt, isNull);
      expect(old.createdAt, DateTime(2020, 1, 1));
    });

    test('age helpers add nothing to the persistence layout', () {
      final keys = op(createdAt: now).toJson().keys.toSet();
      // No new persisted field was introduced by Phase 0.
      expect(
        keys.difference({
          'clientOperationId',
          'kind',
          'companyId',
          'userId',
          'payload',
          'status',
          'attempts',
          'nextAttemptAt',
          'createdAt',
          'lastError',
          'schemaVersion',
          'idempotencyKey',
        }),
        isEmpty,
      );
      expect(OutboxOperation.currentSchemaVersion, 1);
    });
  });
}
