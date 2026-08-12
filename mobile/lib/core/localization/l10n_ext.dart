import 'package:flutter/widgets.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

/// Safe accessor for the generated localizations.
///
/// Usage: `context.l10n.save` (resolves to the generated getter). Non-null
/// assertion is safe inside the widget tree — `AppLocalizations.delegate` is
/// registered in `StockFlowApp`.
extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
}
