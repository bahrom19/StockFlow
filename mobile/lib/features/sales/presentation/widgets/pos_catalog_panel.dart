import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/sales/presentation/providers/pos_catalog_provider.dart';

/// POS catalog panel — the cashier's product browser (~70% width).
///
/// Includes debounced search (name / SKU / barcode), category chips and a
/// keyboard-navigable product table. Enter or tap adds to the cart.
class PosCatalogPanel extends ConsumerStatefulWidget {
  final TextEditingController searchController;
  final FocusNode searchFocus;
  final VoidCallback onAddSelected;
  final void Function(Product) onAddProduct;

  const PosCatalogPanel({
    super.key,
    required this.searchController,
    required this.searchFocus,
    required this.onAddSelected,
    required this.onAddProduct,
  });

  @override
  ConsumerState<PosCatalogPanel> createState() => _PosCatalogPanelState();
}

class _PosCatalogPanelState extends ConsumerState<PosCatalogPanel> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(posCatalogProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(posCatalogProvider);
    final notifier = ref.read(posCatalogProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Search ──────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xs,
          ),
          child: TextField(
            controller: widget.searchController,
            focusNode: widget.searchFocus,
            autofocus: true,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: context.l10n.posCatalogSearchHint,
              prefixIcon: state.isSearching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : const Icon(Icons.search, size: 20),
              suffixIcon: state.query.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        widget.searchController.clear();
                        notifier.searchNow('');
                      },
                    )
                  : null,
              isDense: true,
              filled: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: notifier.search,
            onSubmitted: (_) => widget.onAddSelected(),
          ),
        ),
        // ── Categories ──────────────────────────
        if (state.categories.isNotEmpty)
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              children: [
                _categoryChip(context.l10n.all, null, state.category),
                for (final c in state.categories) ...[
                  const SizedBox(width: AppSpacing.xs),
                  _categoryChip(c, c, state.category),
                ],
              ],
            ),
          ),
        const SizedBox(height: AppSpacing.xs),
        // ── Product Table ───────────────────────
        Expanded(child: _buildContent(context, state)),
        // ── Footer ──────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Row(
            children: [
              // Label-less semantics boundary: footer text stays its own
              // innerText leaf; the Load more CTA remains a separate sibling.
              Semantics(
                container: true,
                child: Text(
                  context.l10n.posCatalogFooter(
                    state.products.length,
                    state.total,
                  ),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              const Spacer(),
              if (state.hasMore && !state.isLoading)
                TextButton(
                  onPressed: () => notifier.loadMore(),
                  child: Text(context.l10n.loadMore),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _categoryChip(String label, String? value, String? active) {
    return ChoiceChip(
      label: Text(label),
      selected: active == value,
      onSelected: (_) =>
          ref.read(posCatalogProvider.notifier).setCategory(value),
      showCheckmark: false,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildContent(BuildContext context, PosCatalogState state) {
    final theme = Theme.of(context);

    if (state.isLoading && state.products.isEmpty) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (state.error != null && state.products.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
            const SizedBox(height: AppSpacing.sm),
            Text(state.error!, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.md),
            FilledButton.tonalIcon(
              onPressed: () =>
                  ref.read(posCatalogProvider.notifier).resetToDefaults(),
              icon: const Icon(Icons.refresh),
              label: Text(context.l10n.retry),
            ),
          ],
        ),
      );
    }

    if (state.products.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inventory_2_outlined,
                size: 56, color: theme.colorScheme.outline),
            const SizedBox(height: AppSpacing.sm),
            Text(context.l10n.posNoProductsFound,
                style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.xxs),
            Text(context.l10n.posTryDifferentSearch,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                )),
          ],
        ),
      );
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      elevation: 0,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: SingleChildScrollView(
        controller: _scrollController,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columnSpacing: 24,
            horizontalMargin: AppSpacing.md,
            headingRowHeight: 44,
            dataRowMinHeight: 48,
            dataRowMaxHeight: 56,
            headingTextStyle: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            columns: [
              DataColumn(label: Text(context.l10n.product)),
              DataColumn(label: Text(context.l10n.sku)),
              DataColumn(label: Text(context.l10n.category)),
              DataColumn(label: Text(context.l10n.price), numeric: true),
              DataColumn(label: Text(context.l10n.stock), numeric: true),
            ],
            rows: [
              for (var i = 0; i < state.products.length; i++)
                _buildRow(context, state, i),
            ],
          ),
        ),
      ),
    );
  }

  DataRow _buildRow(BuildContext context, PosCatalogState state, int index) {
    final theme = Theme.of(context);
    final product = state.products[index];
    final selected = index == state.selectedIndex;

    return DataRow(
      selected: selected,
      color: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return theme.colorScheme.primaryContainer.withOpacity(0.5);
        }
        return null;
      }),
      onSelectChanged: (_) => widget.onAddProduct(product),
      cells: [
        DataCell(
          Text(
            product.name,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: selected ? theme.colorScheme.primary : null,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        DataCell(Text(product.sku ?? '-')),
        DataCell(Text(product.category ?? '-')),
        DataCell(
          Text(
            Formatters.currency(product.price),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        DataCell(_StockCell(quantity: product.stockQuantity)),
      ],
    );
  }
}

class _StockCell extends StatelessWidget {
  final int quantity;

  const _StockCell({required this.quantity});

  @override
  Widget build(BuildContext context) {
    return StatusBadge(
      status: quantity <= 0
          ? 'OUT'
          : quantity <= 5
              ? 'LOW'
              : 'OK',
    );
  }
}
