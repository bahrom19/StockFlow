import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/notifications/domain/notification_models.dart';

// ──────────────────────────────────
// Result sealed class (matches project pattern)
// ──────────────────────────────────
sealed class NotificationsResult<T> {
  const NotificationsResult();
}

class NotificationsSuccess<T> extends NotificationsResult<T> {
  final T data;
  const NotificationsSuccess(this.data);
}

class NotificationsFailure<T> extends NotificationsResult<T> {
  final Failure error;
  const NotificationsFailure(this.error);
}

// ──────────────────────────────────
// Repository
// ──────────────────────────────────
class NotificationsRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('NotificationsRepo'));

  NotificationsRepository(this._api);

  /// List notifications for the authenticated user.
  Future<NotificationsResult<NotificationListResponse>> list({
    int page = 1,
    int limit = 20,
    bool? unreadOnly,
    String? type,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (unreadOnly == true) params['unreadOnly'] = 'true';
      if (type != null) params['type'] = type;

      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.notifications,
        queryParameters: params,
      );
      return NotificationsSuccess(
        NotificationListResponse.fromJson(response.data!),
      );
    } catch (e) {
      return NotificationsFailure(_errorHandler.handle(e));
    }
  }

  /// Get unread notification count.
  Future<NotificationsResult<int>> unreadCount() async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.notificationsUnreadCount,
      );
      final data = response.data!;
      return NotificationsSuccess(data['count'] as int);
    } catch (e) {
      return NotificationsFailure(_errorHandler.handle(e));
    }
  }

  /// Mark a single notification as read.
  Future<NotificationsResult<bool>> markRead(String id) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '${ApiEndpoints.notifications}/$id/read',
      );
      final data = response.data!;
      return NotificationsSuccess(data['success'] as bool);
    } catch (e) {
      return NotificationsFailure(_errorHandler.handle(e));
    }
  }
}

// ──────────────────────────────────
// Provider
// ──────────────────────────────────
final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return NotificationsRepository(api);
});
