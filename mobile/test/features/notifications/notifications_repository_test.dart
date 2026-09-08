import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/notifications/data/notifications_repository.dart';

/// Deterministic in-memory ApiClient double (matches the project-wide
/// FakeApiClient pattern from auth_repository_test.dart — faking at the
/// ApiClient boundary avoids fragile generic Dio stubbing).
class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super(tokenStorage: TokenStorage());

  final List<String> requestedPaths = [];
  final Map<String, Map<String, dynamic>> responses = {};
  Object? errorToThrow;

  void respond(String path, Map<String, dynamic> data) {
    responses[path] = data;
  }

  void failWith(Object error) {
    errorToThrow = error;
  }

  Response<T> _stub<T>(String path) {
    if (errorToThrow != null) {
      final error = errorToThrow;
      errorToThrow = null;
      throw error!;
    }
    final data = responses[path];
    if (data == null) {
      throw StateError('No stub registered for $path');
    }
    return Response(
      data: data,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    ) as Response<T>;
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    requestedPaths.add(
      queryParameters == null || queryParameters.isEmpty
          ? path
          : '$path?$queryParameters',
    );
    return _stub<T>(path);
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    requestedPaths.add(path);
    return _stub<T>(path);
  }
}

void main() {
  late _FakeApiClient fakeApi;
  late NotificationsRepository repository;

  setUp(() {
    fakeApi = _FakeApiClient();
    repository = NotificationsRepository(fakeApi);
  });

  group('NotificationsRepository.unreadCount — GET /notifications/unread-count', () {
    test('parses the count from the backend {count: number} envelope', () async {
      fakeApi.respond('/notifications/unread-count', {'count': 7});

      final result = await repository.unreadCount();

      expect(fakeApi.requestedPaths, ['/notifications/unread-count']);
      expect(result, isA<NotificationsSuccess<int>>());
      expect((result as NotificationsSuccess<int>).data, 7);
    });

    test('parses zero unread notifications', () async {
      fakeApi.respond('/notifications/unread-count', {'count': 0});

      final result = await repository.unreadCount();

      expect((result as NotificationsSuccess<int>).data, 0);
    });

    test('API error is converted to NotificationsFailure — never throws',
        () async {
      fakeApi.respond('/notifications/unread-count', {'count': 7});
      fakeApi.failWith(Exception('network down'));

      final result = await repository.unreadCount();

      expect(result, isA<NotificationsFailure<int>>());
      expect((result as NotificationsFailure<int>).error, isA<Failure>());
    });
  });

  group('NotificationsRepository.markRead — PATCH /notifications/:id/read', () {
    test('hits the mark-read endpoint and parses {success: bool}', () async {
      fakeApi.respond(
        '/notifications/abc-123/read',
        {'success': true},
      );

      final result = await repository.markRead('abc-123');

      expect(fakeApi.requestedPaths, ['/notifications/abc-123/read']);
      expect(result, isA<NotificationsSuccess<bool>>());
      expect((result as NotificationsSuccess<bool>).data, isTrue);
    });

    test('failure surfaces as NotificationsFailure without throwing',
        () async {
      fakeApi.failWith(Exception('boom'));

      final result = await repository.markRead('abc-123');

      expect(result, isA<NotificationsFailure<bool>>());
    });
  });
}
