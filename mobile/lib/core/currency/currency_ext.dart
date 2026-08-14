import 'package:flutter/widgets.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

/// Inherited scope carrying the selected currency code down the widget tree.
///
/// `StockFlowApp` rebuilds this scope whenever [currencyProvider] changes, so
/// every dependent widget re-renders its money values reactively. Widgets
/// outside the scope (tests, isolated harnesses) fall back to the app default
/// `KZT` via [CurrencyScope.maybeOf].
class CurrencyScope extends InheritedWidget {
  const CurrencyScope({
    super.key,
    required this.code,
    required super.child,
  });

  /// Selected currency code (one of [supportedCurrencyCodes]).
  final String code;

  static CurrencyScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<CurrencyScope>();

  /// Strict lookup — throws when the scope is missing.
  static CurrencyScope of(BuildContext context) =>
      maybeOf(context) ??
      (throw FlutterError(
        'CurrencyScope not found in the widget tree. Wrap the app (or the '
        'widget under test) in CurrencyScope(code: ...).',
      ));

  @override
  bool updateShouldNotify(CurrencyScope oldWidget) => oldWidget.code != code;
}

/// Safe accessors for the selected currency.
///
/// Usage: `context.money(price)`, `context.moneyShort(revenue)`,
/// `context.currencyCode`, `context.currencySymbol`. Falls back to `KZT`
/// when no [CurrencyScope] is present, so existing widget tests that pump
/// widgets without the scope keep working unchanged.
extension CurrencyX on BuildContext {
  /// Selected currency code; defaults to `KZT`.
  String get currencyCode => CurrencyScope.maybeOf(this)?.code ?? 'KZT';

  /// Symbol of the selected currency (e.g. `₸`).
  String get currencySymbol => CurrencyCatalog.symbolFor(currencyCode);

  /// Formats [value] with the selected currency (e.g. `₸1,234.56`).
  String money(dynamic value) =>
      CurrencyCatalog.format(value, code: currencyCode);

  /// Compact variant (e.g. `₸1.2M`, `₸1.2K`).
  String moneyShort(dynamic value) =>
      CurrencyCatalog.formatShort(value, code: currencyCode);
}
