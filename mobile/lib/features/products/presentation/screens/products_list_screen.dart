import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';
import 'package:stockflow/features/products/presentation/widgets/product_card.dart';

class ProductsListScreen extends ConsumerStatefulWidget {
  const ProductsListScreen({super.key});

  @override
  ConsumerState<ProductsListScreen> createState() => _ProductsListScreenState();
}

class _ProductsListScreenState extends ConsumerState<ProductsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(productsListProvider.notifier).loadProducts();
    });
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(productsListProvider.notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(productsListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _navigateToForm(),
        child: const Icon(Icons.add),
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search products...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          ref.read(productsListProvider.notifier).search('');
                        },
                      )
                    : null,
                isDense: true,
              ),
              onChanged: (value) {
                ref.read(productsListProvider.notifier).search(value);
                setState(() {});
              },
            ),
          ),
          // Content
          Expanded(child: _buildContent(theme, state)),
        ],
      ),
    );
  }

  Widget _buildContent(ThemeData theme, ProductsState state) {
    return switch (state) {
      ProductsLoading() => ListView.builder(
          itemCount: 8,
          padding: AppSpacing.screenPaddingHorizontal,
          itemBuilder: (_, __) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: ProductCardSkeleton(),
              ),
        ),
      ProductsEmpty(message: final msg) => EmptyStateWidget(
          title: msg,
          subtitle: 'Add your first product to get started',
          icon: Icons.inventory_2_outlined,
          actionLabel: 'Add Product',
          onAction: () => _navigateToForm(),
        ),
      ProductsError(message: final msg) => ErrorStateWidget(
          message: msg,
          onRetry: () =>
              ref.read(productsListProvider.notifier).loadProducts(),
        ),
      ProductsLoaded(:final products, :final hasMore, :final isRefreshing,
          :final isLoadingMore) =>
        RefreshIndicator(
          onRefresh: () => ref.read(productsListProvider.notifier).refresh(),
          child: ListView.builder(
            controller: _scrollController,
            padding: AppSpacing.screenPaddingHorizontal,
            itemCount: products.length + (isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == products.length) {
                return const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                );
              }
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: ProductCard(
                  product: products[index],
                  onTap: () => _navigateToDetail(products[index].id),
                ),
              );
            },
          ),
        ),
      _ => const SizedBox.shrink(),
    };
  }

  void _navigateToDetail(String id) {
    context.push(RouteNames.productDetail.replaceAll(':id', id));
  }

  void _navigateToForm() {
    context.push(RouteNames.productCreate);
  }
}
