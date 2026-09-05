import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/presentation/widgets/purchasing_widgets.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

class PurchaseOrderDetailScreen extends ConsumerStatefulWidget {
  final String orderId;
  const PurchaseOrderDetailScreen({super.key, required this.orderId});
  @override
  ConsumerState<PurchaseOrderDetailScreen> createState() => _PurchaseOrderDetailScreenState();
}

class _PurchaseOrderDetailScreenState extends ConsumerState<PurchaseOrderDetailScreen> {
  PurchaseOrder? _order;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _isLoading = true; _error = null; });
    final repo = ref.read(purchasingRepositoryProvider);
    final result = await repo.getOrderById(widget.orderId);
    if (result is PurchasingSuccess<PurchaseOrder>) {
      setState(() { _order = result.data; _isLoading = false; });
    } else {
      // Render-time localization: canonical ErrorHandler fallbacks get the
      // localized label (RU/KK); backend/freeform messages pass through.
      setState(() {
        _error = localizedErrorLabel(
          context.l10n,
          (result as PurchasingFailure<PurchaseOrder>).error.message,
        );
        _isLoading = false;
      });
    }
  }

  Future<void> _transitionStatus(String status) async {
    final repo = ref.read(purchasingRepositoryProvider);
    final result = await repo.transitionStatus(widget.orderId, status);
    if (result is PurchasingSuccess<PurchaseOrder>) {
      setState(() => _order = result.data);
      if (mounted) {
        // Localized success snackbar (fixes the old 'Order approvedd'
        // concatenation bug while keeping the EN message shape).
        final String msg = switch (status) {
          'APPROVED' => context.l10n.orderApproved,
          'ORDERED' => context.l10n.orderOrdered,
          'CANCELLED' => context.l10n.orderCancelled,
          _ => status.toLowerCase(),
        };
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } else if (mounted) {
      // Render-time localization: canonical ErrorHandler fallbacks get the
      // localized label (RU/KK); backend/freeform messages pass through.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localizedErrorLabel(
            context.l10n,
            (result as PurchasingFailure<PurchaseOrder>).error.message,
          )),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _confirmStatus(String action, String status) async {
    final l10n = context.l10n;
    final String title = switch (status) {
      'APPROVED' => l10n.approveOrderTitle,
      'ORDERED' => l10n.orderOrderTitle,
      'CANCELLED' => l10n.cancelOrderTitle,
      _ => action,
    };
    final String actionLabel = switch (status) {
      'APPROVED' => l10n.approve,
      'ORDERED' => l10n.placeOrder,
      'CANCELLED' => l10n.cancel,
      _ => action,
    };
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(l10n.areYouSure),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.cancel)),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(actionLabel)),
        ],
      ),
    );
    if (confirmed == true) await _transitionStatus(status);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text(context.l10n.purchaseOrder)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: Text(context.l10n.purchaseOrder)),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text(_error!),
              const SizedBox(height: 16),
              FilledButton.tonalIcon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: Text(context.l10n.retry),
              ),
            ],
          ),
        ),
      );
    }

    final order = _order!;
    final total = double.tryParse(order.grandTotal) ?? 0;
    final canApprove = order.status == 'DRAFT';
    final canOrder = order.status == 'APPROVED';
    final canReceive = order.status == 'ORDERED' || order.status == 'PARTIALLY_RECEIVED';
    final canCancel = order.status == 'DRAFT' || order.status == 'PENDING' || order.status == 'APPROVED' || order.status == 'ORDERED';

    return Scaffold(
      appBar: AppBar(
        title: Text(order.orderNumber),
        actions: [
          if (canApprove)
            IconButton(
              icon: const Icon(Icons.check_circle_outline),
              tooltip: context.l10n.approve,
              onPressed: () => _confirmStatus('Approve', 'APPROVED'),
            ),
          if (canOrder)
            IconButton(
              icon: const Icon(Icons.send),
              tooltip: context.l10n.placeOrder,
              onPressed: () => _confirmStatus('Order', 'ORDERED'),
            ),
          if (canCancel)
            IconButton(
              icon: const Icon(Icons.cancel_outlined),
              tooltip: context.l10n.cancel,
              onPressed: () => _confirmStatus('Cancel', 'CANCELLED'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                POStatusBadge(status: order.status),
                const SizedBox(width: 12),
                Text(order.orderNumber, style: theme.textTheme.titleLarge),
              ]),
              const SizedBox(height: 8),
              Text(
                context.l10n.orderDateLabel(
                    order.orderDate.toString().substring(0, 10)),
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
              if (order.expectedDate != null)
                Text(
                  context.l10n.expectedDateLabel(
                      order.expectedDate!.toString().substring(0, 10)),
                  style: theme.textTheme.bodySmall,
                ),
              if (order.approvedBy != null)
                Text(
                  context.l10n.approvedByLabel(order.approvedBy!),
                  style: theme.textTheme.bodySmall,
                ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _row(context.l10n.subtotal,
                          double.tryParse(order.subtotal) ?? 0, theme,
                          currency: order.currency),
                      if ((double.tryParse(order.discountAmount) ?? 0) > 0)
                        _row(context.l10n.discount,
                            -(double.tryParse(order.discountAmount) ?? 0),
                            theme,
                            color: Colors.orange,
                            currency: order.currency),
                      _row(context.l10n.tax,
                          double.tryParse(order.taxAmount) ?? 0, theme,
                          currency: order.currency),
                      const Divider(),
                      _row(context.l10n.grandTotal, total, theme,
                          bold: true, currency: order.currency),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(context.l10n.itemsCount(order.items.length),
                  style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              ...order.items.map((item) {
                final itemTotal = double.tryParse(item.total) ?? 0;
                return Card(
                  child: ListTile(
                    title: Text(
                      context.l10n.productIdLabel(
                          item.productId.substring(0, 8)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(context.l10n.qtyReceivedLabel(
                        item.quantity, item.receivedQuantity)),
                    trailing: Text(
                      CurrencyCatalog.format(itemTotal, code: order.currency),
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                );
              }),
              if (order.notes != null && order.notes!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(context.l10n.notes, style: theme.textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(order.notes!, style: theme.textTheme.bodyMedium),
              ],
              const SizedBox(height: 24),
              if (canReceive)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {}, // Goods receipt dialog
                    icon: const Icon(Icons.inventory),
                    label: Text(context.l10n.receiveGoods),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, double amount, ThemeData theme,
      {bool bold = false, Color? color, String currency = 'KZT'}) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium),
        Text(CurrencyCatalog.format(amount, code: currency), style: (bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium)?.copyWith(fontWeight: bold ? FontWeight.bold : null, color: color)),
      ],
    ));
  }
}
