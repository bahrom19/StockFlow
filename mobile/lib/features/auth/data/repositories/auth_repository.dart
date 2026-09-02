import 'dart:async' show Future;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';

/// Result wrapper for API calls.
sealed class ApiResult<T> {
  const ApiResult();
}

class ApiSuccess<T> extends ApiResult<T> {
  final T data;
  const ApiSuccess(this.data);
}

class ApiFailure<T> extends ApiResult<T> {
  final Failure error;
  const ApiFailure(this.error);
}

/// Authentication Repository with typed API calls.
class AuthRepository {
  final Ref _ref;
  final AppLogger _logger = AppLogger('AuthRepository');
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('ErrorHandler'));

  AuthRepository(this._ref);

  Future<ApiResult<LoginResponse>> login({
    required String email,
    required String password,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post(
        ApiEndpoints.login,
        data: LoginRequest(email: email, password: password).toJson(),
      );
      final data = response.data as Map<String, dynamic>;
      return ApiSuccess(LoginResponse.fromJson(data));
    } catch (e) {
      _logger.error('Login failed', e);
      return ApiFailure(_errorHandler.handle(e));
    }
  }

  Future<ApiResult<LoginResponse>> register({
    required String email,
    required String password,
    required String companyName,
    String? firstName,
    String? lastName,
    String? phone,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post(
        ApiEndpoints.register,
        data: {
          'email': email,
          'password': password,
          'companyName': companyName,
          if (firstName != null && firstName.isNotEmpty) 'firstName': firstName,
          if (lastName != null && lastName.isNotEmpty) 'lastName': lastName,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
        },
      );
      final data = response.data as Map<String, dynamic>;
      return ApiSuccess(LoginResponse.fromJson(data));
    } catch (e) {
      _logger.error('Register failed', e);
      return ApiFailure(_errorHandler.handle(e));
    }
  }

  Future<ApiResult<RefreshResponse>> refreshToken({
    required String refreshTokenValue,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.post(
        ApiEndpoints.refreshToken,
        data: RefreshRequest(refreshToken: refreshTokenValue).toJson(),
      );
      final data = response.data as Map<String, dynamic>;
      return ApiSuccess(RefreshResponse.fromJson(data));
    } catch (e) {
      _logger.error('Refresh failed', e);
      return ApiFailure(_errorHandler.handle(e));
    }
  }

  // NOTE: The deployed backend (Railway) has no GET /auth/me endpoint.
  // Session restore is handled by AuthStateNotifier.checkAuthStatus, which
  // calls refreshToken() and uses the user returned in the refresh response.

  Future<ApiResult<void>> forgotPassword({required String email}) async {
    try {
      final client = _ref.read(apiClientProvider);
      await client.post(
        ApiEndpoints.forgotPassword,
        data: {'email': email},
      );
      return const ApiSuccess(null);
    } catch (e) {
      _logger.error('Forgot password failed', e);
      return ApiFailure(_errorHandler.handle(e));
    }
  }

  Future<ApiResult<void>> resetPassword({
    required String token,
    required String password,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      await client.post(
        ApiEndpoints.resetPassword,
        data: {'token': token, 'password': password},
      );
      return const ApiSuccess(null);
    } catch (e) {
      _logger.error('Reset password failed', e);
      return ApiFailure(_errorHandler.handle(e));
    }
  }

  Future<ApiResult<void>> logout({String? refreshTokenValue}) async {
    try {
      final client = _ref.read(apiClientProvider);
      if (refreshTokenValue != null && refreshTokenValue.isNotEmpty) {
        await client.post(
          ApiEndpoints.logout,
          data: {'refreshToken': refreshTokenValue},
        );
      } else {
        await client.post(ApiEndpoints.logout, data: {});
      }
      return const ApiSuccess(null);
    } catch (e) {
      _logger.warning('Logout request failed (non-critical): $e');
      return const ApiSuccess(null);
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref);
});
