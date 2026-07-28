import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/purchasing/data/repositories/purchasing_repository.dart';
import 'package:stockflow/features/purchasing/presentation/widgets/purchasing_widgets.dart';

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
      setState(() { _error = (result as PurchasingFailure<PurchaseOrder>).error.message; _isLoading = false; });
    }
  }

  Future<void> _transitionStatus(String status) async {
    final repo = ref.read(purchasingRepositoryProvider);
    final result = await repo.transitionStatus(widget.orderId, status);
    if (result is PurchasingSuccess<PurchaseOrder>) {
      setState(() => _order = result.data);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Order ${status.toLowerCase()}d')));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text((result as PurchasingFailure<PurchaseOrder>).error.message), backgroundColor: Colors.red));
    }
  }

  Future<void> _confirmStatus(String action, String status) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('$action Order'),
        content: Text('Are you sure?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(action)),
        ],
      ),
    );
    if (confirmed == true) await _transitionStatus(status);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_isLoading) return Scaffold(appBar: AppBar(title: const Text('Purchase Order')), body: const Center(child: CircularProgressIndicator()));
    if (_error != null) return Scaffold(
      appBar: AppBar(title: const Text('Purchase Order')),
      body: Center(child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: theme.colorScheme.error),
          const SizedBox(height: 16), Text(_error!),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
        ],
      )),
    );

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
          if (canApprove) IconButton(icon: const Icon(Icons.check_circle_outline), tooltip: 'Approve', onPressed: () => _confirmStatus('Approve', 'APPROVED')),
          if (canOrder) IconButton(icon: const Icon(Icons.send), tooltip: 'Order', onPressed: () => _confirmStatus('Order', 'ORDERED')),
          if (canCancel) IconButton(icon: const Icon(Icons.cancel_outlined), tooltip: 'Cancel', onPressed: () => _confirmStatus('Cancel', 'CANCELLED')),
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
              Text('Order Date: ${order.orderDate.toString().substring(0, 10)}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline)),
              if (order.expectedDate != null) Text('Expected: ${order.expectedDate!.toString().substring(0, 10)}', style: theme.textTheme.bodySmall),
              if (order.approvedBy != null) Text('Approved by: ${order.approvedBy}', style: theme.textTheme.bodySmall),
              const SizedBox(height: 16),
              Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(
                children: [
                  _row('Subtotal', double.tryParse(order.subtotal) ?? 0, theme),
                  if ((double.tryParse(order.discountAmount) ?? 0) > 0) _row('Discount', -(double.tryParse(order.discountAmount) ?? 0), theme, color: Colors.orange),
                  _row('Tax', double.tryParse(order.taxAmount) ?? 0, theme),
                  const Divider(),
                  _row('Grand Total', total, theme, bold: true),
                ],
              ))),
              const SizedBox(height: 16),
              Text('Items (${order.items.length})', style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              ...order.items.map((item) {
                final itemTotal = double.tryParse(item.total) ?? 0;
                return Card(child: ListTile(
                  title: Text('Product ${item.productId.substring(0, 8)}', maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('Qty: ${item.quantity}  |  Received: ${item.receivedQuantity}'),
                  trailing: Text('\$${itemTotal.toStringAsFixed(2)}', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                ));
              }),
              if (order.notes != null && order.notes!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Notes', style: theme.textTheme.titleSmall),
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
                    label: const Text('Receive Goods'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, double amount, ThemeData theme, {bool bold = false, Color? color}) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium),
        Text('\$${amount.toStringAsFixed(2)}', style: (bold ? theme.textTheme.titleSmall : theme.textTheme.bodyMedium)?.copyWith(fontWeight: bold ? FontWeight.bold : null, color: color)),
      ],
    ));
  }
}
