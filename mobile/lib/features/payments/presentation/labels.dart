import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';

/// UI-layer labels for backend payment-method codes (CASH/CARD/QR/...).
///
/// Known codes are localized through l10n; unknown codes fall back to the
/// existing [PaymentMethodMeta] label (EN) so RU/KK never see raw enums and
/// EN keeps the historical display byte-for-byte.
String paymentMethodLabel(String code, AppLocalizations l10n) {
  switch (code) {
    case 'CASH':
      return l10n.paymentMethodCash;
    case 'CARD':
      return l10n.paymentMethodCard;
    case 'QR':
      return l10n.paymentMethodQr;
    case 'BANK_TRANSFER':
      return l10n.paymentMethodBankTransfer;
    case 'MOBILE_WALLET':
      return l10n.paymentMethodMobileWallet;
    default:
      return PaymentMethodMeta.byCode(code).label;
  }
}

/// Short dashboard forms (Bank / Wallet) — EN keeps the historical short
/// labels, RU/KK get localized short forms.
String paymentMethodShortLabel(String code, AppLocalizations l10n) {
  switch (code) {
    case 'BANK_TRANSFER':
      return l10n.paymentMethodBankShort;
    case 'MOBILE_WALLET':
      return l10n.paymentMethodWalletShort;
    default:
      return paymentMethodLabel(code, l10n);
  }
}

/// UI-layer label for the analytics period chips.
String paymentPeriodLabel(PaymentPeriod period, AppLocalizations l10n) {
  switch (period) {
    case PaymentPeriod.today:
      return l10n.paymentPeriodToday;
    case PaymentPeriod.week:
      return l10n.paymentPeriodWeek;
    case PaymentPeriod.month:
      return l10n.paymentPeriodMonth;
    case PaymentPeriod.custom:
      return l10n.paymentPeriodCustom;
  }
}

/// Sale-status label for the payments table.
///
/// EN keeps the historical raw display byte-for-byte (uppercase, underscores
/// replaced by spaces, e.g. "PARTIALLY REFUNDED"). RU/KK localize known
/// statuses; unknown values fall back to the raw display.
String paymentStatusLabel(String status, AppLocalizations l10n) {
  if (l10n.localeName.startsWith('en')) {
    return status.replaceAll('_', ' ');
  }
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return l10n.statusCompleted;
    case 'REFUNDED':
      return l10n.statusRefunded;
    case 'PARTIALLY_REFUNDED':
      return l10n.statusPartiallyRefunded;
    case 'PENDING':
      return l10n.statusPending;
    case 'CANCELLED':
      return l10n.statusCancelled;
    case 'DRAFT':
      return l10n.statusDraft;
    case 'FAILED':
      return l10n.statusFailed;
    default:
      return status.replaceAll('_', ' ');
  }
}

/// Method label for the "Filtered by …" subtitle — EN keeps the historical
/// lowercased raw code ("cash", "bank transfer"), other locales use the
/// localized label lowercased.
String paymentMethodFilterLabel(String code, AppLocalizations l10n) {
  if (l10n.localeName.startsWith('en')) {
    return code.replaceAll('_', ' ').toLowerCase();
  }
  return paymentMethodLabel(code, l10n).toLowerCase();
}

/// Method label for the "No … payments match" empty subtitle — EN keeps the
/// raw code as-is ("No CASH payments match this search."), other locales use
/// the localized label.
String paymentMethodRawLabel(String code, AppLocalizations l10n) {
  if (l10n.localeName.startsWith('en')) {
    return code;
  }
  return paymentMethodLabel(code, l10n);
}
