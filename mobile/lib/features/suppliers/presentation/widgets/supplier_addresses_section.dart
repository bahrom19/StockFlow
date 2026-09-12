import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_address_models.dart';

class SupplierAddressesSection extends StatelessWidget {
  final List<SupplierAddress> addresses;
  final VoidCallback onAdd;
  final void Function(SupplierAddress) onEdit;
  final void Function(SupplierAddress) onDelete;

  const SupplierAddressesSection({
    super.key,
    required this.addresses,
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
                Icon(Icons.location_on_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.addresses, style: theme.textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add, size: 20),
                  tooltip: context.l10n.newAddress,
                  onPressed: onAdd,
                ),
              ],
            ),
            if (addresses.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  context.l10n.noAddresses,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              )
            else
              ...addresses.map((a) => ListTile(
                    dense: true,
                    leading: Icon(Icons.location_on,
                        size: 20, color: theme.colorScheme.outline),
                    title: Text(a.displayAddress),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (a.isDefault)
                          Chip(
                            label: Text(context.l10n.defaultAddress,
                                style: const TextStyle(fontSize: 10)),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                          ),
                        PopupMenuButton<String>(
                          onSelected: (v) {
                            if (v == 'edit') onEdit(a);
                            if (v == 'delete') onDelete(a);
                          },
                          itemBuilder: (_) => [
                            PopupMenuItem(
                                value: 'edit', child: Text(context.l10n.edit)),
                            PopupMenuItem(
                                value: 'delete',
                                child: Text(context.l10n.delete)),
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
