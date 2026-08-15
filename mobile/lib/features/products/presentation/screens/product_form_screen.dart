import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/validators.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

class ProductFormScreen extends ConsumerStatefulWidget {
  final Product? product; // non-null = edit (already loaded)
  final String? productId; // edit route: load by id when [product] is null
  const ProductFormScreen({super.key, this.product, this.productId});

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
  bool _isLoading = false;
  Product? _loaded;

  @override
  void initState() {
    super.initState();
    _isEdit = widget.product != null || widget.productId != null;
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
    if (p == null && widget.productId != null) {
      _isLoading = true;
      Future.microtask(_loadProduct);
    }
  }

  Future<void> _loadProduct() async {
    final repo = ref.read(productsRepositoryProvider);
    final result = await repo.getById(widget.productId!);
    if (!mounted) return;
    setState(() {
      if (result is ProductsSuccess<Product>) {
        _loaded = result.data;
        final loaded = result.data;
        _nameCtrl.text = loaded.name;
        _skuCtrl.text = loaded.sku ?? '';
        _barcodeCtrl.text = loaded.barcode ?? '';
        _priceCtrl.text = loaded.price ?? '';
        _costPriceCtrl.text = loaded.costPrice ?? '';
        _unitCtrl.text = loaded.unit ?? '';
        _categoryCtrl.text = loaded.category ?? '';
        _brandCtrl.text = loaded.brand ?? '';
        _descCtrl.text = loaded.description ?? '';
        _stockCtrl.text = loaded.stockQuantity.toString();
        _isActive = loaded.isActive;
      } else {
        AppSnackbar.error(
          context,
          result is ProductsFail<Product>
              ? result.error.message
              : context.l10n.failedToLoadProduct,
        );
      }
      _isLoading = false;
    });
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
    final p = _loaded ?? widget.product!;
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

  String get _editingId =>
      widget.product?.id ?? _loaded?.id ?? widget.productId ?? '';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    try {
      final repo = ref.read(productsRepositoryProvider);

      if (_isEdit) {
        final payload = _buildUpdatePayload();
        if (payload.isEmpty) {
          if (mounted) AppSnackbar.info(context, context.l10n.noChangesToSave);
          setState(() => _isSaving = false);
          return;
        }
        final result = await repo.update(_editingId, payload);
        if (result is ProductsSuccess<Product> && mounted) {
          AppSnackbar.success(context, context.l10n.productUpdated);
          ref.read(productsListProvider.notifier).refresh();
          Navigator.of(context).pop();
        } else if (mounted) {
          AppSnackbar.error(
            context,
            result is ProductsFail<Product>
                ? result.error.message
                : context.l10n.updateFailed,
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
          AppSnackbar.success(context, context.l10n.productCreated);
          ref.read(productsListProvider.notifier).refresh();
          Navigator.of(context).pop();
        } else if (mounted) {
          AppSnackbar.error(
            context,
            result is ProductsFail<Product>
                ? result.error.message
                : context.l10n.createFailed,
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
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? l10n.editProduct : l10n.newProduct),
        actions: [
          TextButton(
            onPressed: _isSaving || _isLoading ? null : _save,
            child: _isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child:
                        CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.save),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screenPadding,
          children: [
            Text(l10n.basicInformation, style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: l10n.nameRequired,
                prefixIcon: const Icon(Icons.inventory_2),
              ),
              validator: (v) => Validators.required(v, l10n.name, l10n),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _skuCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.sku,
                      prefixIcon: const Icon(Icons.tag),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextFormField(
                    controller: _barcodeCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.barcode,
                      prefixIcon: const Icon(Icons.qr_code),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(l10n.pricing, style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _priceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.priceRequired,
                      prefixText: '${context.currencySymbol} ',
                    ),
                    validator: (v) => Validators.required(v, l10n.price, l10n),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextFormField(
                    controller: _costPriceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.costPrice,
                      prefixText: '${context.currencySymbol} ',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(l10n.details, style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _unitCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.unit,
                      hintText: l10n.unitHint,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextFormField(
                    controller: _categoryCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.category,
                      hintText: l10n.categoryHint,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextFormField(
              controller: _brandCtrl,
              decoration: InputDecoration(
                labelText: l10n.brand,
                prefixIcon: const Icon(Icons.business),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextFormField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: l10n.description,
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(l10n.stock, style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _stockCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.quantity,
                      prefixIcon: const Icon(Icons.inventory),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SwitchListTile(
                    title: Text(l10n.statusActive),
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
