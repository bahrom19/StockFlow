import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/utils/csv_importer.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

// ──────────────────────────────────────────────────────
// Import step
// ──────────────────────────────────────────────────────
enum ImportStep { upload, mapping, validation, importing, result }

// ──────────────────────────────────────────────────────
// Import row result (post-server response)
// ──────────────────────────────────────────────────────
enum ImportRowResult { success, duplicate, failed }

class ImportedRow {
  final int rowNumber;
  final ImportRowResult result;
  final String? errorMessage;
  final String? productName;

  const ImportedRow({
    required this.rowNumber,
    required this.result,
    this.errorMessage,
    this.productName,
  });
}

// ──────────────────────────────────────────────────────
// Import state
// ──────────────────────────────────────────────────────
class ProductImportState {
  final ImportStep step;
  final ParseResult? parseResult;
  final Map<int, ImportField> columnMapping;
  final bool isImporting;
  final int currentIndex;
  final int totalCount;
  final List<ImportedRow> importResults;
  final String? generalError;
  final bool cancelled;

  const ProductImportState({
    this.step = ImportStep.upload,
    this.parseResult,
    this.columnMapping = const {},
    this.isImporting = false,
    this.currentIndex = 0,
    this.totalCount = 0,
    this.importResults = const [],
    this.generalError,
    this.cancelled = false,
  });

  ProductImportState copyWith({
    ImportStep? step,
    ParseResult? parseResult,
    Map<int, ImportField>? columnMapping,
    bool? isImporting,
    int? currentIndex,
    int? totalCount,
    List<ImportedRow>? importResults,
    String? generalError,
    bool? cancelled,
  }) {
    return ProductImportState(
      step: step ?? this.step,
      parseResult: parseResult ?? this.parseResult,
      columnMapping: columnMapping ?? this.columnMapping,
      isImporting: isImporting ?? this.isImporting,
      currentIndex: currentIndex ?? this.currentIndex,
      totalCount: totalCount ?? this.totalCount,
      importResults: importResults ?? this.importResults,
      generalError: generalError,
      cancelled: cancelled ?? this.cancelled,
    );
  }

  int get importedCount =>
      importResults.where((r) => r.result == ImportRowResult.success).length;
  int get failedCount =>
      importResults.where((r) => r.result == ImportRowResult.failed).length;
  int get duplicateCount =>
      importResults.where((r) => r.result == ImportRowResult.duplicate).length;
}

// ──────────────────────────────────────────────────────
// Import notifier
// ──────────────────────────────────────────────────────
class ProductImportNotifier extends StateNotifier<ProductImportState> {
  final Ref _ref;

  ProductImportNotifier(this._ref) : super(const ProductImportState());

  /// Parse CSV text and move to mapping step.
  void loadCsv(String text) {
    try {
      final result = parseCsv(text);
      result.validate();
      state = state.copyWith(
        step: ImportStep.mapping,
        parseResult: result,
        columnMapping: Map.from(result.mapping),
      );
    } catch (e) {
      state = state.copyWith(generalError: e.toString());
    }
  }

  /// Update column mapping.
  void updateMapping(Map<int, ImportField> newMapping) {
    state = state.copyWith(columnMapping: newMapping);
  }

  /// Move to validation step.
  void goToValidation() {
    state = state.copyWith(step: ImportStep.validation);
  }

  /// Move back to mapping step.
  void goToMapping() {
    state = state.copyWith(step: ImportStep.mapping);
  }

  /// Move back to upload step.
  void goToUpload() {
    state = const ProductImportState();
  }

  /// Start sequential import of valid rows.
  Future<void> startImport() async {
    final result = state.parseResult;
    if (result == null) return;

    final validRows = result.rows
        .where((r) => r.status == ImportRowStatus.valid)
        .toList();

    if (validRows.isEmpty) return;

    state = state.copyWith(
      step: ImportStep.importing,
      isImporting: true,
      currentIndex: 0,
      totalCount: validRows.length,
      importResults: [],
      cancelled: false,
    );

    final repo = _ref.read(productsRepositoryProvider);

    for (var i = 0; i < validRows.length; i++) {
      if (state.cancelled) break;

      final row = validRows[i];
      state = state.copyWith(currentIndex: i);

      final request = _buildRequest(row, result.mapping);

      final response = await repo.create(request);

      switch (response) {
        case ProductsSuccess():
          state = state.copyWith(
            importResults: [
              ...state.importResults,
              ImportedRow(
                rowNumber: row.rowNumber,
                result: ImportRowResult.success,
                productName: request.name,
              ),
            ],
          );
        case ProductsFail(:final error):
          final errorMsg = error.message;
          final isDuplicate = errorMsg.toLowerCase().contains('already exists');

          state = state.copyWith(
            importResults: [
              ...state.importResults,
              ImportedRow(
                rowNumber: row.rowNumber,
                result:
                    isDuplicate ? ImportRowResult.duplicate : ImportRowResult.failed,
                errorMessage: errorMsg,
                productName: request.name,
              ),
            ],
          );
      }
    }

    state = state.copyWith(
      step: ImportStep.result,
      isImporting: false,
      currentIndex: state.totalCount,
    );
  }

  /// Cancel ongoing import.
  void cancelImport() {
    state = state.copyWith(cancelled: true);
  }

  /// Reset to initial state.
  void reset() {
    state = const ProductImportState();
  }

  CreateProductRequest _buildRequest(
    ImportRow row,
    Map<int, ImportField> mapping,
  ) {
    return CreateProductRequest(
      name: row.values[ImportField.name] ?? '',
      sku: row.values[ImportField.sku],
      barcode: row.values[ImportField.barcode],
      ntin: row.values[ImportField.ntin],
      category: row.values[ImportField.category],
      brand: row.values[ImportField.brand],
      unit: row.values[ImportField.unit],
      price: row.values[ImportField.price] ?? '0',
      costPrice: row.values[ImportField.costPrice],
      stockQuantity:
          int.tryParse(row.values[ImportField.quantity] ?? '') ?? 0,
      description: row.values[ImportField.description],
    );
  }
}

final productImportProvider =
    StateNotifierProvider<ProductImportNotifier, ProductImportState>(
  (ref) => ProductImportNotifier(ref),
);
