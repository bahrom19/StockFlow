import 'package:flutter_gen/gen_l10n/app_localizations.dart';

/// UI-layer labels for receipt status values (backend: `DRAFT`, `COMPLETED`).
///
/// EN keeps the historical raw value byte-for-byte (e.g. `DRAFT`); RU/KK
/// localize known values through l10n; unknown values fall back to the raw
/// value so RU/KK never show raw enums for known statuses and nothing new
/// ever renders as an empty string.
String receiptStatusLabel(String status, AppLocalizations l10n) {
  if (l10n.localeName.startsWith('en')) {
    return status;
  }
  switch (status.toUpperCase()) {
    case 'DRAFT':
      return l10n.statusDraft;
    case 'COMPLETED':
      return l10n.statusCompleted;
    default:
      return status;
  }
}
