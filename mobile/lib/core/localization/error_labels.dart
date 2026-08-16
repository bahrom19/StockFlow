import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/core/errors/error_handler.dart';

/// Maps a user-facing error message to the localized label at RENDER time.
///
/// Phase 5D-7B: `ErrorHandler` bakes canonical English fallback messages into
/// `Failure.message` at the repository layer (where no `BuildContext` exists).
/// Those exact strings are the keys this helper matches — for RU/KK the
/// matching `err*` ARB label is substituted, for EN (and for any backend or
/// freeform message that is not one of the canonical strings) the original
/// message passes through unchanged, preserving the EN display contract.
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
    default:
      return message;
  }
}
