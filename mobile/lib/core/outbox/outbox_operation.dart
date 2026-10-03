import 'package:uuid/uuid.dart';

/// Lifecycle of a queued offline mutation (Offline 1B-min: CREATE_SALE only).
///
/// Safe terminal flow: PENDING → sending → (2xx | recognized-duplicate) →
/// SENT → removed from storage. A retryable failure keeps the op PENDING with
/// a backoff deadline; a permanent 4xx moves it to FAILED_PERMANENT so the
/// user can Retry or Discard it explicitly.
enum OutboxStatus { pending, sending, failedPermanent }

/// Discriminator of the queued operation. 1B-min shipped a single kind
/// (createSale); Phase F3 generalized the per-kind dispatch into a spec
/// registry, and Phase F4 declares the real keyed mutation kinds. Each new
/// kind receives its routing spec in F4-B — until then the worker's
/// `spec == null → skip` guard keeps them inert: persisted, retriable
/// metadata intact, but NEVER dispatched to any endpoint.
enum OutboxOperationKind {
  createSale,

  /// `POST /sales/cash-shifts/cash-in` (keyed).
  cashIn,

  /// `POST /sales/cash-shifts/cash-out` (keyed).
  cashOut,

  /// `POST /inventory/stock/adjust` (keyed).
  adjustStock,

  /// `POST /inventory/stock/transfer` (keyed).
  transferStock,

  /// `POST /purchasing/goods-receipts` (keyed).
  goodsReceipt,
}

/// One durable offline mutation.
///
/// [companyId]/[userId] capture WHO created the operation. The sync worker
/// refuses to send an op whose scope does not match the currently
/// authenticated user — an offline sale of user A can never be flushed under
/// user B, even if logout-clear was somehow skipped.
class OutboxOperation {
  const OutboxOperation({
    required this.clientOperationId,
    required this.kind,
    required this.companyId,
    required this.userId,
    required this.payload,
    this.idempotencyKey,
    this.status = OutboxStatus.pending,
    this.attempts = 0,
    this.nextAttemptAt,
    this.createdAt,
    this.lastError,
    this.schemaVersion = currentSchemaVersion,
  });

  /// Storage schema version stamped into freshly created entries. v1 is the
  /// original `outbox_ops_v1` layout (no schemaVersion / idempotencyKey
  /// fields). Entries persisted by older app versions load with this
  /// default — no storage-format bump, no migration.
  static const int currentSchemaVersion = 1;

  /// Client-side unique key. Re-enqueueing the same id is a no-op (dedupe).
  final String clientOperationId;

  final OutboxOperationKind kind;

  final String companyId;
  final String userId;

  /// JSON-encoded request body, ready to be sent verbatim (for CREATE_SALE:
  /// the CreateSaleRequest JSON incl. the client-generated saleNumber).
  final Map<String, dynamic> payload;

  /// Replay key for kinds whose endpoint is guarded by the backend
  /// idempotency mechanism (F4 kinds). Null for CREATE_SALE on purpose: its
  /// replay safety is the client-generated unique `saleNumber` inside
  /// [payload], and no Idempotency-Key header must ever be sent for it.
  ///
  /// Immutable for the whole lifetime of the op: [copyWith] deliberately
  /// does not expose it, so a retry can never mint or alter a key, and
  /// persistence round-trips it verbatim via toJson/fromJson.
  final String? idempotencyKey;

  final OutboxStatus status;
  final int attempts;

  /// Earliest wall-clock time the op may be retried (backoff). Null = due now.
  final DateTime? nextAttemptAt;
  final DateTime? createdAt;

  /// Human-readable reason of the last failure (for FAILED_PERMANENT UI).
  final String? lastError;

  /// Schema version of the persisted JSON of THIS entry. New ops are stamped
  /// with [currentSchemaVersion]; v1 entries written before the field
  /// existed load with the default value 1.
  final int schemaVersion;

  /// Monotonic FIFO key: createdAt, then clientOperationId for stability.
  bool isDue(DateTime now) {
    final at = nextAttemptAt;
    return at == null || !at.isAfter(now);
  }

  /// Returns a copy with the given mutable fields applied.
  ///
  /// [idempotencyKey] and [schemaVersion] are intentionally NOT parameters:
  /// a key must survive every retry unchanged, and the schema version is a
  /// property of how the entry was persisted, not of in-memory transitions.
  OutboxOperation copyWith({
    OutboxStatus? status,
    int? attempts,
    DateTime? nextAttemptAt,
    DateTime? createdAt,
    String? lastError,
  }) {
    return OutboxOperation(
      clientOperationId: clientOperationId,
      kind: kind,
      companyId: companyId,
      userId: userId,
      payload: payload,
      idempotencyKey: idempotencyKey,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      createdAt: createdAt ?? this.createdAt,
      lastError: lastError, // nullable on purpose — pass null to clear
      schemaVersion: schemaVersion,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'clientOperationId': clientOperationId,
        'kind': kind.name,
        'companyId': companyId,
        'userId': userId,
        'payload': payload,
        'status': status.name,
        'attempts': attempts,
        'nextAttemptAt': nextAttemptAt?.millisecondsSinceEpoch,
        'createdAt': createdAt?.millisecondsSinceEpoch,
        'lastError': lastError,
        'schemaVersion': schemaVersion,
        // Absent when null: CREATE_SALE entries stay identical to the
        // original v1 layout (plus the schemaVersion tag).
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      };

  static OutboxOperation fromJson(Map<String, dynamic> json) {
    return OutboxOperation(
      clientOperationId: json['clientOperationId'] as String,
      kind: _kindFromName(json['kind']),
      companyId: json['companyId'] as String,
      userId: json['userId'] as String,
      payload: (json['payload'] as Map).cast<String, dynamic>(),
      idempotencyKey: json['idempotencyKey'] as String?,
      status: OutboxStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => OutboxStatus.pending,
      ),
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      nextAttemptAt: _msToDate(json['nextAttemptAt'] as num?),
      createdAt: _msToDate(json['createdAt'] as num?),
      lastError: json['lastError'] as String?,
      schemaVersion:
          (json['schemaVersion'] as num?)?.toInt() ?? currentSchemaVersion,
    );
  }

  /// Resolves the persisted kind name. An unknown kind must NEVER silently
  /// degrade into createSale — that would re-dispatch an arbitrary payload
  /// to `POST /sales`. Throwing here makes [OutboxStorage.load] drop the
  /// entry safely (corrupted-entry path) instead of sending it anywhere.
  static OutboxOperationKind _kindFromName(Object? name) {
    for (final kind in OutboxOperationKind.values) {
      if (kind.name == name) return kind;
    }
    throw FormatException(
      'Unknown outbox operation kind "$name" — entry is dropped and is '
      'never dispatched',
    );
  }

  static DateTime? _msToDate(num? ms) =>
      ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms.toInt());

  /// Generates a fresh v4 UUID for [clientOperationId]. Centralised so the
  /// uuid package stays a single-point dependency and tests can stub it via
  /// [idGenerator].
  static String Function() idGenerator = _defaultGenerateId;

  static String _defaultGenerateId() => const Uuid().v4();
}

/// Largest unit an [OutboxOperationAge] reports in. An age is always rendered
/// in the coarsest unit that yields a non-zero value, so "3 days" never reads
/// as "4320 minutes".
enum OutboxOperationAgeUnit { minutes, hours, days }

/// Pure, immutable, **display-only** age descriptor for one queued operation.
///
/// G16-N-3 P2-B-4 Phase 0 (F1/F4). This type exists for the FAILED_PERMANENT
/// UI and nothing else. It is deliberately NOT consulted by [isDue], by the
/// retry budget, by the backoff schedule, by the failure classifier, or by any
/// persistence path — an old age changes nothing about whether an operation may
/// be retried. That is not a simplification: durable operation identity makes a
/// replay safe at any age (the server rejects a second application via a
/// permanent unique constraint, independent of the 24h IdempotencyRecord TTL),
/// so treating age as a gate would only manufacture false permanent failures
/// and silent loss. Age is presented to the user as information; the user
/// decides.
///
/// [OutboxOperation.createdAt] is nullable — entries persisted by a pre-v1
/// build have no timestamp — so the descriptor is nullable too and every
/// consumer must handle "age unknown".
class OutboxOperationAge {
  const OutboxOperationAge._(this.value, this.unit);

  const OutboxOperationAge.minutes(int value)
      : this._(value, OutboxOperationAgeUnit.minutes);

  const OutboxOperationAge.hours(int value)
      : this._(value, OutboxOperationAgeUnit.hours);

  const OutboxOperationAge.days(int value)
      : this._(value, OutboxOperationAgeUnit.days);

  /// Cosmetic staleness threshold, in days. Crossing it adds ONE extra
  /// confirmation before an explicit user-initiated Retry; it never blocks the
  /// retry, never mutates the operation, and is never evaluated by the worker.
  static const int staleAfterDays = 30;

  /// Magnitude of the age, always >= 0, always in the unit named by [unit].
  final int value;

  final OutboxOperationAgeUnit unit;

  /// True when this age has reached [staleAfterDays].
  ///
  /// Only a whole-day age can be stale: the threshold is expressed in days, and
  /// a sub-day age is by definition below it.
  bool get isStale =>
      unit == OutboxOperationAgeUnit.days && value >= staleAfterDays;

  @override
  bool operator ==(Object other) =>
      other is OutboxOperationAge && other.value == value && other.unit == unit;

  @override
  int get hashCode => Object.hash(value, unit);

  @override
  String toString() => 'OutboxOperationAge($value ${unit.name})';
}

/// Display-only age accessors for [OutboxOperation].
///
/// Every member takes the reference instant explicitly instead of reading the
/// clock, so results are deterministic under test and trivially pure.
extension OutboxOperationAgeX on OutboxOperation {
  /// Age of this operation at [now], or `null` when [OutboxOperation.createdAt]
  /// is absent (legacy v1 entries) — callers must render an explicit
  /// "unknown age" state rather than guessing.
  ///
  /// A [createdAt] in the future (clock skew, timezone drift) clamps to zero
  /// instead of producing a negative age.
  OutboxOperationAge? ageAt(DateTime now) {
    final created = createdAt;
    if (created == null) return null;
    final elapsed = now.difference(created);
    if (elapsed.isNegative) return const OutboxOperationAge.minutes(0);
    if (elapsed.inDays >= 1) return OutboxOperationAge.days(elapsed.inDays);
    if (elapsed.inHours >= 1) return OutboxOperationAge.hours(elapsed.inHours);
    return OutboxOperationAge.minutes(elapsed.inMinutes);
  }

  /// True when this operation is at least [OutboxOperationAge.staleAfterDays]
  /// old. Purely cosmetic — see [OutboxOperationAge].
  ///
  /// A `null` [createdAt] is never stale: with no age information the user
  /// cannot be warned about something unknown, and inventing a warning would
  /// make the legacy state unreachable to Retry.
  bool isStaleAt(DateTime now) => ageAt(now)?.isStale ?? false;
}
