import 'package:uuid/uuid.dart';

/// Lifecycle of a queued offline mutation (Offline 1B-min: CREATE_SALE only).
///
/// Safe terminal flow: PENDING → sending → (2xx | recognized-duplicate) →
/// SENT → removed from storage. A retryable failure keeps the op PENDING with
/// a backoff deadline; a permanent 4xx moves it to FAILED_PERMANENT so the
/// user can Retry or Discard it explicitly.
enum OutboxStatus { pending, sending, failedPermanent }

/// Discriminator of the queued operation. 1B-min ships a single kind; the
/// enum keeps the storage schema forward-compatible.
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
    this.status = OutboxStatus.pending,
    this.attempts = 0,
    this.nextAttemptAt,
    this.createdAt,
    this.lastError,
  });

  /// Client-side unique key. Re-enqueueing the same id is a no-op (dedupe).
  final String clientOperationId;

  final OutboxOperationKind kind;

  final String companyId;
  final String userId;

  /// JSON-encoded request body, ready to be sent verbatim (for CREATE_SALE:
  /// the CreateSaleRequest JSON incl. the client-generated saleNumber).
  final Map<String, dynamic> payload;

  final OutboxStatus status;
  final int attempts;

  /// Earliest wall-clock time the op may be retried (backoff). Null = due now.
  final DateTime? nextAttemptAt;
  final DateTime? createdAt;

  /// Human-readable reason of the last failure (for FAILED_PERMANENT UI).
  final String? lastError;

  /// Monotonic FIFO key: createdAt, then clientOperationId for stability.
  bool isDue(DateTime now) {
    final at = nextAttemptAt;
    return at == null || !at.isAfter(now);
  }

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
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      createdAt: createdAt ?? this.createdAt,
      lastError: lastError, // nullable on purpose — pass null to clear
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
      };

  static OutboxOperation fromJson(Map<String, dynamic> json) {
    return OutboxOperation(
      clientOperationId: json['clientOperationId'] as String,
      kind: OutboxOperationKind.values.firstWhere(
        (k) => k.name == json['kind'],
        orElse: () => OutboxOperationKind.createSale,
      ),
      companyId: json['companyId'] as String,
      userId: json['userId'] as String,
      payload: (json['payload'] as Map).cast<String, dynamic>(),
      status: OutboxStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => OutboxStatus.pending,
      ),
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      nextAttemptAt: _msToDate(json['nextAttemptAt'] as num?),
      createdAt: _msToDate(json['createdAt'] as num?),
      lastError: json['lastError'] as String?,
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
