import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/core/theme/app_colors.dart';

// ──────────────────────────────────
// POS Screen — Main Sales Terminal
// ──────────────────────────────────
class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final _searchController = TextEditingController();
  List<Product> _searchResults = [];
  bool _isSearching = false;
  String? _selectedWarehouseId;
  String _selectedWarehouseName = 'Select warehouse...';
  List<Warehouse> _warehouses = [];

  @override
  void initState() {
    super.initState();
    _loadWarehouses();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadWarehouses() async {
    final repo = ref.read(inventoryRepositoryProvider);
    final result = await repo.getWarehouses();
    if (result is InvSuccess<List<Warehouse>>) {
      final warehouses = result.data;
      setState(() {
        _warehouses = warehouses;
        if (warehouses.isNotEmpty) {
          _selectedWarehouseId = warehouses.first.id;
          _selectedWarehouseName = warehouses.first.name;
        }
      });
    }
  }

  Future<void> _searchProducts(String query) async {
    if (query.isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }
    setState(() => _isSearching = true);
    final repo = ref.read(productsRepositoryProvider);
    final result = await repo.list(search: query, limit: 10);
    if (result is ProductsSuccess<ProductListResponse>) {
      setState(() {
        _searchResults = result.data.items;
        _isSearching = false;
      });
    } else {
      setState(() => _isSearching = false);
    }
  }

  void _addToCart(Product product) {
    final price = double.tryParse(product.price ?? '0') ?? 0;
    final costPrice = double.tryParse(product.costPrice ?? '0') ?? 0;
    ref.read(cartProvider.notifier).addItem(CartItem(
      productId: product.id,
      productName: product.name,
      productSku: product.sku ?? '',
      barcode: product.barcode,
      quantity: 1,
      unitPrice: price,
      costPrice: costPrice,
    ));
    _searchController.clear();
    setState(() {
      _searchResults = [];
      _isSearching = false;
    });
  }

  void _showCheckout() {
    final cart = ref.read(cartProvider);
    final error = ref.read(cartProvider.notifier).validate();
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: Colors.red),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => _CheckoutSheet(
        cart: cart,
        selectedWarehouseId: _selectedWarehouseId,
        onComplete: () {
        Navigator.of(context).pop(); // close modal
        ref.read(cartProvider.notifier).clear();
        setState(() {
          _searchResults = [];
          _isSearching = false;
        });
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cart = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Point of Sale'),
        actions: [
          if (_warehouses.length > 1)
            PopupMenuButton<String>(
              onSelected: (id) {
                final wh = _warehouses.firstWhere((w) => w.id == id);
                setState(() {
                  _selectedWarehouseId = id;
                  _selectedWarehouseName = wh.name;
                });
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.warehouse, size: 18),
                    const SizedBox(width: 4),
                    Text(
                      _selectedWarehouseName.length > 12
                          ? '${_selectedWarehouseName.substring(0, 10)}...'
                          : _selectedWarehouseName,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              itemBuilder: (_) => _warehouses.map((w) => PopupMenuItem(
                value: w.id,
                child: Text(w.name),
              )).toList(),
            ),
          if (cart.itemCount > 0)
            TextButton.icon(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              icon: const Icon(Icons.delete_sweep_outlined, size: 18),
              label: const Text('Clear'),
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Product Search ──
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search products by name, SKU or barcode...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _isSearching
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              _searchProducts('');
                            },
                          )
                        : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              onChanged: _searchProducts,
            ),
          ),

          // ── Search Results ──
          if (_searchResults.isNotEmpty)
            SizedBox(
              height: 200,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: _searchResults.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final product = _searchResults[index];
                  final price = double.tryParse(product.price ?? '0') ?? 0;
                  return ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      backgroundColor: theme.colorScheme.primaryContainer,
                      child: const Icon(Icons.inventory_2, size: 20),
                    ),
                    title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${product.sku ?? ''}  •  \$${price.toStringAsFixed(2)}',
                      style: theme.textTheme.bodySmall,
                    ),
                    trailing: FilledButton.tonal(
                      onPressed: () => _addToCart(product),
                      child: const Text('Add'),
                    ),
                    onTap: () => _addToCart(product),
                  );
                },
              ),
            ),

          // ── Cart Items ──
          Expanded(
            child: cart.items.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_shopping_cart_outlined,
                            size: 64, color: theme.colorScheme.outline),
                        const SizedBox(height: 16),
                        Text('Cart is empty',
                            style: theme.textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text('Search and add products to start',
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(color: theme.colorScheme.outline)),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    itemCount: cart.items.length,
                    itemBuilder: (context, index) {
                      final item = cart.items[index];
                      return _CartItemTile(
                        item: item,
                        onQuantityChanged: (qty) =>
                            ref.read(cartProvider.notifier).updateQuantity(
                                  item.productId,
                                  qty,
                                ),
                        onDiscountChanged: (disc) =>
                            ref.read(cartProvider.notifier).updateDiscount(
                                  item.productId,
                                  disc,
                                ),
                        onRemove: () => ref
                            .read(cartProvider.notifier)
                            .removeItem(item.productId),
                      );
                    },
                  ),
          ),
        ],
      ),

      // ── Bottom Bar ──
      bottomNavigationBar: cart.items.isNotEmpty
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(
                    top: BorderSide(color: theme.colorScheme.outlineVariant)),
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${cart.itemCount} items',
                            style: theme.textTheme.bodySmall,
                          ),
                          Text(
                            '\$${cart.total.toStringAsFixed(2)}',
                            style: theme.textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: _showCheckout,
                      icon: const Icon(Icons.payment),
                      label: const Text('Checkout'),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 32, vertical: 16),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }
}

// ──────────────────────────────────
// Cart Item Tile
// ──────────────────────────────────
class _CartItemTile extends StatelessWidget {
  final CartItem item;
  final ValueChanged<int> onQuantityChanged;
  final ValueChanged<double> onDiscountChanged;
  final VoidCallback onRemove;

  const _CartItemTile({
    required this.item,
    required this.onQuantityChanged,
    required this.onDiscountChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.productName,
                      style: theme.textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  Text(item.productSku,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline)),
                  const SizedBox(height: 4),
                  Text(
                    '\$${item.unitPrice.toStringAsFixed(2)} × ${item.quantity}',
                    style: theme.textTheme.bodyMedium,
                  ),
                  if (item.discount > 0)
                    Text(
                      'Discount: -\$${item.discount.toStringAsFixed(2)}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: Colors.orange),
                    ),
                ],
              ),
            ),
            // Quantity controls
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline, size: 20),
                  onPressed: item.quantity > 1
                      ? () => onQuantityChanged(item.quantity - 1)
                      : null,
                ),
                SizedBox(
                  width: 32,
                  child: Text(
                    '${item.quantity}',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, size: 20),
                  onPressed: () => onQuantityChanged(item.quantity + 1),
                ),
              ],
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\$${item.total.toStringAsFixed(2)}',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: onRemove,
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// Checkout Bottom Sheet
// ──────────────────────────────────
class _CheckoutSheet extends ConsumerStatefulWidget {
  final CartState cart;
  final String? selectedWarehouseId;
  final VoidCallback onComplete;
  const _CheckoutSheet({
    required this.cart,
    required this.selectedWarehouseId,
    required this.onComplete,
  });

  @override
  ConsumerState<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends ConsumerState<_CheckoutSheet> {
  final _cashController = TextEditingController();
  final _cardController = TextEditingController();
  final _qrController = TextEditingController();
  String _paymentMethod = 'CASH';
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _cashController.text = widget.cart.total.toStringAsFixed(2);
  }

  @override
  void dispose() {
    _cashController.dispose();
    _cardController.dispose();
    _qrController.dispose();
    super.dispose();
  }

  double get _totalPaid {
    final cash = double.tryParse(_cashController.text) ?? 0;
    final card = double.tryParse(_cardController.text) ?? 0;
    final qr = double.tryParse(_qrController.text) ?? 0;
    return cash + card + qr;
  }

  bool get _isAmountValid => _totalPaid >= widget.cart.total;

  Future<void> _processCheckout() async {
    setState(() => _isProcessing = true);

    final payments = <CreatePayment>[];
    final cash = double.tryParse(_cashController.text) ?? 0;
    final card = double.tryParse(_cardController.text) ?? 0;
    final qr = double.tryParse(_qrController.text) ?? 0;

    if (cash > 0) payments.add(CreatePayment(method: 'CASH', amount: cash));
    if (card > 0) payments.add(CreatePayment(method: 'CARD', amount: card));
    if (qr > 0) payments.add(CreatePayment(method: 'QR', amount: qr));

    if (payments.isEmpty) {
      payments.add(CreatePayment(
          method: 'CASH', amount: widget.cart.total));
    }

    if (widget.selectedWarehouseId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select a warehouse first'),
            backgroundColor: Colors.red,
          ),
        );
      }
      setState(() => _isProcessing = false);
      return;
    }

    final posNotifier = ref.read(posProvider.notifier);
    final sale = await posNotifier.createDraft(
      warehouseId: widget.selectedWarehouseId!,
      cartItems: widget.cart.items,
      payments: payments,
      customerId: widget.cart.customerId,
      notes: widget.cart.notes,
    );

    if (sale != null && mounted) {
      final completed = await posNotifier.completeSale(sale.id);
      if (completed != null && mounted) {
        setState(() => _isProcessing = false);
        widget.onComplete();
        // Show receipt
        if (mounted) {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ReceiptScreen(sale: completed),
            ),
          );
        }
      } else if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to complete sale'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } else if (mounted) {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to create sale'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final change = _totalPaid - widget.cart.total;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text('Checkout',
                      style: theme.textTheme.titleLarge),
                  const Spacer(),
                  Text(
                    '\$${widget.cart.total.toStringAsFixed(2)}',
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Payment method chips
                  Text('Payment Method',
                      style: theme.textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      _paymentChip('CASH', Icons.money),
                      _paymentChip('CARD', Icons.credit_card),
                      _paymentChip('QR', Icons.qr_code),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Split payment inputs
                  if (_paymentMethod == 'CASH' || _paymentMethod == 'MIXED') ...[
                    _amountField('Cash Amount', _cashController, Icons.money),
                    const SizedBox(height: 8),
                  ],
                  if (_paymentMethod == 'CARD' || _paymentMethod == 'MIXED') ...[
                    _amountField('Card Amount', _cardController, Icons.credit_card),
                    const SizedBox(height: 8),
                  ],
                  if (_paymentMethod == 'QR' || _paymentMethod == 'MIXED') ...[
                    _amountField('QR Amount', _qrController, Icons.qr_code),
                    const SizedBox(height: 8),
                  ],

                  if (_paymentMethod == 'MIXED') ...[
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            _splitRow('Total', widget.cart.total),
                            _splitRow('Paid', _totalPaid,
                                color: _isAmountValid ? Colors.green : Colors.red),
                            if (change >= 0)
                              _splitRow('Change', change,
                                  color: Colors.orange),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Process button
            Padding(
              padding: const EdgeInsets.all(16),
              child: SafeArea(
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _isProcessing || !_isAmountValid
                        ? null
                        : _processCheckout,
                    icon: _isProcessing
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle),
                    label: Text(_isProcessing
                        ? 'Processing...'
                        : change >= 0
                            ? 'Complete Sale — \$${_totalPaid.toStringAsFixed(2)}'
                            : 'Insufficient Payment'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _paymentChip(String method, IconData icon) {
    final isSelected = _paymentMethod == method ||
        (_paymentMethod == 'MIXED' && method == 'MIXED') ||
        (_paymentMethod == 'MIXED' && method == 'CASH');
    return FilterChip(
      selected: isSelected,
      avatar: Icon(icon, size: 18),
      label: Text(method == 'MIXED' ? 'Split' : method),
      onSelected: (selected) {
        setState(() {
          if (method == 'MIXED') {
            _paymentMethod = selected ? 'MIXED' : 'CASH';
          } else if (selected) {
            _paymentMethod = method;
          }
        });
      },
    );
  }

  Widget _amountField(String label, TextEditingController controller, IconData icon) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      onChanged: (_) => setState(() {}),
    );
  }

  Widget _splitRow(String label, double amount, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: color)),
          Text('\$${amount.toStringAsFixed(2)}',
              style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}

// ──────────────────────────────────
// Receipt Screen
// ──────────────────────────────────
class ReceiptScreen extends ConsumerWidget {
  final Sale sale;
  const ReceiptScreen({super.key, required this.sale});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final total = double.tryParse(sale.total) ?? 0;
    final paid = double.tryParse(sale.paidAmount) ?? 0;
    final change = double.tryParse(sale.changeAmount) ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Receipt'),
        actions: [
          IconButton(icon: const Icon(Icons.share), onPressed: () {}),
          IconButton(icon: const Icon(Icons.print), onPressed: () {}),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              children: [
                // Receipt header
                Icon(Icons.receipt_long, size: 48, color: theme.colorScheme.primary),
                const SizedBox(height: 8),
                Text(sale.saleNumber,
                    style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                  'Status: ${sale.status}',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: Color(StockFlowColors.statusColor(sale.status))),
                ),
                const SizedBox(height: 24),

                // Items
                ...sale.items.map((item) {
                  final itemTotal = double.tryParse(item.total) ?? 0;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('${item.productId.substring(0, 8)} × ${item.quantity}',
                              maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                        Text('\$${itemTotal.toStringAsFixed(2)}',
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  );
                }),
                const Divider(),

                // Totals
                _receiptRow('Subtotal', double.tryParse(sale.subtotal) ?? 0, theme),
                if ((double.tryParse(sale.discount) ?? 0) > 0)
                  _receiptRow('Discount', -(double.tryParse(sale.discount) ?? 0), theme,
                      color: Colors.orange),
                _receiptRow('Total', total, theme, bold: true),
                const Divider(),

                // Payments
                Text('Payments', style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                ...sale.payments.map((p) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(p.method),
                      Text('\$${(double.tryParse(p.amount) ?? 0).toStringAsFixed(2)}'),
                    ],
                  ),
                )),
                const Divider(),
                _receiptRow('Paid', paid, theme, bold: true),
                if (change > 0)
                  _receiptRow('Change', change, theme,
                      color: Colors.orange),
                const SizedBox(height: 24),

                // Footer
                Text('Thank you for your purchase!',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline)),
                const SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _receiptRow(String label, double amount, ThemeData theme,
      {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium),
          Text(
            '\$${amount.toStringAsFixed(2)}',
            style: (bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium)
                ?.copyWith(fontWeight: bold ? FontWeight.bold : null,
                    color: color),
          ),
        ],
      ),
    );
  }
}
