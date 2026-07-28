import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/features/auth/data/repositories/auth_repository.dart';

class MockDio extends Mock implements Dio {}

class MockTokenStorage extends Mock implements TokenStorage {}

void main() {
  late MockDio mockDio;
  late MockTokenStorage mockTokenStorage;
  late ProviderContainer container;
  late AuthRepository authRepository;

  setUp(() {
    mockDio = MockDio();
    mockTokenStorage = MockTokenStorage();

    container = ProviderContainer(overrides: [
      apiClientProvider.overrideWith((ref) => ApiClient(tokenStorage: mockTokenStorage)),
    ]);

    // Override the Dio instance in ApiClient for testing
    authRepository = AuthRepository(container);
  });

  tearDown(() {
    container.dispose();
  });

  group('AuthRepository', () {
    test('login returns LoginResponse on success', () async {
      final responseData = {
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
      };

      when(mockDio.post(
        ApiEndpoints.login,
        data: anyNamed('data'),
      )).thenAnswer((_) async => Response(
            data: responseData,
            statusCode: 200,
            requestOptions: RequestOptions(path: ApiEndpoints.login),
          ));

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
      when(mockDio.post(
        ApiEndpoints.login,
        data: anyNamed('data'),
      )).thenThrow(DioException(
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
      final responseData = {
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
      };

      when(mockDio.post(
        ApiEndpoints.refreshToken,
        data: anyNamed('data'),
      )).thenAnswer((_) async => Response(
            data: responseData,
            statusCode: 200,
            requestOptions: RequestOptions(path: ApiEndpoints.refreshToken),
          ));

      final result = await authRepository.refreshToken(
        refreshTokenValue: 'old_refresh_token',
      );

      expect(result, isA<ApiSuccess<RefreshResponse>>());
      final success = result as ApiSuccess<RefreshResponse>;
      expect(success.data.accessToken, 'new_access_token');
    });

    test('refreshToken returns ApiFailure on 401', () async {
      when(mockDio.post(
        ApiEndpoints.refreshToken,
        data: anyNamed('data'),
      )).thenThrow(DioException(
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

    test('getProfile returns CurrentUser on success', () async {
      final responseData = {
        'id': 'user-1',
        'email': 'test@stockflow.com',
        'firstName': 'Jane',
        'lastName': 'Smith',
        'companyId': 'company-1',
        'roles': ['Manager'],
      };

      when(mockDio.get(
        ApiEndpoints.me,
      )).thenAnswer((_) async => Response(
            data: responseData,
            statusCode: 200,
            requestOptions: RequestOptions(path: ApiEndpoints.me),
          ));

      final result = await authRepository.getProfile();

      expect(result, isA<ApiSuccess<CurrentUser>>());
      final success = result as ApiSuccess<CurrentUser>;
      expect(success.data.email, 'test@stockflow.com');
      expect(success.data.fullName, 'Jane Smith');
    });

    test('logout returns success even on API error', () async {
      when(mockDio.post(
        ApiEndpoints.logout,
        data: anyNamed('data'),
      )).thenThrow(Exception('Network error'));

      final result = await authRepository.logout(
        refreshTokenValue: 'some_token',
      );

      expect(result, isA<ApiSuccess<void>>());
    });

    test('getProfile returns ApiFailure on 500', () async {
      when(mockDio.get(
        ApiEndpoints.me,
      )).thenThrow(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.me),
        response: Response(
          data: {'message': 'Internal server error'},
          statusCode: 500,
          requestOptions: RequestOptions(path: ApiEndpoints.me),
        ),
        type: DioExceptionType.badResponse,
      ));

      final result = await authRepository.getProfile();

      expect(result, isA<ApiFailure<CurrentUser>>());
      final failure = result as ApiFailure<CurrentUser>;
      expect(failure.error, isA<ServerFailure>());
    });
  });
}
