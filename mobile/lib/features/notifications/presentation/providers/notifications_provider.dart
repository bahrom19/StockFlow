import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/notifications/data/notifications_repository.dart';
import 'package:stockflow/features/notifications/domain/notification_models.dart';

// ──────────────────────────────────
// List State (sealed)
// ──────────────────────────────────
sealed class NotificationsListState {
  const NotificationsListState();
}

class NotificationsListLoading extends NotificationsListState {
  const NotificationsListLoading();
}

class NotificationsListLoaded extends NotificationsListState {
  final List<AppNotification> items;
  final int total;
  final int page;
  final bool hasMore;
  final bool isRefreshing;
  final bool isLoadingMore;

  const NotificationsListLoaded({
    required this.items,
    required this.total,
    required this.page,
    this.hasMore = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
  });

  NotificationsListLoaded copyWith({
    List<AppNotification>? items,
    int? total,
    int? page,
    bool? hasMore,
    bool? isRefreshing,
    bool? isLoadingMore,
  }) {
    return NotificationsListLoaded(
      items: items ?? this.items,
      total: total ?? this.total,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }
}

class NotificationsListEmpty extends NotificationsListState {
  const NotificationsListEmpty();
}

class NotificationsListError extends NotificationsListState {
  final String message;
  final Failure? failure;
  const NotificationsListError(this.message, {this.failure});
}

// ──────────────────────────────────
// List Notifier
// ──────────────────────────────────
class NotificationsListNotifier extends StateNotifier<NotificationsListState> {
  final Ref _ref;

  NotificationsListNotifier(this._ref) : super(const NotificationsListLoading());

  Future<void> loadNotifications() async {
    state = const NotificationsListLoading();
    await _fetch();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is NotificationsListLoaded) {
      state = current.copyWith(isRefreshing: true, page: 1, items: []);
    }
    await _fetch();
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! NotificationsListLoaded ||
        current.isLoadingMore ||
        !current.hasMore) return;
    state = current.copyWith(isLoadingMore: true);
    await _fetch(page: current.page + 1, append: true);
  }

  /// Mark a notification as read and optimistically update local state.
  Future<void> markRead(String id) async {
    final repo = _ref.read(notificationsRepositoryProvider);
    final result = await repo.markRead(id);

    if (result is NotificationsFailure) return;

    // Optimistic local update
    final current = state;
    if (current is NotificationsListLoaded) {
      final updated = current.items.map((n) {
        if (n.id == id && !n.isRead) {
          return n.copyWith(readAt: DateTime.now().toIso8601String());
        }
        return n;
      }).toList();
      state = current.copyWith(items: updated);
    }

    // Refresh unread count
    _ref.read(unreadCountProvider.notifier).refresh();
  }

  Future<void> _fetch({int page = 1, bool append = false}) async {
    final repo = _ref.read(notificationsRepositoryProvider);
    final result = await repo.list(page: page, limit: 20);

    if (result is NotificationsFailure) {
      state = NotificationsListError(
        (result as NotificationsFailure<NotificationListResponse>).error.message,
        failure: (result as NotificationsFailure<NotificationListResponse>).error,
      );
      return;
    }

    final response =
        (result as NotificationsSuccess<NotificationListResponse>).data;

    if (response.items.isEmpty && page == 1) {
      state = const NotificationsListEmpty();
      return;
    }

    final items = append
        ? [...(state as NotificationsListLoaded).items, ...response.items]
        : response.items;
    final hasMore = items.length < response.total;

    state = NotificationsListLoaded(
      items: items,
      total: response.total,
      page: page,
      hasMore: hasMore,
    );
  }
}

final notificationsListProvider =
    StateNotifierProvider<NotificationsListNotifier, NotificationsListState>(
        (ref) {
  return NotificationsListNotifier(ref);
});

// ──────────────────────────────────
// Unread Count State + Notifier
// ──────────────────────────────────
sealed class UnreadCountState {
  const UnreadCountState();
}

class UnreadCountLoading extends UnreadCountState {
  const UnreadCountLoading();
}

class UnreadCountLoaded extends UnreadCountState {
  final int count;
  const UnreadCountLoaded(this.count);
}

class UnreadCountError extends UnreadCountState {
  const UnreadCountError();
}

class UnreadCountNotifier extends StateNotifier<UnreadCountState> {
  final Ref _ref;

  UnreadCountNotifier(this._ref) : super(const UnreadCountLoading());

  Future<void> load() async {
    await _fetch();
  }

  Future<void> refresh() async {
    await _fetch();
  }

  Future<void> _fetch() async {
    final repo = _ref.read(notificationsRepositoryProvider);
    final result = await repo.unreadCount();

    if (result is NotificationsFailure) {
      state = const UnreadCountError();
      return;
    }

    final count = (result as NotificationsSuccess<int>).data;
    state = UnreadCountLoaded(count);
  }
}

final unreadCountProvider =
    StateNotifierProvider<UnreadCountNotifier, UnreadCountState>((ref) {
  return UnreadCountNotifier(ref);
});
