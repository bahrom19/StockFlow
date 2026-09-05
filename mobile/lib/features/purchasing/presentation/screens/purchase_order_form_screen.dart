import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/currency/currency_selector.dart';

/// New Purchase Order form. Create-only today (always DRAFT → the currency
/// selector is editable); an optional [initial] order enables future edit
/// flows where non-DRAFT documents lock the currency read-only.
class PurchaseOrderFormScreen extends ConsumerStatefulWidget {
  const PurchaseOrderFormScreen({super.key, this.initial});
  final PurchaseOrder? initial;
  @override
  ConsumerState<PurchaseOrderFormScreen> createState() => _PurchaseOrderFormScreenState();
}

class _PurchaseOrderFormScreenState extends ConsumerState<PurchaseOrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedSupplierId;
  // ignore: unused_field
  String _selectedSupplierName = 'Select supplier...';
  List<Supplier> _suppliers = [];
  final _items = <_POLineItem>[];
  TextEditingController _notesCtrl = TextEditingController();
  bool _isSaving = false;
  String _selectedCurrency = 'KZT';

  /// DRAFT documents (and brand-new orders) may change currency; non-DRAFT
  /// orders are read-only (backend freeze rule for PO edits).
  bool get _canEditCurrency =>
      widget.initial == null || widget.initial!.status == 'DRAFT';

  @override
  void initState() {
    super.initState();
    _selectedCurrency =
        widget.initial?.currency ?? ref.read(currencyProvider);
    _loadSuppliers();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    for (final item in _items) {
      item.productCtrl.dispose();
      item.qtyCtrl.dispose();
      item.priceCtrl.dispose();
    }
    super.dispose();
  }

  Future<void> _loadSuppliers() async {
    final repo = ref.read(suppliersRepositoryProvider);
    final result = await repo.list(limit: 100);
    if (result is SuppliersSuccess<SupplierListResponse>) {
      setState(() => _suppliers = result.data.items);
      if (result.data.items.isNotEmpty) {
        _selectedSupplierId = result.data.items.first.id;
        _selectedSupplierName = result.data.items.first.companyName;
      }
    }
  }

  void _addItem() {
    setState(() => _items.add(_POLineItem(Product(id: '', name: '', companyId: '', price: '0', createdAt: DateTime.now().toIso8601String(), updatedAt: DateTime.now().toIso8601String()), 1, 0)));
  }

  Future<void> _selectProduct(int index) async {
    final repo = ref.read(productsRepositoryProvider);
    final result = await repo.list(limit: 50);
    if (result is ProductsSuccess<ProductListResponse>) {
      final products = result.data.items;
      if (!mounted) return;
      final selected = await showDialog<Product>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ctx.l10n.selectProduct),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: products.length,
              itemBuilder: (ctx, i) => ListTile(
                title: Text(products[i].name),
                subtitle: Text(ctx.money(
                  double.tryParse(products[i].price ?? '0') ?? 0,
                )),
                onTap: () => Navigator.pop(ctx, products[i]),
              ),
            ),
          ),
        ),
      );
      if (selected != null) {
        setState(() {
          _items[index].product = selected;
          _items[index].productCtrl.text = selected.name;
          _items[index].priceCtrl.text = selected.price ?? '0';
        });
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSupplierId == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(context.l10n.selectSupplierFirst),
        backgroundColor: Colors.red,
      ));
      return;
    }
    setState(() => _isSaving = true);

    final request = CreatePurchaseOrderRequest(
      supplierId: _selectedSupplierId!,
      notes: _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
      currency: _selectedCurrency,
      items: _items.where((i) => i.product.id.isNotEmpty).map((i) => CreatePurchaseOrderItem(
        productId: i.product.id,
        quantity: int.tryParse(i.qtyCtrl.text) ?? 1,
        unitCost: double.tryParse(i.priceCtrl.text) ?? 0,
      )).toList(),
    );

    final repo = ref.read(purchasingRepositoryProvider);
    final result = await repo.createOrder(request);

    setState(() => _isSaving = false);
    if (result is PurchasingSuccess && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.purchaseOrderCreated)),
      );
      context.pop();
    } else if (result is PurchasingFailure && mounted) {
      // Render-time localization: canonical ErrorHandler fallbacks get the
      // localized label (RU/KK); backend/freeform messages pass through.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localizedErrorLabel(
            context.l10n,
            (result as PurchasingFailure).error.message,
          )),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.newPurchaseOrder)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Supplier dropdown
            DropdownButtonFormField<String>(
              value: _selectedSupplierId,
              decoration: InputDecoration(
                labelText: context.l10n.supplierRequired,
                border: const OutlineInputBorder(),
              ),
              items: _suppliers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.companyName))).toList(),
              onChanged: (v) {
                final s = _suppliers.firstWhere((s) => s.id == v);
                setState(() { _selectedSupplierId = v; _selectedSupplierName = s.companyName; });
              },
              validator: (v) => v == null ? context.l10n.required : null,
            ),
            const SizedBox(height: 16),

            // Currency — editable for new/DRAFT orders, read-only once the
            // order leaves DRAFT (backend currency freeze rule).
            CurrencySelector(
              value: _selectedCurrency,
              enabled: _canEditCurrency,
              label: context.l10n.currency,
              onChanged: (code) => setState(() => _selectedCurrency = code),
            ),
            const SizedBox(height: 16),

            // Items
            Row(
              children: [
                // Semantics boundary (f72701d/ddd97fb pattern): without it,
                // Flutter Web hoists "Items" into the row's role="group"
                // aria-label next to the interactive Add Item button, hiding
                // the header from document.body.innerText.
                Semantics(
                  container: true,
                  child: Text(context.l10n.items,
                      style: theme.textTheme.titleSmall),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _addItem,
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(context.l10n.addItem),
                ),
              ],
            ),
            ..._items.asMap().entries.map((entry) {
              final i = entry.key;
              final item = entry.value;
              return Card(
                margin: const EdgeInsets.symmetric(vertical: 4),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Row(children: [
                        Expanded(
                          child: TextFormField(
                            controller: item.productCtrl,
                            decoration: InputDecoration(
                              labelText: context.l10n.product,
                              border: const OutlineInputBorder(),
                              isDense: true,
                            ),
                            readOnly: true,
                            onTap: () => _selectProduct(i),
                            validator: (v) =>
                                v == null || v.isEmpty
                                    ? context.l10n.required
                                    : null,
                          ),
                        ),
                        IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() => _items.removeAt(i))),
                      ]),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(
                          child: TextFormField(
                            controller: item.qtyCtrl,
                            decoration: InputDecoration(
                              labelText: context.l10n.qty,
                              border: const OutlineInputBorder(),
                              isDense: true,
                            ),
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextFormField(
                            controller: item.priceCtrl,
                            decoration: InputDecoration(
                              labelText: context.l10n.unitCost,
                              border: const OutlineInputBorder(),
                              isDense: true,
                            ),
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          ),
                        ),
                      ]),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 8),
            TextFormField(
              controller: _notesCtrl,
              decoration: InputDecoration(
                labelText: context.l10n.notes,
                border: const OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(context.l10n.createPurchaseOrder),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _POLineItem {
  Product product;
  final TextEditingController productCtrl;
  final TextEditingController qtyCtrl;
  final TextEditingController priceCtrl;

  _POLineItem(this.product, int qty, double price)
      : productCtrl = TextEditingController(text: product.name),
        qtyCtrl = TextEditingController(text: qty.toString()),
        priceCtrl = TextEditingController(text: price.toString());
}
