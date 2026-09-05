import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';
import 'package:stockflow/features/products/presentation/widgets/product_card.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

/// Products management screen — desktop-first DataTable with search,
/// CSV export, status filter and pagination.
///
/// Supports a deep-linked stock-level filter (`/products?stock=low|out`) used
/// by the Dashboard "Requires attention" alerts («Товар заканчивается» /
/// «Товар закончился» → «Проверить остатки»).
class ProductsListScreen extends ConsumerStatefulWidget {
  const ProductsListScreen({super.key, this.initialStockFilter});

  /// Stock-level filter carried by the route query parameters
  /// ([ProductStockFilter.queryParameterKey]). Null → normal unfiltered entry.
  final ProductStockFilter? initialStockFilter;

  @override
  ConsumerState<ProductsListScreen> createState() =>
      _ProductsListScreenState();
}

class _ProductsListScreenState extends ConsumerState<ProductsListScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() {
      final notifier = ref.read(productsListProvider.notifier);
      // Deep link from a Dashboard alert: apply the requested stock filter
      // (which triggers the load). A plain entry keeps the current list
      // state, matching how search/category behave across visits.
      final deepLink = widget.initialStockFilter;
      if (deepLink != null) {
        notifier.applyStockFilter(deepLink);
      } else {
        notifier.loadProducts();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(productsListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final state = ref.watch(productsListProvider);

    final loaded = state is ProductsLoaded ? state : null;
    final items = loaded?.products ?? const <Product>[];
    final activeCategory = loaded?.category;
    final activeStockFilter = loaded?.stockFilter;
    final categories = <String>[];
    for (final p in items) {
      final c = p.category;
      if (c != null && c.isNotEmpty && !categories.contains(c)) {
        categories.add(c);
      }
    }

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: l10n.products,
            subtitle: l10n.productsSubtitle,
          ),
          // Stock-level filter chips — same entry points as the Dashboard
          // "Requires attention" alerts («Товар заканчивается» /
          // «Товар закончился»). Reuses the standard ChoiceChip language of
          // EntityTable's filter strip; no new design.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              0,
            ),
            child: Wrap(
              spacing: AppSpacing.xs,
              children: [
                for (final filter in ProductStockFilter.values)
                  ChoiceChip(
                    label: Text(
                      filter == ProductStockFilter.low
                          ? l10n.filterLowStock
                          : l10n.filterOutOfStock,
                    ),
                    selected: activeStockFilter == filter,
                    onSelected: (selected) => ref
                        .read(productsListProvider.notifier)
                        .setStockFilter(selected ? filter : null),
                    showCheckmark: false,
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          ),
          Expanded(
            child: EntityTable<Product>(
              items: items,
              total: loaded?.total ?? 0,
              hasMore: loaded?.hasMore ?? false,
              isLoading: state is ProductsLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              isLoadingMore: loaded?.isLoadingMore ?? false,
              onLoadMore: _onScroll,
              search: loaded?.search,
              searchHint: l10n.searchByNameSkuBarcode,
              onSearch: (q) =>
                  ref.read(productsListProvider.notifier).search(q),
              filters: [
                EntityFilter(l10n.all, null),
                for (final c in categories) EntityFilter(c, c),
              ],
              activeFilter: activeCategory,
              onFilter: (v) =>
                  ref.read(productsListProvider.notifier).setCategory(v),
              onRefresh: () =>
                  ref.read(productsListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.productCreate),
              createLabel: l10n.newProduct,
              onImport: () => context.push(RouteNames.productImport),
              importLabel: l10n.importCsv,
              exportFileName: 'products.csv',
              exportHeaders: [
                l10n.name,
                l10n.sku,
                l10n.barcode,
                l10n.ntin,
                l10n.category,
                l10n.brand,
                l10n.unit,
                l10n.price,
                l10n.cost,
                l10n.stock,
                l10n.status,
              ],
              exportRows: () => [
                for (final p in items)
                  [
                    p.name,
                    p.sku ?? '',
                    p.barcode ?? '',
                    p.ntin ?? '',
                    p.category ?? '',
                    p.brand ?? '',
                    p.unit ?? '',
                    p.price ?? '',
                    p.costPrice ?? '',
                    p.stockQuantity.toString(),
                    p.isActive ? l10n.statusActive : l10n.statusInactive,
                  ],
              ],
              columns: [
                DataColumn(label: Text(l10n.product)),
                DataColumn(label: Text(l10n.sku)),
                DataColumn(label: Text(l10n.category)),
                DataColumn(label: Text(l10n.unit)),
                DataColumn(
                  label: Text(l10n.price, style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(l10n.stock, style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(label: Text(l10n.status)),
              ],
              buildRow: (p) => DataRow(
                cells: [
                  DataCell(
                    Text(
                      p.name,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  DataCell(Text(p.sku ?? '-')),
                  DataCell(Text(p.category ?? '-')),
                  DataCell(Text(p.unit ?? '-')),
                  DataCell(Text(context.money(p.price))),
                  DataCell(_StockCell(quantity: p.stockQuantity)),
                  DataCell(StatusBadge(
                    status: p.isActive ? 'ACTIVE' : 'INACTIVE',
                  )),
                ],
              ),
              buildCard: (p) => ProductCard(
                product: p,
                onTap: () => _navigateToDetail(p.id),
              ),
              onRowTap: (p) => _navigateToDetail(p.id),
              emptyTitle: activeStockFilter == null
                  ? l10n.productsEmptyTitle
                  : l10n.productsStockFilterEmptyTitle,
              emptySubtitle: activeStockFilter == null
                  ? l10n.productsEmptySubtitle
                  : l10n.productsStockFilterEmptySubtitle,
              emptyIcon: Icons.inventory_2_outlined,
              errorMessage: state is ProductsError
                  ? (state as ProductsError).message
                  : null,
              onRetry: () =>
                  ref.read(productsListProvider.notifier).loadProducts(),
            ),
          ),
        ],
      ),
    );
  }

  void _navigateToDetail(String id) {
    context.push(RouteNames.productDetail.replaceAll(':id', id));
  }
}

class _StockCell extends StatelessWidget {
  final int quantity;

  const _StockCell({required this.quantity});

  @override
  Widget build(BuildContext context) {
    // Same classification as the stock filters (kLowStockThreshold) so the
    // cell colors always agree with what "Низкий остаток"/"Нет в наличии"
    // list.
    final color = quantity <= 0
        ? Theme.of(context).colorScheme.error
        : quantity <= kLowStockThreshold
            ? const Color(0xFFFB8C00)
            : Theme.of(context).colorScheme.primary;
    return Text(
      '$quantity',
      style: TextStyle(
        fontWeight: FontWeight.w600,
        color: color,
      ),
    );
  }
}
