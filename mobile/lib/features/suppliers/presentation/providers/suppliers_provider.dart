import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

sealed class SupplierListState {
  const SupplierListState();
}

class SupplierListLoading extends SupplierListState {
  const SupplierListLoading();
}

class SupplierListLoaded extends SupplierListState {
  final List<Supplier> suppliers;
  final int total;
  final int page;
  final bool hasMore;
  final bool isRefreshing;
  final bool isLoadingMore;
  final String search;

  const SupplierListLoaded({
    required this.suppliers,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search = '',
  });

  SupplierListLoaded copyWith({
    List<Supplier>? suppliers,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? search,
  }) {
    return SupplierListLoaded(
      suppliers: suppliers ?? this.suppliers,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      search: search ?? this.search,
    );
  }
}

class SupplierListEmpty extends SupplierListState {
  const SupplierListEmpty();
}

class SupplierListError extends SupplierListState {
  final String message;
  final Failure? failure;
  const SupplierListError(this.message, {this.failure});
}

class SupplierListNotifier extends StateNotifier<SupplierListState> {
  final Ref _ref;
  Timer? _searchDebounce;
  String _currentSearch = '';

  SupplierListNotifier(this._ref) : super(const SupplierListLoading());

  Future<void> loadSuppliers() async {
    state = const SupplierListLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is SupplierListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, suppliers: []);
    }
    _currentSearch = '';
    await _fetch();
  }

  void search(String query) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _currentSearch = query;
      final current = state;
      if (current is SupplierListLoaded) {
        state = current.copyWith(isRefreshing: true, page: 1, suppliers: []);
      } else {
        state = const SupplierListLoading();
      }
      _fetch();
    });
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! SupplierListLoaded ||
        current.isLoadingMore ||
        !current.hasMore) return;
    state = current.copyWith(isLoadingMore: true);
    await _fetch(page: current.page + 1, append: true);
  }

  Future<void> _fetch({int page = 1, bool append = false}) async {
    final repo = _ref.read(suppliersRepositoryProvider);
    final result = await repo.list(
      page: page,
      limit: 20,
      search: _currentSearch.isNotEmpty ? _currentSearch : null,
    );
    if (result is SuppliersFailure) {
      state = SupplierListError(
        (result as SuppliersFailure<SupplierListResponse>).error.message,
        failure: (result as SuppliersFailure<SupplierListResponse>).error,
      );
      return;
    }
    final response = (result as SuppliersSuccess<SupplierListResponse>).data;
    if (response.items.isEmpty && page == 1) {
      state = const SupplierListEmpty();
      return;
    }
    final suppliers = append
        ? [...(state as SupplierListLoaded).suppliers, ...response.items]
        : response.items;
    final hasMore = suppliers.length < response.total;
    state = SupplierListLoaded(
      suppliers: suppliers,
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

final supplierListProvider =
    StateNotifierProvider<SupplierListNotifier, SupplierListState>((ref) {
  return SupplierListNotifier(ref);
});
