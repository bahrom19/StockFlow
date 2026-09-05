import 'package:flutter/material.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

/// Compact, reusable currency selector.
///
/// Reuses THE canonical currency system — [supportedCurrencyCodes] +
/// [currencyDisplayNames] + [CurrencyCatalog]. It never invents a second
/// currency set, provider or formatter (CURRENCY-4 architectural rule).
///
/// Used by: Purchase Order form, Open Cash Shift dialog, Reports filter and
/// Dashboard filter. [enabled] = false renders the current selection in a
/// read-only state (DRAFT-only editing, immutable open shift currency, etc).
class CurrencySelector extends StatelessWidget {
  const CurrencySelector({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.label,
    this.isDense = true,
  });

  /// Current ISO currency code (one of [supportedCurrencyCodes]).
  final String value;

  final ValueChanged<String> onChanged;

  /// When false the selector is read-only (non-DRAFT documents, immutable
  /// open-shift currency).
  final bool enabled;

  /// Optional label (callers use `context.l10n.currency`).
  final String? label;

  final bool isDense;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final effective = supportedCurrencyCodes.contains(value) ? value : 'KZT';
    // Material(transparency) keeps the dropdown self-sufficient when the
    // selector is embedded in trees without a Material ancestor (e.g. the
    // Dashboard/Reports ListViews) — no visual impact anywhere else.
    return Material(
      type: MaterialType.transparency,
      child: InputDecorator(
        key: const Key('currency_selector'),
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(
            horizontal: 12,
            vertical: isDense ? 8 : 14,
          ),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: effective,
            isDense: isDense,
            icon: enabled ? null : const Icon(Icons.lock_outline, size: 16),
            style: theme.textTheme.bodyMedium,
            items: [
              for (final code in supportedCurrencyCodes)
                DropdownMenuItem(
                  value: code,
                  child: Text(currencyDisplayNames[code] ?? code),
                ),
            ],
            onChanged: enabled
                ? (code) {
                    if (code != null && code != effective) onChanged(code);
                  }
                : null,
          ),
        ),
      ),
    );
  }
}
