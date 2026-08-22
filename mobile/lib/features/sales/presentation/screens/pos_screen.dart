import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/customers/domain/customer_models.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_colors.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/services/receipt_print_service.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/presentation/screens/pos_workspace.dart';
import 'package:stockflow/features/sales/presentation/widgets/pos_customer_picker.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/currency/money.dart';

// ──────────────────────────────────
// POS Screen — Responsive Terminal
// ──────────────────────────────────
/// Desktop/tablet: full two-panel cashier workspace (catalog + cart).
/// Narrow screens (< 600px): compact mobile terminal with bottom sheet.
class PosScreen extends ConsumerWidget {
  const PosScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= AppSpacing.breakpointTablet) {
      return const PosWorkspace();
    }
    return const _MobilePosScreen();
  }
}

// ──────────────────────────────────
// Mobile POS — Compact Terminal
// ──────────────────────────────────
class _MobilePosScreen extends ConsumerStatefulWidget {
  const _MobilePosScreen();

  @override
  ConsumerState<_MobilePosScreen> createState() => _MobilePosScreenState();
}

class _MobilePosScreenState extends ConsumerState<_MobilePosScreen> {
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
    final cartCurrency = ref.read(cartProvider).currency;
    final price = product.price ?? '0';
    final costPrice = product.costPrice ?? '0';
    ref.read(cartProvider.notifier).addItem(CartItem(
          productId: product.id,
          productName: product.name,
          productSku: product.sku ?? '',
          barcode: product.barcode,
          quantity: 1,
          unitPrice:
              Money.tryParse(price, cartCurrency) ?? Money.zero(cartCurrency),
          costPrice: Money.tryParse(costPrice, cartCurrency) ??
              Money.zero(cartCurrency),
        ));
    _searchController.clear();
    setState(() {
      _searchResults = [];
      _isSearching = false;
    });
  }

  void _showCheckout() {
    ref.read(cartProvider.notifier).syncFromCurrency();
    final cart = ref.read(cartProvider);
    final error = ref.read(cartProvider.notifier).validate(context.l10n);
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
        title: Text(context.l10n.posPointOfSale),
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
              itemBuilder: (_) => _warehouses
                  .map((w) => PopupMenuItem(
                        value: w.id,
                        child: Text(w.name),
                      ))
                  .toList(),
            ),
          if (cart.itemCount > 0)
            TextButton.icon(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              icon: const Icon(Icons.delete_sweep_outlined, size: 18),
              label: Text(context.l10n.posClear),
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
                hintText: context.l10n.posMobileSearchHint,
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
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
                    title: Text(product.name,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${product.sku ?? ''}  •  ${context.money(price)}',
                      style: theme.textTheme.bodySmall,
                    ),
                    trailing: FilledButton.tonal(
                      onPressed: () => _addToCart(product),
                      child: Text(context.l10n.posAdd),
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
                        Text(context.l10n.posCartEmpty,
                            style: theme.textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text(context.l10n.posMobileCartEmptyHint,
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
                            context.l10n.posItemsCount(cart.itemCount),
                            style: theme.textTheme.bodySmall,
                          ),
                          Text(
                            context.money(cart.total),
                            style: theme.textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: _showCheckout,
                      icon: const Icon(Icons.payment),
                      label: Text(context.l10n.posCheckout),
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
  final ValueChanged<Money> onDiscountChanged;
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
                    '${context.money(item.unitPrice)} × ${item.quantity}',
                    style: theme.textTheme.bodyMedium,
                  ),
                  if (item.effectiveDiscount.isPositive)
                    Text(
                      context.l10n.posDiscountLine(
                          item.effectiveDiscount.toDecimalString()),
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
                  context.money(item.total),
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
  Customer? _customer;

  @override
  void initState() {
    super.initState();
    _cashController.text = widget.cart.total.toDecimalString();
  }

  @override
  void dispose() {
    _cashController.dispose();
    _cardController.dispose();
    _qrController.dispose();
    super.dispose();
  }

  Money _money(String text) =>
      Money.tryParse(text, widget.cart.currency) ??
      Money.zero(widget.cart.currency);

  Money get _totalPaid =>
      _money(_cashController.text) +
      _money(_cardController.text) +
      _money(_qrController.text);

  bool get _isAmountValid => _totalPaid >= widget.cart.total;

  Future<void> _pickCustomer() async {
    final customer = await showPosCustomerPicker(context);
    if (customer != null && mounted) {
      setState(() => _customer = customer);
      ref
          .read(cartProvider.notifier)
          .setCustomer(customer.id, customer.displayName);
    }
  }

  Future<void> _processCheckout() async {
    setState(() => _isProcessing = true);

    final payments = <CreatePayment>[];
    final cash = _money(_cashController.text);
    final card = _money(_cardController.text);
    final qr = _money(_qrController.text);

    if (cash.isPositive) {
      payments.add(
        CreatePayment(method: 'CASH', amount: cash.toApiNumber().toDouble()),
      );
    }
    if (card.isPositive) {
      payments.add(
        CreatePayment(method: 'CARD', amount: card.toApiNumber().toDouble()),
      );
    }
    if (qr.isPositive) {
      payments.add(
        CreatePayment(method: 'QR', amount: qr.toApiNumber().toDouble()),
      );
    }

    if (payments.isEmpty) {
      payments.add(CreatePayment(
          method: 'CASH', amount: widget.cart.total.toApiNumber().toDouble()));
    }

    if (widget.selectedWarehouseId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.posPleaseSelectWarehouse),
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
      // The sheet may have picked a customer after [widget.cart] was snapshotted.
      customerId: _customer?.id ?? widget.cart.customerId,
      notes: widget.cart.notes,
      currency: widget.cart.currency,
    );

    if (sale != null && mounted) {
      final completed = await posNotifier.completeSale(sale.id);
      if (completed != null && mounted) {
        setState(() => _isProcessing = false);
        // Capture product names BEFORE onComplete() clears the cart — the
        // backend SaleItem carries only productId, so the receipt needs the
        // cart mapping to render real product names instead of IDs.
        final productNames = {
          for (final i in widget.cart.items) i.productId: i.productName,
        };
        widget.onComplete();
        // Show receipt
        if (mounted) {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ReceiptScreen(
                sale: completed,
                productNames: productNames,
              ),
            ),
          );
        }
      } else if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.posFailedCompleteSaleShort),
            backgroundColor: Colors.red,
          ),
        );
      }
    } else if (mounted) {
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.posFailedCreateSaleShort),
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
              width: 40,
              height: 4,
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
                  Text(context.l10n.posCheckout,
                      style: theme.textTheme.titleLarge),
                  const Spacer(),
                  Text(
                    context.money(widget.cart.total),
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
                  // Customer
                  Text(context.l10n.posCustomer,
                      style: theme.textTheme.titleSmall),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    key: const Key('pos_mobile_customer_button'),
                    onPressed: _pickCustomer,
                    icon: const Icon(Icons.person_outline, size: 18),
                    label: Text(
                      _customer?.displayName ?? context.l10n.posWalkInCustomer,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Payment method chips
                  Text(context.l10n.posPaymentMethod,
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
                  if (_paymentMethod == 'CASH' ||
                      _paymentMethod == 'MIXED') ...[
                    _amountField(context.l10n.posCashAmount, _cashController,
                        Icons.money),
                    const SizedBox(height: 8),
                  ],
                  if (_paymentMethod == 'CARD' ||
                      _paymentMethod == 'MIXED') ...[
                    _amountField(context.l10n.posCardAmount, _cardController,
                        Icons.credit_card),
                    const SizedBox(height: 8),
                  ],
                  if (_paymentMethod == 'QR' || _paymentMethod == 'MIXED') ...[
                    _amountField(
                        context.l10n.posQrAmount, _qrController, Icons.qr_code),
                    const SizedBox(height: 8),
                  ],

                  if (_paymentMethod == 'MIXED') ...[
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            _splitRow(context.l10n.posTotal, widget.cart.total),
                            _splitRow(context.l10n.posPaid, _totalPaid,
                                color:
                                    _isAmountValid ? Colors.green : Colors.red),
                            if (!change.isNegative)
                              _splitRow(context.l10n.posChange, change,
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
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle),
                    label: Text(_isProcessing
                        ? context.l10n.posProcessing
                        : !change.isNegative
                            ? context.l10n
                                .posCompleteSale(_totalPaid.toDecimalString())
                            : context.l10n.posInsufficientPaymentCaps),
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

  String _chipLabel(String method) {
    final l10n = context.l10n;
    switch (method) {
      case 'CASH':
        return l10n.posPaymentCash;
      case 'CARD':
        return l10n.posPaymentCard;
      case 'QR':
        return l10n.posPaymentQr;
      case 'MIXED':
        return l10n.posPaymentSplit;
      default:
        return method;
    }
  }

  Widget _paymentChip(String method, IconData icon) {
    final isSelected = _paymentMethod == method ||
        (_paymentMethod == 'MIXED' && method == 'MIXED') ||
        (_paymentMethod == 'MIXED' && method == 'CASH');
    return FilterChip(
      selected: isSelected,
      avatar: Icon(icon, size: 18),
      label: Text(_chipLabel(method)),
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

  Widget _amountField(
      String label, TextEditingController controller, IconData icon) {
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

  Widget _splitRow(String label, dynamic amount, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: color)),
          Text(context.money(amount),
              style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}

// ──────────────────────────────────
// Receipt Screen
// ──────────────────────────────────
class ReceiptScreen extends ConsumerStatefulWidget {
  final Sale sale;

  /// productId → display name mapping captured from the POS cart before it
  /// was cleared (the backend SaleItem carries no product name).
  final Map<String, String>? productNames;

  const ReceiptScreen({super.key, required this.sale, this.productNames});

  @override
  ConsumerState<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends ConsumerState<ReceiptScreen> {
  bool _isPdfExporting = false;

  Future<void> _downloadPdf() async {
    final sale = widget.sale;
    setState(() => _isPdfExporting = true);
    try {
      final bytes = await ReceiptExport.buildPdf(sale,
          productNames: widget.productNames,
          l10n: context.l10n,
          currency: sale.currency);
      await ReceiptPrintService.downloadPdf(bytes, '${sale.saleNumber}.pdf');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.posReceiptPdfDownloaded)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.posPdfExportFailed(e.toString())),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPdfExporting = false);
    }
  }

  Future<void> _print() async {
    try {
      await ReceiptPrintService.printReceipt(
        html: ReceiptExport.buildHtml(widget.sale,
            productNames: widget.productNames,
            l10n: context.l10n,
            currency: widget.sale.currency),
        pdf: () => ReceiptExport.buildPdf(widget.sale,
            productNames: widget.productNames,
            l10n: context.l10n,
            currency: widget.sale.currency),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.posPrintFailed(e.toString())),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sale = widget.sale;
    final total = double.tryParse(sale.total) ?? 0;
    final paid = double.tryParse(sale.paidAmount) ?? 0;
    final change = double.tryParse(sale.changeAmount) ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.posReceipt),
        actions: [
          IconButton(
            icon: _isPdfExporting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
            tooltip: context.l10n.posDownloadPdf,
            onPressed: _isPdfExporting ? null : _downloadPdf,
          ),
          IconButton(
            icon: const Icon(Icons.print),
            tooltip: context.l10n.posPrint,
            onPressed: _print,
          ),
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
                Icon(Icons.receipt_long,
                    size: 48, color: theme.colorScheme.primary),
                const SizedBox(height: 8),
                Text(sale.saleNumber, style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                  context.l10n.posStatus(
                    StatusBadge.statusLabel(sale.status, context.l10n),
                  ),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Color(StockFlowColors.statusColor(sale.status)),
                  ),
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
                          child: Text(
                              '${item.productId.substring(0, 8)} × ${item.quantity}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                        ),
                        Text(context.money(itemTotal),
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  );
                }),
                const Divider(),

                // Totals
                _receiptRow(context.l10n.posSubtotal,
                    double.tryParse(sale.subtotal) ?? 0, theme),
                if ((double.tryParse(sale.discount) ?? 0) > 0)
                  _receiptRow(
                    context.l10n.posDiscount,
                    -(double.tryParse(sale.discount) ?? 0),
                    theme,
                    color: Colors.orange,
                  ),
                _receiptRow(context.l10n.posTotal, total, theme, bold: true),
                const Divider(),

                // Payments
                Text(context.l10n.posPayments,
                    style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                ...sale.payments.map((p) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_paymentMethodLabel(p.method, context.l10n)),
                          Text(context.money(double.tryParse(p.amount) ?? 0)),
                        ],
                      ),
                    )),
                const Divider(),
                _receiptRow(context.l10n.posPaid, paid, theme, bold: true),
                if (change > 0)
                  _receiptRow(context.l10n.posChange, change, theme,
                      color: Colors.orange),
                const SizedBox(height: 24),

                // Footer
                Text(context.l10n.posThankYou,
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

  /// Payment method display label — EN keeps the backend value byte-for-byte.
  String _paymentMethodLabel(String method, AppLocalizations l10n) {
    switch (method) {
      case 'CASH':
        return l10n.posPaymentCash;
      case 'CARD':
        return l10n.posPaymentCard;
      case 'QR':
        return l10n.posPaymentQr;
      default:
        return method;
    }
  }

  Widget _receiptRow(String label, double amount, ThemeData theme,
      {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: bold
                  ? theme.textTheme.titleSmall
                  : theme.textTheme.bodyMedium),
          Text(
            context.money(amount),
            style:
                (bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium)
                    ?.copyWith(
                        fontWeight: bold ? FontWeight.bold : null,
                        color: color),
          ),
        ],
      ),
    );
  }
}
