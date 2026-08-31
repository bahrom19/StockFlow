import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/validators.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';

/// Shows the Stock Adjustment dialog.
/// Returns true when an adjustment was applied successfully.
Future<bool> showAdjustmentDialog(
  BuildContext context, {
  required List<StockItem> items,
  required List<Warehouse> warehouses,
  StockItem? preselected,
}) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => _AdjustmentDialog(
      items: items,
      warehouses: warehouses,
      preselected: preselected,
    ),
  ).then((v) => v ?? false);
}

/// Shows the Stock Transfer dialog.
/// Returns true when a transfer was applied successfully.
Future<bool> showTransferDialog(
  BuildContext context, {
  required List<StockItem> items,
  required List<Warehouse> warehouses,
  StockItem? preselected,
}) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => _TransferDialog(
      items: items,
      warehouses: warehouses,
      preselected: preselected,
    ),
  ).then((v) => v ?? false);
}

class _AdjustmentDialog extends ConsumerStatefulWidget {
  final List<StockItem> items;
  final List<Warehouse> warehouses;
  final StockItem? preselected;

  const _AdjustmentDialog({
    required this.items,
    required this.warehouses,
    this.preselected,
  });

  @override
  ConsumerState<_AdjustmentDialog> createState() => _AdjustmentDialogState();
}

class _AdjustmentDialogState extends ConsumerState<_AdjustmentDialog> {
  final _formKey = GlobalKey<FormState>();
  StockItem? _selected;
  Warehouse? _warehouse;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _reasonCtrl;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.preselected;
    _qtyCtrl = TextEditingController(text: '0');
    _reasonCtrl = TextEditingController();
    // Default warehouse: the one matching the selected item, else first.
    _warehouse = widget.warehouses.isEmpty
        ? null
        : widget.warehouses.firstWhere(
            (w) => w.id == _selected?.warehouseId,
            orElse: () => widget.warehouses.first,
          );
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selected == null || _warehouse == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.selectProductAndWarehouse)),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;
    final qty = int.tryParse(_qtyCtrl.text) ?? 0;
    if (qty == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.quantityCannotBeZero)),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final dto = AdjustStockDto(
      productId: _selected!.productId,
      warehouseId: _warehouse!.id,
      quantity: qty,
      comment: _reasonCtrl.text.trim().isEmpty ? null : _reasonCtrl.text.trim(),
    );
    final result = await ref.read(adjustmentProvider.notifier).adjust(
          dto,
          offlineMessage: context.l10n.outboxOfflineQueuedMessage,
        );
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result != null) {
      ref.read(inventoryListProvider.notifier).refresh();
      ref.read(movementsProvider.notifier).loadMovements();
      Navigator.of(context).pop(true);
    } else {
      final state = ref.read(adjustmentProvider);
      final message = state is AsyncError
          ? localizedErrorLabel(context.l10n, state.error.toString())
          : context.l10n.adjustmentFailed;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.adjustStock),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.adjustHint,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<StockItem>(
                  value: _selected,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.productRequired,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final i in widget.items)
                      DropdownMenuItem(
                        value: i,
                        child: Text(
                          '${i.productName} ${l10n.itemInStock(i.quantity)}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) {
                    setState(() {
                      _selected = v;
                      if (v != null) {
                        _warehouse = widget.warehouses.isEmpty
                            ? null
                            : widget.warehouses.firstWhere(
                                (w) => w.id == v.warehouseId,
                                orElse: () => widget.warehouses.first,
                              );
                      }
                    });
                  },
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<Warehouse>(
                  value: _warehouse,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.warehouseRequired,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final w in widget.warehouses)
                      DropdownMenuItem(
                        value: w,
                        child: Text(
                          w.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) => setState(() => _warehouse = v),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _qtyCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: l10n.quantityRequired,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  validator: (v) => Validators.required(v, l10n.quantity, l10n),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _reasonCtrl,
                  decoration: InputDecoration(
                    labelText: l10n.reasonComment,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed:
              _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n.applyAdjustment),
        ),
      ],
    );
  }
}

class _TransferDialog extends ConsumerStatefulWidget {
  final List<StockItem> items;
  final List<Warehouse> warehouses;
  final StockItem? preselected;

  const _TransferDialog({
    required this.items,
    required this.warehouses,
    this.preselected,
  });

  @override
  ConsumerState<_TransferDialog> createState() => _TransferDialogState();
}

class _TransferDialogState extends ConsumerState<_TransferDialog> {
  final _formKey = GlobalKey<FormState>();
  StockItem? _selected;
  Warehouse? _from;
  Warehouse? _to;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _commentCtrl;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.preselected;
    _from = widget.warehouses.isEmpty
        ? null
        : widget.warehouses.firstWhere(
            (w) => w.id == _selected?.warehouseId,
            orElse: () => widget.warehouses.first,
          );
    _to = widget.warehouses.length > 1 ? widget.warehouses[1] : null;
    _qtyCtrl = TextEditingController(text: '1');
    _commentCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selected == null || _from == null || _to == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.selectProductAndBothWarehouses)),
      );
      return;
    }
    if (_from!.id == _to!.id) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.sourceDestinationDiffer)),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;
    final qty = int.tryParse(_qtyCtrl.text) ?? 0;
    if (qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.quantityMustBePositive)),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final dto = TransferStockDto(
      productId: _selected!.productId,
      fromWarehouseId: _from!.id,
      toWarehouseId: _to!.id,
      quantity: qty,
      comment:
          _commentCtrl.text.trim().isEmpty ? null : _commentCtrl.text.trim(),
    );
    final result = await ref.read(transferProvider.notifier).transfer(
          dto,
          offlineMessage: context.l10n.outboxOfflineQueuedMessage,
        );
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (result != null) {
      ref.read(inventoryListProvider.notifier).refresh();
      ref.read(movementsProvider.notifier).loadMovements();
      Navigator.of(context).pop(true);
    } else {
      final state = ref.read(transferProvider);
      final message = state is AsyncError
          ? localizedErrorLabel(context.l10n, state.error.toString())
          : context.l10n.transferFailed;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.transferStock),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<StockItem>(
                  value: _selected,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.productRequired,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final i in widget.items)
                      DropdownMenuItem(
                        value: i,
                        child: Text(
                          '${i.productName} ${l10n.itemInStock(i.quantity)}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) {
                    setState(() {
                      _selected = v;
                      if (v != null) {
                        _from = widget.warehouses.isEmpty
                            ? null
                            : widget.warehouses.firstWhere(
                                (w) => w.id == v.warehouseId,
                                orElse: () => widget.warehouses.first,
                              );
                      }
                    });
                  },
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<Warehouse>(
                  value: _from,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.fromWarehouse,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final w in widget.warehouses)
                      DropdownMenuItem(
                        value: w,
                        child: Text(w.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _from = v),
                ),
                const SizedBox(height: AppSpacing.sm),
                DropdownButtonFormField<Warehouse>(
                  value: _to,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: l10n.toWarehouse,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final w in widget.warehouses)
                      DropdownMenuItem(
                        value: w,
                        child: Text(w.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (v) => setState(() => _to = v),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _qtyCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: l10n.quantityRequired,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                  validator: (v) => Validators.required(v, l10n.quantity, l10n),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _commentCtrl,
                  decoration: InputDecoration(
                    labelText: l10n.comment,
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed:
              _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n.inventoryTransfer),
        ),
      ],
    );
  }
}
