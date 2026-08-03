import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/finance/data/finance_repository.dart';
import 'package:stockflow/features/finance/domain/finance_models.dart';

// ──────────────────────────────────
// Trial Balance State
// ──────────────────────────────────
sealed class TrialBalanceState {
  const TrialBalanceState();
}

class TrialBalanceLoading extends TrialBalanceState {
  const TrialBalanceLoading();
}

class TrialBalanceLoaded extends TrialBalanceState {
  final List<TrialBalanceRow> rows;
  final String totalDebit;
  final String totalCredit;
  final bool isRefreshing;

  const TrialBalanceLoaded({
    required this.rows,
    required this.totalDebit,
    required this.totalCredit,
    this.isRefreshing = false,
  });

  TrialBalanceLoaded copyWith({
    List<TrialBalanceRow>? rows,
    String? totalDebit,
    String? totalCredit,
    bool? isRefreshing,
  }) {
    return TrialBalanceLoaded(
      rows: rows ?? this.rows,
      totalDebit: totalDebit ?? this.totalDebit,
      totalCredit: totalCredit ?? this.totalCredit,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }
}

class TrialBalanceEmpty extends TrialBalanceState {
  const TrialBalanceEmpty();
}

class TrialBalanceError extends TrialBalanceState {
  final String message;
  final Failure? failure;
  const TrialBalanceError(this.message, {this.failure});
}

// ──────────────────────────────────
// Notifier
// ──────────────────────────────────
class TrialBalanceNotifier extends StateNotifier<TrialBalanceState> {
  final Ref _ref;
  String? _accountType;

  TrialBalanceNotifier(this._ref) : super(const TrialBalanceLoading());

  Future<void> load({String? accountType}) async {
    _accountType = accountType;
    state = const TrialBalanceLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is TrialBalanceLoaded) {
      state = current.copyWith(isRefreshing: true);
    } else {
      state = const TrialBalanceLoading();
    }
    await _fetch();
  }

  void filterByType(String? accountType) {
    _accountType = accountType;
    final current = state;
    if (current is TrialBalanceLoaded) {
      state = current.copyWith(isRefreshing: true);
    }
    _fetch();
  }

  Future<void> _fetch() async {
    final repo = _ref.read(financeRepositoryProvider);
    final result = await repo.getTrialBalance(accountType: _accountType);
    if (result is FinanceFailure) {
      state = TrialBalanceError(
        (result as FinanceFailure<TrialBalanceResponse>).error.message,
        failure: (result as FinanceFailure<TrialBalanceResponse>).error,
      );
      return;
    }
    final data = (result as FinanceSuccess<TrialBalanceResponse>).data;
    state = data.rows.isEmpty
        ? const TrialBalanceEmpty()
        : TrialBalanceLoaded(
            rows: data.rows,
            totalDebit: data.totalDebit,
            totalCredit: data.totalCredit,
          );
  }
}

final trialBalanceProvider =
    StateNotifierProvider<TrialBalanceNotifier, TrialBalanceState>((ref) {
  return TrialBalanceNotifier(ref);
});
