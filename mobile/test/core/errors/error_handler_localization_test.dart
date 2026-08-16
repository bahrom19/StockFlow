import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/logger/app_logger.dart';

/// Phase 5D-7B — ErrorHandler canonical client-side messages must be
/// substituted with the localized label at render time for RU/KK, while EN
/// stays byte-for-byte (the ARB EN values equal the ErrorMessages constants)
/// and backend/freeform messages pass through unchanged.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('localizedErrorLabel render-time mapping', () {
    const cases = {
      ErrorMessages.connectionTimeout: (
        ru: 'Превышено время ожидания. Проверьте интернет-соединение.',
        kk: 'Қосылу уақыты аяқталды. Интернет байланысын тексеріңіз.',
      ),
      ErrorMessages.noInternet: (
        ru: 'Нет подключения к интернету. Проверьте сеть.',
        kk: 'Интернетке қосылым жоқ. Желіні тексеріңіз.',
      ),
      ErrorMessages.unexpectedError: (
        ru: 'Произошла непредвиденная ошибка. Попробуйте ещё раз.',
        kk: 'Күтпеген қате орын алды. Қайталап көріңіз.',
      ),
      ErrorMessages.requestCancelled: (
        ru: 'Запрос был отменён.',
        kk: 'Сұрау болдырмалды.',
      ),
      ErrorMessages.unknownError: (
        ru: 'Неизвестная ошибка',
        kk: 'Белгісіз қате',
      ),
      ErrorMessages.somethingWentWrong: (
        ru: 'Что-то пошло не так. Попробуйте ещё раз.',
        kk: 'Бірдеңе дұрыс болмады. Қайталап көріңіз.',
      ),
    };

    cases.forEach((english, ruKk) {
      test('EN keeps "$english" byte-for-byte', () {
        expect(localizedErrorLabel(en(), english), english);
      });

      test('RU localizes "$english" — no raw English', () {
        expect(localizedErrorLabel(ru(), english), ruKk.ru);
        expect(localizedErrorLabel(ru(), english), isNot(english));
      });

      test('KK localizes "$english" — no raw English', () {
        expect(localizedErrorLabel(kk(), english), ruKk.kk);
        expect(localizedErrorLabel(kk(), english), isNot(english));
      });
    });

    test('backend/freeform messages pass through unchanged in RU', () {
      const backend = 'Email already registered';
      expect(localizedErrorLabel(ru(), backend), backend);
    });

    test('backend/freeform messages pass through unchanged in KK', () {
      const backend = 'Some backend message';
      expect(localizedErrorLabel(kk(), backend), backend);
    });

    test('already-localized messages pass through unchanged', () {
      const ruMessage = 'Неверный email или пароль';
      expect(localizedErrorLabel(ru(), ruMessage), ruMessage);
    });
  });

  group('ErrorHandler produces the canonical messages', () {
    ErrorHandler handler() => ErrorHandler(AppLogger('ErrTest'));

    test('timeout → ErrorMessages.connectionTimeout (NetworkFailure)', () {
      final failure = handler().handle(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.connectionTimeout,
      ));
      expect(failure, isA<NetworkFailure>());
      expect(failure.message, ErrorMessages.connectionTimeout);
    });

    test('connectionError → ErrorMessages.noInternet (NetworkFailure)', () {
      final failure = handler().handle(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.connectionError,
      ));
      expect(failure, isA<NetworkFailure>());
      expect(failure.message, ErrorMessages.noInternet);
    });

    test('cancel → ErrorMessages.requestCancelled (ServerFailure)', () {
      final failure = handler().handle(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.cancel,
      ));
      expect(failure, isA<ServerFailure>());
      expect(failure.message, ErrorMessages.requestCancelled);
    });

    test('unknown Dio type → ErrorMessages.somethingWentWrong', () {
      final failure = handler().handle(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.badCertificate,
      ));
      expect(failure.message, ErrorMessages.somethingWentWrong);
    });

    test('unhandled non-Dio exception → ErrorMessages.unexpectedError', () {
      final failure = handler().handle(StateError('boom'));
      expect(failure, isA<ServerFailure>());
      expect(failure.message, ErrorMessages.unexpectedError);
    });

    test('4xx without body message → ErrorMessages.unknownError', () {
      final failure = handler().handle(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.badResponse,
        response: Response(requestOptions: RequestOptions(path: '/'), statusCode: 404),
      ));
      expect(failure.message, ErrorMessages.unknownError);
    });
  });
}
