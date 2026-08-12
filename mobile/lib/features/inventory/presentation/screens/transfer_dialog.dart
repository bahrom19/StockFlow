import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/core/utils/validators.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';

class TransferDialog extends ConsumerStatefulWidget {
  final String productId;
  final String productName;
  final List<Warehouse> warehouses;

  const TransferDialog({
    super.key,
    required this.productId,
    required this.productName,
    required this.warehouses,
  });

  @override
  ConsumerState<TransferDialog> createState() => _TransferDialogState();
}

class _TransferDialogState extends ConsumerState<TransferDialog> {
  final _formKey = GlobalKey<FormState>();
  final _qtyCtrl = TextEditingController();
  final _commentCtrl = TextEditingController();
  Warehouse? _fromWarehouse;
  Warehouse? _toWarehouse;
  bool _isSaving = false;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_fromWarehouse == null || _toWarehouse == null) {
      AppSnackbar.error(context, context.l10n.selectBothWarehouses);
      return;
    }
    if (_fromWarehouse!.id == _toWarehouse!.id) {
      AppSnackbar.error(context, context.l10n.sourceDestinationDiffer);
      return;
    }
    setState(() => _isSaving = true);

    final dto = TransferStockDto(
      productId: widget.productId,
      fromWarehouseId: _fromWarehouse!.id,
      toWarehouseId: _toWarehouse!.id,
      quantity: int.parse(_qtyCtrl.text),
      comment: _commentCtrl.text.isNotEmpty ? _commentCtrl.text : null,
    );

    final result = await ref.read(transferProvider.notifier).transfer(dto);
    setState(() => _isSaving = false);

    if (result != null && mounted) {
      AppSnackbar.success(context, context.l10n.stockTransferred);
      ref.read(inventoryListProvider.notifier).refresh();
      Navigator.of(context).pop();
    } else if (mounted) {
      AppSnackbar.error(context, context.l10n.transferFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.transferStock)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Text(widget.productName, style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.lg),
            DropdownButtonFormField<Warehouse>(
              value: _fromWarehouse,
              decoration: InputDecoration(
                labelText: l10n.fromWarehouse,
                prefixIcon: const Icon(Icons.arrow_circle_right),
              ),
              items: widget.warehouses
                  .map((w) => DropdownMenuItem(value: w, child: Text(w.name)))
                  .toList(),
              onChanged: (v) => setState(() => _fromWarehouse = v),
              validator: (v) => v == null ? l10n.required : null,
            ),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<Warehouse>(
              value: _toWarehouse,
              decoration: InputDecoration(
                labelText: l10n.toWarehouse,
                prefixIcon: const Icon(Icons.arrow_circle_left),
              ),
              items: widget.warehouses
                  .map((w) => DropdownMenuItem(value: w, child: Text(w.name)))
                  .toList(),
              onChanged: (v) => setState(() => _toWarehouse = v),
              validator: (v) => v == null ? l10n.required : null,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _qtyCtrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: l10n.quantityRequired,
                prefixIcon: const Icon(Icons.inventory),
              ),
              validator: (v) {
                final req = Validators.required(v, l10n.quantity);
                if (req != null) return req;
                final qty = int.tryParse(v ?? '');
                if (qty == null || qty <= 0) return l10n.positiveNumber;
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _commentCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: l10n.comment,
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: _isSaving ? null : _submit,
              child: _isSaving
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(l10n.submitTransfer),
            ),
          ],
        ),
      ),
    );
  }
}
