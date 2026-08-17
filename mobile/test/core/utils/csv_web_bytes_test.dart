import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/utils/csv_web_bytes.dart';

void main() {
  group('webCsvBytes — UTF-8 BOM byte contract', () {
    test('first three bytes are EF BB BF for every locale', () {
      for (final csv in [
        'Number,Date,Status\n',
        'Номер,Дата,Статус\n',
        'Нөмір,Күні,Мәртебе\n',
      ]) {
        final bytes = webCsvBytes(csv);
        expect(bytes.sublist(0, 3), [0xEF, 0xBB, 0xBF]);
      }
    });

    test('bytes after the BOM are exactly UTF-8 of the original content', () {
      const csv = 'Number,Date,Status,Subtotal,Tax,Total,Paid\n';
      final bytes = webCsvBytes(csv);
      expect(bytes.sublist(3), utf8.encode(csv));
    });

    test('RU Cyrillic survives the BOM prefix (round-trips cleanly)', () {
      const csv = 'Номер,Дата,Статус\nSALE-1,2026-08-17,COMPLETED\n';
      final bytes = webCsvBytes(csv);
      expect(bytes.sublist(0, 3), [0xEF, 0xBB, 0xBF]);
      final decoded = utf8.decode(bytes.sublist(3), allowMalformed: false);
      expect(decoded, csv);
      expect(decoded, contains('Номер'));
      expect(decoded, contains('Статус'));
    });

    test('KK Kazakh survives the BOM prefix (round-trips cleanly)', () {
      const csv = 'Нөмір,Күні,Мәртебе\nБелсенді емес\n';
      final bytes = webCsvBytes(csv);
      expect(bytes.sublist(0, 3), [0xEF, 0xBB, 0xBF]);
      final decoded = utf8.decode(bytes.sublist(3), allowMalformed: false);
      expect(decoded, csv);
      expect(decoded, contains('Нөмір'));
      expect(decoded, contains('Белсенді емес'));
    });

    test('EN stays byte-for-byte identical apart from the BOM', () {
      const csv = 'Name,Type,Phone,Email,Bonus Points,Debt,Status\n'
          'Csv Active,PERSON,+7000000001,,0,,Active\n';
      final bytes = webCsvBytes(csv);
      expect(bytes.sublist(0, 3), [0xEF, 0xBB, 0xBF]);
      expect(utf8.decode(bytes.sublist(3)), csv);
    });

    test('empty input still carries the BOM', () {
      final bytes = webCsvBytes('');
      expect(bytes, [0xEF, 0xBB, 0xBF]);
    });

    test('delimiter, quoting and line endings are untouched', () {
      const csv = 'A,"has,comma",C\r\n"line\nbreak",E,F\n';
      final bytes = webCsvBytes(csv);
      final decoded = utf8.decode(bytes.sublist(3));
      expect(decoded, csv);
      expect(decoded, contains('"has,comma"'));
      expect(decoded, contains('"line\nbreak"'));
    });
  });
}
