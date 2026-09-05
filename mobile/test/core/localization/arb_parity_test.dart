import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Reads the ARB file at [path] and returns the ordered list of
/// user-facing keys (excludes @@-prefixed metadata).
List<String> _readArbKeys(String path) {
  final content = File(path).readAsStringSync();
  final Map<String, dynamic> json = jsonDecode(content);
  return json.keys.where((k) => !k.startsWith('@@')).toList();
}

/// Detects duplicate key definitions in raw ARB text.
/// JSON.parse silently keeps the last value; this catches earlier duplicates.
List<String> _findDuplicateKeys(String path) {
  final lines = File(path).readAsLinesSync();
  final seen = <String, int>{};
  final dupes = <String>[];
  for (var i = 0; i < lines.length; i++) {
    final match = RegExp(r'^\s*"(\w+)"\s*:\s*"').firstMatch(lines[i]);
    if (match != null) {
      final key = match.group(1)!;
      if (seen.containsKey(key)) {
        dupes.add(key);
      } else {
        seen[key] = i;
      }
    }
  }
  return dupes;
}

void main() {
  const enPath = 'lib/l10n/app_en.arb';
  const ruPath = 'lib/l10n/app_ru.arb';
  const kkPath = 'lib/l10n/app_kk.arb';

  group('ARB duplicate keys', () {
    test('EN has no duplicate keys', () {
      final dupes = _findDuplicateKeys(enPath);
      expect(dupes, isEmpty, reason: 'Duplicate keys in EN: $dupes');
    });

    test('RU has no duplicate keys', () {
      final dupes = _findDuplicateKeys(ruPath);
      expect(dupes, isEmpty, reason: 'Duplicate keys in RU: $dupes');
    });

    test('KK has no duplicate keys', () {
      final dupes = _findDuplicateKeys(kkPath);
      expect(dupes, isEmpty, reason: 'Duplicate keys in KK: $dupes');
    });
  });

  group('ARB key parity', () {
    late List<String> enKeys;
    late List<String> ruKeys;
    late List<String> kkKeys;

    setUpAll(() {
      enKeys = _readArbKeys(enPath);
      ruKeys = _readArbKeys(ruPath);
      kkKeys = _readArbKeys(kkPath);
    });

    test('EN and RU have identical key sets', () {
      final enSet = enKeys.toSet();
      final ruSet = ruKeys.toSet();
      expect(ruSet.difference(enSet), isEmpty,
          reason: 'Keys in RU but not EN: ${ruSet.difference(enSet)}');
      expect(enSet.difference(ruSet), isEmpty,
          reason: 'Keys in EN but not RU: ${enSet.difference(ruSet)}');
    });

    test('EN and KK have identical key sets', () {
      final enSet = enKeys.toSet();
      final kkSet = kkKeys.toSet();
      expect(kkSet.difference(enSet), isEmpty,
          reason: 'Keys in KK but not EN: ${kkSet.difference(enSet)}');
      expect(enSet.difference(kkSet), isEmpty,
          reason: 'Keys in EN but not KK: ${enSet.difference(kkSet)}');
    });

    test('all three ARBs have the same key count', () {
      expect(enKeys.length, equals(ruKeys.length));
      expect(enKeys.length, equals(kkKeys.length));
    });
  });
}
