import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/csv_importer.dart';
import 'package:stockflow/features/products/presentation/providers/product_import_provider.dart';

/// CSV Product Import wizard — 5 steps:
/// Upload → Mapping → Validation → Import → Result
class ProductImportScreen extends ConsumerStatefulWidget {
  const ProductImportScreen({super.key});

  @override
  ConsumerState<ProductImportScreen> createState() =>
      _ProductImportScreenState();
}

class _ProductImportScreenState extends ConsumerState<ProductImportScreen> {
  @override
  void dispose() {
    // Reset provider on dispose
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(productImportProvider.notifier).reset();
    });
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(productImportProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.importCsvProducts),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (state.step == ImportStep.upload) {
              context.pop();
            } else {
              ref.read(productImportProvider.notifier).goToUpload();
            }
          },
        ),
      ),
      body: _buildBody(context, state, theme),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ProductImportState state,
    ThemeData theme,
  ) {
    switch (state.step) {
      case ImportStep.upload:
        return _buildUploadStep(context, state, theme);
      case ImportStep.mapping:
        return _buildMappingStep(context, state, theme);
      case ImportStep.validation:
        return _buildValidationStep(context, state, theme);
      case ImportStep.importing:
        return _buildImportingStep(context, state, theme);
      case ImportStep.result:
        return _buildResultStep(context, state, theme);
    }
  }

  // ── STEP 1: Upload ──────────────────────────────────
  Widget _buildUploadStep(
    BuildContext context,
    ProductImportState state,
    ThemeData theme,
  ) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.upload_file,
                size: 64,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                context.l10n.importUploadTitle,
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                context.l10n.importUploadSubtitle,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton.icon(
                onPressed: () => _pickFile(context),
                icon: const Icon(Icons.file_upload),
                label: Text(context.l10n.importSelectCsv),
              ),
              if (state.generalError != null) ...[
                const SizedBox(height: AppSpacing.md),
                Card(
                  color: theme.colorScheme.errorContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline,
                            color: theme.colorScheme.error),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            state.generalError!,
                            style: TextStyle(
                              color: theme.colorScheme.onErrorContainer,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickFile(BuildContext context) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv'],
    );

    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    String text;

    if (file.path != null) {
      text = await File(file.path!).readAsString();
    } else if (file.bytes != null) {
      text = String.fromCharCodes(file.bytes!);
    } else {
      return;
    }

    ref.read(productImportProvider.notifier).loadCsv(text);
  }

  // ── STEP 2: Mapping ─────────────────────────────────
  Widget _buildMappingStep(
    BuildContext context,
    ProductImportState state,
    ThemeData theme,
  ) {
    final result = state.parseResult;
    if (result == null) return const SizedBox.shrink();

    final mapping = state.columnMapping;

    return Column(
      children: [
        // Header info
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: theme.colorScheme.surfaceContainerHighest,
          child: Row(
            children: [
              Icon(Icons.table_chart,
                  color: theme.colorScheme.primary),
              const SizedBox(width: AppSpacing.sm),
              Text(
                context.l10n.importMappingInfo(
                  result.rows.length,
                  result.headers.length,
                ),
                style: theme.textTheme.titleMedium,
              ),
            ],
          ),
        ),
        // Mapping list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: result.headers.length,
            itemBuilder: (context, index) {
              final csvHeader = result.headers[index];
              final currentField = mapping[index];

              return Card(
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      // CSV column
                      Expanded(
                        flex: 3,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              context.l10n.importCsvColumn,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                            Text(
                              csvHeader,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward, size: 20),
                      const SizedBox(width: AppSpacing.sm),
                      // Mapped field
                      Expanded(
                        flex: 3,
                        child: DropdownButtonFormField<ImportField?>(
                          value: currentField,
                          isExpanded: true,
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(
                                AppSpacing.radiusSm,
                              ),
                            ),
                          ),
                          items: [
                            DropdownMenuItem<ImportField?>(
                              value: null,
                              child: Text(
                                context.l10n.importNotImported,
                                style: TextStyle(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                            for (final field in ImportField.values)
                              DropdownMenuItem<ImportField?>(
                                value: field,
                                child: Text(_fieldLabel(context, field)),
                              ),
                          ],
                          onChanged: (value) {
                            final newMapping = Map<int, ImportField>.from(
                              state.columnMapping,
                            );
                            if (value == null) {
                              newMapping.remove(index);
                            } else {
                              newMapping[index] = value;
                            }
                            ref
                                .read(productImportProvider.notifier)
                                .updateMapping(newMapping);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        // Actions
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              OutlinedButton(
                onPressed: () =>
                    ref.read(productImportProvider.notifier).goToUpload(),
                child: Text(context.l10n.goBack),
              ),
              const Spacer(),
              FilledButton(
                onPressed: () =>
                    ref.read(productImportProvider.notifier).goToValidation(),
                child: Text(context.l10n.importValidate),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _fieldLabel(BuildContext context, ImportField field) {
    switch (field) {
      case ImportField.name:
        return '${context.l10n.product} (${context.l10n.name})';
      case ImportField.sku:
        return context.l10n.sku;
      case ImportField.barcode:
        return context.l10n.barcode;
      case ImportField.ntin:
        return 'NTIN';
      case ImportField.category:
        return context.l10n.category;
      case ImportField.brand:
        return context.l10n.brand;
      case ImportField.unit:
        return context.l10n.unit;
      case ImportField.price:
        return context.l10n.sellingPrice;
      case ImportField.costPrice:
        return context.l10n.cost;
      case ImportField.quantity:
        return context.l10n.stock;
      case ImportField.description:
        return context.l10n.description;
    }
  }

  // ── STEP 3: Validation / Preview ────────────────────
  Widget _buildValidationStep(
    BuildContext context,
    ProductImportState state,
    ThemeData theme,
  ) {
    final result = state.parseResult;
    if (result == null) return const SizedBox.shrink();

    return Column(
      children: [
        // Summary cards
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              _summaryChip(
                context,
                '${result.validCount}',
                context.l10n.importValid,
                Colors.green,
                theme,
              ),
              _summaryChip(
                context,
                '${result.duplicateCount}',
                context.l10n.importDuplicates,
                Colors.orange,
                theme,
              ),
              _summaryChip(
                context,
                '${result.invalidCount}',
                context.l10n.importInvalid,
                Colors.red,
                theme,
              ),
            ],
          ),
        ),
        // Row list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            itemCount: result.rows.length,
            itemBuilder: (context, index) {
              final row = result.rows[index];
              final name = row.values[ImportField.name] ?? '';
              final sku = row.values[ImportField.sku];

              return Card(
                margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: ListTile(
                  leading: _statusIcon(row.status),
                  title: Text(
                    name.isEmpty ? context.l10n.importUnnamedRow : name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: sku != null ? Text('SKU: $sku') : null,
                  trailing: Text(
                    '${context.l10n.row} ${row.rowNumber}',
                    style: theme.textTheme.labelSmall,
                  ),
                ),
              );
            },
          ),
        ),
        // Actions
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              OutlinedButton(
                onPressed: () =>
                    ref.read(productImportProvider.notifier).goToMapping(),
                child: Text(context.l10n.goBack),
              ),
              const Spacer(),
              if (result.validCount > 0)
                FilledButton.icon(
                  onPressed: () =>
                      ref.read(productImportProvider.notifier).startImport(),
                  icon: const Icon(Icons.download),
                  label: Text(
                    context.l10n.importCount(result.validCount),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryChip(
    BuildContext context,
    String count,
    String label,
    Color color,
    ThemeData theme,
  ) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Column(
            children: [
              Text(
                count,
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusIcon(ImportRowStatus status) {
    switch (status) {
      case ImportRowStatus.valid:
        return const Icon(Icons.check_circle, color: Colors.green);
      case ImportRowStatus.duplicate:
        return const Icon(Icons.content_copy, color: Colors.orange);
      case ImportRowStatus.invalid:
        return const Icon(Icons.error, color: Colors.red);
      case ImportRowStatus.warning:
        return const Icon(Icons.warning, color: Colors.amber);
      case ImportRowStatus.failed:
        return const Icon(Icons.cancel, color: Colors.red);
    }
  }

  // ── STEP 4: Importing ───────────────────────────────
  Widget _buildImportingStep(
    BuildContext context,
    ProductImportState state,
    ThemeData theme,
  ) {
    final progress = state.totalCount > 0
        ? state.currentIndex / state.totalCount
        : 0.0;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 400),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (state.isImporting) ...[
                const CircularProgressIndicator(),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  context.l10n.importProgress(
                    state.currentIndex,
                    state.totalCount,
                  ),
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                LinearProgressIndicator(value: progress),
              ] else ...[
                Icon(
                  Icons.check_circle_outline,
                  size: 64,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  context.l10n.importComplete,
                  style: theme.textTheme.titleMedium,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ── STEP 5: Result ──────────────────────────────────
  Widget _buildResultStep(
    BuildContext context,
    ProductImportState state,
    ThemeData theme,
  ) {
    final imported = state.importedCount;
    final duplicates = state.duplicateCount;
    final failed = state.failedCount;
    final total = state.totalCount;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                imported > 0
                    ? Icons.check_circle
                    : Icons.info_outline,
                size: 64,
                color: imported > 0
                    ? Colors.green
                    : theme.colorScheme.primary,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                context.l10n.importResultTitle,
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.md),
              // Summary cards
              Row(
                children: [
                  _resultCard(
                    context,
                    '$total',
                    context.l10n.importTotalRows,
                    theme.colorScheme.primary,
                    theme,
                  ),
                  _resultCard(
                    context,
                    '$imported',
                    context.l10n.importSuccess,
                    Colors.green,
                    theme,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  _resultCard(
                    context,
                    '$duplicates',
                    context.l10n.importDuplicates,
                    Colors.orange,
                    theme,
                  ),
                  _resultCard(
                    context,
                    '$failed',
                    context.l10n.importFailed,
                    Colors.red,
                    theme,
                  ),
                ],
              ),
              // Failed rows detail
              if (failed > 0) ...[
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  height: 120,
                  child: ListView(
                    children: state.importResults
                        .where((r) => r.result == ImportRowResult.failed)
                        .map(
                          (r) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              '${context.l10n.row} ${r.rowNumber}: ${r.errorMessage ?? context.l10n.importUnknownError}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.error,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  OutlinedButton(
                    onPressed: () =>
                        context.go(RouteNames.products),
                    child: Text(context.l10n.viewProducts),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: () =>
                        ref.read(productImportProvider.notifier).reset(),
                    child: Text(context.l10n.importAnother),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _resultCard(
    BuildContext context,
    String count,
    String label,
    Color color,
    ThemeData theme,
  ) {
    return Expanded(
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            children: [
              Text(
                count,
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
