import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/outbox/outbox_mutation_queue.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/services/connectivity_service.dart';
import 'package:stockflow/features/sales/data/cash_shift_repository.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';

// ──────────────────────────────────
// Cash Shift State
// ──────────────────────────────────
sealed class ShiftState {
  const ShiftState();
}

class ShiftLoading extends ShiftState {
  const ShiftLoading();
}

class ShiftLoaded extends ShiftState {
  final CashShift? current; // the OPEN shift, if any
  final bool isOperating; // an open/close/cash-in request in flight
  const ShiftLoaded({this.current, this.isOperating = false});

  ShiftLoaded copyWith({CashShift? current, bool? isOperating}) {
    return ShiftLoaded(
      current: current ?? this.current,
      isOperating: isOperating ?? this.isOperating,
    );
  }
}

class ShiftError extends ShiftState {
  final String message;
  const ShiftError(this.message);
}

// ──────────────────────────────────
// Cash Shift Notifier
// ──────────────────────────────────
class CashShiftNotifier extends StateNotifier<ShiftState> {
  final Ref _ref;
  String? _warehouseId;

  CashShiftNotifier(this._ref) : super(const ShiftLoading());

  /// Loads the open shift for [warehouseId] (via X report, which returns the
  /// current shift — 404 when none is open is treated as "no shift").
  Future<void> loadShift(String warehouseId) async {
    _warehouseId = warehouseId;
    state = const ShiftLoading();
    final repo = _ref.read(cashShiftRepositoryProvider);
    final result = await repo.getXReport(warehouseId: warehouseId);
    if (result is ShiftSuccess<CashShift>) {
      state = ShiftLoaded(current: result.data);
      return;
    }
    final failure = result as ShiftFailure<CashShift>;
    // A 404 means "no open shift" — that's a normal state, not an error.
    if (failure.error is NotFoundFailure) {
      state = const ShiftLoaded(current: null);
      return;
    }
    state = ShiftError(failure.error.message);
  }

  Future<CashShift?> openShift(double openingBalance, {String? notes}) async {
    final warehouseId = _warehouseId;
    if (warehouseId == null) return null;
    final current = state;
    if (current is ShiftLoaded && current.isOperating) return null;

    state = current is ShiftLoaded
        ? current.copyWith(isOperating: true)
        : const ShiftLoaded(isOperating: true);
    final repo = _ref.read(cashShiftRepositoryProvider);
    final result = await repo.openShift(OpenShiftRequest(
      warehouseId: warehouseId,
      openingBalance: openingBalance,
      notes: notes,
    ));
    if (result is ShiftSuccess<CashShift>) {
      state = ShiftLoaded(current: result.data);
      return result.data;
    }
    final failure = result as ShiftFailure<CashShift>;
    state = ShiftError(failure.error.message);
    return null;
  }

  Future<CashShift?> closeShift({
    double? actualClosingBalance,
    String? notes,
  }) async {
    final warehouseId = _warehouseId;
    if (warehouseId == null) return null;
    final current = state;
    if (current is ShiftLoaded && current.isOperating) return null;

    state = current is ShiftLoaded
        ? current.copyWith(isOperating: true)
        : const ShiftLoaded(isOperating: true);
    final repo = _ref.read(cashShiftRepositoryProvider);
    final result = await repo.closeShift(
      warehouseId: warehouseId,
      request: CloseShiftRequest(
        actualClosingBalance: actualClosingBalance,
        notes: notes,
      ),
    );
    if (result is ShiftSuccess<CashShift>) {
      // After closing, there is no open shift anymore.
      state = const ShiftLoaded(current: null);
      return result.data;
    }
    final failure = result as ShiftFailure<CashShift>;
    state = ShiftError(failure.error.message);
    return null;
  }

  Future<CashShift?> cashIn(double amount, {String? reason}) async {
    return _cashOperation(
      amount: amount,
      reason: reason,
      isIn: true,
    );
  }

  Future<CashShift?> cashOut(double amount, {String? reason}) async {
    return _cashOperation(
      amount: amount,
      reason: reason,
      isIn: false,
    );
  }

  Future<CashShift?> _cashOperation({
    required double amount,
    String? reason,
    required bool isIn,
  }) async {
    final warehouseId = _warehouseId;
    if (warehouseId == null) return null;
    final current = state;
    if (current is ShiftLoaded && current.isOperating) return null;

    state = current is ShiftLoaded
        ? current.copyWith(isOperating: true)
        : const ShiftLoaded(isOperating: true);

    // Phase F4-D: send-or-park. ONLINE → direct repository call carrying the
    // freshly minted Idempotency-Key header; OFFLINE → the payload is parked
    // in the outbox with idempotencyKey == clientOperationId. The offline
    // payload carries warehouseId INSIDE (the cashIn/cashOut outbox specs
    // build the required query from it), while the online repository call
    // keeps its explicit queryParameters contract.
    final online = _ref.read(connectivityStatusProvider);
    final queue = _ref.read(outboxMutationQueueProvider);
    final repo = _ref.read(cashShiftRepositoryProvider);
    final request = CashInOutRequest(amount: amount, reason: reason);
    final payload = request.toJson()..['warehouseId'] = warehouseId;

    final outcome = await queue.mutate<ShiftResult<CashShift>>(
      kind: isIn ? OutboxOperationKind.cashIn : OutboxOperationKind.cashOut,
      payload: payload,
      online: online,
      sendOnline: (key) => isIn
          ? repo.cashIn(
              warehouseId: warehouseId,
              request: request,
              idempotencyKey: key,
            )
          : repo.cashOut(
              warehouseId: warehouseId,
              request: request,
              idempotencyKey: key,
            ),
    );

    if (outcome is OutboxMutationSent<ShiftResult<CashShift>>) {
      final result = outcome.result;
      if (result is ShiftSuccess<CashShift>) {
        state = ShiftLoaded(current: result.data);
        return result.data;
      }
      state = ShiftError((result as ShiftFailure<CashShift>).error.message);
      return null;
    }
    // D3: the existing generic error channel carries the offline feedback —
    // no new l10n keys. The operation is durably parked in the outbox and
    // will sync automatically with the SAME idempotency key.
    final message = outcome is OutboxMutationQueued<ShiftResult<CashShift>>
        ? OutboxMutationQueue.offlineQueuedMessage
        : (outcome as OutboxMutationRejected<ShiftResult<CashShift>>).reason;
    state = ShiftError(message);
    return null;
  }

  Future<CashShift?> refresh() async {
    final warehouseId = _warehouseId;
    if (warehouseId == null) return null;
    final repo = _ref.read(cashShiftRepositoryProvider);
    final result = await repo.getXReport(warehouseId: warehouseId);
    if (result is ShiftSuccess<CashShift>) {
      state = ShiftLoaded(current: result.data);
      return result.data;
    }
    final failure = result as ShiftFailure<CashShift>;
    if (failure.error is NotFoundFailure) {
      state = const ShiftLoaded(current: null);
    } else {
      state = ShiftError(failure.error.message);
    }
    return null;
  }

  /// Fetches a Z report for a closed shift by id (used from the history UI).
  Future<CashShift?> fetchZReport(String id) async {
    final repo = _ref.read(cashShiftRepositoryProvider);
    final result = await repo.getZReport(id);
    return result is ShiftSuccess<CashShift> ? result.data : null;
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final cashShiftProvider =
    StateNotifierProvider<CashShiftNotifier, ShiftState>((ref) {
  return CashShiftNotifier(ref);
});
