import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';

/// POS cart panel — the cashier's checkout column (~30% width).
///
/// Holds the cart items (quantity controls, discounts, remove), the totals
/// and the payment section (cash / card / mixed) with the Complete button.
/// The whole body below the header scrolls as one unit so the panel never
/// overflows, even on short windows.
class PosCartPanel extends ConsumerStatefulWidget {
  final String? warehouseId;
  final String warehouseName;
  final VoidCallback onPickWarehouse;
  final VoidCallback onPickCustomer;
  final TextEditingController cashController;
  final TextEditingController cardController;
  final TextEditingController qrController;
  final FocusNode paymentFocus;
  final bool isCompleting;
  final Future<void> Function() onComplete;
  final VoidCallback? onHold;
  final VoidCallback? onResumeHeld;

  const PosCartPanel({
    super.key,
    required this.warehouseId,
    required this.warehouseName,
    required this.onPickWarehouse,
    required this.onPickCustomer,
    required this.cashController,
    required this.cardController,
    required this.qrController,
    required this.paymentFocus,
    required this.isCompleting,
    required this.onComplete,
    this.onHold,
    this.onResumeHeld,
  });

  @override
  ConsumerState<PosCartPanel> createState() => _PosCartPanelState();
}

class _PosCartPanelState extends ConsumerState<PosCartPanel> {
  double get _cash => double.tryParse(widget.cashController.text) ?? 0;
  double get _card => double.tryParse(widget.cardController.text) ?? 0;
  double get _qr => double.tryParse(widget.qrController.text) ?? 0;
  double get _totalPaid => _cash + _card + _qr;

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final total = cart.total;
    final change = _totalPaid - total;
    final isAmountValid = _totalPaid >= total - 0.005;
    final canComplete = cart.items.isNotEmpty &&
        widget.warehouseId != null &&
        isAmountValid &&
        !widget.isCompleting;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Header ───────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.xs,
          ),
          child: Row(
            children: [
              Icon(
                Icons.shopping_cart_outlined,
                size: 18,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: AppSpacing.xs),
              // Label-less semantics boundary: cart header text stays its own
              // innerText leaf; the Clear CTA remains a separate sibling.
              Semantics(
                container: true,
                child: Text(
                  'Cart (${cart.itemCount} items)',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              if (cart.items.isNotEmpty)
                TextButton.icon(
                  onPressed: () => _confirmClearCart(),
                  icon: const Icon(Icons.delete_sweep_outlined, size: 16),
                  label: const Text('Clear'),
                ),
            ],
          ),
        ),
        // ── Body: items + totals + payment (single scroll) ──
        Expanded(
          child: cart.items.isEmpty
              ? _EmptyCart(theme: theme)
              : SingleChildScrollView(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Cart items
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                        ),
                        child: Column(
                          children: [
                            for (final item in cart.items)
                              _CartItemCard(
                                item: item,
                                onQuantityChanged: (qty) => ref
                                    .read(cartProvider.notifier)
                                    .updateQuantity(item.productId, qty),
                                onDiscountChanged: (disc) => ref
                                    .read(cartProvider.notifier)
                                    .updateDiscount(item.productId, disc),
                                onRemove: () => ref
                                    .read(cartProvider.notifier)
                                    .removeItem(item.productId),
                              ),
                          ],
                        ),
                      ),
                      // ── Totals ───────────────────
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                        ),
                        child: Column(
                          children: [
                            _totalRow('Subtotal', cart.subtotal),
                            if (cart.totalDiscount > 0)
                              _totalRow('Discount', -cart.totalDiscount,
                                  color: const Color(0xFFFB8C00)),
                            _totalRow('Tax', cart.tax),
                            const Divider(height: AppSpacing.sm),
                            _totalRow('Total', total, bold: true, large: true),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      // ── Payment ──────────────────
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Semantics(
                              container: true,
                              child: Row(
                                children: [
                                  Icon(Icons.payments_outlined,
                                      size: 18,
                                      color: theme.colorScheme.primary),
                                  const SizedBox(width: AppSpacing.xs),
                                  Text(
                                    'Payment',
                                    style:
                                        theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    'F8',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                      color: theme.colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            // Customer picker
                            _customerButton(theme, cart),
                            const SizedBox(height: AppSpacing.sm),
                            // Warehouse picker
                            _warehouseButton(theme),
                            const SizedBox(height: AppSpacing.sm),
                            // Split payment inputs (cash / card / QR = mixed)
                            _amountField(
                              'Cash',
                              widget.cashController,
                              Icons.money,
                              fieldKey: const Key('pos_cash_field'),
                              focusNode: widget.paymentFocus,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            _amountField(
                              'Card',
                              widget.cardController,
                              Icons.credit_card,
                              fieldKey: const Key('pos_card_field'),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            _amountField(
                              'QR / Other',
                              widget.qrController,
                              Icons.qr_code,
                              fieldKey: const Key('pos_qr_field'),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            // Change indicator
                            Semantics(
                              container: true,
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Paid',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                  Text(
                                    Formatters.currency(_totalPaid),
                                    style:
                                        theme.textTheme.bodySmall?.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: isAmountValid
                                          ? const Color(0xFF0F9D58)
                                          : theme.colorScheme.error,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (_totalPaid > 0) ...[
                              const SizedBox(height: AppSpacing.xxs),
                              Semantics(
                                container: true,
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Change',
                                        style: theme.textTheme.bodySmall),
                                    Text(
                                      Formatters.currency(change),
                                      style: theme.textTheme.bodySmall?.copyWith(
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFFFB8C00),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            // Hold / resume actions
                            if (widget.onHold != null ||
                                widget.onResumeHeld != null) ...[
                              Row(
                                children: [
                                  if (widget.onHold != null)
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        key: const Key('pos_hold_button'),
                                        onPressed: cart.items.isEmpty
                                            ? null
                                            : widget.onHold,
                                        icon: const Icon(Icons.pause,
                                            size: 16),
                                        label: const Text('Hold (F6)'),
                                      ),
                                    ),
                                  if (widget.onHold != null &&
                                      widget.onResumeHeld != null)
                                    const SizedBox(width: AppSpacing.sm),
                                  if (widget.onResumeHeld != null)
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        onPressed: widget.onResumeHeld,
                                        icon: const Icon(Icons.play_arrow,
                                            size: 16),
                                        label: const Text('Resume (Ctrl+H)'),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                            const SizedBox(height: AppSpacing.md),
                            // Complete button
                            FilledButton.icon(
                              key: const Key('pos_complete_button'),
                              onPressed:
                                  canComplete ? () => widget.onComplete() : null,
                              style: FilledButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    vertical: 16),
                                backgroundColor: const Color(0xFF0F9D58),
                              ),
                              icon: widget.isCompleting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(Icons.check_circle, size: 20),
                              label: Text(
                                widget.isCompleting
                                    ? 'Completing…'
                                    : isAmountValid
                                        ? 'Complete Sale — '
                                            '${Formatters.currency(total)}'
                                        : 'Insufficient payment',
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Semantics(
                              container: true,
                              child: Text(
                                'F9 to complete · F8 to payment · F4 customer',
                                textAlign: TextAlign.center,
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  ),
                ),
        ),
      ],
    );
  }

  Widget _customerButton(ThemeData theme, CartState cart) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            key: const Key('pos_customer_button'),
            onPressed: widget.onPickCustomer,
            icon: const Icon(Icons.person_outline, size: 18),
            label: Text(
              cart.customerName ?? 'Walk-in customer (F4)',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
        if (cart.customerId != null)
          IconButton(
            tooltip: 'Remove customer',
            icon: const Icon(Icons.close, size: 16),
            visualDensity: VisualDensity.compact,
            onPressed: () =>
                ref.read(cartProvider.notifier).setCustomer(null, null),
          ),
      ],
    );
  }

  Widget _warehouseButton(ThemeData theme) {
    return OutlinedButton.icon(
      onPressed: widget.onPickWarehouse,
      icon: const Icon(Icons.warehouse_outlined, size: 18),
      label: Text(
        widget.warehouseId == null
            ? 'Select warehouse…'
            : widget.warehouseName,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
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
    }
  }

  Widget _amountField(
    String label,
    TextEditingController controller,
    IconData icon, {
    Key? fieldKey,
    FocusNode? focusNode,
  }) {
    return TextField(
      key: fieldKey,
      controller: controller,
      focusNode: focusNode,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 18),
        isDense: true,
        filled: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
          borderSide: BorderSide.none,
        ),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      onChanged: (_) => setState(() {}),
      onSubmitted: (_) => setState(() {}),
    );
  }

  Widget _totalRow(
    String label,
    double amount, {
    bool bold = false,
    bool large = false,
    Color? color,
  }) {
    final theme = Theme.of(context);
    final base = large ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      // Label-less semantics boundary: label + amount stay one innerText leaf
      // instead of being merged into the workspace group's aria-label.
      child: Semantics(
        container: true,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: base?.copyWith(
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
            Text(
              Formatters.currency(amount),
              style: base?.copyWith(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// Empty cart
// ──────────────────────────────────
class _EmptyCart extends StatelessWidget {
  final ThemeData theme;
  const _EmptyCart({required this.theme});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.add_shopping_cart_outlined,
              size: 56, color: theme.colorScheme.outline),
          const SizedBox(height: AppSpacing.sm),
          Text('Cart is empty', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            'Search products on the left, then press Enter',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────
// Cart item card
// ──────────────────────────────────
class _CartItemCard extends StatelessWidget {
  final CartItem item;
  final ValueChanged<int> onQuantityChanged;
  final ValueChanged<double> onDiscountChanged;
  final VoidCallback onRemove;

  const _CartItemCard({
    required this.item,
    required this.onQuantityChanged,
    required this.onDiscountChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.productName,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 16),
                  onPressed: onRemove,
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Remove',
                ),
              ],
            ),
            if (item.productSku.isNotEmpty)
              Text(
                item.productSku,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                Text(
                  '${Formatters.currency(item.unitPrice)} × ',
                  style: theme.textTheme.bodySmall,
                ),
                // Quantity stepper
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline, size: 18),
                  onPressed: item.quantity > 1
                      ? () => onQuantityChanged(item.quantity - 1)
                      : null,
                  visualDensity: VisualDensity.compact,
                ),
                SizedBox(
                  width: 34,
                  child: TextField(
                    textAlign: TextAlign.center,
                    controller: TextEditingController(
                      text: '${item.quantity}',
                    ),
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(isDense: true),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    onSubmitted: (v) {
                      final qty = int.tryParse(v);
                      if (qty != null && qty > 0) onQuantityChanged(qty);
                    },
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, size: 18),
                  onPressed: () => onQuantityChanged(item.quantity + 1),
                  visualDensity: VisualDensity.compact,
                ),
                const Spacer(),
                Text(
                  Formatters.currency(item.total),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            // Discount
            Row(
              children: [
                Text(
                  'Discount',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                SizedBox(
                  width: 90,
                  child: TextField(
                    controller: TextEditingController(
                      text: item.discount > 0 ? '${item.discount}' : '',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(isDense: true),
                    style: theme.textTheme.bodySmall,
                    onSubmitted: (v) {
                      final d = double.tryParse(v) ?? 0;
                      onDiscountChanged(d.clamp(0, item.subtotal));
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
