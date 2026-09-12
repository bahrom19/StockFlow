import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_contact_models.dart';

class SupplierContactsSection extends StatelessWidget {
  final List<SupplierContact> contacts;
  final VoidCallback onAdd;
  final void Function(SupplierContact) onEdit;
  final void Function(SupplierContact) onDelete;

  const SupplierContactsSection({
    super.key,
    required this.contacts,
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
                Icon(Icons.people_outline,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.contacts, style: theme.textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add, size: 20),
                  tooltip: context.l10n.newContact,
                  onPressed: onAdd,
                ),
              ],
            ),
            if (contacts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  context.l10n.noContacts,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              )
            else
              ...contacts.map((c) => ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 16,
                      child: Text(
                        (c.firstName ?? c.email ?? '?')[0].toUpperCase(),
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                    title: Text(c.displayName),
                    subtitle: Text(
                      [c.position, c.phone ?? c.email]
                          .where((e) => e != null && e.isNotEmpty)
                          .join(' · '),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (c.isPrimary)
                          Chip(
                            label: Text(context.l10n.primaryContact,
                                style: const TextStyle(fontSize: 10)),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                          ),
                        PopupMenuButton<String>(
                          onSelected: (v) {
                            if (v == 'edit') onEdit(c);
                            if (v == 'delete') onDelete(c);
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
