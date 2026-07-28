import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/suppliers/presentation/providers/suppliers_provider.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_widgets.dart';

class SuppliersListScreen extends ConsumerStatefulWidget {
  const SuppliersListScreen({super.key});
  @override
  ConsumerState<SuppliersListScreen> createState() => _SuppliersListScreenState();
}

class _SuppliersListScreenState extends ConsumerState<SuppliersListScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() => ref.read(supplierListProvider.notifier).loadSuppliers());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(supplierListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(supplierListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Suppliers')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search suppliers...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
              ),
              onChanged: (q) => ref.read(supplierListProvider.notifier).search(q),
            ),
          ),
          Expanded(child: _buildContent(state, theme)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/suppliers/new'),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildContent(SupplierListState state, ThemeData theme) {
    switch (state) {
      case SupplierListLoading():
        return const Center(child: CircularProgressIndicator());
      case SupplierListEmpty():
        return Center(child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.business_outlined, size: 64, color: theme.colorScheme.outline),
            const SizedBox(height: 16),
            Text('No suppliers found', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            FilledButton.tonalIcon(
              onPressed: () => context.push('/suppliers/new'),
              icon: const Icon(Icons.add), label: const Text('Add Supplier'),
            ),
          ],
        ));
      case SupplierListError():
        final err = state as SupplierListError;
        return Center(child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text(err.message, style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: () => ref.read(supplierListProvider.notifier).loadSuppliers(),
              icon: const Icon(Icons.refresh), label: const Text('Retry'),
            ),
          ],
        ));
      case SupplierListLoaded():
        final loaded = state as SupplierListLoaded;
        return RefreshIndicator(
          onRefresh: () => ref.read(supplierListProvider.notifier).refresh(),
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(8),
            itemCount: loaded.suppliers.length + (loaded.isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index >= loaded.suppliers.length) {
                return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
              }
              final supplier = loaded.suppliers[index];
              return SupplierCard(supplier: supplier, onTap: () => context.push('/suppliers/${supplier.id}'));
            },
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
