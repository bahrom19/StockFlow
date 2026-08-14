import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/presentation/widgets/sales_widgets.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

// ──────────────────────────────────
// Sale Detail Screen
// ──────────────────────────────────
class SaleDetailScreen extends ConsumerStatefulWidget {
  final String saleId;
  const SaleDetailScreen({super.key, required this.saleId});

  @override
  ConsumerState<SaleDetailScreen> createState() => _SaleDetailScreenState();
}

class _SaleDetailScreenState extends ConsumerState<SaleDetailScreen> {
  Sale? _sale;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSale();
  }

  Future<void> _loadSale() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final repo = ref.read(salesRepositoryProvider);
    final result = await repo.getById(widget.saleId);
    if (result is SalesSuccess<Sale>) {
      setState(() {
        _sale = result.data;
        _isLoading = false;
      });
    } else {
      setState(() {
        _error = (result as SalesFailure<Sale>).error.message;
        _isLoading = false;
      });
    }
  }

  Future<void> _transitionStatus(String status) async {
    final repo = ref.read(salesRepositoryProvider);
    final result = await repo.transitionStatus(widget.saleId, status);
    if (result is SalesSuccess<Sale>) {
      setState(() => _sale = result.data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sale ${status.toLowerCase()}d')),
        );
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text((result as SalesFailure<Sale>).error.message),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _confirmAction(String action, String status) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('$action Sale'),
        content: Text('Are you sure you want to $action this sale?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(action),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _transitionStatus(status);
    }
  }

  /// Partial return — lets the cashier pick which items (and how many) to
  /// return. The backend tracks PARTIALLY_REFUNDED status; inventory reversal
  /// for partial returns is a backend-level concern and is noted as such.
  Future<void> _partialReturn() async {
    final sale = _sale;
    if (sale == null || sale.items.isEmpty) return;

    final quantities = <String, int>{
      for (final item in sale.items) item.id: item.quantity,
    };
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => _PartialReturnDialog(
        sale: sale,
        quantities: quantities,
        onChanged: (itemId, qty) => quantities[itemId] = qty,
      ),
    );
    if (confirmed != true || !mounted) return;

    // Full return (all items back to full quantity) → use the refund API.
    final isFull = sale.items.every((i) => quantities[i.id] == i.quantity);
    if (isFull) {
      await _transitionStatus('REFUNDED');
      return;
    }
    // Partial → mark the sale as PARTIALLY_REFUNDED.
    final repo = ref.read(salesRepositoryProvider);
    final result = await repo.transitionStatus(widget.saleId, 'PARTIALLY_REFUNDED');
    if (result is SalesSuccess<Sale>) {
      setState(() => _sale = result.data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Partial return recorded')),
        );
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text((result as SalesFailure<Sale>).error.message),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sale Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sale Details')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline,
                  size: 64, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text(_error!, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 16),
              FilledButton.tonalIcon(
                onPressed: _loadSale,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final sale = _sale!;
    final total = double.tryParse(sale.total) ?? 0;
    final paid = double.tryParse(sale.paidAmount) ?? 0;
    final change = double.tryParse(sale.changeAmount) ?? 0;
    // Determine available actions based on status
    final canComplete = sale.status == 'DRAFT' || sale.status == 'PENDING';
    final canCancel =
        sale.status == 'DRAFT' || sale.status == 'PENDING';
    final canRefund = sale.status == 'COMPLETED';

    return Scaffold(
      appBar: AppBar(
        title: Text(sale.saleNumber),
        actions: [
          if (canComplete)
            IconButton(
              icon: const Icon(Icons.check_circle_outline),
              tooltip: 'Complete',
              onPressed: () => _confirmAction('Complete', 'COMPLETED'),
            ),
          if (canCancel)
            IconButton(
              icon: const Icon(Icons.cancel_outlined),
              tooltip: 'Cancel',
              onPressed: () => _confirmAction('Cancel', 'CANCELLED'),
            ),
          if (canRefund)
            IconButton(
              icon: const Icon(Icons.keyboard_return),
              tooltip: 'Full refund',
              onPressed: () => _confirmAction('Refund', 'REFUNDED'),
            ),
          if (canRefund)
            IconButton(
              icon: const Icon(Icons.currency_exchange),
              tooltip: 'Partial return',
              onPressed: _partialReturn,
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadSale,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status badge + sale number
              Row(
                children: [
                  StatusBadge(status: sale.status),
                  const SizedBox(width: 12),
                  Text(sale.saleNumber,
                      style: theme.textTheme.titleLarge),
                  const Spacer(),
                  Text(sale.currency,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Created: ${_formatDate(sale.createdAt)}',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
              const SizedBox(height: 16),

              // Totals card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _detailRow('Subtotal', double.tryParse(sale.subtotal) ?? 0,
                          theme),
                      if ((double.tryParse(sale.discount) ?? 0) > 0)
                        _detailRow(
                            'Discount', -(double.tryParse(sale.discount) ?? 0),
                            theme,
                            color: Colors.orange),
                      _detailRow('Tax', double.tryParse(sale.tax) ?? 0, theme),
                      const Divider(),
                      _detailRow('Total', total, theme, bold: true),
                      _detailRow('Paid', paid, theme,
                          color: Colors.green, bold: true),
                      if (change > 0)
                        _detailRow('Change', change, theme,
                            color: Colors.orange),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Items
              Text('Items (${sale.items.length})',
                  style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              ...sale.items.map((item) {
                final itemTotal = double.tryParse(item.total) ?? 0;
                final qty = item.quantity;
                final price = double.tryParse(item.unitPrice) ?? 0;
                return Card(
                  child: ListTile(
                    title: Text('Product ${item.productId.substring(0, 8)}',
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${context.money(price)} × $qty'),
                    trailing: Text(context.money(itemTotal),
                        style: theme.textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.bold)),
                  ),
                );
              }),
              const SizedBox(height: 16),

              // Payments
              if (sale.payments.isNotEmpty) ...[
                Text('Payments', style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                ...sale.payments.map((p) {
                  final pAmount = double.tryParse(p.amount) ?? 0;
                  return Card(
                    child: ListTile(
                      leading: Icon(_paymentIcon(p.method)),
                      title: Text(p.method),
                      subtitle: p.reference != null
                          ? Text(p.reference!, maxLines: 1)
                          : null,
                      trailing: Text(context.money(pAmount),
                          style: theme.textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.bold)),
                    ),
                  );
                }),
                const SizedBox(height: 16),
              ],

              // Receipts
              if (sale.receipts.isNotEmpty) ...[
                Text('Receipts', style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                ...sale.receipts.map((r) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.receipt),
                        title: Text(r.receiptNumber),
                        subtitle: Text(r.status),
                        trailing: TextButton(
                          onPressed: () => _showReceipt(context, r),
                          child: const Text('View'),
                        ),
                      ),
                    )),
              ],

              // Notes
              if (sale.notes != null && sale.notes!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Notes', style: theme.textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(sale.notes!, style: theme.textTheme.bodyMedium),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, double amount, ThemeData theme,
      {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: bold
                  ? theme.textTheme.titleSmall
                  : theme.textTheme.bodyMedium),
          Text(
            context.money(amount),
            style: (bold
                    ? theme.textTheme.titleSmall
                    : theme.textTheme.bodyMedium)
                ?.copyWith(
                    fontWeight: bold ? FontWeight.bold : null, color: color),
          ),
        ],
      ),
    );
  }

  void _showReceipt(BuildContext context, Receipt receipt) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(receipt.receiptNumber),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _dialogRow('Status', receipt.status),
            _dialogRow('Printed', receipt.printed ? 'Yes' : 'No'),
            _dialogRow('Emailed', receipt.emailed ? 'Yes' : 'No'),
            _dialogRow('Created', _formatDate(receipt.createdAt)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _dialogRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(value,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  IconData _paymentIcon(String method) {
    switch (method) {
      case 'CASH':
        return Icons.money;
      case 'CARD':
        return Icons.credit_card;
      case 'QR':
        return Icons.qr_code;
      case 'BANK_TRANSFER':
        return Icons.account_balance;
      default:
        return Icons.payment;
    }
  }

  String _formatDate(DateTime dt) {
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

// ──────────────────────────────────
// Partial Return Dialog
// ──────────────────────────────────
class _PartialReturnDialog extends StatefulWidget {
  final Sale sale;
  final Map<String, int> quantities;
  final void Function(String itemId, int qty) onChanged;

  const _PartialReturnDialog({
    required this.sale,
    required this.quantities,
    required this.onChanged,
  });

  @override
  State<_PartialReturnDialog> createState() => _PartialReturnDialogState();
}

class _PartialReturnDialogState extends State<_PartialReturnDialog> {
  late Map<String, int> _qty;

  @override
  void initState() {
    super.initState();
    _qty = Map.of(widget.quantities);
  }

  double get _refundTotal {
    var total = 0.0;
    for (final item in widget.sale.items) {
      final qty = _qty[item.id] ?? 0;
      if (qty > 0) {
        final unit = (double.tryParse(item.total) ?? 0) / item.quantity;
        total += unit * qty;
      }
    }
    return total;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      icon: const Icon(Icons.currency_exchange, size: 40),
      title: const Text('Partial Return'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select how many of each item to return.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final item in widget.sale.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.productId.length <= 16
                              ? item.productId
                              : item.productId.substring(0, 16),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                      Text('max ${item.quantity} · ',
                          style: theme.textTheme.labelSmall),
                      SizedBox(
                        width: 70,
                        child: TextField(
                          controller: TextEditingController(
                            text: '${_qty[item.id] ?? 0}',
                          ),
                          textAlign: TextAlign.center,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(isDense: true),
                          onChanged: (v) {
                            final maxQty = item.quantity;
                            final parsed = int.tryParse(v);
                            final qty = (parsed ?? 0).clamp(0, maxQty);
                            _qty[item.id] = qty;
                            widget.onChanged(item.id, qty);
                            setState(() {});
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              const Divider(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Refund total', style: theme.textTheme.titleSmall),
                  Text(
                    context.money(_refundTotal),
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _refundTotal <= 0
              ? null
              : () => Navigator.of(context).pop(true),
          child: const Text('Confirm return'),
        ),
      ],
    );
  }
}
