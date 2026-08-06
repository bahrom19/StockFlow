import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/app_dialog.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(productDetailProvider(widget.productId).notifier)
          .loadProduct(widget.productId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(productDetailProvider(widget.productId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Product'),
        actions: [
          if (state is ProductDetailLoaded) ...[
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit',
              onPressed: () => context
                  .push(RouteNames.productEdit.replaceAll(':id', widget.productId)),
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              tooltip: 'Delete',
              onPressed: () => _confirmDelete(state.product),
            ),
          ],
        ],
      ),
      body: switch (state) {
        ProductDetailLoading() => const Center(
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ProductDetailError(message: final msg) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48,
                      color: theme.colorScheme.error),
                  const SizedBox(height: AppSpacing.md),
                  Text(msg, style: theme.textTheme.bodyLarge),
                  const SizedBox(height: AppSpacing.md),
                  FilledButton(
                    onPressed: () => ref
                        .read(productDetailProvider(widget.productId).notifier)
                        .loadProduct(widget.productId),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ProductDetailLoaded(product: final p) => _buildDetail(theme, p),
        _ => const SizedBox.shrink(),
      },
    );
  }

  Widget _buildDetail(ThemeData theme, Product p) {
    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        // Header card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: Icon(Icons.inventory_2, size: 32,
                      color: theme.colorScheme.onSurfaceVariant),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.name, style: theme.textTheme.titleLarge),
                      const SizedBox(height: 4),
                      if (p.sku != null)
                        Text('SKU: ${p.sku}',
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                _StatusBadge(isActive: p.isActive),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Pricing
        Text('Pricing', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Column(
            children: [
              _InfoRow(label: 'Price', value: Formatters.currency(p.price)),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _InfoRow(
                label: 'Cost Price',
                value: p.costPrice != null
                    ? Formatters.currency(p.costPrice)
                    : '-',
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _InfoRow(
                label: 'Margin',
                value: _calcMargin(p),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Stock
        Text('Stock', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Column(
            children: [
              _InfoRow(
                label: 'Quantity',
                value: p.stockQuantity.toString(),
                valueColor: p.stockQuantity <= 5
                    ? DesignTokens.warning
                    : null,
              ),
              if (p.unit != null) ...[
                const Divider(height: 1, indent: 16, endIndent: 16),
                _InfoRow(label: 'Unit', value: p.unit!),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Details
        Text('Details', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Column(
            children: [
              if (p.category != null)
                _InfoRow(label: 'Category', value: p.category!),
              if (p.barcode != null) ...[
                const Divider(height: 1, indent: 16, endIndent: 16),
                _InfoRow(label: 'Barcode', value: p.barcode!,
                    icon: Icons.qr_code),
              ],
              if (p.brand != null) ...[
                const Divider(height: 1, indent: 16, endIndent: 16),
                _InfoRow(label: 'Brand', value: p.brand!),
              ],
              if (p.description != null) ...[
                const Divider(height: 1, indent: 16, endIndent: 16),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Description',
                          style: theme.textTheme.labelMedium),
                      const SizedBox(height: 4),
                      Text(p.description!,
                          style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Metadata
        Text('Metadata', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Column(
            children: [
              _InfoRow(label: 'Created',
                  value: Formatters.dateTime(DateTime.tryParse(p.createdAt))),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _InfoRow(label: 'Updated',
                  value: Formatters.dateTime(DateTime.tryParse(p.updatedAt))),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }

  String _calcMargin(Product p) {
    final price = double.tryParse(p.price ?? '0') ?? 0;
    final cost = double.tryParse(p.costPrice ?? '0') ?? 0;
    if (price <= 0) return '-';
    final margin = ((price - cost) / price * 100);
    return '${margin.toStringAsFixed(1)}%';
  }

  Future<void> _confirmDelete(Product product) async {
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Delete Product',
      message: 'Are you sure you want to delete "${product.name}"?',
      confirmText: 'Delete',
      isDestructive: true,
    );
    if (confirmed) {
      final notifier = ref.read(productDetailProvider(widget.productId).notifier);
      final success = await notifier.deleteProduct(widget.productId);
      if (success && mounted) {
        AppSnackbar.success(context, 'Product deleted');
        Navigator.of(context).pop();
      } else if (mounted) {
        AppSnackbar.error(context, 'Failed to delete product');
      }
    }
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData? icon;
  final Color? valueColor;

  const _InfoRow({
    required this.label,
    required this.value,
    this.icon,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      leading: icon != null
          ? Icon(icon, size: 20, color: theme.colorScheme.onSurfaceVariant)
          : null,
      title: Text(label, style: theme.textTheme.bodyMedium),
      trailing: Text(
        value,
        style: theme.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: valueColor,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final bool isActive;
  const _StatusBadge({required this.isActive});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = isActive ? DesignTokens.success : DesignTokens.grey500;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        isActive ? 'Active' : 'Inactive',
        style: theme.textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
