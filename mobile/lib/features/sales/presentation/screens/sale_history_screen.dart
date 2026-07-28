import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/sales/presentation/widgets/sales_widgets.dart';

// ──────────────────────────────────
// Sale History Screen
// ──────────────────────────────────
class SaleHistoryScreen extends ConsumerStatefulWidget {
  const SaleHistoryScreen({super.key});

  @override
  ConsumerState<SaleHistoryScreen> createState() => _SaleHistoryScreenState();
}

class _SaleHistoryScreenState extends ConsumerState<SaleHistoryScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() => ref.read(saleListProvider.notifier).loadSales());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(saleListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(saleListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales History'),
      ),
      body: Column(
        children: [
          // Search + filters
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by sale number...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              onChanged: (q) =>
                  ref.read(saleListProvider.notifier).search(q),
            ),
          ),

          // Status filter chips
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                _buildFilterChip('All', null),
                const SizedBox(width: 8),
                _buildFilterChip('Draft', 'DRAFT'),
                const SizedBox(width: 8),
                _buildFilterChip('Completed', 'COMPLETED'),
                const SizedBox(width: 8),
                _buildFilterChip('Cancelled', 'CANCELLED'),
                const SizedBox(width: 8),
                _buildFilterChip('Refunded', 'REFUNDED'),
              ],
            ),
          ),

          // Content
          Expanded(child: _buildContent(state, theme)),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String? status) {
    return FilterChip(
      label: Text(label),
      selected: false,
      onSelected: (_) =>
          ref.read(saleListProvider.notifier).filterByStatus(status),
    );
  }
  Widget _buildContent(SaleListState state, ThemeData theme) {
    switch (state) {
      case SaleListLoading():
        return const Center(child: CircularProgressIndicator());
      case SaleListEmpty():
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.receipt_long_outlined,
                  size: 64, color: theme.colorScheme.outline),
              const SizedBox(height: 16),
              Text('No sales found', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text('Complete your first sale to see it here',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.outline)),
            ],
          ),
        );
      case SaleListError():
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline,
                  size: 64, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text((state as SaleListError).message,
                  style: theme.textTheme.bodyMedium,
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.tonalIcon(
                onPressed: () =>
                    ref.read(saleListProvider.notifier).loadSales(),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        );
      case SaleListLoaded():
        final loaded = state as SaleListLoaded;
        return RefreshIndicator(
          onRefresh: () => ref.read(saleListProvider.notifier).refresh(),
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(8),
            itemCount: loaded.sales.length + (loaded.isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index >= loaded.sales.length) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(),
                  ),
                );
              }
              final sale = loaded.sales[index];
              return SaleCard(
                sale: sale,
                onTap: () => context.push('/sales/${sale.id}'),
              );
            },
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
