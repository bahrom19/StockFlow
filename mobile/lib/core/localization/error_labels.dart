import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/core/errors/error_handler.dart';

/// Maps a user-facing error message to the localized label at RENDER time.
///
/// Phase 5D-7B: `ErrorHandler` bakes canonical English fallback messages into
/// `Failure.message` at the repository layer (where no `BuildContext` exists).
/// Those exact strings are the keys this helper matches — for RU/KK the
/// matching `err*` ARB label is substituted for known canonical messages, and
/// any unknown backend/freeform message falls back to a safe localized generic
/// label so untranslated English never leaks to RU/KK users. EN keeps the
/// original message unchanged, preserving the EN display contract.
String localizedErrorLabel(AppLocalizations l10n, String message) {
  switch (message) {
    case ErrorMessages.connectionTimeout:
      return l10n.errConnectionTimeout;
    case ErrorMessages.noInternet:
      return l10n.errNoInternet;
    case ErrorMessages.unexpectedError:
      return l10n.errUnexpectedError;
    case ErrorMessages.requestCancelled:
      return l10n.errRequestCancelled;
    case ErrorMessages.unknownError:
      return l10n.errUnknownError;
    case ErrorMessages.somethingWentWrong:
      return l10n.errSomethingWentWrong;
    case ErrorMessages.insufficientStock:
      return l10n.insufficientStock;
    case ErrorMessages.invalidCredentials:
      return l10n.errInvalidCredentials;
    case ErrorMessages.permissionDenied:
      return l10n.errPermissionDenied;
    case ErrorMessages.tooManyRequests:
      return l10n.errTooManyRequests;
    case ErrorMessages.serverUnavailable:
      return l10n.errServerUnavailable;
    default:
      // Canonical client errors above have explicit translations. Unknown
      // backend text is still retained by the failure/logger, but must not
      // leak as untranslated user-facing text in RU/KK.
      return l10n.localeName.startsWith('en') ? message : l10n.errGenericServer;
  }
}
