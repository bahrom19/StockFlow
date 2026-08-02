import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';

/// Deterministic in-memory ApiClient double.
///
/// Stubbing a raw Dio with mockito 5 is fragile because ApiClient forwards
/// generic type arguments and named parameters to `_dio.post<T>(...)`, which
/// rarely match the recorded stub invocation. Faking at the ApiClient boundary
/// (the actual dependency of AuthRepository) keeps the tests simple and exact.
class FakeApiClient extends ApiClient {
  FakeApiClient() : super(tokenStorage: TokenStorage());

  final Map<String, Map<String, dynamic>> _responses = {};
  Object? _errorToThrow;

  void respond(String path, Map<String, dynamic> data) {
    _responses[path] = data;
  }

  void failWith(Object error) {
    _errorToThrow = error;
  }

  Response<T> _stub<T>(String path) {
    if (_errorToThrow != null) {
      final error = _errorToThrow;
      _errorToThrow = null;
      throw error!;
    }
    final data = _responses[path];
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
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _stub<T>(path);
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _stub<T>(path);
  }

  @override
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('PUT is not stubbed in FakeApiClient ($path)');
  }

  @override
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('PATCH is not stubbed in FakeApiClient ($path)');
  }

  @override
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    throw StateError('DELETE is not stubbed in FakeApiClient ($path)');
  }
}

void main() {
  late FakeApiClient fakeApi;
  late ProviderContainer container;
  late AuthRepository authRepository;

  setUp(() {
    fakeApi = FakeApiClient();

    container = ProviderContainer(overrides: [
      apiClientProvider.overrideWith((ref) => fakeApi),
    ]);

    // Resolve AuthRepository through the provider so it uses the fake
    // ApiClient from the override above.
    authRepository = container.read(authRepositoryProvider);
  });

  tearDown(() {
    container.dispose();
  });

  group('AuthRepository', () {
    test('login returns LoginResponse on success', () async {
      fakeApi.respond(ApiEndpoints.login, {
        'accessToken': 'test_access_token',
        'refreshToken': 'test_refresh_token',
        'expiresIn': '15m',
        'refreshExpiresIn': '30d',
        'user': {
          'id': 'user-1',
          'email': 'test@stockflow.com',
          'firstName': 'John',
          'lastName': 'Doe',
          'companyId': 'company-1',
          'roles': ['Admin'],
        },
      });

      final result = await authRepository.login(
        email: 'test@stockflow.com',
        password: 'Password123',
      );

      expect(result, isA<ApiSuccess<LoginResponse>>());
      final success = result as ApiSuccess<LoginResponse>;
      expect(success.data.accessToken, 'test_access_token');
      expect(success.data.user.email, 'test@stockflow.com');
      expect(success.data.user.fullName, 'John Doe');
    });

    test('login returns ApiFailure on DioException', () async {
      fakeApi.failWith(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.login),
        response: Response(
          data: {'message': 'Invalid credentials'},
          statusCode: 401,
          requestOptions: RequestOptions(path: ApiEndpoints.login),
        ),
        type: DioExceptionType.badResponse,
      ));

      final result = await authRepository.login(
        email: 'test@stockflow.com',
        password: 'wrong',
      );

      expect(result, isA<ApiFailure<LoginResponse>>());
      final failure = result as ApiFailure<LoginResponse>;
      expect(failure.error, isA<AuthFailure>());
    });

    test('refreshToken returns RefreshResponse on success', () async {
      fakeApi.respond(ApiEndpoints.refreshToken, {
        'accessToken': 'new_access_token',
        'refreshToken': 'new_refresh_token',
        'expiresIn': '15m',
        'refreshExpiresIn': '30d',
        'user': {
          'id': 'user-1',
          'email': 'test@stockflow.com',
          'firstName': null,
          'lastName': null,
          'companyId': 'company-1',
          'roles': ['Admin'],
        },
      });

      final result = await authRepository.refreshToken(
        refreshTokenValue: 'old_refresh_token',
      );

      expect(result, isA<ApiSuccess<RefreshResponse>>());
      final success = result as ApiSuccess<RefreshResponse>;
      expect(success.data.accessToken, 'new_access_token');
    });

    test('refreshToken returns ApiFailure on 401', () async {
      fakeApi.failWith(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.refreshToken),
        response: Response(
          data: {'message': 'Invalid refresh token'},
          statusCode: 401,
          requestOptions: RequestOptions(path: ApiEndpoints.refreshToken),
        ),
        type: DioExceptionType.badResponse,
      ));

      final result = await authRepository.refreshToken(
        refreshTokenValue: 'expired_token',
      );

      expect(result, isA<ApiFailure<RefreshResponse>>());
    });

    test('refreshToken returns user profile for session restore', () async {
      // Deployed backend has no GET /auth/me — session restore uses the
      // user object returned by POST /auth/refresh.
      fakeApi.respond(ApiEndpoints.refreshToken, {
        'accessToken': 'new_access_token',
        'refreshToken': 'new_refresh_token',
        'user': {
          'id': 'user-1',
          'email': 'jane@stockflow.com',
          'firstName': 'Jane',
          'lastName': 'Smith',
          'companyId': 'company-1',
          'roles': ['Manager'],
        },
      });

      final result = await authRepository.refreshToken(
        refreshTokenValue: 'old_refresh_token',
      );

      expect(result, isA<ApiSuccess<RefreshResponse>>());
      final success = result as ApiSuccess<RefreshResponse>;
      expect(success.data.user.email, 'jane@stockflow.com');
      expect(success.data.user.fullName, 'Jane Smith');
    });

    test('logout returns success even on API error', () async {
      fakeApi.failWith(Exception('Network error'));

      final result = await authRepository.logout(
        refreshTokenValue: 'some_token',
      );

      expect(result, isA<ApiSuccess<void>>());
    });

    test('refreshToken returns ApiFailure on 500', () async {
      fakeApi.failWith(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.refreshToken),
        response: Response(
          data: {'message': 'Internal server error'},
          statusCode: 500,
          requestOptions: RequestOptions(path: ApiEndpoints.refreshToken),
        ),
        type: DioExceptionType.badResponse,
      ));

      final result = await authRepository.refreshToken(
        refreshTokenValue: 'expired_token',
      );

      expect(result, isA<ApiFailure<RefreshResponse>>());
      final failure = result as ApiFailure<RefreshResponse>;
      expect(failure.error, isA<ServerFailure>());
    });
  });
}
