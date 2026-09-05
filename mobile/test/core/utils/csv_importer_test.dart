import 'package:flutter_test/flutter_test.dart';
import 'package:csv/csv.dart';
import 'package:stockflow/core/utils/csv_importer.dart';

/// Helper to build CSV text with real newlines.
String csv(String header, [List<String> rows = const []]) {
  final buf = StringBuffer();
  buf.writeln(header);
  for (final row in rows) {
    buf.writeln(row);
  }
  return buf.toString();
}

void main() {
  // ──────────────────────────────────────────────────────
  // Parser tests
  // ──────────────────────────────────────────────────────
  group('CSV Parser', () {
    test('comma-delimited CSV', () {
      final result = parseCsv(csv('name,price', ['Milk,500', 'Bread,200']));
      expect(result.rows.length, 2);
      expect(result.delimiter, ',');
      expect(result.rows[0].values[ImportField.name], 'Milk');
      expect(result.rows[0].values[ImportField.price], '500');
      expect(result.rows[1].values[ImportField.name], 'Bread');
      expect(result.rows[1].values[ImportField.price], '200');
    });

    test('semicolon-delimited CSV', () {
      final result = parseCsv(csv('name;price', ['Milk;500', 'Bread;200']));
      expect(result.rows.length, 2);
      expect(result.delimiter, ';');
      expect(result.rows[0].values[ImportField.name], 'Milk');
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('quoted fields', () {
      final result = parseCsv(
        csv('name,description', ['"Product A","A great product"']),
      );
      expect(result.rows.length, 1);
      expect(result.rows[0].values[ImportField.name], 'Product A');
      expect(result.rows[0].values[ImportField.description], 'A great product');
    });

    test('comma inside quoted field', () {
      final result = parseCsv(
        csv('name,description', ['"Product A","Contains, comma"']),
      );
      expect(result.rows.length, 1);
      expect(result.rows[0].values[ImportField.description], 'Contains, comma');
    });

    test('semicolon inside quoted field', () {
      final result = parseCsv(
        csv(
          'name;description',
          ['"Молоко 2,5%";"Молоко; пастеризованное"'],
        ),
      );
      expect(result.rows.length, 1);
      expect(result.rows[0].values[ImportField.name], 'Молоко 2,5%');
      expect(result.rows[0].values[ImportField.description],
          'Молоко; пастеризованное');
    });

    test('UTF-8 BOM is stripped', () {
      final result = parseCsv('${String.fromCharCode(0xFEFF)}name,price\nMilk,500');
      expect(result.rows.length, 1);
      expect(result.rows[0].values[ImportField.name], 'Milk');
    });

    test('CRLF line endings', () {
      final csvText = 'name,price\r\nMilk,500\r\nBread,200';
      final result = parseCsv(csvText);
      expect(result.rows.length, 2);
      expect(result.rows[0].values[ImportField.name], 'Milk');
    });

    test('LF line endings', () {
      final result = parseCsv(csv('name,price', ['Milk,500', 'Bread,200']));
      expect(result.rows.length, 2);
    });

    test('empty CSV throws FormatException', () {
      expect(() => parseCsv(''), throwsFormatException);
    });

    test('header-only CSV returns no data rows', () {
      final result = parseCsv('name,price');
      expect(result.rows.length, 0);
      expect(result.headers, ['name', 'price']);
    });

    test('empty rows are skipped', () {
      final result = parseCsv(csv('name,price', ['Milk,500', '', 'Bread,200']));
      expect(result.rows.length, 2);
      expect(result.rows[0].values[ImportField.name], 'Milk');
      expect(result.rows[1].values[ImportField.name], 'Bread');
    });

    test('rows with different column counts are handled', () {
      final result =
          parseCsv(csv('name,price,sku', ['Milk,500,MILK001', 'Bread,200']));
      expect(result.rows.length, 2);
      expect(result.rows[0].values[ImportField.sku], 'MILK001');
      // Second row has fewer columns — sku should be null
      expect(result.rows[1].values[ImportField.sku], isNull);
    });
  });

  // ──────────────────────────────────────────────────────
  // Header mapping tests
  // ──────────────────────────────────────────────────────
  group('Header Auto-Mapping', () {
    test('English headers map correctly', () {
      final result = parseCsv(csv(
        'name,sku,barcode,ntin,category,brand,unit,price,cost,stock,description',
        ['Product A,SKU001,123456,NTIN001,Electronics,Logitech,pcs,99.99,45.50,25,Description text'],
      ));
      expect(result.mapping.length, 11);
      expect(result.rows[0].values[ImportField.name], 'Product A');
      expect(result.rows[0].values[ImportField.sku], 'SKU001');
      expect(result.rows[0].values[ImportField.barcode], '123456');
      expect(result.rows[0].values[ImportField.ntin], 'NTIN001');
      expect(result.rows[0].values[ImportField.category], 'Electronics');
      expect(result.rows[0].values[ImportField.brand], 'Logitech');
      expect(result.rows[0].values[ImportField.unit], 'pcs');
      expect(result.rows[0].values[ImportField.price], '99.99');
      expect(result.rows[0].values[ImportField.costPrice], '45.50');
      expect(result.rows[0].values[ImportField.quantity], '25');
      expect(result.rows[0].values[ImportField.description], 'Description text');
    });

    test('Russian headers map correctly', () {
      final result = parseCsv(csv(
        'Название;Артикул;Штрихкод;Категория;Бренд;Единица;Цена;Себестоимость;Остаток;Описание',
        ['Молоко;MILK001;123;Молочные;Бренды;кг;500;300;10;Описание'],
      ));
      expect(result.rows[0].values[ImportField.name], 'Молоко');
      expect(result.rows[0].values[ImportField.sku], 'MILK001');
      expect(result.rows[0].values[ImportField.barcode], '123');
      expect(result.rows[0].values[ImportField.category], 'Молочные');
      expect(result.rows[0].values[ImportField.brand], 'Бренды');
      expect(result.rows[0].values[ImportField.unit], 'кг');
      expect(result.rows[0].values[ImportField.price], '500');
      expect(result.rows[0].values[ImportField.costPrice], '300');
      expect(result.rows[0].values[ImportField.quantity], '10');
      expect(result.rows[0].values[ImportField.description], 'Описание');
    });

    test('case-insensitive mapping', () {
      final result = parseCsv(csv('NAME,Price', ['Milk,500']));
      expect(result.rows[0].values[ImportField.name], 'Milk');
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('mapping is tolerant to extra spaces', () {
      final result = parseCsv('  Name  ,  Price  \nMilk,500');
      expect(result.rows[0].values[ImportField.name], 'Milk');
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('unknown columns are not mapped', () {
      final result = parseCsv(csv('name,price,foobar_column', ['Milk,500,test']));
      expect(result.mapping.length, 2); // only name and price
      expect(result.rows[0].values[ImportField.name], 'Milk');
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('retailprice alias maps to price (F1 fix)', () {
      final result = parseCsv(csv('name,retailprice', ['Milk,500']));
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('selling price alias maps correctly', () {
      final result = parseCsv(csv('name,selling price', ['Milk,500']));
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('stock alias maps to quantity', () {
      final result = parseCsv(csv('name,price,stock', ['Milk,500,10']));
      expect(result.rows[0].values[ImportField.quantity], '10');
    });

    test('cost alias maps to costPrice', () {
      final result = parseCsv(csv('name,price,cost', ['Milk,500,300']));
      expect(result.rows[0].values[ImportField.costPrice], '300');
    });

    test('наименование maps to name', () {
      final result = parseCsv(csv('наименование,цена', ['Молоко,500']));
      expect(result.rows[0].values[ImportField.name], 'Молоко');
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('штрихкод maps to barcode', () {
      final result = parseCsv(csv('name,штрихкод', ['Milk,123456789']));
      expect(result.rows[0].values[ImportField.barcode], '123456789');
    });

    test('единица maps to unit', () {
      final result = parseCsv(csv('name,единица', ['Milk,кг']));
      expect(result.rows[0].values[ImportField.unit], 'кг');
    });

    test('описание maps to description', () {
      final result =
          parseCsv(csv('name,описание', ['Milk,хорошее молоко']));
      expect(result.rows[0].values[ImportField.description], 'хорошее молоко');
    });

    test('бренд maps to brand', () {
      final result = parseCsv(csv('name,бренд', ['Milk,Brandy']));
      expect(result.rows[0].values[ImportField.brand], 'Brandy');
    });
  });

  // ──────────────────────────────────────────────────────
  // Validation tests
  // ──────────────────────────────────────────────────────
  group('Validation', () {
    ParseResult _validate(String text) {
      final result = parseCsv(text);
      result.validate();
      return result;
    }

    test('valid product has no errors', () {
      final result = _validate(csv('name,price', ['Milk,500']));
      expect(result.rows[0].status, ImportRowStatus.valid);
      expect(result.rows[0].errors, isEmpty);
    });

    test('missing name is invalid', () {
      final result = _validate(csv('name,price', [',500']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Name is required'));
    });

    test('empty name is invalid', () {
      final result = _validate(csv('name,price', ['  ,500']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Name is required'));
    });

    test('name > 255 characters is invalid', () {
      final longName = 'A' * 256;
      final result = _validate(csv('name,price', ['$longName,500']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors,
          contains('Name must be at most 255 characters'));
    });

    test('missing price is invalid', () {
      final result = _validate(csv('name,price', ['Milk,']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Price is required'));
    });

    test('invalid price is invalid', () {
      final result = _validate(csv('name,price', ['Milk,abc']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Price must be a valid number'));
    });

    test('negative price is invalid', () {
      final result = _validate(csv('name,price', ['Milk,-100']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Price must be ≥ 0'));
    });

    test('negative costPrice is invalid', () {
      final result = _validate(csv('name,price,cost', ['Milk,500,-50']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Cost price must be ≥ 0'));
    });

    test('invalid costPrice is invalid', () {
      final result = _validate(csv('name,price,cost', ['Milk,500,abc']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(
          result.rows[0].errors, contains('Cost price must be a valid number'));
    });

    test('negative quantity is invalid', () {
      final result = _validate(csv('name,price,stock', ['Milk,500,-5']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors, contains('Quantity must be ≥ 0'));
    });

    test('invalid quantity is invalid', () {
      final result = _validate(csv('name,price,stock', ['Milk,500,abc']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors,
          contains('Quantity must be a valid integer'));
    });

    test('SKU > 100 is invalid', () {
      final longSku = 'S' * 101;
      final result = _validate(csv('name,price,sku', ['Milk,500,$longSku']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(
          result.rows[0].errors, contains('SKU must be at most 100 characters'));
    });

    test('barcode > 100 is invalid', () {
      final longBarcode = 'B' * 101;
      final result =
          _validate(csv('name,price,barcode', ['Milk,500,$longBarcode']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors,
          contains('Barcode must be at most 100 characters'));
    });

    test('category > 100 is invalid', () {
      final longCat = 'C' * 101;
      final result =
          _validate(csv('name,price,category', ['Milk,500,$longCat']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors,
          contains('Category must be at most 100 characters'));
    });

    test('brand > 100 is invalid', () {
      final longBrand = 'B' * 101;
      final result =
          _validate(csv('name,price,brand', ['Milk,500,$longBrand']));
      expect(result.rows[0].status, ImportRowStatus.invalid);
      expect(result.rows[0].errors,
          contains('Brand must be at most 100 characters'));
    });

    test('valid costPrice is accepted', () {
      final result = _validate(csv('name,price,cost', ['Milk,500,300']));
      expect(result.rows[0].status, ImportRowStatus.valid);
    });

    test('valid quantity is accepted', () {
      final result = _validate(csv('name,price,stock', ['Milk,500,10']));
      expect(result.rows[0].status, ImportRowStatus.valid);
    });

    test('zero price is valid', () {
      final result = _validate(csv('name,price', ['Milk,0']));
      expect(result.rows[0].status, ImportRowStatus.valid);
    });

    test('decimal price is valid', () {
      final result = _validate(csv('name,price', ['Milk,49.99']));
      expect(result.rows[0].status, ImportRowStatus.valid);
    });
  });

  // ──────────────────────────────────────────────────────
  // Internal duplicate detection
  // ──────────────────────────────────────────────────────
  group('Internal Duplicates', () {
    test('duplicate SKU rows are detected', () {
      final result = parseCsv(
          csv('name,price,sku', ['Milk,500,MILK001', 'Bread,200,MILK001']));
      result.validate();
      expect(result.rows[0].status, ImportRowStatus.valid);
      expect(result.rows[1].status, ImportRowStatus.duplicate);
      expect(result.rows[1].errors.first, contains('milk001'));
    });

    test('duplicate barcode rows are detected', () {
      final result = parseCsv(
          csv('name,price,barcode', ['Milk,500,123', 'Bread,200,123']));
      result.validate();
      expect(result.rows[0].status, ImportRowStatus.valid);
      expect(result.rows[1].status, ImportRowStatus.duplicate);
      expect(result.rows[1].errors.first, contains('123'));
    });

    test('unique SKU and barcode have no duplicates', () {
      final result = parseCsv(
          csv('name,price,sku,barcode', ['Milk,500,M001,111', 'Bread,200,B001,222']));
      result.validate();
      expect(result.rows[0].status, ImportRowStatus.valid);
      expect(result.rows[1].status, ImportRowStatus.valid);
    });

    test('empty SKU/barcode are not considered duplicates', () {
      final result =
          parseCsv(csv('name,price,sku', ['Milk,500,', 'Bread,200,']));
      result.validate();
      expect(result.rows[0].status, ImportRowStatus.valid);
      expect(result.rows[1].status, ImportRowStatus.valid);
    });
  });

  // ──────────────────────────────────────────────────────
  // Canonical mapping test
  // ──────────────────────────────────────────────────────
  group('Canonical Mapping', () {
    test('canonical English headers map to all 11 fields', () {
      final result = parseCsv(csv(
        'name,sku,barcode,ntin,category,brand,unit,price,cost,stock,description',
        ['Product A,SKU001,123456,NTIN001,Electronics,Logitech,pcs,99.99,45.50,25,Description text'],
      ));
      expect(result.mapping.length, 11);
      expect(result.rows[0].values[ImportField.name], 'Product A');
      expect(result.rows[0].values[ImportField.sku], 'SKU001');
      expect(result.rows[0].values[ImportField.barcode], '123456');
      expect(result.rows[0].values[ImportField.ntin], 'NTIN001');
      expect(result.rows[0].values[ImportField.category], 'Electronics');
      expect(result.rows[0].values[ImportField.brand], 'Logitech');
      expect(result.rows[0].values[ImportField.unit], 'pcs');
      expect(result.rows[0].values[ImportField.price], '99.99');
      expect(result.rows[0].values[ImportField.costPrice], '45.50');
      expect(result.rows[0].values[ImportField.quantity], '25');
      expect(
          result.rows[0].values[ImportField.description], 'Description text');
    });

    test('cost maps to costPrice, stock maps to quantity', () {
      final result = parseCsv(csv('name,price,cost,stock', ['Milk,500,300,10']));
      expect(result.rows[0].values[ImportField.costPrice], '300');
      expect(result.rows[0].values[ImportField.quantity], '10');
      expect(result.rows[0].values.length, 4);
    });
  });

  // ──────────────────────────────────────────────────────
  // Real-world scenario tests
  // ──────────────────────────────────────────────────────
  group('Real-World Scenarios', () {
    test('RU Excel semicolon CSV with Cyrillic', () {
      final result = parseCsv(csv(
        'Название;Артикул;Цена;Остаток',
        ['Молоко 3,2%;MILK001;500;10', 'Хлеб белый;BREAD001;120;25'],
      ));
      expect(result.delimiter, ';');
      expect(result.rows.length, 2);
      expect(result.rows[0].values[ImportField.name], 'Молоко 3,2%');
      expect(result.rows[0].values[ImportField.sku], 'MILK001');
      expect(result.rows[0].values[ImportField.price], '500');
      expect(result.rows[0].values[ImportField.quantity], '10');
      expect(result.rows[1].values[ImportField.name], 'Хлеб белый');
    });

    test('quoted field with semicolon inside', () {
      final result = parseCsv(csv(
        'name;description;price',
        ['"Молоко 2,5%";"Молоко; пастеризованное";500'],
      ));
      expect(result.rows[0].values[ImportField.name], 'Молоко 2,5%');
      expect(result.rows[0].values[ImportField.description],
          'Молоко; пастеризованное');
      expect(result.rows[0].values[ImportField.price], '500');
    });

    test('mixed valid/invalid/duplicate rows', () {
      final result = parseCsv(csv(
        'name,price,sku',
        ['Milk,500,M001', ',300,M002', 'Bread,-10,B001', 'Cheese,800,M001'],
      ));
      result.validate();
      expect(result.rows[0].status, ImportRowStatus.valid);
      expect(result.rows[1].status, ImportRowStatus.invalid);
      expect(result.rows[2].status, ImportRowStatus.invalid);
      expect(result.rows[3].status, ImportRowStatus.duplicate);
    });

    test('ParseResult counts are correct', () {
      final result = parseCsv(csv(
        'name,price,sku',
        ['Milk,500,M001', ',300,M002', 'Bread,-10,B001', 'Cheese,800,M001'],
      ));
      result.validate();
      expect(result.validCount, 1);
      expect(result.invalidCount, 2);
      expect(result.duplicateCount, 1);
    });
  });
}
