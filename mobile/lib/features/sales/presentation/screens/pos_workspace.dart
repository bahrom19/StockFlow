import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:qr_flutter/qr_flutter.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/services/receipt_print_service.dart';
import 'package:stockflow/core/widgets/app_dialog.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/inventory/data/repositories/inventory_repository.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/held_sales_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/pos_catalog_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/sales/presentation/widgets/pos_cart_panel.dart';
import 'package:stockflow/features/sales/presentation/widgets/pos_catalog_panel.dart';
import 'package:stockflow/features/sales/presentation/widgets/pos_customer_picker.dart';
import 'package:stockflow/features/sales/presentation/widgets/pos_shift_panel.dart';

/// Desktop/tablet POS workspace — the cashier's full-screen terminal.
///
/// Left (70%): product catalog with debounced search, categories and a
/// keyboard-navigable table. Right (30%): cart, totals, split payment
/// (cash / card / QR) and the Complete Sale button.
///
/// Hotkeys:
///  - F2 focus search · F4 focus payment · F8 complete sale
///  - ESC clear search · Enter add selected · ↑↓ navigate products
class PosWorkspace extends ConsumerStatefulWidget {
  const PosWorkspace({super.key});

  @override
  ConsumerState<PosWorkspace> createState() => _PosWorkspaceState();
}

class _PosWorkspaceState extends ConsumerState<PosWorkspace> {
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();
  final _cashController = TextEditingController();
  final _cardController = TextEditingController();
  final _qrController = TextEditingController();
  final _paymentFocus = FocusNode();
  final _focusNode = FocusNode(debugLabel: 'PosWorkspace');

  bool _isCompleting = false;
  String? _selectedWarehouseId;
  String _selectedWarehouseName = 'Select warehouse…';
  List<Warehouse> _warehouses = [];

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_handleGlobalKeyEvent);
    _loadWarehouses();
    // Prime the catalog cache early so the first keystroke is instant.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(posCatalogProvider.notifier).init();
    });
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleGlobalKeyEvent);
    _searchController.dispose();
    _searchFocus.dispose();
    _cashController.dispose();
    _cardController.dispose();
    _qrController.dispose();
    _paymentFocus.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  // ──────────────────────────────────
  // Warehouses
  // ──────────────────────────────────
  Future<void> _loadWarehouses() async {
    final repo = ref.read(inventoryRepositoryProvider);
    final result = await repo.getWarehouses();
    if (!mounted) return;
    if (result is InvSuccess<List<Warehouse>>) {
      setState(() {
        _warehouses = result.data;
        if (_warehouses.isNotEmpty) {
          _selectedWarehouseId = _warehouses.first.id;
          _selectedWarehouseName = _warehouses.first.name;
        }
      });
      // Load the open shift for the default warehouse.
      if (_selectedWarehouseId != null) {
        ref.read(cashShiftProvider.notifier).loadShift(_selectedWarehouseId!);
      }
    }
  }

  // ──────────────────────────────────
  // Cash shift actions
  // ──────────────────────────────────
  Future<void> _openShift() async {
    final warehouseId = _selectedWarehouseId;
    if (warehouseId == null) {
      _showSnack('Select a warehouse first');
      return;
    }
    final openingBalance = await _promptAmount(
      title: 'Open Cash Shift',
      message: 'Enter the opening balance in the drawer:',
      confirmLabel: 'Open shift',
      hint: 'Opening balance',
    );
    if (openingBalance == null || !mounted) return;
    final shift = await ref
        .read(cashShiftProvider.notifier)
        .openShift(openingBalance);
    if (shift != null && mounted) {
      _showSnack('Shift opened', isError: false);
    } else if (mounted) {
      _showSnack('Could not open shift. Check your permissions.');
    }
  }

  Future<void> _xReport() async {
    final warehouseId = _selectedWarehouseId;
    if (warehouseId == null) {
      _showSnack('Select a warehouse first');
      return;
    }
    final shift = await ref.read(cashShiftProvider.notifier).refresh();
    if (shift == null && mounted) {
      _showSnack('No open shift to report');
      return;
    }
    if (!mounted || shift == null) return;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: ShiftReportView(shift: shift),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
          TextButton.icon(
            onPressed: () => _downloadShiftPdf(shift),
            icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
            label: const Text('PDF'),
          ),
        ],
      ),
    );
  }

  Future<void> _closeShift() async {
    final warehouseId = _selectedWarehouseId;
    if (warehouseId == null) return;
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Close Cash Shift',
      message: 'Close the current shift? A Z report will be generated.',
      confirmText: 'Close shift',
    );
    if (!confirmed || !mounted) return;

    final actual = await _promptAmount(
      title: 'Closing balance',
      message: 'Optional: enter the actual cash in the drawer. '
          'Leave empty to use the calculated balance.',
      confirmLabel: 'Close',
      hint: 'Actual closing balance',
      allowEmpty: true,
    );
    if (!mounted) return;

    final closed = await ref.read(cashShiftProvider.notifier).closeShift(
          actualClosingBalance: actual,
        );
    if (closed != null && mounted) {
      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: ShiftReportView(
            shift: closed,
            isZ: true,
            closedAt: closed.closedAt ?? DateTime.now(),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Close'),
            ),
            TextButton.icon(
              onPressed: () => _downloadShiftPdf(closed, isZ: true),
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
              label: const Text('PDF'),
            ),
          ],
        ),
      );
    } else if (mounted) {
      _showSnack('Could not close shift');
    }
  }

  Future<void> _cashInOut({required bool isIn}) async {
    final warehouseId = _selectedWarehouseId;
    if (warehouseId == null) return;
    final amount = await _promptAmount(
      title: isIn ? 'Cash In' : 'Cash Out',
      message: isIn
          ? 'Enter the amount being added to the drawer:'
          : 'Enter the amount being removed from the drawer:',
      confirmLabel: isIn ? 'Cash in' : 'Cash out',
      hint: 'Amount',
    );
    if (amount == null || !mounted) return;
    final shift = isIn
        ? await ref.read(cashShiftProvider.notifier).cashIn(amount)
        : await ref.read(cashShiftProvider.notifier).cashOut(amount);
    if (shift != null && mounted) {
      _showSnack(isIn ? 'Cash in recorded' : 'Cash out recorded',
          isError: false);
    } else if (mounted) {
      _showSnack('Operation failed');
    }
  }

  Future<void> _downloadShiftPdf(CashShift shift, {bool isZ = false}) async {
    try {
      final doc = pw.Document();
      doc.addPage(pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text(isZ ? 'Z Report' : 'X Report',
                  style: pw.TextStyle(
                      fontSize: 18, fontWeight: pw.FontWeight.bold)),
            ),
            pw.SizedBox(height: 4),
            pw.Center(
              child: pw.Text(Formatters.dateTime(shift.openedAt),
                  style: const pw.TextStyle(fontSize: 10)),
            ),
            pw.Divider(),
            pw.Text('Warehouse: $_selectedWarehouseName',
                style: const pw.TextStyle(fontSize: 10)),
            pw.Text('Status: ${shift.status}',
                style: const pw.TextStyle(fontSize: 10)),
            pw.SizedBox(height: 8),
            _pdfAmountRow('Opening balance', shift.openingBalanceValue),
            _pdfAmountRow('Cash sales', shift.cashSalesValue),
            _pdfAmountRow('Card sales', shift.cardSalesValue),
            _pdfAmountRow('QR sales', shift.qrSalesValue),
            _pdfAmountRow('Bank transfer sales', shift.bankTransferSalesValue),
            _pdfAmountRow('Mobile wallet sales', shift.mobileWalletSalesValue),
            _pdfAmountRow('Total sales', shift.totalSalesValue, bold: true),
            _pdfAmountRow('Cash in', shift.cashInValue),
            _pdfAmountRow('Cash out', shift.cashOutValue),
            if (isZ) ...[
              pw.Divider(),
              _pdfAmountRow('Expected closing', shift.expectedClosingValue,
                  bold: true),
              _pdfAmountRow('Difference', shift.differenceValue, bold: true),
            ],
          ],
        ),
      ));
      final bytes = await doc.save();
      await ReceiptPrintService.downloadPdf(
          bytes, '${isZ ? 'Z' : 'X'}_report_${shift.id.substring(0, 6)}.pdf');
      _showSnack('Report downloaded', isError: false);
    } catch (e) {
      _showSnack('PDF export failed: $e');
    }
  }

  pw.Widget _pdfAmountRow(String label, double amount, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label,
              style: pw.TextStyle(
                  fontSize: 11,
                  fontWeight:
                      bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
          pw.Text(amount.toStringAsFixed(2),
              style: pw.TextStyle(
                  fontSize: 11,
                  fontWeight:
                      bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
        ],
      ),
    );
  }

  /// Shows a small amount prompt dialog; returns null when cancelled.
  Future<double?> _promptAmount({
    required String title,
    required String message,
    required String confirmLabel,
    required String hint,
    bool allowEmpty = false,
  }) async {
    final result = await showDialog<double>(
      context: context,
      builder: (ctx) => _AmountPromptDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        hint: hint,
        allowEmpty: allowEmpty,
      ),
    );
    if (result == -1.0) return null; // allowEmpty sentinel
    return result;
  }

  // ──────────────────────────────────
  // Hold sale
  // ──────────────────────────────────
  Future<void> _holdSale() async {
    final cart = ref.read(cartProvider);
    if (cart.items.isEmpty) {
      _showSnack('Nothing to hold — cart is empty');
      return;
    }
    await ref.read(heldSalesProvider.notifier).hold(cart);
    ref.read(cartProvider.notifier).clear();
    _cashController.clear();
    _cardController.clear();
    _qrController.clear();
    if (mounted) _showSnack('Sale held — resume it with Ctrl+H', isError: false);
  }

  Future<void> _resumeHeld() async {
    await ref.read(heldSalesProvider.notifier).load();
    if (!mounted) return;
    final held = ref.read(heldSalesProvider).held;
    if (held.isEmpty) {
      _showSnack('No held sales');
      return;
    }
    final selected = await showDialog<HeldSale>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Resume held sale'),
        children: [
          for (final h in held)
            SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(h),
              child: Row(
                children: [
                  Icon(Icons.pause_circle_outline, size: 18,
                      color: Theme.of(ctx).colorScheme.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      '${h.label} · ${h.itemCount} items · '
                      '${Formatters.currency(h.total)}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          if (held.isEmpty)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Text('No held sales'),
            ),
        ],
      ),
    );
    if (selected == null || !mounted) return;
    final restored = await ref.read(heldSalesProvider.notifier).resume(selected.id);
    if (restored == null || !mounted) return;
    final notifier = ref.read(cartProvider.notifier);
    notifier.clear();
    for (final item in restored.items) {
      notifier.addItem(item);
    }
    if (restored.customerId != null) {
      notifier.setCustomer(restored.customerId, restored.customerName);
    }
    if (mounted) _showSnack('Sale resumed', isError: false);
  }

  Future<void> _pickWarehouse() async {
    final selected = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Select warehouse'),
        children: [
          for (final w in _warehouses)
            SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(w.id),
              child: Row(
                children: [
                  Icon(
                    w.isDefault
                        ? Icons.star_rounded
                        : Icons.warehouse_outlined,
                    size: 18,
                    color: Theme.of(ctx).colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      '${w.name} (${w.code})',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          if (_warehouses.isEmpty)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Text('No warehouses yet. Create one in Settings.'),
            ),
        ],
      ),
    );
    if (selected != null && mounted) {
      final wh = _warehouses.firstWhere((w) => w.id == selected);
      setState(() {
        _selectedWarehouseId = selected;
        _selectedWarehouseName = wh.name;
      });
      ref.read(cashShiftProvider.notifier).loadShift(selected);
    }
  }

  // ──────────────────────────────────
  // Cart / catalog actions
  // ──────────────────────────────────
  void _addSelected() {
    final product = ref.read(posCatalogProvider).selected;
    if (product != null) _addProduct(product);
  }

  /// Enter / barcode scanner submit: waits for the debounced query to settle,
  /// then adds the exact barcode/SKU match if any, otherwise the selected row.
  Future<void> _submitSearch() async {
    final query = _searchController.text.trim();
    final notifier = ref.read(posCatalogProvider.notifier);
    if (query.isNotEmpty) {
      await notifier.searchNow(query);
      final state = ref.read(posCatalogProvider);
      final exact = state.products.where((p) {
        final bc = (p.barcode ?? '').trim().toLowerCase();
        final sku = (p.sku ?? '').trim().toLowerCase();
        final q = query.toLowerCase();
        return (bc.isNotEmpty && bc == q) || (sku.isNotEmpty && sku == q);
      }).toList();
      if (exact.isNotEmpty) {
        _addProduct(exact.first);
        return;
      }
    }
    _addSelected();
  }

  Future<void> _pickCustomer() async {
    final customer = await showPosCustomerPicker(context);
    if (customer != null && mounted) {
      ref
          .read(cartProvider.notifier)
          .setCustomer(customer.id, customer.displayName);
      _showSnack('Customer: ${customer.displayName}', isError: false);
    }
  }

  void _addProduct(Product product) {
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
  }

  void _moveSelection(int delta) {
    ref.read(posCatalogProvider.notifier).moveSelection(delta);
  }

  void _clearSearch() {
    _searchController.clear();
    ref.read(posCatalogProvider.notifier).searchNow('');
    _searchFocus.requestFocus();
  }

  // ──────────────────────────────────
  // Complete sale
  // ──────────────────────────────────
  Future<void> _completeSale() async {
    if (_isCompleting) return;

    final cart = ref.read(cartProvider);
    final validationError = ref.read(cartProvider.notifier).validate();
    if (validationError != null) {
      _showSnack(validationError);
      return;
    }
    if (_selectedWarehouseId == null) {
      _showSnack('Select a warehouse before completing the sale');
      return;
    }

    final cash = double.tryParse(_cashController.text) ?? 0;
    final card = double.tryParse(_cardController.text) ?? 0;
    final qr = double.tryParse(_qrController.text) ?? 0;
    final totalPaid = cash + card + qr;

    if (totalPaid < cart.total - 0.005) {
      _showSnack('Insufficient payment — needs '
          '${Formatters.currency(cart.total)}');
      _paymentFocus.requestFocus();
      return;
    }

    final payments = <CreatePayment>[];
    if (cash > 0) payments.add(CreatePayment(method: 'CASH', amount: cash));
    if (card > 0) payments.add(CreatePayment(method: 'CARD', amount: card));
    if (qr > 0) payments.add(CreatePayment(method: 'QR', amount: qr));
    if (payments.isEmpty) {
      payments.add(CreatePayment(method: 'CASH', amount: cart.total));
    }

    setState(() => _isCompleting = true);
    final posNotifier = ref.read(posProvider.notifier);

    final sale = await posNotifier.createDraft(
      warehouseId: _selectedWarehouseId!,
      cartItems: cart.items,
      payments: payments,
      customerId: cart.customerId,
      notes: cart.notes,
    );

    if (sale == null) {
      if (mounted) setState(() => _isCompleting = false);
      _showSnack('Failed to create sale. Please try again.');
      return;
    }

    final completed = await posNotifier.completeSale(sale.id);
    if (completed == null) {
      if (mounted) setState(() => _isCompleting = false);
      _showSnack('Failed to complete sale. Please try again.');
      return;
    }

    if (!mounted) return;
    setState(() => _isCompleting = false);

    // ── Success housekeeping: capture receipt context BEFORE clearing the
    //    cart (product names live in CartItem, not in the backend SaleItem).
    final productNames = {
      for (final i in cart.items) i.productId: i.productName,
    };
    final cashierName = ref.read(currentUserProvider)?.fullName;

    ref.read(cartProvider.notifier).clear();
    _cashController.clear();
    _cardController.clear();
    _qrController.clear();
    ref.read(posCatalogProvider.notifier).resetToDefaults();
    ref.read(dashboardProvider.notifier).refresh();
    ref.read(saleListProvider.notifier).refresh();
    ref.read(inventoryListProvider.notifier).refresh();
    _showReceipt(
      completed,
      productNames: productNames,
      cashierName: cashierName,
      warehouseName: _selectedWarehouseName,
    );
  }

  /// Post-sale receipt dialog: full receipt preview + Print / Download PDF.
  void _showReceipt(
    Sale sale, {
    Map<String, String>? productNames,
    String? cashierName,
    String? warehouseName,
  }) {
    final theme = Theme.of(context);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.check_circle, size: 44, color: Color(0xFF0F9D58)),
        title: const Text('Sale completed'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Text(sale.saleNumber,
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800)),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Center(
                  child: Text(
                    Formatters.dateTime(sale.createdAt),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                if ((cashierName?.isNotEmpty ?? false) ||
                    (warehouseName?.isNotEmpty ?? false)) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Center(
                    child: Text(
                      [
                        if (cashierName?.isNotEmpty ?? false)
                          'Cashier: $cashierName',
                        if (warehouseName?.isNotEmpty ?? false)
                          'Warehouse: $warehouseName',
                      ].join(' · '),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
                const Divider(height: AppSpacing.md),
                // Items (names mapped from the local cart)
                for (final item in sale.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _receiptItemName(item, productNames),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium,
                          ),
                        ),
                        Text('×${item.quantity}',
                            style: theme.textTheme.bodyMedium),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          '\$${(double.tryParse(item.total) ?? 0).toStringAsFixed(2)}',
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                const Divider(height: AppSpacing.md),
                _receiptRow('Subtotal', double.tryParse(sale.subtotal) ?? 0),
                if ((double.tryParse(sale.discount) ?? 0) > 0)
                  _receiptRow('Discount',
                      -(double.tryParse(sale.discount) ?? 0)),
                _receiptRow('Tax', double.tryParse(sale.tax) ?? 0),
                _receiptRow('Total', double.tryParse(sale.total) ?? 0,
                    bold: true),
                const Divider(height: AppSpacing.md),
                for (final p in sale.payments)
                  _receiptRow(
                    p.method,
                    double.tryParse(p.amount) ?? 0,
                  ),
                _receiptRow('Paid', double.tryParse(sale.paidAmount) ?? 0,
                    bold: true),
                if ((double.tryParse(sale.changeAmount) ?? 0) > 0)
                  _receiptRow('Change',
                      double.tryParse(sale.changeAmount) ?? 0),
                const SizedBox(height: AppSpacing.sm),
                // QR code — machine-readable receipt.
                Center(
                  child: Column(
                    children: [
                      QrImageView(
                        data: ReceiptExport.qrPayload(sale),
                        size: 96,
                        padding: EdgeInsets.zero,
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        sale.saleNumber,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => _downloadReceiptPdf(sale),
            icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
            label: const Text('PDF'),
          ),
          TextButton.icon(
            onPressed: () => _printReceipt(sale),
            icon: const Icon(Icons.print, size: 18),
            label: const Text('Print'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(ctx).pop();
              _searchFocus.requestFocus();
            },
            icon: const Icon(Icons.add_shopping_cart),
            label: const Text('New sale'),
          ),
        ],
      ),
    );
  }

  Widget _receiptRow(String label, double amount, {bool bold = false}) {
    final theme = Theme.of(context);
    final style = theme.textTheme.bodyMedium?.copyWith(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text('\$${amount.toStringAsFixed(2)}', style: style),
        ],
      ),
    );
  }

  Future<void> _downloadReceiptPdf(Sale sale) async {
    try {
      final bytes = await ReceiptExport.buildPdf(sale);
      await ReceiptPrintService.downloadPdf(bytes, '${sale.saleNumber}.pdf');
      _showSnack('Receipt PDF downloaded', isError: false);
    } catch (e) {
      _showSnack('PDF export failed: $e');
    }
  }

  Future<void> _printReceipt(Sale sale) async {
    try {
      await ReceiptPrintService.printHtml(ReceiptExport.buildHtml(sale));
    } catch (e) {
      _showSnack('Print failed: $e');
    }
  }

  String _receiptItemName(SaleItem item, Map<String, String>? productNames) {
    final name = productNames?[item.productId];
    if (name != null && name.isNotEmpty) return name;
    return item.productId.length <= 12
        ? item.productId
        : 'Item ${item.productId.substring(0, 10)}';
  }

  void _showSnack(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError
          ? Theme.of(context).colorScheme.error
          : const Color(0xFF0F9D58),
    ));
  }

  // ──────────────────────────────────
  // Hotkeys (F2 search / F4 customer / F8 payment / F9 complete /
  //             ESC clear / Ctrl+Delete clear cart / Enter add / ↑↓ navigate)
  //
  // Registered on HardwareKeyboard so the shortcuts fire even while the
  // search TextField has focus (a focused TextField consumes Enter/arrows
  // and they would never reach a widget-level Focus.onKeyEvent).
  // ──────────────────────────────────
  bool _handleGlobalKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent || event is KeyRepeatEvent) return false;
    final key = event.logicalKey;
    final searchFocused = _searchFocus.hasFocus;
    final shiftState = ref.read(cashShiftProvider);
    final hasOpenShift =
        shiftState is ShiftLoaded && shiftState.current?.isOpen == true;

    if (key == LogicalKeyboardKey.f2) {
      _searchFocus.requestFocus();
      return true;
    }
    if (key == LogicalKeyboardKey.f4) {
      _pickCustomer();
      return true;
    }
    // F5 — open shift (or report when already open).
    if (key == LogicalKeyboardKey.f5) {
      if (hasOpenShift) {
        _xReport();
      } else {
        _openShift();
      }
      return true;
    }
    // F6 — hold the current sale.
    if (key == LogicalKeyboardKey.f6) {
      _holdSale();
      return true;
    }
    // F7 — X report (open shift only).
    if (key == LogicalKeyboardKey.f7 && hasOpenShift) {
      _xReport();
      return true;
    }
    // F10 — close shift (Z report).
    if (key == LogicalKeyboardKey.f10 && hasOpenShift) {
      _closeShift();
      return true;
    }
    // Ctrl+H — resume a held sale.
    if (key == LogicalKeyboardKey.keyH &&
        HardwareKeyboard.instance.isControlPressed) {
      _resumeHeld();
      return true;
    }
    if (key == LogicalKeyboardKey.f8) {
      _paymentFocus.requestFocus();
      return true;
    }
    if (key == LogicalKeyboardKey.f9) {
      _completeSale();
      return true;
    }
    // Ctrl+Delete clears the cart (with confirmation handled by the panel
    // equivalent here: direct clear is guarded by an empty-cart check).
    if (key == LogicalKeyboardKey.delete &&
        HardwareKeyboard.instance.isControlPressed) {
      if (ref.read(cartProvider).items.isNotEmpty) {
        _confirmClearCart();
      }
      return true;
    }
    // ESC clears the search only while the search field is focused;
    // otherwise it falls through so dialogs/fields close normally.
    if (key == LogicalKeyboardKey.escape && searchFocused) {
      _clearSearch();
      return true;
    }
    // ↑↓ navigate the product table while the search field is focused
    // (the cashier's main interaction surface).
    if (searchFocused &&
        (key == LogicalKeyboardKey.arrowDown ||
            key == LogicalKeyboardKey.arrowUp)) {
      _moveSelection(key == LogicalKeyboardKey.arrowDown ? 1 : -1);
      return true;
    }
    // Enter submits the search / barcode scan (adds exact match or selection),
    // then clears the field and re-focuses it for the next scan.
    if (key == LogicalKeyboardKey.enter && searchFocused) {
      _submitSearch().then((_) {
        if (mounted) {
          _searchController.clear();
          _searchFocus.requestFocus();
        }
      });
      return true;
    }
    return false;
  }

  Future<void> _confirmClearCart() async {
    final cart = ref.read(cartProvider);
    if (cart.items.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.delete_sweep_outlined,
            color: Color(0xFFD93025)),
        title: const Text('Clear cart?'),
        content: Text(
          'Remove all ${cart.itemCount} items (${Formatters.currency(cart.total)}) from the cart?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD93025),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Clear cart'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      ref.read(cartProvider.notifier).clear();
      _showSnack('Cart cleared', isError: false);
    }
  }

  // ──────────────────────────────────
  // Layout — catalog (70%) + cart (30%)
  // ──────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cart = ref.watch(cartProvider);

    return Focus(
      focusNode: _focusNode,
      // NOTE: no autofocus here — the search field owns initial focus so the
      // cashier can type immediately and Enter/arrows are handled correctly.
      child: Column(
        children: [
          // ── Toolbar ───────────────────────────
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest
                  .withOpacity(0.4),
              border: Border(
                bottom: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.point_of_sale,
                    size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: AppSpacing.xs),
                Text('Cashier Terminal',
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'F2 search · F4 customer · F8 payment · F9 complete · '
                    'Ctrl+Del clear · Enter add · ESC clear',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                Text(
                  '${cart.itemCount} items · ${Formatters.currency(cart.total)}',
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
          // ── Cash shift strip ───────────────────
          PosShiftPanel(
            warehouseId: _selectedWarehouseId,
            warehouseName: _selectedWarehouseName,
            onOpenShift: _openShift,
            onXReport: _xReport,
            onCloseShift: _closeShift,
            onCashIn: () => _cashInOut(isIn: true),
            onCashOut: () => _cashInOut(isIn: false),
          ),
          // ── Panels ────────────────────────────
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  flex: 7,
                  child: PosCatalogPanel(
                    searchController: _searchController,
                    searchFocus: _searchFocus,
                    onAddSelected: _submitSearch,
                    onAddProduct: _addProduct,
                  ),
                ),
                Container(
                  width: 1,
                  color: theme.colorScheme.outlineVariant,
                ),
                Expanded(
                  flex: 3,
                  child: PosCartPanel(
                    warehouseId: _selectedWarehouseId,
                    warehouseName: _selectedWarehouseName,
                    onPickWarehouse: _pickWarehouse,
                    onPickCustomer: _pickCustomer,
                    cashController: _cashController,
                    cardController: _cardController,
                    qrController: _qrController,
                    paymentFocus: _paymentFocus,
                    isCompleting: _isCompleting,
                    onComplete: _completeSale,
                    onHold: _holdSale,
                    onResumeHeld: _resumeHeld,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Amount prompt dialog. Owns its [TextEditingController] so the controller
/// outlives the dialog's closing animation (a controller disposed right after
/// `showDialog` completes crashes the exiting TextField).
class _AmountPromptDialog extends StatefulWidget {
  const _AmountPromptDialog({
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.hint,
    this.allowEmpty = false,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final String hint;
  final bool allowEmpty;

  @override
  State<_AmountPromptDialog> createState() => _AmountPromptDialogState();
}

class _AmountPromptDialogState extends State<_AmountPromptDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (!mounted) return; // guard against Enter + tap double-pop
    final text = _controller.text.trim();
    if (widget.allowEmpty && text.isEmpty) {
      Navigator.of(context).pop(-1.0); // sentinel: use calculated
      return;
    }
    final value = double.tryParse(text);
    if (value != null) {
      Navigator.of(context).pop(value);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.message, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('pos_prompt_field'),
            controller: _controller,
            autofocus: true,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: widget.hint,
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            onSubmitted: (_) => _submit(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}
