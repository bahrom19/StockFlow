import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/validators.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';

class ProductFormScreen extends ConsumerStatefulWidget {
  final Product? product; // null = create, non-null = edit
  const ProductFormScreen({super.key, this.product});

  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _skuCtrl;
  late TextEditingController _barcodeCtrl;
  late TextEditingController _priceCtrl;
  late TextEditingController _costPriceCtrl;
  late TextEditingController _unitCtrl;
  late TextEditingController _categoryCtrl;
  late TextEditingController _brandCtrl;
  late TextEditingController _descCtrl;
  late TextEditingController _stockCtrl;
  bool _isActive = true;
  bool _isSaving = false;
  bool _isEdit = false;

  @override
  void initState() {
    super.initState();
    _isEdit = widget.product != null;
    final p = widget.product;
    _nameCtrl = TextEditingController(text: p?.name ?? '');
    _skuCtrl = TextEditingController(text: p?.sku ?? '');
    _barcodeCtrl = TextEditingController(text: p?.barcode ?? '');
    _priceCtrl = TextEditingController(text: p?.price ?? '');
    _costPriceCtrl = TextEditingController(text: p?.costPrice ?? '');
    _unitCtrl = TextEditingController(text: p?.unit ?? '');
    _categoryCtrl = TextEditingController(text: p?.category ?? '');
    _brandCtrl = TextEditingController(text: p?.brand ?? '');
    _descCtrl = TextEditingController(text: p?.description ?? '');
    _stockCtrl = TextEditingController(
      text: (p?.stockQuantity ?? 0).toString(),
    );
    _isActive = p?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _skuCtrl.dispose();
    _barcodeCtrl.dispose();
    _priceCtrl.dispose();
    _costPriceCtrl.dispose();
    _unitCtrl.dispose();
    _categoryCtrl.dispose();
    _brandCtrl.dispose();
    _descCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  Map<String, dynamic> _buildUpdatePayload() {
    final p = widget.product!;
    final map = <String, dynamic>{};
    if (_nameCtrl.text != p.name) map['name'] = _nameCtrl.text;
    if (_skuCtrl.text != (p.sku ?? '')) map['sku'] = _skuCtrl.text;
    if (_barcodeCtrl.text != (p.barcode ?? '')) {
      map['barcode'] = _barcodeCtrl.text;
    }
    if (_priceCtrl.text != (p.price ?? '')) {
      map['price'] = _priceCtrl.text;
    }
    if (_costPriceCtrl.text != (p.costPrice ?? '')) {
      map['costPrice'] = _costPriceCtrl.text;
    }
    if (_unitCtrl.text != (p.unit ?? '')) map['unit'] = _unitCtrl.text;
    if (_categoryCtrl.text != (p.category ?? '')) {
      map['category'] = _categoryCtrl.text;
    }
    if (_brandCtrl.text != (p.brand ?? '')) map['brand'] = _brandCtrl.text;
    if (_descCtrl.text != (p.description ?? '')) {
      map['description'] = _descCtrl.text;
    }
    if (_stockCtrl.text != p.stockQuantity.toString()) {
      map['stockQuantity'] = int.tryParse(_stockCtrl.text) ?? 0;
    }
    if (_isActive != p.isActive) map['isActive'] = _isActive;
    return map;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    try {
      final repo = ref.read(productsRepositoryProvider);

      if (_isEdit) {
        final payload = _buildUpdatePayload();
        if (payload.isEmpty) {
          if (mounted) AppSnackbar.info(context, 'No changes to save');
          setState(() => _isSaving = false);
          return;
        }
        final result = await repo.update(widget.product!.id, payload);
        if (result is ProductsSuccess<Product> && mounted) {
          AppSnackbar.success(context, 'Product updated');
          ref.read(productsListProvider.notifier).refresh();
          Navigator.of(context).pop();
        } else if (mounted) {
          AppSnackbar.error(
            context,
            result is ProductsFail<Product>
                ? result.error.message
                : 'Update failed',
          );
        }
      } else {
        final request = CreateProductRequest(
          name: _nameCtrl.text,
          sku: _skuCtrl.text.isNotEmpty ? _skuCtrl.text : null,
          barcode: _barcodeCtrl.text.isNotEmpty ? _barcodeCtrl.text : null,
          price: _priceCtrl.text,
          costPrice: _costPriceCtrl.text.isNotEmpty
              ? _costPriceCtrl.text
              : null,
          unit: _unitCtrl.text.isNotEmpty ? _unitCtrl.text : null,
          category: _categoryCtrl.text.isNotEmpty
              ? _categoryCtrl.text
              : null,
          brand: _brandCtrl.text.isNotEmpty ? _brandCtrl.text : null,
          description:
              _descCtrl.text.isNotEmpty ? _descCtrl.text : null,
          stockQuantity: int.tryParse(_stockCtrl.text) ?? 0,
          isActive: _isActive,
        );
        final result = await repo.create(request);
        if (result is ProductsSuccess<Product> && mounted) {
          AppSnackbar.success(context, 'Product created');
          ref.read(productsListProvider.notifier).refresh();
          Navigator.of(context).pop();
        } else if (mounted) {
          AppSnackbar.error(
            context,
            result is ProductsFail<Product>
                ? result.error.message
                : 'Create failed',
          );
        }
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit Product' : 'New Product'),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _save,
            child: _isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child:
                        CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Text('Basic Information', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name *',
                prefixIcon: Icon(Icons.inventory_2),
              ),
              validator: (v) => Validators.required(v, 'Name'),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _skuCtrl,
                    decoration: const InputDecoration(
                      labelText: 'SKU',
                      prefixIcon: Icon(Icons.tag),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextFormField(
                    controller: _barcodeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Barcode',
                      prefixIcon: Icon(Icons.qr_code),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Pricing', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _priceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Price *',
                      prefixText: '\$ ',
                    ),
                    validator: (v) => Validators.required(v, 'Price'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextFormField(
                    controller: _costPriceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Cost Price',
                      prefixText: '\$ ',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Details', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _unitCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Unit',
                      hintText: 'pcs, kg, m',
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextFormField(
                    controller: _categoryCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Category',
                      hintText: 'Electronics',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextFormField(
              controller: _brandCtrl,
              decoration: const InputDecoration(
                labelText: 'Brand',
                prefixIcon: Icon(Icons.business),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextFormField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Description',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text('Stock', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _stockCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Quantity',
                      prefixIcon: Icon(Icons.inventory),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SwitchListTile(
                    title: const Text('Active'),
                    value: _isActive,
                    onChanged: (v) => setState(() => _isActive = v),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}
