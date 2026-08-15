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

/// Render-time localization for held-sale labels (POS Hold Sale flow).
///
/// Persisted data is never migrated: auto-generated labels (`Held HH:MM`) and
/// the legacy `Held sale` fallback are localized at display time, while
/// user-entered freeform labels pass through unchanged. This works for
/// existing stored data and for live EN/RU/KK switching — the provider never
/// needs a BuildContext.
String heldSaleDisplayLabel(AppLocalizations l10n, String stored) {
  final auto = RegExp(r'^Held (\d{2}:\d{2})$').firstMatch(stored);
  if (auto != null) {
    return '${l10n.posHeldAtPrefix} ${auto.group(1)}';
  }
  if (stored == 'Held sale') {
    return l10n.posHeldSaleFallback;
  }
  return stored;
}
