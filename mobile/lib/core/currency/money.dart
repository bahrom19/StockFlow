import 'dart:core';

/// Canonical monetary value for POS/domain arithmetic.
///
/// Amount is stored as an exact integer in the currency's minor units
/// (2 decimal places — the same scale the UI `CurrencyCatalog` renders and the
/// backend `Decimal(12,2)` persists). All arithmetic (`+`, `-`, `* int`,
/// comparisons) operates on that integer and never touches `double`.
///
/// Currency is carried together with the amount; mixing currencies throws.
class Money {
  /// Minor units per major unit (2 decimals, the StockFlow contract).
  static const int scale = 100;

  /// Minor-unit integer amount. May be negative (discount / change lines).
  final int minorUnits;

  /// ISO currency code (one of [supportedCurrencyCodes]).
  final String currency;

  const Money({required this.minorUnits, required this.currency});

  /// Creates a Money from a minor-unit count (exact, no rounding).
  static Money fromMinorUnits(int minorUnits, String currency) =>
      Money(minorUnits: minorUnits, currency: currency);

  /// Zero amount in [currency].
  static Money zero(String currency) =>
      Money(minorUnits: 0, currency: currency);

  /// Exact decimal-string boundary parser.
  /// Returns null on malformed input or when the value has >2 decimal places
  /// (the backend Decimal(12,2) contract).
  static Money? tryParse(
    String? text,
    String currency, {
    bool allowNegative = false,
  }) {
    if (text == null) return null;
    final trimmed = text.trim();
    if (trimmed.isEmpty) return null;

    final isNegative = trimmed.startsWith('-');
    final body = isNegative ? trimmed.substring(1) : trimmed;
    if (body.isEmpty) return null;
    if (!RegExp(r'^\d+(\.\d+)?$').hasMatch(body)) return null;

    final parts = body.split('.');
    final fracPart = parts.length == 2 ? parts[1] : '';
    if (fracPart.length > 2 || !RegExp(r'^\d{0,2}$').hasMatch(fracPart)) {
      return null; // >2 decimals is out of contract for StockFlow currencies.
    }

    final whole = int.parse(parts[0]);
    final frac = fracPart.isEmpty ? 0 : int.parse(fracPart.padRight(2, '0'));

    if (isNegative && !allowNegative) return null;
    final sign = isNegative ? -1 : 1;

    return Money(
      minorUnits: sign * (whole * scale + frac),
      currency: currency,
    );
  }

  /// Parses and must succeed — throws [ArgumentError] on invalid input.
  static Money parse(String text, String currency,
      {bool allowNegative = false}) {
    final m = tryParse(text, currency, allowNegative: allowNegative);
    if (m == null) {
      throw ArgumentError('Invalid money amount "$text" for "$currency"');
    }
    return m;
  }

  /// Input-boundary adapter for wire / persisted values that may already be a
  /// `num` (legacy HeldSale JSON) or a decimal string.
  static Money? fromJson(dynamic value, String currency) {
    if (value == null) return null;
    if (value is String) {
      return tryParse(value as String, currency, allowNegative: true);
    }
    if (value is int) {
      return Money(minorUnits: (value as int) * scale, currency: currency);
    }
    if (value is double) {
      return tryParse((value as double).toString(), currency,
          allowNegative: true);
    }
    return null;
  }

  bool get isZero => minorUnits == 0;
  bool get isPositive => minorUnits > 0;
  bool get isNegative => minorUnits < 0;

  Money operator +(Money other) {
    _assertSameCurrency(other);
    return Money(minorUnits: minorUnits + other.minorUnits, currency: currency);
  }

  Money operator -(Money other) {
    _assertSameCurrency(other);
    return Money(minorUnits: minorUnits - other.minorUnits, currency: currency);
  }

  Money operator *(int times) =>
      Money(minorUnits: minorUnits * times, currency: currency);

  bool operator <(Money other) {
    _assertSameCurrency(other);
    return minorUnits < other.minorUnits;
  }

  bool operator <=(Money other) {
    _assertSameCurrency(other);
    return minorUnits <= other.minorUnits;
  }

  bool operator >(Money other) {
    _assertSameCurrency(other);
    return minorUnits > other.minorUnits;
  }

  bool operator >=(Money other) {
    _assertSameCurrency(other);
    return minorUnits >= other.minorUnits;
  }

  @override
  bool operator ==(Object other) =>
      other is Money &&
      (other as Money).currency == currency &&
      (other as Money).minorUnits == minorUnits;

  @override
  int get hashCode => currency.hashCode * 31 + minorUnits;

  /// Clamps this amount between [min] and [max] (minor-unit granularity).
  Money clamp(Money min, Money max) {
    _assertSameCurrency(min);
    _assertSameCurrency(max);
    var v = minorUnits;
    if (v <= min.minorUnits) {
      v = min.minorUnits;
    } else if (v >= max.minorUnits) {
      v = max.minorUnits;
    }
    return Money(minorUnits: v, currency: currency);
  }

  /// Negated amount (discount / change display).
  Money get negate => Money(minorUnits: -minorUnits, currency: currency);

  /// Absolute amount.
  Money get abs => Money(
      minorUnits: minorUnits < 0 ? -minorUnits : minorUnits,
      currency: currency);

  /// Exact canonical decimal string, e.g. `"3.50"` / `"-0.25"`.
  String toDecimalString() {
    final sign = minorUnits < 0 ? '-' : '';
    final abs = minorUnits.abs();
    final whole = abs ~/ scale;
    final frac = (abs % scale).toString().padLeft(2, '0');
    return '$sign$whole.$frac';
  }

  @override
  String toString() => toDecimalString();

  /// API-boundary adapter: the numeric JSON value (backend DTO expects
  /// `@IsNumber`). Lossless for whole+2-decimal values when converted back.
  num toApiNumber() => minorUnits / scale;

  void _assertSameCurrency(Money other) {
    if (other.currency != currency) {
      throw ArgumentError(
        'Cannot combine currencies "$currency" and "${other.currency}"',
      );
    }
  }
}
