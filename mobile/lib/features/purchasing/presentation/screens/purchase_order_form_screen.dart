import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/suppliers/data/repositories/suppliers_repository.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';

class PurchaseOrderFormScreen extends ConsumerStatefulWidget {
  const PurchaseOrderFormScreen({super.key});
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

  @override
  void initState() {
    super.initState();
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
          title: const Text('Select Product'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: products.length,
              itemBuilder: (_, i) => ListTile(
                title: Text(products[i].name),
                subtitle: Text('\$${(double.tryParse(products[i].price ?? '0') ?? 0).toStringAsFixed(2)}'),
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select a supplier'), backgroundColor: Colors.red));
      return;
    }
    setState(() => _isSaving = true);

    final request = CreatePurchaseOrderRequest(
      supplierId: _selectedSupplierId!,
      notes: _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Purchase order created')));
      context.pop();
    } else if (result is PurchasingFailure && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text((result as PurchasingFailure).error.message), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('New Purchase Order')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Supplier dropdown
            DropdownButtonFormField<String>(
              value: _selectedSupplierId,
              decoration: const InputDecoration(labelText: 'Supplier *', border: OutlineInputBorder()),
              items: _suppliers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.companyName))).toList(),
              onChanged: (v) {
                final s = _suppliers.firstWhere((s) => s.id == v);
                setState(() { _selectedSupplierId = v; _selectedSupplierName = s.companyName; });
              },
              validator: (v) => v == null ? 'Required' : null,
            ),
            const SizedBox(height: 16),

            // Items
            Row(
              children: [
                Text('Items', style: theme.textTheme.titleSmall),
                const Spacer(),
                TextButton.icon(onPressed: _addItem, icon: const Icon(Icons.add, size: 18), label: const Text('Add Item')),
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
                            decoration: const InputDecoration(labelText: 'Product', border: OutlineInputBorder(), isDense: true),
                            readOnly: true,
                            onTap: () => _selectProduct(i),
                            validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                          ),
                        ),
                        IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() => _items.removeAt(i))),
                      ]),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(
                          child: TextFormField(
                            controller: item.qtyCtrl,
                            decoration: const InputDecoration(labelText: 'Qty', border: OutlineInputBorder(), isDense: true),
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextFormField(
                            controller: item.priceCtrl,
                            decoration: const InputDecoration(labelText: 'Unit Cost', border: OutlineInputBorder(), isDense: true),
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
            TextFormField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder()), maxLines: 2),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Create Purchase Order'),
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
