import 'dart:async' show Completer;
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/token_storage.dart';
import 'package:stockflow/core/config/environment.dart';
import 'package:stockflow/core/logger/app_logger.dart';

/// StockFlow Enterprise API Client
class ApiClient {
  late final Dio _dio;
  final AppLogger _logger = AppLogger('ApiClient');
  final TokenStorage _tokenStorage;
  final _RefreshTokenQueue _refreshQueue = _RefreshTokenQueue();

  static const int _maxRetries = 3;

  /// [dio] is optional and allows tests to inject a mocked instance.
  ApiClient({required TokenStorage tokenStorage, Dio? dio})
      : _tokenStorage = tokenStorage {
    _dio = dio ??
        Dio(
          BaseOptions(
            baseUrl: Environment.apiBaseUrl,
            connectTimeout: Duration(milliseconds: Environment.apiTimeout),
            receiveTimeout: Duration(milliseconds: Environment.apiTimeout),
            sendTimeout: Duration(milliseconds: Environment.apiTimeout),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );

    _dio.interceptors.addAll([
      _AuthInterceptor(this, tokenStorage, _refreshQueue),
      _LoggingInterceptor(_logger),
      _RetryInterceptor(_logger),
    ]);
  }

  Dio get dio => _dio;
  TokenStorage get tokenStorage => _tokenStorage;
  _RefreshTokenQueue get refreshQueue => _refreshQueue;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return _dio.get<T>(path,
        queryParameters: queryParameters, options: options, cancelToken: cancelToken);
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return _dio.post<T>(path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken);
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return _dio.put<T>(path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken);
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return _dio.patch<T>(path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken);
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return _dio.delete<T>(path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken);
  }
}

// ──────────────────────────────────
// Refresh Token Queue
// ──────────────────────────────────
class _RefreshTokenQueue {
  bool _isRefreshing = false;
  final List<_PendingRequest> _pending = [];

  bool get isRefreshing => _isRefreshing;

  Future<String?> getOrRefresh({
    required TokenStorage tokenStorage,
    required AppLogger logger,
  }) async {
    if (!_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshTokenValue = await tokenStorage.getRefreshToken();
        if (refreshTokenValue == null || refreshTokenValue.isEmpty) {
          _isRefreshing = false;
          _rejectAll(Exception('No refresh token available'));
          return null;
        }

        final refreshDio = Dio(BaseOptions(baseUrl: Environment.apiBaseUrl));
        final response = await refreshDio.post(
          '/auth/refresh',
          data: {'refreshToken': refreshTokenValue},
        );
        final data = response.data as Map<String, dynamic>;
        final newAccessToken = data['accessToken']?.toString() ?? '';
        final newRefreshToken = data['refreshToken']?.toString();

        if (newAccessToken.isEmpty) {
          throw Exception('Empty access token received');
        }

        await tokenStorage.saveTokens(
          accessToken: newAccessToken,
          refreshToken: newRefreshToken != null && newRefreshToken.isNotEmpty
              ? newRefreshToken
              : null,
        );

        _isRefreshing = false;
        _resolveAll(newAccessToken);
        return newAccessToken;
      } catch (e) {
        logger.error('Token refresh failed', e);
        _isRefreshing = false;
        _rejectAll(e);
        await tokenStorage.clearTokens();
        return null;
      }
    } else {
      // Queue up — wait for the in-flight refresh to complete
      final completer = _PendingRequest();
      _pending.add(completer);
      return completer.future;
    }
  }

  void _resolveAll(String token) {
    for (final pending in _pending) {
      pending.complete(token);
    }
    _pending.clear();
  }

  void _rejectAll(Object error) {
    for (final pending in _pending) {
      pending.completeError(error);
    }
    _pending.clear();
  }
}

class _PendingRequest {
  final Completer<String?> _completer = Completer<String?>();

  Future<String?> get future => _completer.future;

  void complete(String? token) => _completer.complete(token);
  void completeError(Object error) => _completer.completeError(error);
}

// ──────────────────────────────────
// Auth Interceptor
// ──────────────────────────────────
class _AuthInterceptor extends Interceptor {
  final ApiClient _client;
  final TokenStorage _tokenStorage;
  final _RefreshTokenQueue _refreshQueue;
  final AppLogger _logger = AppLogger('AuthInterceptor');

  _AuthInterceptor(this._client, this._tokenStorage, this._refreshQueue);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _tokenStorage.getAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 && !_isAuthEndpoint(err.requestOptions.path)) {
      try {
        final newToken = await _refreshQueue.getOrRefresh(
          tokenStorage: _tokenStorage,
          logger: _logger,
        );

        if (newToken != null) {
          err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
          final retryResponse = await _client.dio.fetch(err.requestOptions);
          handler.resolve(retryResponse);
          return;
        }
      } catch (_) {
        // Refresh failed — will propagate original 401
      }
    }
    handler.next(err);
  }

  /// Don't try to refresh on the auth endpoints themselves to avoid infinite loops.
  bool _isAuthEndpoint(String path) {
    return path.contains('/auth/login') ||
        path.contains('/auth/refresh') ||
        path.contains('/auth/register');
  }
}

// ──────────────────────────────────
// Logging Interceptor
// ──────────────────────────────────
class _LoggingInterceptor extends Interceptor {
  final AppLogger _logger;

  _LoggingInterceptor(this._logger);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _logger.info('➡️ ${options.method} ${options.path}');
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    _logger.info('⬅️ ${response.statusCode} ${response.requestOptions.path}');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _logger.error('❌ ${err.response?.statusCode} ${err.requestOptions.path}: ${err.message}');
    handler.next(err);
  }
}

// ──────────────────────────────────
// Retry Interceptor (server errors only)
// ──────────────────────────────────
class _RetryInterceptor extends Interceptor {
  final AppLogger _logger;

  _RetryInterceptor(this._logger);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (_shouldRetry(err)) {
      final retryCount = (err.requestOptions.extra['retryCount'] as int?) ?? 0;
      if (retryCount < ApiClient._maxRetries) {
        err.requestOptions.extra['retryCount'] = retryCount + 1;
        _logger.warning('🔄 Retry ${retryCount + 1}/${ApiClient._maxRetries}: ${err.requestOptions.path}');
        await Future.delayed(Duration(seconds: retryCount + 1));
        try {
          final freshDio = Dio(BaseOptions(baseUrl: Environment.apiBaseUrl));
          final response = await freshDio.fetch(err.requestOptions);
          handler.resolve(response);
          return;
        } catch (_) {}
      }
    }
    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError ||
        (err.type == DioExceptionType.badResponse &&
            (err.response?.statusCode ?? 0) >= 500);
  }
}

// ──────────────────────────────────
// Provider
// ──────────────────────────────────
final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.read(tokenStorageProvider);
  return ApiClient(tokenStorage: tokenStorage);
});
