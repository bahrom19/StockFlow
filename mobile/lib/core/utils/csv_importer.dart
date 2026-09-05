import 'package:csv/csv.dart';

/// Canonical import field names.
enum ImportField {
  name,
  sku,
  barcode,
  ntin,
  category,
  brand,
  unit,
  price,
  costPrice,
  quantity,
  description,
}

/// Mapping from normalized header strings to ImportField.
const Map<String, ImportField> _headerMapping = {
  // name
  'name': ImportField.name,
  'product name': ImportField.name,
  'productname': ImportField.name,
  'название': ImportField.name,
  'наименование': ImportField.name,
  'товар': ImportField.name,
  // sku
  'sku': ImportField.sku,
  'артикул': ImportField.sku,
  'article': ImportField.sku,
  'статья': ImportField.sku,
  // barcode
  'barcode': ImportField.barcode,
  'штрихкод': ImportField.barcode,
  'ean': ImportField.barcode,
  'шк': ImportField.barcode,
  // ntin
  'ntin': ImportField.ntin,
  // category
  'category': ImportField.category,
  'категория': ImportField.category,
  'группа': ImportField.category,
  // brand
  'brand': ImportField.brand,
  'бренд': ImportField.brand,
  'производитель': ImportField.brand,
  // unit
  'unit': ImportField.unit,
  'единица': ImportField.unit,
  'единица измерения': ImportField.unit,
  'ед': ImportField.unit,
  // price
  'price': ImportField.price,
  'selling price': ImportField.price,
  'sellingprice': ImportField.price,
  'цена': ImportField.price,
  'цена продажи': ImportField.price,
  'продажная цена': ImportField.price,
  'retailprice': ImportField.price,
  // costPrice
  'cost': ImportField.costPrice,
  'costprice': ImportField.costPrice,
  'cost price': ImportField.costPrice,
  'себестоимость': ImportField.costPrice,
  'цена закупки': ImportField.costPrice,
  'закупочная цена': ImportField.costPrice,
  // quantity
  'quantity': ImportField.quantity,
  'stock': ImportField.quantity,
  'stockquantity': ImportField.quantity,
  'остаток': ImportField.quantity,
  'количество': ImportField.quantity,
  'кол-во': ImportField.quantity,
  'кол': ImportField.quantity,
  // description
  'description': ImportField.description,
  'описание': ImportField.description,
};

/// A single parsed import row.
class ImportRow {
  final int rowNumber;
  final Map<ImportField, String?> values;
  ImportRowStatus status;
  List<String> errors;
  List<String> warnings;

  ImportRow({
    required this.rowNumber,
    required this.values,
    this.status = ImportRowStatus.valid,
    this.errors = const [],
    this.warnings = const [],
  });
}

enum ImportRowStatus {
  valid,
  duplicate,
  invalid,
  warning,
  failed,
}

/// Detect BOM and strip it.
String _stripBom(String text) {
  if (text.startsWith('\uFEFF')) {
    return text.substring(1);
  }
  return text;
}

/// Detect delimiter: comma or semicolon.
String _detectDelimiter(String csvText) {
  final firstLine = csvText.split('\n').first;
  final commas = ','.allMatches(firstLine).length;
  final semicolons = ';'.allMatches(firstLine).length;
  return semicolons > commas ? ';' : ',';
}

/// Normalize a header string for matching.
String _normalizeHeader(String header) {
  return header
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), ' ');
}

/// Auto-map CSV headers to ImportField.
Map<int, ImportField> autoMapHeaders(List<String> headers) {
  final mapping = <int, ImportField>{};
  for (var i = 0; i < headers.length; i++) {
    final normalized = _normalizeHeader(headers[i]);
    final field = _headerMapping[normalized];
    if (field != null) {
      mapping[i] = field;
    }
  }
  return mapping;
}

/// Validate a single import row.
void _validateRow(ImportRow row) {
  final errors = <String>[];
  final warnings = <String>[];

  // name — required
  final name = row.values[ImportField.name];
  if (name == null || name.trim().isEmpty) {
    errors.add('Name is required');
  } else if (name.length > 255) {
    errors.add('Name must be at most 255 characters');
  }

  // price — required
  final price = row.values[ImportField.price];
  if (price == null || price.trim().isEmpty) {
    errors.add('Price is required');
  } else {
    final parsed = double.tryParse(price.trim());
    if (parsed == null) {
      errors.add('Price must be a valid number');
    } else if (parsed < 0) {
      errors.add('Price must be ≥ 0');
    }
  }

  // costPrice — optional
  final costPrice = row.values[ImportField.costPrice];
  if (costPrice != null && costPrice.trim().isNotEmpty) {
    final parsed = double.tryParse(costPrice.trim());
    if (parsed == null) {
      errors.add('Cost price must be a valid number');
    } else if (parsed < 0) {
      errors.add('Cost price must be ≥ 0');
    }
  }

  // quantity — optional
  final quantity = row.values[ImportField.quantity];
  if (quantity != null && quantity.trim().isNotEmpty) {
    final parsed = int.tryParse(quantity.trim());
    if (parsed == null) {
      errors.add('Quantity must be a valid integer');
    } else if (parsed < 0) {
      errors.add('Quantity must be ≥ 0');
    }
  }

  // sku — max 100
  final sku = row.values[ImportField.sku];
  if (sku != null && sku.length > 100) {
    errors.add('SKU must be at most 100 characters');
  }

  // barcode — max 100
  final barcode = row.values[ImportField.barcode];
  if (barcode != null && barcode.length > 100) {
    errors.add('Barcode must be at most 100 characters');
  }

  // ntin — max 100
  final ntin = row.values[ImportField.ntin];
  if (ntin != null && ntin.length > 100) {
    errors.add('NTIN must be at most 100 characters');
  }

  // category — max 100
  final category = row.values[ImportField.category];
  if (category != null && category.length > 100) {
    errors.add('Category must be at most 100 characters');
  }

  // brand — max 100
  final brand = row.values[ImportField.brand];
  if (brand != null && brand.length > 100) {
    errors.add('Brand must be at most 100 characters');
  }

  row.errors = errors;
  row.warnings = warnings;
  row.status =
      errors.isEmpty ? ImportRowStatus.valid : ImportRowStatus.invalid;
}

/// Detect duplicates within CSV rows (by SKU and barcode).
void _detectInternalDuplicates(List<ImportRow> rows) {
  final skuSeen = <String, int>{};
  final barcodeSeen = <String, int>{};

  for (final row in rows) {
    if (row.status == ImportRowStatus.invalid) continue;

    final sku = row.values[ImportField.sku]?.trim().toLowerCase();
    if (sku != null && sku.isNotEmpty) {
      final firstRow = skuSeen[sku];
      if (firstRow != null) {
        row.status = ImportRowStatus.duplicate;
        row.errors = ['SKU "$sku" first appears in row $firstRow'];
      } else {
        skuSeen[sku] = row.rowNumber;
      }
    }

    final barcode = row.values[ImportField.barcode]?.trim().toLowerCase();
    if (barcode != null && barcode.isNotEmpty) {
      final firstRow = barcodeSeen[barcode];
      if (firstRow != null) {
        row.status = ImportRowStatus.duplicate;
        row.errors = ['Barcode "$barcode" first appears in row $firstRow'];
      } else {
        barcodeSeen[barcode] = row.rowNumber;
      }
    }
  }
}

/// Parse raw CSV text into import rows.
///
/// Returns a list of [ImportRow] with auto-detected mapping applied.
/// Throws [FormatException] if the CSV is empty or has no headers.
ParseResult parseCsv(String rawText) {
  // Strip BOM
  var text = _stripBom(rawText);

  // Detect delimiter
  final delimiter = _detectDelimiter(text);

  // Parse
  final converter = CsvToListConverter(
    fieldDelimiter: delimiter,
    shouldParseNumbers: false,
    allowInvalid: false,
    eol: '\n',
  );

  final rows = converter.convert(text);
  if (rows.isEmpty) {
    throw FormatException('CSV is empty');
  }

  final headers = rows.first.map((e) => e.toString()).toList();
  if (headers.isEmpty || headers.every((h) => h.trim().isEmpty)) {
    throw FormatException('CSV has no headers');
  }

  // Auto-map headers
  final mapping = autoMapHeaders(headers);

  // Parse data rows
  final importRows = <ImportRow>[];
  for (var i = 1; i < rows.length; i++) {
    final csvRow = rows[i];
    // Skip completely empty rows
    if (csvRow.every((cell) => cell.toString().trim().isEmpty)) continue;

    final values = <ImportField, String?>{};
    for (final entry in mapping.entries) {
      if (entry.key < csvRow.length) {
        final raw = csvRow[entry.key].toString().trim();
        values[entry.value] = raw.isEmpty ? null : raw;
      }
    }

    importRows.add(ImportRow(
      rowNumber: i + 1, // 1-indexed (row 1 = first data row after header)
      values: values,
    ));
  }

  return ParseResult(
    headers: headers,
    mapping: mapping,
    rows: importRows,
    delimiter: delimiter,
  );
}

/// Full parse result.
class ParseResult {
  final List<String> headers;
  final Map<int, ImportField> mapping;
  final List<ImportRow> rows;
  final String delimiter;

  ParseResult({
    required this.headers,
    required this.mapping,
    required this.rows,
    required this.delimiter,
  });

  /// Run validation and duplicate detection on all rows.
  void validate() {
    for (final row in rows) {
      if (row.status != ImportRowStatus.duplicate) {
        _validateRow(row);
      }
    }
    _detectInternalDuplicates(rows);
  }

  int get validCount => rows.where((r) => r.status == ImportRowStatus.valid).length;
  int get duplicateCount => rows.where((r) => r.status == ImportRowStatus.duplicate).length;
  int get invalidCount => rows.where((r) => r.status == ImportRowStatus.invalid).length;
  int get warningCount => rows.where((r) => r.status == ImportRowStatus.warning).length;
}
