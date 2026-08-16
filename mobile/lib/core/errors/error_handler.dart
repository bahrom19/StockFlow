import 'package:dio/dio.dart';
import '../logger/app_logger.dart';
import 'exceptions.dart';
import 'failures.dart';

/// Canonical client-side generic error messages produced by [ErrorHandler].
///
/// These exact strings are the EN display contract AND the keys used by
/// `localizedErrorLabel()` (core/localization/error_labels.dart) to substitute
/// RU/KK translations at render time — keep them in sync with the ARB EN
/// values of the `err*` keys.
abstract final class ErrorMessages {
  static const connectionTimeout =
      'Connection timeout. Please check your internet.';
  static const noInternet =
      'No internet connection. Please check your network.';
  static const unexpectedError =
      'An unexpected error occurred. Please try again.';
  static const requestCancelled = 'Request was cancelled.';
  static const unknownError = 'Unknown error';
  static const somethingWentWrong = 'Something went wrong. Please try again.';
}

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
      return ServerFailure(message: ErrorMessages.unexpectedError);
    }
  }

  Failure _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return NetworkFailure(message: ErrorMessages.connectionTimeout);

      case DioExceptionType.connectionError:
        return NetworkFailure(message: ErrorMessages.noInternet);

      case DioExceptionType.badResponse:
        return _handleStatusCode(error.response);

      case DioExceptionType.cancel:
        return ServerFailure(message: ErrorMessages.requestCancelled);

      default:
        return ServerFailure(message: ErrorMessages.somethingWentWrong);
    }
  }

  Failure _handleStatusCode(Response? response) {
    final statusCode = response?.statusCode ?? 0;
    final body = response?.data;
    final message = body is Map
        ? (body['message']?.toString() ?? ErrorMessages.unknownError)
        : ErrorMessages.unknownError;

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
