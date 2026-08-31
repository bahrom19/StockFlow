import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/core/outbox/outbox_scheduler.dart';
import 'package:stockflow/core/outbox/outbox_sync_service.dart';

/// Compact outbox bar above the routed content (Offline 1B-min).
///
/// Visible whenever offline sales are queued: "N pending sales" plus, for
/// FAILED_PERMANENT entries, an error entry point with per-sale Retry /
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
        ? '${l10n.outboxPendingSales(pending)}  •  ${l10n.outboxFailedSales(failed)}'
        : l10n.outboxPendingSales(pending);

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

  void _showFailedDialog(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
  ) {
    final ops = ref
        .read(outboxControllerProvider)
        .operations
        .where((o) => o.status == OutboxStatus.failedPermanent)
        .toList(growable: false);
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(l10n.outboxFailedTitle),
          content: SizedBox(
            width: 460,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: ops.length,
              itemBuilder: (_, index) {
                final op = ops[index];
                final number =
                    '${op.payload['saleNumber'] ?? op.clientOperationId}';
                return ListTile(
                  dense: true,
                  title: Text(
                    number,
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
                          final controller = ref.read(
                            outboxControllerProvider.notifier,
                          );
                          await controller.retryFailed(op.clientOperationId);
                          await ref.read(outboxSyncProvider).syncAll();
                        },
                      ),
                      IconButton(
                        tooltip: l10n.outboxDiscard,
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () async {
                          final controller = ref.read(
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
  }
}