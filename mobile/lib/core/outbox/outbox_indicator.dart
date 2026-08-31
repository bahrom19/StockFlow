import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_scheduler.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';

/// Compact outbox bar above the routed content (Offline 1B-min).
///
/// Visible whenever offline operations are queued — sales as well as cash,
/// inventory and purchasing mutations — as "N pending changes" plus, for
/// FAILED_PERMANENT entries, an error entry point with per-entry Retry /
/// Discard. "Send now" runs one worker burst immediately. Watching
/// [outboxInitProvider] also hydrates the persisted queue once on cold start.
class OutboxIndicatorScope extends ConsumerWidget {
  const OutboxIndicatorScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Fire-and-forget hydrate of the persisted queue (restart survival).
    ref.watch(outboxInitProvider);
    // Arms the F5-C retry scheduler for the whole app: one initial flush of
    // the hydrated backlog plus automatic backoff retries (fire-and-forget,
    // no UI impact).
    ref.watch(outboxSchedulerProvider);
    final state = ref.watch(outboxControllerProvider);
    if (state.isEmpty) return child;

    final l10n = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final pending = state.pendingCount + state.sendingCount;
    final failed = state.failedCount;
    final label = failed > 0
        ? '${l10n.outboxPendingItems(pending)}  •  ${l10n.outboxFailedItems(failed)}'
        : l10n.outboxPendingItems(pending);

    return Column(
      children: [
        Material(
          color: theme.colorScheme.secondaryContainer,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Row(
                children: [
                  Icon(
                    Icons.cloud_upload_outlined,
                    size: 18,
                    color: theme.colorScheme.onSecondaryContainer,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSecondaryContainer,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.read(outboxSyncProvider).syncAll(),
                    child: Text(l10n.outboxSyncNow),
                  ),
                  if (failed > 0)
                    IconButton(
                      tooltip: l10n.outboxFailedTitle,
                      icon: const Icon(Icons.error_outline, size: 20),
                      onPressed: () => _showFailedDialog(context, ref, l10n),
                    ),
                ],
              ),
            ),
          ),
        ),
        Expanded(child: child),
      ],
    );
  }

  /// User-facing title of a failed entry: the sale number for sales, a
  /// localized kind label for every other kind. The raw clientOperationId
  /// (UUID) stays only as a last-resort technical fallback for a sale whose
  /// payload has no saleNumber.
  static String _failedItemTitle(OutboxOperation op, AppLocalizations l10n) {
    switch (op.kind) {
      case OutboxOperationKind.createSale:
        return '${op.payload['saleNumber'] ?? op.clientOperationId}';
      case OutboxOperationKind.cashIn:
        return l10n.outboxKindCashIn;
      case OutboxOperationKind.cashOut:
        return l10n.outboxKindCashOut;
      case OutboxOperationKind.adjustStock:
        return l10n.outboxKindAdjustStock;
      case OutboxOperationKind.transferStock:
        return l10n.outboxKindTransferStock;
      case OutboxOperationKind.goodsReceipt:
        return l10n.outboxKindGoodsReceipt;
    }
  }

  void _showFailedDialog(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        // Reactive: the open dialog follows the live queue, so a Retry or
        // Discard performed inside it removes the entry immediately (no
        // reopen needed). A repeated tap on an already-resolved entry is a
        // safe controller no-op.
        return Consumer(
          builder: (context, dialogRef, _) {
            final ops = dialogRef
                .watch(outboxControllerProvider)
                .operations
                .where((o) => o.status == OutboxStatus.failedPermanent)
                .toList(growable: false);
            return AlertDialog(
              title: Text(l10n.outboxFailedTitle),
              content: SizedBox(
                width: 460,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: ops.length,
                  itemBuilder: (_, index) {
                    final op = ops[index];
                    return ListTile(
                      dense: true,
                      title: Text(
                        _failedItemTitle(op, l10n),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: op.lastError == null
                          ? null
                          : Text(
                              op.lastError!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: l10n.retry,
                            icon: const Icon(Icons.refresh),
                            onPressed: () async {
                              final controller = dialogRef.read(
                                outboxControllerProvider.notifier,
                              );
                              await controller.retryFailed(
                                op.clientOperationId,
                              );
                              await dialogRef
                                  .read(outboxSyncProvider)
                                  .syncAll();
                            },
                          ),
                          IconButton(
                            tooltip: l10n.outboxDiscard,
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () async {
                              final controller = dialogRef.read(
                                outboxControllerProvider.notifier,
                              );
                              await controller.discard(op.clientOperationId);
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: Text(l10n.goBack),
                ),
              ],
            );
          },
        );
      },
    );
  }
}