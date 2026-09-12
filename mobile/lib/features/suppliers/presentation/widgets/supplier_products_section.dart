import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_product_models.dart';

class SupplierProductsSection extends StatelessWidget {
  final List<SupplierProduct> products;
  final VoidCallback onAdd;
  final void Function(SupplierProduct) onEdit;
  final void Function(SupplierProduct) onDelete;

  const SupplierProductsSection({
    super.key,
    required this.products,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.inventory_2, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.supplierProducts, style: theme.textTheme.titleSmall),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(context.l10n.addProduct),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (products.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noProducts,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              )
            else
              ...products.map((sp) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: sp.isPreferred
                        ? const Icon(Icons.star, size: 20, color: Colors.amber)
                        : Icon(Icons.inventory_2, size: 20, color: theme.colorScheme.onSurfaceVariant),
                    title: Text(sp.product.name),
                    subtitle: Text([
                      if (sp.product.sku != null) 'SKU: ${sp.product.sku}',
                      if (sp.supplierSku != null) 'Sup: ${sp.supplierSku}',
                    ].join(' • ')),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (sp.purchasePrice != null)
                          Text('₸${sp.purchasePrice}',
                              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(width: 8),
                        PopupMenuButton<String>(
                          onSelected: (value) {
                            if (value == 'edit') onEdit(sp);
                            if (value == 'delete') onDelete(sp);
                          },
                          itemBuilder: (context) => [
                            PopupMenuItem(value: 'edit', child: Text(context.l10n.edit)),
                            PopupMenuItem(value: 'delete', child: Text(context.l10n.delete)),
                          ],
                        ),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }
}
