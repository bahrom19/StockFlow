import 'package:dio/dio.dart';
import '../logger/app_logger.dart';
import 'exceptions.dart';
import 'failures.dart';

/// Central Error Handler
/// Maps exceptions to user-friendly failures.
class ErrorHandler {
  final AppLogger _logger;

  ErrorHandler(this._logger);

  Failure handle(dynamic error) {
    if (error is DioException) {
      return _handleDioError(error);
    } else if (error is ServerException) {
      return ServerFailure(message: error.message, code: error.statusCode?.toString());
    } else if (error is AuthException) {
      return AuthFailure(message: error.message);
    } else if (error is NetworkException) {
      return NetworkFailure(message: error.message);
    } else if (error is ValidationException) {
      return ValidationFailure(message: error.message, errors: error.errors);
    } else if (error is NotFoundException) {
      return NotFoundFailure(message: error.message);
    } else {
      _logger.error('Unhandled error: $error', error);
      return ServerFailure(message: 'An unexpected error occurred. Please try again.');
    }
  }

  Failure _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return NetworkFailure(message: 'Connection timed out. Please check your internet.');

      case DioExceptionType.connectionError:
        return NetworkFailure(message: 'No internet connection. Please check your network.');

      case DioExceptionType.badResponse:
        return _handleStatusCode(error.response);

      case DioExceptionType.cancel:
        return ServerFailure(message: 'Request was cancelled.');

      default:
        return ServerFailure(message: 'Something went wrong. Please try again.');
    }
  }

  Failure _handleStatusCode(Response? response) {
    final statusCode = response?.statusCode ?? 0;
    final body = response?.data;
    final message = body is Map ? (body['message']?.toString() ?? 'Unknown error') : 'Unknown error';

    switch (statusCode) {
      case 400:
        return ValidationFailure(message: message, errors: body is Map ? body['errors'] as Map<String, dynamic>? : null);
      case 401:
        return AuthFailure(message: 'Invalid credentials. Please login again.');
      case 403:
        return AuthFailure(message: 'You do not have permission to perform this action.');
      case 404:
        return NotFoundFailure(message: message);
      case 409:
        return ConflictFailure(message: message, code: '409');
      case 422:
        return ValidationFailure(message: message);
      case 429:
        return ServerFailure(message: 'Too many requests. Please wait and try again.');
      case 500:
      case 502:
      case 503:
        return ServerFailure(message: 'Server error. Please try again later.');
      default:
        return ServerFailure(message: message);
    }
  }
}
