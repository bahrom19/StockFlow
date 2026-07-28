import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';

// ── PO List State ──

sealed class POListState {
  const POListState();
}

class POListLoading extends POListState {
  const POListLoading();
}

class POListLoaded extends POListState {
  final List<PurchaseOrder> orders;
  final int total;
  final int page;
  final bool hasMore;
  final bool isRefreshing;
  final bool isLoadingMore;
  final String search;

  const POListLoaded({
    required this.orders,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search = '',
  });

  POListLoaded copyWith({
    List<PurchaseOrder>? orders,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? search,
  }) {
    return POListLoaded(
      orders: orders ?? this.orders,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      search: search ?? this.search,
    );
  }
}

class POListEmpty extends POListState {
  const POListEmpty();
}

class POListError extends POListState {
  final String message;
  final Failure? failure;
  const POListError(this.message, {this.failure});
}

class POListNotifier extends StateNotifier<POListState> {
  final Ref _ref;
  Timer? _searchDebounce;
  String _currentSearch = '';
  String? _statusFilter;

  POListNotifier(this._ref) : super(const POListLoading());

  Future<void> loadOrders() async {
    state = const POListLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is POListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, orders: []);
    }
    _currentSearch = '';
    _statusFilter = null;
    await _fetch();
  }

  void search(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _currentSearch = query;
      final current = state;
      if (current is POListLoaded) {
        state = current.copyWith(isRefreshing: true, page: 1, orders: []);
      } else {
        state = const POListLoading();
      }
      _fetch();
    });
  }

  void filterByStatus(String? status) {
    _statusFilter = status;
    final current = state;
    if (current is POListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, orders: []);
    } else {
      state = const POListLoading();
    }
    _fetch();
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! POListLoaded || current.isLoadingMore || !current.hasMore) return;
    state = current.copyWith(isLoadingMore: true);
    await _fetch(page: current.page + 1, append: true);
  }

  Future<void> _fetch({int page = 1, bool append = false}) async {
    final repo = _ref.read(purchasingRepositoryProvider);
    final result = await repo.listOrders(
      page: page,
      limit: 20,
      search: _currentSearch.isNotEmpty ? _currentSearch : null,
      status: _statusFilter,
    );
    if (result is PurchasingFailure) {
      state = POListError(
        (result as PurchasingFailure<PurchaseOrderListResponse>).error.message,
        failure: (result as PurchasingFailure<PurchaseOrderListResponse>).error,
      );
      return;
    }
    final response = (result as PurchasingSuccess<PurchaseOrderListResponse>).data;
    if (response.items.isEmpty && page == 1) {
      state = const POListEmpty();
      return;
    }
    final orders = append
        ? [...(state as POListLoaded).orders, ...response.items]
        : response.items;
    final hasMore = orders.length < response.total;
    state = POListLoaded(
      orders: orders,
      total: response.total,
      page: page,
      hasMore: hasMore,
      search: _currentSearch,
    );
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}

final poListProvider = StateNotifierProvider<POListNotifier, POListState>((ref) {
  return POListNotifier(ref);
});
