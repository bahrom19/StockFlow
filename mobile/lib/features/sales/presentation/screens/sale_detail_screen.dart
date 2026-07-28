import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/data/repositories/sales_repository.dart';
import 'package:stockflow/features/sales/presentation/widgets/sales_widgets.dart';

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
              tooltip: 'Refund',
              onPressed: () => _confirmAction('Refund', 'REFUNDED'),
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
                    subtitle: Text('\$${price.toStringAsFixed(2)} × $qty'),
                    trailing: Text('\$${itemTotal.toStringAsFixed(2)}',
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
                      trailing: Text('\$${pAmount.toStringAsFixed(2)}',
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
                          onPressed: () => context.push('/sales/receipt/${r.id}'),
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
            '\$${amount.toStringAsFixed(2)}',
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
