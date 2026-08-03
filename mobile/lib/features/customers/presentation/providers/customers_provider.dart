import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/customers/data/customers_repository.dart';
import 'package:stockflow/features/customers/domain/customer_models.dart';

// ──────────────────────────────────
// State
// ──────────────────────────────────
sealed class CustomersListState {
  const CustomersListState();
}

class CustomersListLoading extends CustomersListState {
  const CustomersListLoading();
}

class CustomersListLoaded extends CustomersListState {
  final List<Customer> customers;
  final int total;
  final int page;
  final bool hasMore;
  final bool isRefreshing;
  final bool isLoadingMore;
  final String search;
  final String? typeFilter;

  const CustomersListLoaded({
    required this.customers,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search = '',
    this.typeFilter,
  });

  CustomersListLoaded copyWith({
    List<Customer>? customers,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? search,
    String? typeFilter,
  }) {
    return CustomersListLoaded(
      customers: customers ?? this.customers,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      search: search ?? this.search,
      typeFilter: typeFilter ?? this.typeFilter,
    );
  }
}

class CustomersListEmpty extends CustomersListState {
  const CustomersListEmpty();
}

class CustomersListError extends CustomersListState {
  final String message;
  final Failure? failure;
  const CustomersListError(this.message, {this.failure});
}

// ──────────────────────────────────
// Notifier
// ──────────────────────────────────
class CustomersListNotifier extends StateNotifier<CustomersListState> {
  final Ref _ref;
  Timer? _searchDebounce;
  String _currentSearch = '';
  String? _typeFilter;

  CustomersListNotifier(this._ref) : super(const CustomersListLoading());

  Future<void> loadCustomers() async {
    state = const CustomersListLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is CustomersListLoaded) {
      state = current.copyWith(
        isRefreshing: true,
        page: 1,
        customers: [],
      );
    }
    _currentSearch = '';
    _typeFilter = null;
    await _fetch();
  }

  void search(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _currentSearch = query;
      final current = state;
      if (current is CustomersListLoaded) {
        state = current.copyWith(isRefreshing: true, page: 1, customers: []);
      } else {
        state = const CustomersListLoading();
      }
      _fetch();
    });
  }

  void filterByType(String? type) {
    _typeFilter = type;
    final current = state;
    if (current is CustomersListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, customers: []);
    } else {
      state = const CustomersListLoading();
    }
    _fetch();
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! CustomersListLoaded ||
        current.isLoadingMore ||
        !current.hasMore) return;
    state = current.copyWith(isLoadingMore: true);
    await _fetch(page: current.page + 1, append: true);
  }

  Future<void> _fetch({int page = 1, bool append = false}) async {
    final repo = _ref.read(customersRepositoryProvider);
    final result = await repo.list(
      page: page,
      limit: 20,
      search: _currentSearch.isNotEmpty ? _currentSearch : null,
      type: _typeFilter,
    );
    if (result is CustomersFailure) {
      state = CustomersListError(
        (result as CustomersFailure<CustomerListResponse>).error.message,
        failure: (result as CustomersFailure<CustomerListResponse>).error,
      );
      return;
    }
    final response = (result as CustomersSuccess<CustomerListResponse>).data;
    if (response.items.isEmpty && page == 1) {
      state = const CustomersListEmpty();
      return;
    }
    final customers = append
        ? [...(state as CustomersListLoaded).customers, ...response.items]
        : response.items;
    final hasMore = customers.length < response.total;
    state = CustomersListLoaded(
      customers: customers,
      total: response.total,
      page: page,
      hasMore: hasMore,
      search: _currentSearch,
      typeFilter: _typeFilter,
    );
  }

  Future<bool> delete(String id) async {
    final repo = _ref.read(customersRepositoryProvider);
    final result = await repo.delete(id);
    if (result is CustomersFailure) return false;
    await _fetch();
    return true;
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    super.dispose();
  }
}

final customersListProvider =
    StateNotifierProvider<CustomersListNotifier, CustomersListState>((ref) {
  return CustomersListNotifier(ref);
});
