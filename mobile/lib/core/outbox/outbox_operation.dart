import 'package:uuid/uuid.dart';

/// Lifecycle of a queued offline mutation (Offline 1B-min: CREATE_SALE only).
///
/// Safe terminal flow: PENDING → sending → (2xx | recognized-duplicate) →
/// SENT → removed from storage. A retryable failure keeps the op PENDING with
/// a backoff deadline; a permanent 4xx moves it to FAILED_PERMANENT so the
/// user can Retry or Discard it explicitly.
enum OutboxStatus { pending, sending, failedPermanent }

/// Discriminator of the queued operation. 1B-min ships a single kind; the
/// enum keeps the storage schema forward-compatible. Phase F3 generalizes
/// the per-kind dispatch into a spec registry without adding new kinds —
/// the follow-up kinds (cash-in/out, adjust, transfer, goods-receipt)
/// belong to F4.
enum OutboxOperationKind { createSale }

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
