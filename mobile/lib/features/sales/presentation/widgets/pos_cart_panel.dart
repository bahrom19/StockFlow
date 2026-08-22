import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/currency/money.dart';

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
  Money _paid(String text, String currency) =>
      Money.tryParse(text, currency) ?? Money.zero(currency);

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final currency = cart.currency;
    final total = cart.total;
    final cash = _paid(widget.cashController.text, currency);
    final card = _paid(widget.cardController.text, currency);
    final qr = _paid(widget.qrController.text, currency);
    final totalPaid = cash + card + qr;
    final change = totalPaid - total;
    // Exact comparison — no epsilon tolerance in money equality.
    final isAmountValid = totalPaid >= total;
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
              // Expanded keeps long item counts from pushing the Clear CTA
              // out of the panel on narrow windows.
              Expanded(
                child: Semantics(
                  container: true,
                  child: Text(
                    context.l10n.posCartItemsCount(cart.itemCount),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              if (cart.items.isNotEmpty)
                TextButton.icon(
                  onPressed: () => _confirmClearCart(),
                  icon: const Icon(Icons.delete_sweep_outlined, size: 16),
                  label: Text(context.l10n.posClear),
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
                            _totalRow(context.l10n.posSubtotal, cart.subtotal),
                            if (cart.totalDiscount.isPositive)
                              _totalRow(
                                context.l10n.posDiscount,
                                cart.totalDiscount.negate,
                                color: const Color(0xFFFB8C00),
                              ),
                            _totalRow(context.l10n.posTax, cart.tax),
                            const Divider(height: AppSpacing.sm),
                            _totalRow(context.l10n.posTotal, total,
                                bold: true, large: true),
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
                                    context.l10n.posPayment,
                                    style: theme.textTheme.titleSmall?.copyWith(
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
                              context.l10n.posCash,
                              widget.cashController,
                              Icons.money,
                              fieldKey: const Key('pos_cash_field'),
                              focusNode: widget.paymentFocus,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            _amountField(
                              context.l10n.posCard,
                              widget.cardController,
                              Icons.credit_card,
                              fieldKey: const Key('pos_card_field'),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            _amountField(
                              context.l10n.posQrOther,
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
                                    context.l10n.posPaid,
                                    style: theme.textTheme.bodySmall,
                                  ),
                                  Text(
                                    context.money(totalPaid),
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: isAmountValid
                                          ? const Color(0xFF0F9D58)
                                          : theme.colorScheme.error,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (totalPaid.isPositive) ...[
                              const SizedBox(height: AppSpacing.xxs),
                              Semantics(
                                container: true,
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(context.l10n.posChange,
                                        style: theme.textTheme.bodySmall),
                                    Text(
                                      context.money(change),
                                      style:
                                          theme.textTheme.bodySmall?.copyWith(
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
                                        icon: const Icon(Icons.pause, size: 16),
                                        label: Text(context.l10n.posHold),
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
                                        label: Text(context.l10n.posResume),
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
                              onPressed: canComplete
                                  ? () => widget.onComplete()
                                  : null,
                              style: FilledButton.styleFrom(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
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
                                    ? context.l10n.posCompleting
                                    : isAmountValid
                                        ? context.l10n.posCompleteSale(
                                            context.money(total))
                                        : context.l10n.posInsufficientPayment,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Semantics(
                              container: true,
                              child: Text(
                                context.l10n.posCartFooterHints,
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
              cart.customerName ?? context.l10n.posWalkInCustomerF4,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
        if (cart.customerId != null)
          IconButton(
            tooltip: context.l10n.posRemoveCustomer,
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
            ? context.l10n.posSelectWarehouse
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
        icon: const Icon(Icons.delete_sweep_outlined, color: Color(0xFFD93025)),
        title: Text(context.l10n.posClearCartTitle),
        content: Text(
          context.l10n.posClearCartConfirm(
            context.money(cart.total),
            cart.itemCount,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(context.l10n.cancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD93025),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(context.l10n.posClearCartButton),
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
    dynamic amount, {
    bool bold = false,
    bool large = false,
    Color? color,
  }) {
    final theme = Theme.of(context);
    final base =
        large ? theme.textTheme.titleMedium : theme.textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      // Label-less semantics boundary: label + amount stay one innerText leaf
      // instead of being merged into the workspace group's aria-label.
      child: Semantics(
        container: true,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Expanded keeps the row overflow-proof at any panel width: the
            // label yields (ellipsis) while the amount is always fully shown.
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: base?.copyWith(
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                  color: color,
                ),
              ),
            ),
            Text(
              context.money(amount),
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
          Text(context.l10n.posCartEmpty, style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            context.l10n.posCartEmptyHint,
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
  final ValueChanged<Money> onDiscountChanged;
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
                  tooltip: context.l10n.posRemove,
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
            // Same compact single row as before (unit price × stepper × line
            // total) — identical card height; Flexible/Expanded let the texts
            // yield gracefully instead of overflowing on narrow terminals.
            Row(
              children: [
                Flexible(
                  child: Text(
                    '${context.money(item.unitPrice)} × ',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
                // Quantity stepper
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline, size: 18),
                  onPressed: item.quantity > 1
                      ? () => onQuantityChanged(item.quantity - 1)
                      : null,
                  visualDensity: VisualDensity.compact,
                ),
                // Adaptive width: hugs its digits so 1–2 digit quantities keep
                // the original 34px footprint while 3-digit values ("100",
                // "999") stay fully visible; maxWidth caps hand-typed numbers.
                ConstrainedBox(
                  constraints: const BoxConstraints(
                    minWidth: 34,
                    maxWidth: 64,
                  ),
                  child: IntrinsicWidth(
                    child: TextField(
                      key: const Key('pos_qty_field'),
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
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, size: 18),
                  onPressed: () => onQuantityChanged(item.quantity + 1),
                  visualDensity: VisualDensity.compact,
                ),
                Expanded(
                  child: Text(
                    context.money(item.total),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            // Discount
            Row(
              children: [
                Text(
                  context.l10n.posDiscount,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                // Flexible instead of a hard width: the field keeps its 90px
                // footprint when there is room and shrinks gracefully on
                // narrow cards instead of overflowing the row.
                Flexible(
                  child: SizedBox(
                    width: 90,
                    child: TextField(
                      controller: TextEditingController(
                        text: item.effectiveDiscount.isPositive
                            ? '${item.effectiveDiscount}'
                            : '',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(isDense: true),
                      style: theme.textTheme.bodySmall,
                      onSubmitted: (v) {
                        final parsed =
                            Money.tryParse(v, item.unitPrice.currency);
                        if (parsed == null) return;
                        onDiscountChanged(parsed.clamp(
                          Money.zero(item.unitPrice.currency),
                          item.subtotal,
                        ));
                      },
                    ),
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
