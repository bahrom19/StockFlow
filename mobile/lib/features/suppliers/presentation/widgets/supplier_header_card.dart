import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

class SupplierHeaderCard extends StatelessWidget {
  final Supplier supplier;
  const SupplierHeaderCard({super.key, required this.supplier});

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
                Expanded(
                  child: Text(
                    supplier.companyName,
                    style: theme.textTheme.headlineSmall,
                  ),
                ),
                StatusBadge(
                  status: supplier.isActive ? 'ACTIVE' : 'INACTIVE',
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (supplier.bin != null && supplier.bin!.isNotEmpty)
              _infoRow(Icons.numbers, context.l10n.bin, supplier.bin!, theme),
            if (supplier.email != null && supplier.email!.isNotEmpty)
              _infoRow(
                  Icons.email_outlined, context.l10n.email, supplier.email!, theme),
            if (supplier.phone != null && supplier.phone!.isNotEmpty)
              _infoRow(
                  Icons.phone_outlined, context.l10n.phone, supplier.phone!, theme),
            if (supplier.website != null && supplier.website!.isNotEmpty)
              _infoRow(Icons.language, context.l10n.website, supplier.website!,
                  theme),
            const Divider(height: 24),
            _infoRow(
              Icons.access_time,
              context.l10n.createdAt,
              supplier.createdAt.toString().substring(0, 10),
              theme,
            ),
            _infoRow(
              Icons.update,
              context.l10n.updatedAt,
              supplier.updatedAt.toString().substring(0, 10),
              theme,
            ),
          ],
        ),
      ),
    );
  }

  static Widget _infoRow(IconData icon, String label, String value, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: theme.colorScheme.outline),
          const SizedBox(width: 8),
          Text('$label: ', style: theme.textTheme.bodySmall),
          Expanded(
            child: Text(value, style: theme.textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
