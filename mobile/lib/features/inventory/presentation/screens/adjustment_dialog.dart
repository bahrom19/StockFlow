import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/core/utils/validators.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';

class AdjustmentDialog extends ConsumerStatefulWidget {
  final String productId;
  final String productName;
  final String warehouseId;

  const AdjustmentDialog({
    super.key,
    required this.productId,
    required this.productName,
    required this.warehouseId,
  });

  @override
  ConsumerState<AdjustmentDialog> createState() => _AdjustmentDialogState();
}

class _AdjustmentDialogState extends ConsumerState<AdjustmentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _qtyCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();
  final _commentCtrl = TextEditingController();
  bool _isIncrease = true;
  bool _isSaving = false;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _reasonCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final quantity = int.parse(_qtyCtrl.text);
    final dto = AdjustStockDto(
      productId: widget.productId,
      warehouseId: widget.warehouseId,
      quantity: _isIncrease ? quantity : -quantity,
      reason: _reasonCtrl.text.isNotEmpty ? _reasonCtrl.text : null,
      comment: _commentCtrl.text.isNotEmpty ? _commentCtrl.text : null,
    );

    final result = await ref.read(adjustmentProvider.notifier).adjust(dto);
    setState(() => _isSaving = false);

    if (result != null && mounted) {
      AppSnackbar.success(context, 'Stock adjusted successfully');
      ref.read(inventoryListProvider.notifier).refresh();
      Navigator.of(context).pop();
    } else if (mounted) {
      AppSnackbar.error(context, 'Adjustment failed');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Adjust Stock')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Text(widget.productName, style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.lg),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('Increase')),
                ButtonSegment(value: false, label: Text('Decrease')),
              ],
              selected: {_isIncrease},
              onSelectionChanged: (v) => setState(() => _isIncrease = v.first),
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _qtyCtrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Quantity *',
                prefixIcon:
                    Icon(_isIncrease ? Icons.add_circle : Icons.remove_circle),
              ),
              validator: (v) {
                final req = Validators.required(v, 'Quantity');
                if (req != null) return req;
                final qty = int.tryParse(v ?? '');
                if (qty == null || qty <= 0) return 'Must be a positive number';
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason',
                hintText: 'e.g. Physical count correction',
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextFormField(
              controller: _commentCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Comment',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: _isSaving ? null : _submit,
              child: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit Adjustment'),
            ),
          ],
        ),
      ),
    );
  }
}
