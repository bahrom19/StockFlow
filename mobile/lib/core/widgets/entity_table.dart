import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/csv_exporter.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';

/// A single filter option rendered as a chip.
class EntityFilter {
  final String label;
  final String? value;

  /// [value] == null represents the "All" filter.
  const EntityFilter(this.label, this.value);
}

/// StockFlow flagship list component.
///
/// Desktop-first: renders a [DataTable] inside a card with a toolbar
/// (search + filter chips + refresh + CSV export + create) and a footer
/// (row count + "Load more"). On narrow screens it falls back to a card
/// list with pull-to-refresh when [buildCard] is provided.
class EntityTable<T> extends StatelessWidget {
  final List<T> items;
  final int total;
  final bool hasMore;
  final bool isLoading;
  final bool isRefreshing;
  final bool isLoadingMore;

  // Search
  final String? search;
  final String? searchHint;
  final ValueChanged<String>? onSearch;

  // Filters
  final List<EntityFilter> filters;
  final String? activeFilter;
  final ValueChanged<String?>? onFilter;

  // Actions
  final Future<void> Function()? onRefresh;
  final VoidCallback? onLoadMore;
  final VoidCallback? onCreate;
  final String? createLabel;

  // Export
  final String? exportFileName;
  final List<String>? exportHeaders;
  final List<List<String>> Function()? exportRows;

  // Table
  final List<DataColumn> columns;
  final DataRow Function(T item) buildRow;
  final Widget Function(T item)? buildCard;

  // States
  final String? emptyTitle;
  final String? emptySubtitle;
  final IconData emptyIcon;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final void Function(T item)? onRowTap;

  const EntityTable({
    super.key,
    required this.items,
    this.total = 0,
    this.hasMore = false,
    this.isLoading = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.search,
    this.searchHint,
    this.onSearch,
    this.filters = const [],
    this.activeFilter,
    this.onFilter,
    this.onRefresh,
    this.onLoadMore,
    this.onCreate,
    this.createLabel,
    this.exportFileName,
    this.exportHeaders,
    this.exportRows,
    required this.columns,
    required this.buildRow,
    this.buildCard,
    this.emptyTitle,
    this.emptySubtitle,
    this.emptyIcon = Icons.inbox_outlined,
    this.errorMessage,
    this.onRetry,
    this.onRowTap,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDesktop = MediaQuery.of(context).size.width >=
        AppSpacing.breakpointDesktop;
    final resolvedSearchHint = searchHint ?? l10n.searchHint;
    final resolvedCreateLabel = createLabel ?? l10n.newLabel;
    final resolvedEmptyTitle = emptyTitle ?? l10n.tableEmptyTitle;
    final resolvedEmptySubtitle = emptySubtitle ?? l10n.tableEmptySubtitle;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Toolbar(
          search: search,
          searchHint: resolvedSearchHint,
          onSearch: onSearch,
          filters: filters,
          activeFilter: activeFilter,
          onFilter: onFilter,
          onRefresh: onRefresh,
          isRefreshing: isRefreshing,
          onCreate: onCreate,
          createLabel: resolvedCreateLabel,
          exportFileName: exportFileName,
          exportHeaders: exportHeaders,
          exportRows: exportRows,
          itemCount: items.length,
        ),
        Expanded(
          child: _Body(
            items: items,
            total: total,
            hasMore: hasMore,
            isLoading: isLoading,
            isLoadingMore: isLoadingMore,
            onLoadMore: onLoadMore,
            columns: columns,
            buildRow: buildRow,
            buildCard: buildCard,
            isDesktop: isDesktop,
            emptyTitle: resolvedEmptyTitle,
            emptySubtitle: resolvedEmptySubtitle,
            emptyIcon: emptyIcon,
            onCreate: onCreate,
            createLabel: resolvedCreateLabel,
            errorMessage: errorMessage,
            onRetry: onRetry,
            onRowTap: onRowTap,
          ),
        ),
      ],
    );
  }
}

// ──────────────────────────────────
// Toolbar
// ──────────────────────────────────
class _Toolbar extends StatefulWidget {
  final String? search;
  final String searchHint;
  final ValueChanged<String>? onSearch;
  final List<EntityFilter> filters;
  final String? activeFilter;
  final ValueChanged<String?>? onFilter;
  final Future<void> Function()? onRefresh;
  final bool isRefreshing;
  final VoidCallback? onCreate;
  final String createLabel;
  final String? exportFileName;
  final List<String>? exportHeaders;
  final List<List<String>> Function()? exportRows;
  final int itemCount;

  const _Toolbar({
    required this.search,
    required this.searchHint,
    required this.onSearch,
    required this.filters,
    required this.activeFilter,
    required this.onFilter,
    required this.onRefresh,
    required this.isRefreshing,
    required this.onCreate,
    required this.createLabel,
    required this.exportFileName,
    required this.exportHeaders,
    required this.exportRows,
    required this.itemCount,
  });

  @override
  State<_Toolbar> createState() => _ToolbarState();
}

class _ToolbarState extends State<_Toolbar> {
  late final TextEditingController _searchController;
  bool _showFilters = false;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.search ?? '');
  }

  @override
  void didUpdateWidget(covariant _Toolbar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.search != widget.search &&
        _searchController.text != (widget.search ?? '')) {
      _searchController.text = widget.search ?? '';
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _export() async {
    final data = widget.exportRows?.call();
    final headers = widget.exportHeaders;
    if (data == null || headers == null || data.isEmpty) return;
    final rows = [headers, ...data];
    final filename = widget.exportFileName ??
        'export_${DateTime.now().millisecondsSinceEpoch}.csv';
    await CsvExporter.download(filename, rows);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.exportedRows(data.length))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasExport = widget.exportRows != null &&
        widget.exportHeaders != null &&
        widget.itemCount > 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: widget.searchHint,
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              widget.onSearch?.call('');
                            },
                          )
                        : null,
                    isDense: true,
                    filled: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusSm),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (v) => widget.onSearch?.call(v),
                ),
              ),
              if (widget.filters.isNotEmpty) ...[
                const SizedBox(width: AppSpacing.xs),
                IconButton.filledTonal(
                  tooltip: context.l10n.filters,
                  onPressed: () => setState(() => _showFilters = !_showFilters),
                  icon: Icon(
                    Icons.filter_list,
                    size: 20,
                    color: widget.activeFilter != null
                        ? theme.colorScheme.primary
                        : null,
                  ),
                ),
              ],
              if (widget.onRefresh != null) ...[
                const SizedBox(width: AppSpacing.xs),
                IconButton(
                  tooltip: context.l10n.refresh,
                  onPressed: widget.isRefreshing
                      ? null
                      : () => widget.onRefresh?.call(),
                  icon: widget.isRefreshing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh, size: 20),
                ),
              ],
              if (hasExport) ...[
                const SizedBox(width: AppSpacing.xs),
                IconButton(
                  tooltip: context.l10n.exportCsv,
                  onPressed: _export,
                  icon: const Icon(Icons.file_download_outlined, size: 20),
                ),
              ],
              if (widget.onCreate != null) ...[
                const SizedBox(width: AppSpacing.sm),
                FilledButton.icon(
                  onPressed: widget.onCreate,
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(widget.createLabel),
                ),
              ],
            ],
          ),
          if (_showFilters && widget.filters.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final filter in widget.filters) ...[
                    _FilterChip(
                      label: filter.label,
                      selected: widget.activeFilter == filter.value,
                      onTap: () => widget.onFilter?.call(filter.value),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      showCheckmark: false,
      visualDensity: VisualDensity.compact,
      labelStyle: theme.textTheme.labelMedium?.copyWith(
        fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
      ),
    );
  }
}

// ──────────────────────────────────
// Body
// ──────────────────────────────────
class _Body<T> extends StatelessWidget {
  final List<T> items;
  final int total;
  final bool hasMore;
  final bool isLoading;
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;
  final List<DataColumn> columns;
  final DataRow Function(T item) buildRow;
  final Widget Function(T item)? buildCard;
  final bool isDesktop;
  final String emptyTitle;
  final String emptySubtitle;
  final IconData emptyIcon;
  final VoidCallback? onCreate;
  final String createLabel;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final void Function(T item)? onRowTap;

  const _Body({
    required this.items,
    required this.total,
    required this.hasMore,
    required this.isLoading,
    required this.isLoadingMore,
    required this.onLoadMore,
    required this.columns,
    required this.buildRow,
    required this.buildCard,
    required this.isDesktop,
    required this.emptyTitle,
    required this.emptySubtitle,
    required this.emptyIcon,
    required this.onCreate,
    required this.createLabel,
    required this.errorMessage,
    required this.onRetry,
    required this.onRowTap,
  });

  /// Builds the row, attaching [onRowTap] as a select callback when present.
  DataRow _buildRowWithTap(T item) {
    final row = buildRow(item);
    if (onRowTap == null) return row;
    return DataRow(
      cells: row.cells,
      onSelectChanged: (_) => onRowTap!(item),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (isLoading && items.isEmpty) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (errorMessage != null && items.isEmpty) {
      return ErrorStateWidget(
        message: errorMessage!,
        onRetry: onRetry,
      );
    }

    if (items.isEmpty) {
      return EmptyStateWidget(
        title: emptyTitle,
        subtitle: emptySubtitle,
        icon: emptyIcon,
        actionLabel: onCreate != null ? createLabel : null,
        onAction: onCreate,
      );
    }

    // Mobile fallback: card list.
    if (!isDesktop && buildCard != null) {
      return ListView.builder(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        itemCount: items.length + (isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= items.length) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }
          final item = items[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: InkWell(
              onTap: onRowTap == null ? null : () => onRowTap!(item),
              child: buildCard!(item),
            ),
          );
        },
      );
    }

    // Desktop: DataTable.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Card(
            margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            clipBehavior: Clip.antiAlias,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              side: BorderSide(color: theme.colorScheme.outlineVariant),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SingleChildScrollView(
                child: DataTable(
                  columnSpacing: 28,
                  horizontalMargin: AppSpacing.md,
                  headingRowHeight: 48,
                  dataRowMinHeight: 52,
                  dataRowMaxHeight: 64,
                  headingTextStyle: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onSurfaceVariant,
                    letterSpacing: 0.4,
                  ),
                  columns: columns,
                  rows: [
                    for (final item in items)
                      _buildRowWithTap(item),
                  ],
                ),
              ),
            ),
          ),
        ),
        _Footer(
          shown: items.length,
          total: total,
          hasMore: hasMore,
          isLoadingMore: isLoadingMore,
          onLoadMore: onLoadMore,
        ),
      ],
    );
  }
}

// ──────────────────────────────────
// Footer
// ──────────────────────────────────
class _Footer extends StatelessWidget {
  final int shown;
  final int total;
  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;

  const _Footer({
    required this.shown,
    required this.total,
    required this.hasMore,
    required this.isLoadingMore,
    required this.onLoadMore,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: [
          Text(
            context.l10n.showingOf(shown, total),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const Spacer(),
          if (hasMore && onLoadMore != null)
            OutlinedButton.icon(
              onPressed: isLoadingMore ? null : onLoadMore,
              icon: isLoadingMore
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.more_horiz, size: 18),
              label: Text(
                isLoadingMore ? context.l10n.loadingMore : context.l10n.loadMore,
              ),
            ),
        ],
      ),
    );
  }
}
