import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/purchasing/presentation/providers/purchasing_provider.dart';
import 'package:stockflow/features/purchasing/presentation/widgets/purchasing_widgets.dart';

class PurchaseOrderListScreen extends ConsumerStatefulWidget {
  const PurchaseOrderListScreen({super.key});
  @override
  ConsumerState<PurchaseOrderListScreen> createState() => _PurchaseOrderListScreenState();
}

class _PurchaseOrderListScreenState extends ConsumerState<PurchaseOrderListScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() => ref.read(poListProvider.notifier).loadOrders());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(poListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(poListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Purchase Orders')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search orders...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
              ),
              onChanged: (q) => ref.read(poListProvider.notifier).search(q),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                _filterChip('All', null),
                const SizedBox(width: 8),
                _filterChip('Draft', 'DRAFT'),
                const SizedBox(width: 8),
                _filterChip('Approved', 'APPROVED'),
                const SizedBox(width: 8),
                _filterChip('Received', 'RECEIVED'),
                const SizedBox(width: 8),
                _filterChip('Cancelled', 'CANCELLED'),
              ],
            ),
          ),
          Expanded(child: _buildContent(state, theme)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/purchasing/new'),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _filterChip(String label, String? status) {
    return FilterChip(
      label: Text(label),
      selected: false,
      onSelected: (_) => ref.read(poListProvider.notifier).filterByStatus(status),
    );
  }

  Widget _buildContent(POListState state, ThemeData theme) {
    switch (state) {
      case POListLoading():
        return const Center(child: CircularProgressIndicator());
      case POListEmpty():
        return Center(child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_outlined, size: 64, color: theme.colorScheme.outline),
            const SizedBox(height: 16),
            Text('No purchase orders', style: theme.textTheme.titleMedium),
          ],
        ));
      case POListError():
        final err = state as POListError;
        return Center(child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(err.message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonalIcon(onPressed: () => ref.read(poListProvider.notifier).loadOrders(), icon: const Icon(Icons.refresh), label: const Text('Retry')),
          ],
        ));
      case POListLoaded():
        final loaded = state as POListLoaded;
        return RefreshIndicator(
          onRefresh: () => ref.read(poListProvider.notifier).refresh(),
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(8),
            itemCount: loaded.orders.length + (loaded.isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index >= loaded.orders.length) {
                return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
              }
              return POCard(order: loaded.orders[index], onTap: () => context.push('/purchasing/${loaded.orders[index].id}'));
            },
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
